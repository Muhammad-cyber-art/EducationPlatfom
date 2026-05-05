from django.db import models
from django.conf import settings
from django.utils import timezone

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
            from finance.models import FinanceTransaction
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
