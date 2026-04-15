from django.db import models
from django.conf import settings
from django.utils import timezone

from django.core.validators import MinValueValidator, MaxValueValidator

class Payment(models.Model):
    # O'quvchi va Guruh bilan bog'liqlik
    student = models.ForeignKey('groups.Student', on_delete=models.PROTECT, related_name='payments')
    group = models.ForeignKey('groups.Group', on_delete=models.PROTECT, related_name='payments')
    
    # Qaysi oy uchun to'lov (Masalan: 2025-12-01)
    month = models.DateField(null=True, blank=True)    
    
    # To'lov holati
    is_paid = models.BooleanField(default=False)
    
    # Refund (Qaytarib berish)ni bekor qilish opsiyasi
    refund_ignored = models.BooleanField(default=False, verbose_name="Refund bekor qilingan")
    
    # Guruhning o'sha paytdagi narxi (audit uchun muhim!)
    amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Kim tomonidan va qachon tasdiqlandi
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='marked_student_payments',
        limit_choices_to={'role__in': ['admin', 'super_admin']}
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Payment Gateway dan keladigan ma'lumotlar
    transaction_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    payer_name = models.CharField(max_length=100, null=True, blank=True)
    payer_phone = models.CharField(max_length=20, null=True, blank=True)
    payer_card_mask = models.CharField(max_length=20, null=True, blank=True)

    class Meta:
        unique_together = ('student', 'group', 'month')
        ordering = ['-month']
        verbose_name = "O'quvchi to'lovi"
        verbose_name_plural = "O'quvchilar to'lovlari"

    def __str__(self):
        return f"{self.student.full_name} - {self.group.name} - {self.month.strftime('%B %Y') if self.month else 'No month'}"

    def mark_as_paid(self, admin_user):
        if not self.is_paid:
            self.is_paid = True
            self.marked_by = admin_user
            self.paid_at = timezone.now()
            self.save()
            
            # ✅ Centralized Finance Ledger ga yozish
            from .models import FinanceTransaction
            FinanceTransaction.objects.get_or_create(
                related_id=f"STP-{self.id}",
                defaults={
                    'transaction_type': 'income',
                    'category': 'student_fee',
                    'amount': self.amount,
                    'date': self.paid_at.date(),
                    'marked_by': admin_user,
                    'branch': self.student.branch,
                    'title': f"To'lov: {self.student.full_name}",
                    'description': f"{self.group.name} guruhi uchun {self.month.strftime('%Y-%m')} oyi to'lovi",
                }
            )
    def save(self, *args, **kwargs):
        if self.month:
            from finance.utils import normalize_month
            self.month = normalize_month(self.month)
        super().save(*args, **kwargs)
# finance/models.py

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


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
    
    @property
    def total_amount(self):
        """Jami to'lov miqdori (floor)"""
        from decimal import Decimal
        from finance.utils import floor_amount
        # ✅ Barcha qiymatlarni Decimal ga o'girish
        salary = Decimal(str(self.salary_base)) if self.salary_base else Decimal('0')
        bonus = Decimal(str(self.bonus)) if self.bonus else Decimal('0')
        deductions = Decimal(str(self.deductions)) if self.deductions else Decimal('0')
        return floor_amount(salary + bonus - deductions)
    
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
                if self.employee.role == 'mentor' and hasattr(self.employee, 'staff_profile'):
                    if self.employee.staff_profile.salary_type == 'percentage':
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
                
                from .models import FinanceTransaction
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
            from decimal import Decimal
            profile = self.employee.staff_profile
            # calculate_salary_for_month metodidan foydalanamiz
            calculated_salary = profile.calculate_salary_for_month(self.month)
            # ✅ Decimal ga o'girish
            self.salary_base = Decimal(str(calculated_salary))
            # save() ni chaqirmaymiz, chunki mark_as_paid() o'zi save() qiladi
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
        Natija floor qilinadi.
        """
        from decimal import Decimal
        from finance.utils import floor_amount
        
        if self.user.role != 'mentor':
            return Decimal('0')
        
        from groups.models import Group
        from .models import Payment, FinanceTransaction
        
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
                    # Refund ayiramiz (agar bekor qilinmagan bo'lsa)
                    if not payment.refund_ignored:
                        refund = Decimal(str(student.calculate_refund_amount(month.year, month.month)))
                        group_revenue += (student_revenue - refund)
                    else:
                        group_revenue += student_revenue
                
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
                        group_revenue += tx_amount  # Qo'shimcha kirim qo'shiladi
                    else:
                        group_revenue -= tx_amount  # Qo'shimcha chiqim ayriladi
            
            total_income += group_revenue
            
        return floor_amount(total_income)
    
    def calculate_salary_for_month(self, month):
        """Berilgan oy uchun maoshni hisoblash (natija floor qilinadi)"""
        from decimal import Decimal
        from finance.utils import floor_amount
        
        if self.salary_type == 'fixed':
            # ✅ Fixed maosh — ham floor
            return floor_amount(self.fixed_salary)
        
        elif self.salary_type == 'percentage':
            # ✅ Foiz - to'langan to'lovlardan
            total_income = self.calculate_monthly_income(month)
            commission_pct = Decimal(str(self.commission_percentage)) / Decimal('100')
            commission = total_income * commission_pct
            return floor_amount(commission)
        
        elif self.salary_type == 'student_count':
            # ✅ O'quvchilar soni bo'yicha
            from groups.models import GroupEnrollment
            import calendar
            from datetime import date
            
            # Oyni boshlanishi va oxiri
            first_day = month.replace(day=1)
            last_day_num = calendar.monthrange(month.year, month.month)[1]
            last_day = month.replace(day=last_day_num)
            
            # Mentorning barcha guruhlarini topish
            from groups.models import Group
            mentor_groups = Group.objects.filter(mentor=self.user)
            
            # Shu oydagi o'quvchilar sonini hisoblash
            # Talab: O'sha oyda guruhda faol bo'lgan (yoki darsga qatnashgan) o'quvchilar
            # Biz GroupEnrollment orqali hisoblaymiz: joined_at <= last_day va is_active=True
            total_students = GroupEnrollment.objects.filter(
                group__in=mentor_groups,
                joined_at__date__lte=last_day,
                is_active=True
            ).values('student_id').distinct().count()
            
            salary = Decimal(str(total_students)) * Decimal(str(self.per_student_amount))
            return floor_amount(salary)
        
        return Decimal('0')
    
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
            new_salary = self.calculate_salary_for_month(payment.month)
            new_salary = self.calculate_salary_for_month(payment.month)
            payment.salary_base = new_salary
            payment.save()


class FinanceTransaction(models.Model):
    """
    Markaziy moliya daftari (Unified Ledger)
    Hamma tushum va chiqimlar shu yerga yoziladi.
    Yuqori yuklamalar uchun indexlash kiritilgan.
    """
    TRANSACTION_TYPE = [
        ('income', 'Tushum (Kirim)'),
        ('expense', 'Chiqim (Chiqit)'),
    ]

    CATEGORY_CHOICES = [
        ('student_fee', 'O\'quvchi to\'lovi'),
        ('salary', 'Xodim maoshi'),
        ('utility', 'Kommunal to\'lovlar'),
        ('rent', 'Ijara'),
        ('refund', 'Qaytarilgan pul (Dars qoldirgani uchun)'),
        ('student_extra', 'O\'quvchi qo\'shimcha to\'lovi'),
        ('other', 'Boshqa'),
    ]

    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPE, db_index=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    date = models.DateField(db_index=True)
    
    # Yangi: O'quvchiga bog'lash uchun (optional)
    student = models.ForeignKey(
        'groups.Student', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='finance_transactions'
    )
    group = models.ForeignKey(
        'groups.Group', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='finance_transactions'
    )
    payer_name = models.CharField(max_length=255, blank=True, null=True)

    # Mas’ul shaxs
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        db_index=True
    )
    
    # Filial bo'yicha indexlangan
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.CASCADE,
        related_name='transactions',
        db_index=True
    )
    
    # Qisqa mazmuni (Search uchun qulay)
    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True)
    
    # Bog'liqlikni saqlash (Generic ID kabi)
    related_id = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = "Moliya operatsiyasi"
        verbose_name_plural = "Moliya operatsiyalari"
        # Kompozit indexlar qidiruvni yanada tezlashtiradi
        indexes = [
            models.Index(fields=['date', 'transaction_type']),
            models.Index(fields=['branch', 'transaction_type']),
        ]

    def __str__(self):
        return f"{self.date} | {self.transaction_type} | {self.amount}"
