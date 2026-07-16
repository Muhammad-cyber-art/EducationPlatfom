from django.db import models

class StudentFinanceProfile(models.Model):
    """
    O'quvchining moliyaviy holati va tarixiy statistikasi (Wallet).
    O'quvchi tomonidan jami to'langan pullar va qaytarilgan pullarni saqlaydi.
    """
    student = models.OneToOneField(
        'groups.Student', 
        on_delete=models.CASCADE, 
        related_name='finance_profile',
        verbose_name="O'quvchi"
    )
    total_paid_all_time = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0,
        verbose_name="Jami to'lagan (hayoti davomida)"
    )
    total_refunded = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0,
        verbose_name="Jami qaytarilgan (refunds)"
    )
    last_payment_date = models.DateField(
        null=True, 
        blank=True,
        verbose_name="Oxirgi to'lov sanasi"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "O'quvchi Moliyaviy Profili (Wallet)"
        verbose_name_plural = "O'quvchilar Moliyaviy Profillari"

    def __str__(self):
        return f"{self.student.full_name} Wallet"
