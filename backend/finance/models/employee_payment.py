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
    def total_advances(self):
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
    def total_amount(self):
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
    
    def calculate_monthly_income(self, month):
        """
        Mentorning berilgan oydagi jami daromadini hisoblash
        (To'langan oylik to'lovlar + qo'shimcha to'lovlar - refundlar)
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
        
        total_income = Decimal('0')
        
        for group in mentor_groups:
            group_revenue = Decimal('0')
            
            for student in group.students.all():
                # 1. Oylik asosiy to'lov (tasdiqlangan)
                payment = Payment.objects.filter(
                    student=student, 
                    group=group, 
                    month__year=month.year, 
                    month__month=month.month,
                    is_paid=True
                ).first()
                
                if payment:
                    student_revenue = Decimal(str(payment.amount))
                    group_revenue += student_revenue
                
                # ✅ QO'SHIMCHA: O'qituvchi kelishgan o'quvchilar (agar on qilingan bo'lsa)
                elif student.status == 'teacher_negotiated' and student.include_in_mentor_salary:
                    # Ularning o'rniga o'qituvchiga hypothetical summa qo'shiladi
                    hypothetical_fee = Decimal(str(student.custom_fee or group.monthly_price))
                    group_revenue += hypothetical_fee
                
                # 2. ✅ Qo'shimcha to'lovlarni ham hisobga olamiz (student_extra)
                extra_txs = FinanceTransaction.objects.filter(
                    student=student,
                    group=group,
                    category='student_extra',
                    date__year=month.year,
                    date__month=month.month
                )
                for tx in extra_txs:
                    tx_amount = Decimal(str(tx.amount))
                    if tx.transaction_type == 'income':
                        group_revenue += tx_amount
                    else:
                        group_revenue -= tx_amount
            
            total_income += group_revenue
            
        return floor_amount(total_income)
    
    def calculate_salary_for_month(self, month):
        """Berilgan oy uchun maoshni hisoblash (natija floor qilinadi)"""
        from finance.utils import floor_amount
        
        if self.salary_type == 'fixed':
            return floor_amount(self.fixed_salary)
        
        elif self.salary_type == 'percentage':
            # ✅ Foiz - to'langan to'lovlardan (refundlar ayirilgan)
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
