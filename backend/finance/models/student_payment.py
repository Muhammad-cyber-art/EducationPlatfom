from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import uuid

class Payment(models.Model):
    # O'quvchi va Guruh bilan bog'liqlik
    student = models.ForeignKey('groups.Student', on_delete=models.CASCADE, related_name='payments')
    group = models.ForeignKey('groups.Group', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    
    # Qaysi oy uchun to'lov (Masalan: 2025-12-01)
    month = models.DateField(null=True, blank=True)    
    
    # To'lov holati
    is_paid = models.BooleanField(default=False)
    
    # Refund (Qaytarib berish)ni bekor qilish opsiyasi
    refund_ignored = models.BooleanField(default=False, verbose_name="Refund bekor qilingan")

    # Guruhning o'sha paytdagi narxi (audit uchun muhim!)
    amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    paid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="To'langan summa (jami)",
    )
    is_partial = models.BooleanField(default=False, verbose_name="Bo'lib to'langan")
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Refund miqdori")
    
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
    
    # Yangi: To'lov turi va tasdiqlari
    PAYMENT_METHODS = [
        ('cash', 'Naqd'),
        ('click', 'Click / Card'),
        ('payme', 'Payme'),
        ('other', 'Boshqa'),
    ]
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS, default='cash')
    receipt_image = models.ImageField(upload_to='receipts/', null=True, blank=True)
    is_receiptless = models.BooleanField(default=False, verbose_name="Chek yo'q")
    is_full_amount = models.BooleanField(default=False, verbose_name="To'liq oylik to'langan")
    notes = models.TextField(blank=True, null=True)

    # Super Admin tasdig'i (Verification)
    is_verified = models.BooleanField(default=False, verbose_name="Tasdiqlangan")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_student_payments'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student', 'group', 'month')
        ordering = ['-month']
        verbose_name = "O'quvchi to'lovi"
        verbose_name_plural = "O'quvchilar to'lovlari"

    def __str__(self):
        return f"{self.student.full_name} - {self.group.name} - {self.month.strftime('%B %Y') if self.month else 'No month'}"

    @property
    def remaining_amount(self):
        """Qolgan qarz summasi"""
        expected = Decimal(str(self.amount or 0))
        paid = Decimal(str(self.paid_amount or 0))
        return max(Decimal('0'), expected - paid)

    def apply_payment(
        self,
        admin_user,
        installment_amount,
        method='cash',
        receipt=None,
        notes=None,
        is_receiptless=False,
        is_full_amount=False,
    ):
        """
        To'lovni qabul qilish (to'liq yoki bo'lib-bo'lib).
        Har bir qism uchun alohida FinanceTransaction yaratiladi.
        """
        from django.db import transaction as db_transaction
        from finance.models import FinanceTransaction

        installment = Decimal(str(installment_amount))
        if installment <= 0:
            raise ValueError("To'lov summasi 0 dan katta bo'lishi kerak")

        with db_transaction.atomic():
            expected = Decimal(str(self.amount or 0))
            current_paid = Decimal(str(self.paid_amount or 0))
            remaining = max(Decimal('0'), expected - current_paid)

            if remaining > 0 and installment > remaining:
                installment = remaining

            self.paid_amount = current_paid + installment
            if not self.paid_at:
                self.paid_at = timezone.now()
            self.marked_by = admin_user
            self.payment_method = method
            self.is_receiptless = is_receiptless
            self.is_full_amount = is_full_amount
            if receipt:
                self.receipt_image = receipt
            if notes:
                self.notes = notes

            if expected > 0 and self.paid_amount >= expected:
                self.is_paid = True
                self.is_partial = False
            elif self.paid_amount > 0:
                self.is_paid = False
                self.is_partial = True
            else:
                self.is_paid = False
                self.is_partial = False

            self.save()

            FinanceTransaction.objects.create(
                related_id=f"STP-{self.id}-INS-{uuid.uuid4().hex[:12]}",
                transaction_type='income',
                category='student_fee',
                amount=installment,
                date=self.paid_at.date(),
                marked_by=admin_user,
                branch=self.student.branch,
                student=self.student,
                title=f"To'lov: {self.student.full_name}",
                description=(
                    f"{self.group.name} ({'To''liq' if self.is_full_amount else 'Bo''lib' if self.is_partial else 'Davomat'}) "
                    f"{self.month.strftime('%Y-%m')} — {installment} UZS. "
                    f"Usul: {self.get_payment_method_display()}. "
                    f"{'(Cheksiz)' if self.is_receiptless else ''} {self.notes or ''}"
                ).strip(),
            )

        return self

    def mark_as_paid(self, admin_user, method='cash', receipt=None, notes=None, is_receiptless=False, is_full_amount=False):
        """Orqaga moslik: to'liq qolgan summani bir martada qabul qiladi."""
        if self.is_paid:
            return self
        expected = Decimal(str(self.amount or 0))
        paid = Decimal(str(self.paid_amount or 0))
        remaining = max(expected - paid, expected if paid == 0 and expected > 0 else Decimal('0'))
        if remaining <= 0 and expected > 0:
            remaining = expected
        return self.apply_payment(
            admin_user,
            remaining if remaining > 0 else expected,
            method=method,
            receipt=receipt,
            notes=notes,
            is_receiptless=is_receiptless,
            is_full_amount=is_full_amount,
        )
    def save(self, *args, **kwargs):
        if self.month:
            from finance.utils import normalize_month
            self.month = normalize_month(self.month)
        super().save(*args, **kwargs)
