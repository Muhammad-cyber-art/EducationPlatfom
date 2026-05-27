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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._old_per_student = self.per_student_amount

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

        Yangi logika (multi-teacher support):
        - Foizli mentor uchun: student to'lovi qaysi teacher bilan nechta real
          dars o'qiganiga qarab proporsional taqsimlanadi.
        - Fixed / student_count mentor uchun: o'zgarmaydi.
        - Admin uchun: o'zgarmaydi (filial bo'yicha).
        - 1 ta teacher bo'lsa: avvalgi natija aynan saqlanadi (backward-compatible).
        """
        from finance.utils import floor_amount

        # Admin + foiz: filial bo'yicha tasdiqlangan oylik to'lovlar (mentor logikasi emas)
        if self.user.role == 'admin' and getattr(self.user, 'branch', None):
            from finance.models import Payment
            from django.db.models import Sum
            total = Payment.objects.filter(
                group__branch=self.user.branch,
                month__year=month.year,
                month__month=month.month,
                is_paid=True,
            ).aggregate(total=Sum('amount'))['total'] or 0
            return floor_amount(Decimal(str(total)))

        if self.user.role != 'mentor':
            return Decimal('0')

        from groups.models import Group
        from finance.models import Payment, FinanceTransaction

        # Mentorning barcha guruhlari (faol + nofaol, chunki tarixiy to'lovlar bo'lishi mumkin)
        mentor_groups = Group.objects.filter(mentor=self.user)

        # --- Foizli mentor uchun multi-teacher taqsimlash (real attendance bo'yicha) ---
        #
        # Maqsad:
        #   - Student oy davomida bir nechta teacher guruhi bilan o'qisa -> student to'lovi real davomatga proporsional taqsimlansin.
        #   - payment.group qaysi mentorniki bo'lishidan qat'iy nazar, attendance counts teacher'larni aniqlaydi.
        #   - total_lessons==0 bo'lsa (attendance yozuvi yo'q) -> backward compatible fallback: payment.group.mentor ga.
        #
        from homework_attends.models import Attendance

        month_year = month.year
        month_num = month.month

        mentor_group_ids = list(mentor_groups.values_list('id', flat=True))

        # 1) Shu mentorga attendance bo'yicha biriktirilgan studentlar
        students_from_attendance = Attendance.objects.filter(
            group__mentor=self.user,
            date__year=month_year,
            date__month=month_num,
            is_present=True,
        ).values_list('student_id', flat=True).distinct()

        # 2) Shu mentorga tegishli guruhda olingan (paid) to'lovlar bor studentlar
        #    (agar attendance umuman bo'lmasa, fallback shu yerda ishlaydi)
        students_from_paid_payments = Payment.objects.filter(
            group_id__in=mentor_group_ids,
            month__year=month_year,
            month__month=month_num,
            is_paid=True,
        ).values_list('student_id', flat=True).distinct()

        relevant_student_ids = set(students_from_attendance) | set(students_from_paid_payments)

        total_income = Decimal('0')
        if relevant_student_ids:
            # Attendance counts: {student_id: {mentor_id: lessons}}
            att_qs = Attendance.objects.filter(
                student_id__in=relevant_student_ids,
                date__year=month_year,
                date__month=month_num,
                is_present=True,
                group__mentor_id__isnull=False,
            ).values('student_id', 'group__mentor_id').annotate(
                lessons=models.Count('id')
            )

            teacher_lessons_by_student: dict[int, dict[int, int]] = {}
            total_lessons_by_student: dict[int, int] = {}
            for row in att_qs:
                sid = row['student_id']
                mid = row['group__mentor_id']
                lessons = int(row['lessons'] or 0)
                if sid not in teacher_lessons_by_student:
                    teacher_lessons_by_student[sid] = {}
                teacher_lessons_by_student[sid][mid] = teacher_lessons_by_student[sid].get(mid, 0) + lessons

                total_lessons_by_student[sid] = total_lessons_by_student.get(sid, 0) + lessons

            # Shu student oyda qancha REAL paid pul to'lagan (payment status: is_paid=True)
            paid_totals_qs = Payment.objects.filter(
                student_id__in=relevant_student_ids,
                month__year=month_year,
                month__month=month_num,
                is_paid=True,
            ).values('student_id').annotate(total=models.Sum('amount'))

            student_total_paid = {
                row['student_id']: Decimal(str(row['total'] or 0))
                for row in paid_totals_qs
            }

            # total_lessons==0 bo'lgan studentlar uchun fallback (payment.group.mentor ga)
            no_attendance_students = [
                sid for sid in relevant_student_ids
                if total_lessons_by_student.get(sid, 0) == 0
            ]
            if no_attendance_students:
                fallback_total = Payment.objects.filter(
                    student_id__in=no_attendance_students,
                    group__mentor=self.user,
                    month__year=month_year,
                    month__month=month_num,
                    is_paid=True,
                ).aggregate(total=models.Sum('amount'))['total'] or 0
                total_income += Decimal(str(fallback_total))

            # Attendance bor studentlar uchun taqsimlash (studentning oy total paid puliga)
            for sid, student_paid_amount in student_total_paid.items():
                if student_paid_amount <= 0:
                    continue

                teacher_lessons = teacher_lessons_by_student.get(sid)
                total_lessons = total_lessons_by_student.get(sid, 0)
                if not teacher_lessons or total_lessons <= 0:
                    continue  # fallback yuqorida handled

                sorted_teachers = sorted(
                    teacher_lessons.items(),
                    key=lambda x: (-x[1], x[0])  # deterministik: eng ko'p dars, keyin id
                )

                allocated = Decimal('0')
                share_for_self = Decimal('0')
                for i, (mentor_id, lessons) in enumerate(sorted_teachers):
                    if i == len(sorted_teachers) - 1:
                        share = student_paid_amount - allocated
                    else:
                        raw = student_paid_amount * Decimal(lessons) / Decimal(total_lessons)
                        share = floor_amount(raw)

                    if mentor_id == self.user.id:
                        share_for_self = share
                    allocated += share

                total_income += share_for_self

        # Teacher_negotiated + include_in_mentor_salary (faqat shu mentor guruhidagi)
        for group in mentor_groups:
            teacher_neg_students = group.students.filter(
                status='teacher_negotiated',
                include_in_mentor_salary=True,
            )
            for student in teacher_neg_students:
                hypothetical_fee = Decimal(str(student.custom_fee or group.monthly_price or 0))
                total_income += hypothetical_fee

        # Qo'shimcha to'lovlar (student_extra) — guruh mentori kimligidan qat'iy nazar,
        # qo'shimcha to'lovlar to'g'ridan-to'g'ri guruh mentoriga tegishli (o'zgartirilmaydi)
        from finance.models import FinanceTransaction
        extra_txs = FinanceTransaction.objects.filter(
            group__in=mentor_groups,
            category='student_extra',
            date__year=month.year,
            date__month=month.month,
        )
        for tx in extra_txs:
            tx_amount = Decimal(str(tx.amount))
            if tx.transaction_type == 'income':
                total_income += tx_amount
            else:
                total_income -= tx_amount

        return floor_amount(total_income)

    def calculate_expected_monthly_income(self, month):
        """
        Foizli mentor uchun kutilayotgan tushum:
        mentor guruhlaridagi barcha statusdagi o'quvchilarning
        oy bo'yicha berishi kerak bo'lgan shartnoma summalari yig'indisi.
        """
        from finance.utils import floor_amount
        from groups.models import Group

        if self.user.role == 'admin' and getattr(self.user, 'branch', None):
            from finance.models import Payment
            from django.db.models import Sum
            total = Payment.objects.filter(
                group__branch=self.user.branch,
                month__year=month.year,
                month__month=month.month,
            ).aggregate(total=Sum('amount'))['total'] or 0
            return floor_amount(Decimal(str(total)))

        if self.user.role != 'mentor':
            return Decimal('0')

        mentor_groups = Group.objects.filter(mentor=self.user).prefetch_related(
            'enrollments__student',
            'old_students_fk',
        )
        total_expected_income = Decimal('0')
        for group in mentor_groups:
            for student in self._collect_group_students(group):
                total_expected_income += _student_contract_monthly(student, group)
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
            # ✅ O'quvchilar soni bo'yicha - FAQAT TO'LAGANLARNI HISIBLAYMIZ
            from finance.models import Payment
            
            # Mentorning barcha guruhlarini topish
            from groups.models import Group
            mentor_groups = Group.objects.filter(mentor=self.user)
            
            # Shu oydagi TO'LANGAN to'lovlarni olish
            paid_payments = Payment.objects.filter(
                group__in=mentor_groups,
                month=month.replace(day=1),
                is_paid=True
            )
            
            per_student = Decimal(str(self.per_student_amount))
            salary = Decimal('0')
            
            for p in paid_payments:
                p_amount = Decimal(str(p.amount))
                mentor_slice = min(p_amount, per_student)
                salary += mentor_slice
            
            # ✅ QO'SHIMCHA: O'qituvchi kelishgan o'quvchilarni ham sanaymiz
            for group in mentor_groups:
                teacher_neg_students = group.students.filter(
                    status='teacher_negotiated', 
                    include_in_mentor_salary=True
                )
                for _ in teacher_neg_students:
                    salary += per_student
            
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
        
        if self.pk:
            try:
                old = StaffProfile.objects.get(pk=self.pk)
                old_fixed = old.fixed_salary
                old_percentage = old.commission_percentage
            except StaffProfile.DoesNotExist:
                pass
        
        # Saqlash
        super().save(*args, **kwargs)
        
        # Agar maosh o'zgargan bo'lsa, to'lanmagan paymentlarni yangilash
        salary_fields_changed = any([
            old_fixed is not None and old_fixed != self.fixed_salary,
            old_percentage is not None and old_percentage != self.commission_percentage,
            # Yangi fieldni ham tekshiramiz (agar pk bo'lsa)
            hasattr(self, '_old_per_student') and self._old_per_student != self.per_student_amount
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
