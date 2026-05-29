from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


def _student_contract_monthly(student, group):
    """
    O'quvchi uchun oylik shartnoma narxi (kelishilgan/custom_fee yoki guruh narxi).
    Davomat jarimasining kunlik asosini shu qiymatdan olamiz — har doim guruh.monthly_price emas.
    """
    cf = getattr(student, 'custom_fee', None)
    if cf is not None:
        return Decimal(str(cf))
    return Decimal(str(group.monthly_price or 0))


class EmployeePayment(models.Model):
    """Xodimlar (mentor va admin) uchun oylik maosh to'lovlari"""
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='salary_payments',
        limit_choices_to={'role__in': ['mentor', 'admin']}
    )
    
    month = models.DateField(verbose_name="Oy")
    
    salary_base = models.DecimalField(
        max_digits=20, 
        decimal_places=2, 
        verbose_name="Asosiy maosh"
    )
    bonus = models.DecimalField(
        max_digits=20, 
        decimal_places=2, 
        default=0, 
        verbose_name="Bonus"
    )
    deductions = models.DecimalField(
        max_digits=20, 
        decimal_places=2, 
        default=0, 
        verbose_name="Ayirmalar"
    )
    
    attendance_deductions = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Davomat bo'yicha ayirmalar",
        help_text="Har bir o'quvchi uchun davomat sababli qirqilgan summa tafsilotlari"
    )
    
    @property
    def total_advances(self) -> Decimal:
        """
        Ushbu oy uchun berilgan avanslar + o'tgan to'langan oylardan 
        'kech' qolib o'tib kelgan avanslar yig'indisi.
        """
        from finance.models import EmployeeAdvance
        from django.db.models import Sum
        
        # 1. Shu oyga tegishli avanslar
        qs = EmployeeAdvance.objects.filter(employee=self.employee, month=self.month)
        
        if self.is_paid and self.paid_at:
            # Snapshot: To'langan vaqtgacha bo'lgan avanslar
            return qs.filter(created_at__lte=self.paid_at).aggregate(total=Sum('amount'))['total'] or 0

        # TO'LANMAGAN OY UCHUN:
        total = qs.aggregate(total=Sum('amount'))['total'] or 0
        
        # Carry-over: O'tgan to'langan oylardan kech qolgan avanslarni yig'amiz
        last_paid = EmployeePayment.objects.filter(
            employee=self.employee, 
            month__lt=self.month,
            is_paid=True
        ).order_by('-month').first()
        
        if last_paid:
            # Eng oxirgi to'langan oydan keyin yaratilgan barcha 'eskirgan' avanslar
            late_advances = EmployeeAdvance.objects.filter(
                employee=self.employee,
                month__lt=self.month,
                created_at__gt=last_paid.paid_at
            ).aggregate(total=Sum('amount'))['total'] or 0
            total += late_advances
        else:
            # Agar hali birorta ham oy to'lanmagan bo'lsa, barcha o'tgan oylardagi avanslar shu oyga o'tadi
            late_advances = EmployeeAdvance.objects.filter(
                employee=self.employee,
                month__lt=self.month
            ).aggregate(total=Sum('amount'))['total'] or 0
            total += late_advances
            
        return total

    @property
    def total_amount(self) -> Decimal:
        """Jami to'lov miqdori (floor)"""
        from finance.utils import floor_amount
        salary = Decimal(str(self.salary_base)) if self.salary_base else Decimal('0')
        bonus = Decimal(str(self.bonus)) if self.bonus else Decimal('0')
        deductions = Decimal(str(self.deductions)) if self.deductions else Decimal('0')
        total_advances = Decimal(str(self.total_advances))
        
        return floor_amount(salary + bonus - deductions - total_advances)
    
    is_paid = models.BooleanField(default=False, verbose_name="To'landi")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="To'langan vaqt")
    
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, 
        blank=True,
        related_name='marked_employee_payments',
        limit_choices_to={'role': 'super_admin'},
        verbose_name="Kim tomonidan tasdiqlandi"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")

    class Meta:
        unique_together = ('employee', 'month')
        ordering = ['-month']
        verbose_name = "Xodim maoshi"
        verbose_name_plural = "Xodimlar maoshlari"

    def __str__(self):
        return f"{self.employee.get_full_name() or self.employee.username} - {self.month.strftime('%B %Y')}"

    def mark_as_paid(self, super_admin_user):
        """To'lovni tasdiqlashda summani qulflash (snapshot)"""
        from django.db import transaction
        with transaction.atomic():
            if not self.is_paid:
                # To'lanayotgan paytda oxirgi marta qayta hisoblab olish (ixtiyoriy, lekin aniqlik uchun yaxshi)
                try:
                    if hasattr(self.employee, 'staff_profile'):
                        st = self.employee.staff_profile.salary_type
                        # Foiz — mentor va admin; o'quvchi soni — faqat mentor guruhlari bilan
                        if st == 'percentage' or (
                            st == 'student_count' and self.employee.role == 'mentor'
                        ):
                            self.recalculate_salary()
                except Exception as e:
                    # Agar qayta hisoblashda xatolik bo'lsa, davom etamiz
                    print(f"Recalculate error: {e}")
                
                self.is_paid = True
                self.paid_at = timezone.now()
                self.marked_by = super_admin_user
                self.save()
                
                # ✅ Centralized Finance Ledger ga yozish
                try:
                    # Branch mavjudligini tekshirish
                    if not self.employee.branch:
                        print(f"Warning: Employee {self.employee.id} has no branch assigned")
                        return  # Transaction yaratmasdan chiqamiz
                    
                    from finance.models import FinanceTransaction
                    FinanceTransaction.objects.get_or_create(
                        related_id=f"EMP-{self.id}",
                        defaults={
                            'transaction_type': 'expense',
                            'category': 'salary',
                            'amount': self.total_amount,
                            'date': self.paid_at.date(),
                            'marked_by': super_admin_user,
                            'branch': self.employee.branch,
                            'title': f"Maosh: {self.employee.get_full_name() or self.employee.username}",
                            'description': f"{self.month.strftime('%Y-%m')} oyi uchun xizmat haqi",
                        }
                    )
                except Exception as e:
                    # Transaction yaratishda xatolik bo'lsa, log qilamiz
                    print(f"FinanceTransaction creation error: {e}")
                    import traceback
                    traceback.print_exc()

    def recalculate_salary(self):
        """Maoshni StaffProfile bo'yicha qayta hisoblash"""
        if self.is_paid:
            return self.salary_base # To'langan maoshni o'zgartirib bo'lmaydi
        
        try:
            profile = self.employee.staff_profile
            # calculate_salary_for_month metodidan foydalanamiz
            calculated_salary = profile.calculate_salary_for_month(self.month)
            # ✅ Decimal ga o'girish
            self.salary_base = Decimal(str(calculated_salary))
            # Davomat ayirmalarini tozalash (endi bu logika yo'q)
            self.attendance_deductions = {}
            return self.salary_base
        except Exception as e:
            print(f"Recalculate salary error: {e}")
            import traceback
            traceback.print_exc()
            return self.salary_base
        
    def save(self, *args, **kwargs):
        # Month normalizatsiyasi
        if self.month:
            from finance.utils import normalize_month
            self.month = normalize_month(self.month)
        
        # ✅ Validatsiya: Xodimning staff_profile mavjudligini tekshirish
        if self.employee and not hasattr(self.employee, 'staff_profile'):
            from django.core.exceptions import ValidationError
            raise ValidationError(
                f"Xodim {self.employee.get_full_name() or self.employee.username} uchun StaffProfile yaratilmagan. "
                f"Avval /finance/staff-profiles/ orqali profil yarating."
            )
        
        super().save(*args, **kwargs)

class StaffProfile(models.Model):
    """Xodimlar (mentor va admin) uchun doimiy ma'lumotlar"""
    
    SALARY_TYPE_CHOICES = [
        ('fixed', 'Belgilangan oylik (so\'m)'),
        ('percentage', 'Foiz asosida (%)'),
        ('student_count', 'O\'quvchilar soni bo\'yicha (so\'m/o\'quvchi)'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='staff_profile',
        limit_choices_to={'role__in': ['mentor', 'admin']}
    )
    
    salary_type = models.CharField(
        max_length=20,
        choices=SALARY_TYPE_CHOICES,
        default='fixed',
        verbose_name="Maosh turi"
    )
    
    fixed_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Belgilangan maosh (so'm)",
        help_text="Faqat 'Belgilangan oylik' turida ishlatiladi"
    )
    
    commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Komissiya foizi (%)",
        help_text="Faqat 'Foiz asosida' turida ishlatiladi"
    )

    per_student_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Har bir o'quvchi uchun (so'm)",
        help_text="Faqat 'O'quvchilar soni bo'yicha' turida ishlatiladi"
    )
    
    karta = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name="Karta raqami"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")



    class Meta:
        verbose_name = "Xodim profili"
        verbose_name_plural = "Xodimlar profillari"

    def __str__(self):
        if self.salary_type == 'fixed':
            return f"{self.user.get_full_name() or self.user.username} - {self.fixed_salary:,.0f} so'm"
        elif self.salary_type == 'percentage':
            return f"{self.user.get_full_name() or self.user.username} - {self.commission_percentage}%"
        else:
            return f"{self.user.get_full_name() or self.user.username} - {self.per_student_amount:,.0f} so'm/o'quvchi"

    def get_salary_display(self):
        """Maoshni chiroyli formatda ko'rsatish"""
        if self.salary_type == 'fixed':
            return f"{int(self.fixed_salary):,} so'm".replace(',', '.')
        elif self.salary_type == 'percentage':
            return f"{self.commission_percentage}% (foizdan)"
        else:
            return f"{int(self.per_student_amount):,} so'm (har bir o'quvchi uchun)".replace(',', '.')

    def _collect_group_students(self, group):
        """Guruhdagi o'quvchilarni (yangi + legacy) dublikatsiz qaytaradi."""
        students_map = {}
        for enr in group.enrollments.select_related('student').all():
            if enr.student:
                students_map[enr.student.id] = enr.student
        for st in group.old_students_fk.all():
            students_map[st.id] = st
        return list(students_map.values())
    
    @staticmethod
    def _get_teacher_lesson_share(payment, month):
        """
        Bir studentning oylik to'lovini shu oyda real qatnashgan darslari
        asosida teacher'lar o'rtasida proporsional taqsimlaydi.

        Qaytaradi: {teacher_user_id: Decimal(share_amount)}

        Qoidalar:
        - Faqat is_present=True bo'lgan real davomat hisoblanadi.
        - total_lessons == 0 bo'lsa bo'linish xatosini oldini olish uchun {payment.group.mentor_id: payment.amount} qaytariladi.
        - Duplicate attendance yozuvlari unique_together (student, group, date) constraint bilan DB darajasida himoyalangan.
        - Rounding: floor_amount(1000 ga) ishlatiladi, qoldiq eng ko'p dars o'tgan o'qituvchiga qo'shiladi.
        """
        from homework_attends.models import Attendance
        from finance.utils import floor_amount
        import math

        student = payment.student
        year = payment.month.year
        month_num = payment.month.month
        payment_amount = Decimal(str(payment.amount or 0))

        # Edge case: to'lov nol bo'lsa bo'lish kerak emas
        if payment_amount <= 0:
            return {}

        # Studentning shu oydagi barcha guruhlaridagi real davomati
        att_qs = (
            Attendance.objects
            .filter(
                student=student,
                date__year=year,
                date__month=month_num,
                is_present=True,
            )
            .select_related('group__mentor')
            .values('group__mentor_id', 'group_id')
            .annotate(lessons=models.Count('id'))
        )

        # {mentor_id: lesson_count}
        teacher_lessons: dict[int, int] = {}
        for row in att_qs:
            mentor_id = row['group__mentor_id']
            if mentor_id is None:
                continue
            teacher_lessons[mentor_id] = teacher_lessons.get(mentor_id, 0) + row['lessons']

        total_lessons = sum(teacher_lessons.values())

        # Edge case: davomat yo'q — to'lovni payment.group.mentor ga yubor (backward-compatible)
        if total_lessons == 0:
            fallback_mentor_id = payment.group.mentor_id if payment.group else None
            if fallback_mentor_id:
                return {fallback_mentor_id: payment_amount}
            return {}

        # Proporsional taqsimlash (floor 1000 ga)
        shares: dict[int, Decimal] = {}
        allocated = Decimal('0')

        # Saralash: qoldiqni eng katta hissali o'qituvchiga berish uchun deterministik tartib
        sorted_teachers = sorted(teacher_lessons.items(), key=lambda x: (-x[1], x[0]))

        for i, (mentor_id, lessons) in enumerate(sorted_teachers):
            if i == len(sorted_teachers) - 1:
                # Oxirgi o'qituvchiga qoldiqni bering (rounding xatosi to'planmasin)
                share = payment_amount - allocated
            else:
                raw = payment_amount * Decimal(lessons) / Decimal(total_lessons)
                share = floor_amount(raw)
            shares[mentor_id] = share
            allocated += share

        return shares

    def calculate_monthly_income(self, month):
        """
        Mentorning berilgan oydagi jami daromadini hisoblash.
        
        UNIFIED LOGIC: Barcha joyda bir xil hisoblash (serializer bilan mos)
        
        Qoidalar:
        1. Discount studentlar uchun: attendance asosida (kelgan kunlariga qarab) → faqat kelgan kunlar uchun
        2. Oddiy (regular, negotiated, low_income) studentlar uchun: faqat to'langan (is_paid=True) to'lovlar
        3. Teacher_negotiated: include_in_mentor_salary=True bo'lsa, to'liq summa
        4. Student_extra: qo'shimcha to'lovlar (har bir student-group uchun qo'shiladi)
        """
        from finance.utils import floor_amount, calculate_discount_student_payment

        # Admin uchun real tushum: filialdagi barcha guruhlardagi studentlar uchun
        if self.user.role == 'admin' and getattr(self.user, 'branch', None):
            from groups.models import Group
            from finance.models import Payment, FinanceTransaction
            
            total = Decimal('0')
            branch_groups = Group.objects.filter(branch=self.user.branch)
            branch_group_ids = [g.id for g in branch_groups]
            processed_pairs = set()
            
            # Barcha to'lovlarni bitta queryda olamiz
            payment_map = {}
            payment_qs = Payment.objects.filter(
                group_id__in=branch_group_ids,
                month__year=month.year,
                month__month=month.month
            ).select_related('student')
            for p in payment_qs:
                key = (p.student_id, p.group_id)
                payment_map[key] = p
            
            # Student extra tranzaksiyalarini yig'ish
            extra_map = {}
            extra_qs = FinanceTransaction.objects.filter(
                category='student_extra',
                date__year=month.year,
                date__month=month.month,
                group_id__in=branch_group_ids,
            ).values('student_id', 'group_id', 'transaction_type', 'amount')
            for tx in extra_qs:
                key = (tx['student_id'], tx['group_id'])
                amt = Decimal(str(tx['amount'] or 0))
                if tx['transaction_type'] == 'income':
                    extra_map[key] = extra_map.get(key, Decimal('0')) + amt
                else:
                    extra_map[key] = extra_map.get(key, Decimal('0')) - amt
            
            for group in branch_groups:
                all_students_map = {}
                for enr in group.enrollments.select_related('student').all():
                    if enr.student:
                        all_students_map[enr.student.id] = enr.student
                for st in group.old_students_fk.all():
                    all_students_map[st.id] = st
                
                for student in all_students_map.values():
                    key = (student.id, group.id)
                    if key in processed_pairs:
                        continue
                    processed_pairs.add(key)
                    
                    if student.status == 'teacher_negotiated':
                        if student.include_in_mentor_salary:
                            # Teacher negotiated uchun: shartnoma summasi + student_extra
                            hypothetical_fee = Decimal(str(student.custom_fee or group.monthly_price or 0))
                            total += hypothetical_fee
                            total += extra_map.get(key, Decimal('0'))
                        continue
                    
                    if student.status == 'discount':
                        # Discount student uchun: davomat asosida + student_extra
                        discount_amount = calculate_discount_student_payment(student, group, month)
                        net_amount = discount_amount + extra_map.get(key, Decimal('0'))
                        total += net_amount
                        continue
                    
                    # Oddiy studentlar uchun: faqat to'langan to'lovlar
                    p = payment_map.get(key)
                    base_amount = Decimal('0')
                    if p and p.is_paid:
                        base_amount = Decimal(str(p.amount or 0))
                    net_amount = base_amount + extra_map.get(key, Decimal('0'))
                    if net_amount != 0 or (p and p.is_paid):
                        total += net_amount
            
            return floor_amount(total)

        if self.user.role != 'mentor':
            return Decimal('0')

        from groups.models import Group
        from finance.models import Payment, FinanceTransaction

        # Mentorning barcha guruhlari (faol + nofaol, chunki tarixiy to'lovlar bo'lishi mumkin)
        mentor_groups = Group.objects.filter(mentor=self.user)
        mentor_group_ids = [g.id for g in mentor_groups]

        total_income = Decimal('0')
        processed_student_group_pairs = set() # Duplicatlarni oldini olish uchun

        # Barcha to'lovlarni bitta queryda olamiz (optimizatsiya)
        _all_payments = Payment.objects.filter(
            group_id__in=mentor_group_ids,
            month__year=month.year,
            month__month=month.month
        ).select_related('student')
        payment_map = {(p.student_id, p.group_id): p for p in _all_payments}

        # Qo'shimcha to'lovlarni bitta queryda olamiz
        extra_map = {}
        extra_qs = FinanceTransaction.objects.filter(
            category='student_extra',
            date__year=month.year,
            date__month=month.month,
            group_id__in=mentor_group_ids,
        ).values('student_id', 'group_id', 'transaction_type', 'amount')
        for tx in extra_qs:
            key = (tx['student_id'], tx['group_id'])
            amt = Decimal(str(tx['amount'] or 0))
            if tx['transaction_type'] == 'income':
                extra_map[key] = extra_map.get(key, Decimal('0')) + amt
            else:
                extra_map[key] = extra_map.get(key, Decimal('0')) - amt

        # 1. Barcha guruhlar va o'quvchilarni ko'rib chiqamiz (serializerdagi get_mentor_groups bilan mos)
        for group in mentor_groups:
            # Guruhdagi barcha o'quvchilarni olamiz
            students_map = {}
            for enr in group.enrollments.select_related('student').all():
                if enr.student:
                    students_map[enr.student.id] = enr.student
            for st in group.old_students_fk.all():
                students_map[st.id] = st
            
            students = list(students_map.values())
            
            for student in students:
                key = (student.id, group.id)
                if key in processed_student_group_pairs:
                    continue
                processed_student_group_pairs.add(key)

                if student.status == 'teacher_negotiated':
                    if student.include_in_mentor_salary:
                        hypothetical_fee = Decimal(str(student.custom_fee or group.monthly_price or 0))
                        total_income += hypothetical_fee
                        total_income += extra_map.get(key, Decimal('0'))
                    continue

                # Discount student uchun: attendance asosida
                if student.status == 'discount':
                    discount_amount = calculate_discount_student_payment(student, group, month)
                    net_amount = discount_amount + extra_map.get(key, Decimal('0'))
                    total_income += net_amount
                    continue

                # Oddiy studentlar uchun: faqat to'langan to'lovlar
                p = payment_map.get(key)
                base_amount = Decimal('0')
                if p and p.is_paid:
                    base_amount = Decimal(str(p.amount or 0))
                net_amount = base_amount + extra_map.get(key, Decimal('0'))
                if net_amount != 0 or (p and p.is_paid):
                    total_income += net_amount

        return floor_amount(total_income)

    def calculate_expected_monthly_income(self, month):
        """
        Foizli mentor uchun kutilayotgan tushum:
        mentor guruhlaridagi barcha statusdagi o'quvchilarning
        oy bo'yicha berishi kerak bo'lgan shartnoma summalari yig'indisi.
        """
        from finance.utils import floor_amount, calculate_discount_student_payment
        from groups.models import Group
        from finance.models import FinanceTransaction

        if self.user.role == 'admin' and getattr(self.user, 'branch', None):
            total = Decimal('0')
            branch_groups = Group.objects.filter(branch=self.user.branch)
            processed_pairs = set()
            
            # Student extra tranzaksiyalarni olamiz
            extra_map = {}
            branch_group_ids = [g.id for g in branch_groups]
            extra_qs = FinanceTransaction.objects.filter(
                category='student_extra',
                date__year=month.year,
                date__month=month.month,
                group_id__in=branch_group_ids,
            ).values('student_id', 'group_id', 'transaction_type', 'amount')
            for tx in extra_qs:
                key = (tx['student_id'], tx['group_id'])
                amt = Decimal(str(tx['amount'] or 0))
                if tx['transaction_type'] == 'income':
                    extra_map[key] = extra_map.get(key, Decimal('0')) + amt
                else:
                    extra_map[key] = extra_map.get(key, Decimal('0')) - amt
            
            for group in branch_groups:
                all_students_map = {}
                for enr in group.enrollments.select_related('student').all():
                    if enr.student:
                        all_students_map[enr.student.id] = enr.student
                for st in group.old_students_fk.all():
                    all_students_map[st.id] = st
                
                for student in all_students_map.values():
                    key = (student.id, group.id)
                    if key in processed_pairs:
                        continue
                    processed_pairs.add(key)
                    
                    if student.status == 'teacher_negotiated':
                        if student.include_in_mentor_salary:
                            # Teacher negotiated student uchun: shartnoma summasi + student_extra
                            if student.custom_fee:
                                total += Decimal(str(student.custom_fee))
                            else:
                                total += Decimal(str(group.monthly_price or 0))
                            total += extra_map.get(key, Decimal('0'))
                        continue
                    
                    if student.status == 'discount':
                        # Discount student uchun: davomat asosida + student_extra
                        total += calculate_discount_student_payment(student, group, month)
                        total += extra_map.get(key, Decimal('0'))
                        continue
                    
                    # Oddiy studentlar uchun: shartnoma summasi + student_extra
                    if student.status in ['low_income', 'negotiated'] and student.custom_fee:
                        total += Decimal(str(student.custom_fee))
                    else:
                        total += Decimal(str(group.monthly_price or 0))
                    total += extra_map.get(key, Decimal('0'))
            
            return floor_amount(total)

        if self.user.role != 'mentor':
            return Decimal('0')

        mentor_groups = Group.objects.filter(mentor=self.user)
        mentor_group_ids = [g.id for g in mentor_groups]
        processed_student_group_pairs = set()
        
        # Qo'shimcha tranzaksiyalarni olamiz
        extra_map = {}
        extra_qs = FinanceTransaction.objects.filter(
            category='student_extra',
            date__year=month.year,
            date__month=month.month,
            group_id__in=mentor_group_ids,
        ).values('student_id', 'group_id', 'transaction_type', 'amount')
        for tx in extra_qs:
            key = (tx['student_id'], tx['group_id'])
            amt = Decimal(str(tx['amount'] or 0))
            if tx['transaction_type'] == 'income':
                extra_map[key] = extra_map.get(key, Decimal('0')) + amt
            else:
                extra_map[key] = extra_map.get(key, Decimal('0')) - amt

        total_expected_income = Decimal('0')
        for group in mentor_groups:
            for student in self._collect_group_students(group):
                key = (student.id, group.id)
                if key in processed_student_group_pairs:
                    continue
                processed_student_group_pairs.add(key)

                if student.status == 'teacher_negotiated':
                    if student.include_in_mentor_salary:
                        # Teacher negotiated student uchun expected income: shartnoma summasi
                        base = _student_contract_monthly(student, group)
                        total_expected_income += base
                        # Student extra ni ham qo'shamiz
                        total_expected_income += extra_map.get(key, Decimal('0'))
                    continue

                # Discount student uchun expected income: davomat asosida (calculate_discount_student_payment)
                if student.status == 'discount':
                    base = calculate_discount_student_payment(student, group, month)
                    total_expected_income += base
                    # Student extra ni ham qo'shamiz
                    total_expected_income += extra_map.get(key, Decimal('0'))
                    continue
                
                # Oddiy studentlar uchun expected income
                base = _student_contract_monthly(student, group)
                total_expected_income += base
                total_expected_income += extra_map.get(key, Decimal('0'))

        return floor_amount(total_expected_income)
    
    def calculate_salary_for_month(self, month, commission_basis='paid'):
        """Berilgan oy uchun maoshni hisoblash (natija floor qilinadi)"""
        from finance.utils import floor_amount
        
        if self.salary_type == 'fixed':
            return floor_amount(self.fixed_salary)
        
        elif self.salary_type == 'percentage':
            # Foizli mentor uchun komissiya bazasi:
            # - paid: real tushumdan
            # - expected: barcha statusdagi o'quvchilarning shartnoma summasidan
            if commission_basis == 'expected':
                total_income = self.calculate_expected_monthly_income(month)
            else:
                total_income = self.calculate_monthly_income(month)
            commission_pct = Decimal(str(self.commission_percentage)) / Decimal('100')
            commission = total_income * commission_pct
            return floor_amount(commission)
        
        elif self.salary_type == 'student_count':
            # ✅ O'quvchilar soni bo'yicha hisoblash (discount studentlarni ham qo'shamiz)
            from finance.models import Payment
            from groups.models import Group
            
            mentor_groups = Group.objects.filter(mentor=self.user)
            per_student = Decimal(str(self.per_student_amount))
            salary = Decimal('0')
            processed_student_group_pairs = set()
            
            # 1. Discount studentlar uchun (attendance asosida, lekin student_count uchun ular "to'langan" deb hisoblanadi)
            #    va oddiy to'lovlar
            for group in mentor_groups:
                # Guruhdagi barcha o'quvchilarni olamiz
                students_map = {}
                for enr in group.enrollments.select_related('student').all():
                    if enr.student:
                        students_map[enr.student.id] = enr.student
                for st in group.old_students_fk.all():
                    students_map[st.id] = st
                
                students = list(students_map.values())
                
                for student in students:
                    key = (student.id, group.id)
                    if key in processed_student_group_pairs:
                        continue
                    processed_student_group_pairs.add(key)
                    
                    if student.status == 'teacher_negotiated':
                        if student.include_in_mentor_salary:
                            if commission_basis == 'expected':
                                salary += per_student
                            else:
                                # Teacher negotiated uchun: shartnoma summasi (lekin per_student dan kichik bo'lsa shuni olamiz)
                                teacher_fee = Decimal(str(student.custom_fee or group.monthly_price or 0))
                                salary += min(teacher_fee, per_student)
                        continue
                    
                    if student.status == 'discount':
                        # Discount student uchun: attendance asosidagi summa (lekin per_student dan kichik bo'lsa, shuni olamiz)
                        from finance.utils import calculate_discount_student_payment
                        discount_amount = calculate_discount_student_payment(student, group, month)
                        salary += min(discount_amount, per_student)
                        continue
                    
                    # Oddiy studentlar uchun:
                    # - paid: faqat to'langan paymentlar
                    # - expected: payment mavjud bo'lmasa ham har bir student uchun per_student miqdori qo'shiladi
                    try:
                        payment = Payment.objects.get(
                            student=student,
                            group=group,
                            month=month.replace(day=1)
                        )
                        if (commission_basis == 'paid' and payment.is_paid) or (commission_basis == 'expected'):
                            if commission_basis == 'expected':
                                # Expected rejimida: to'liq per_student miqdori
                                salary += per_student
                            else:
                                # Paid rejimida: to'langan summa bilan per_student dan kichigini
                                p_amount = Decimal(str(payment.amount or 0))
                                mentor_slice = min(p_amount, per_student)
                                salary += mentor_slice
                    except Payment.DoesNotExist:
                        if commission_basis == 'expected':
                            # Expected rejimida: payment mavjud bo'lmasa ham qo'shish
                            salary += per_student
                        continue
            
            return floor_amount(salary)
        
        return Decimal('0')
    
    def calculate_attendance_based_salary(self, month):
        """
        OBSOLETE: Mentor davomati logikasi olib tashlandi.
        """
        return self.calculate_salary_for_month(month), {}
    
    def save(self, *args, **kwargs):
        """Profile yangilanganda mavjud to'lovlarni ham yangilash"""
        # Eski qiymatlarni olish (agar mavjud bo'lsa)
        old_fixed = None
        old_percentage = None
        old_per_student = None
        
        if self.pk:
            try:
                old = StaffProfile.objects.get(pk=self.pk)
                old_fixed = old.fixed_salary
                old_percentage = old.commission_percentage
                old_per_student = old.per_student_amount
            except StaffProfile.DoesNotExist:
                pass
        
        # Saqlash
        super().save(*args, **kwargs)
        
        # Agar maosh o'zgargan bo'lsa, to'lanmagan paymentlarni yangilash
        salary_fields_changed = any([
            old_fixed is not None and old_fixed != self.fixed_salary,
            old_percentage is not None and old_percentage != self.commission_percentage,
            old_per_student is not None and old_per_student != self.per_student_amount
        ])
        
        if salary_fields_changed:
            self._update_unpaid_payments()
    
    def _update_unpaid_payments(self):
        """To'lanmagan va joriy/kelajakdagi paymentlarni yangilash"""
        today = timezone.now().date()
        current_month = today.replace(day=1)

        unpaid_payments = EmployeePayment.objects.filter(
            employee=self.user,
            is_paid=False,
            month__gte=current_month
        )

        for payment in unpaid_payments:
            payment.salary_base = self.calculate_salary_for_month(payment.month)
            payment.attendance_deductions = {}
            payment.save()

class EmployeeAdvance(models.Model):
    """Xodimga oylik maoshidan tashqari berilgan avans (oldindan to'lov)"""
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='staff_advances',
        verbose_name="Xodim"
    )
    month = models.DateField(verbose_name="Qaysi oy maoshidan ayriladi")
    amount = models.DecimalField(max_digits=20, decimal_places=2, verbose_name="Avans summasi")
    description = models.TextField(blank=True, null=True, verbose_name="Izoh")
    date = models.DateField(default=timezone.now, verbose_name="Berilgan sana")
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Kim berdi"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name = "Xodim avansi"
        verbose_name_plural = "Xodimlar avanslari"

    def __str__(self):
        return f"{self.employee.get_full_name()} - {self.amount} ({self.date})"

    @property
    def payment_record(self):
        """Ushbu avans tegishli bo'lgan payment rekordini topish"""
        return EmployeePayment.objects.filter(employee=self.employee, month=self.month).first()

    def save(self, *args, **kwargs):
        # Oy normalizatsiyasi
        if self.month:
            from finance.utils import normalize_month
            self.month = normalize_month(self.month)
        
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            # ✅ Centralized Finance Ledger ga Chiqim sifatida yozish
            from finance.models import FinanceTransaction
            FinanceTransaction.objects.create(
                related_id=f"ADV-{self.id}",
                transaction_type='expense',
                category='salary', # Avans maoshning bir qismi
                amount=self.amount,
                date=self.date,
                marked_by=self.marked_by,
                branch=self.employee.branch,
                title=f"Avans: {self.employee.get_full_name() or self.employee.username}",
                description=f"{self.month.strftime('%Y-%m')} oyi maoshi hisobidan avans. {self.description or ''}"
            )
