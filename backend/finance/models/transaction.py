from django.db import models
from django.conf import settings

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
