import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from homework_attends.models import Attendance

from finance.services import update_attendance_based_payments

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Attendance)
def handle_attendance_save(sender, instance, created, **kwargs):
    """
    Attendance saqlanganda (yangi yaratilgan yoki o'zgartirilgan)
    discount/negotiated studentlar uchun joriy oyda qayta hisoblashni ishga tushiradi.
    """
    try:
        if not instance.student_id or not instance.student:
            return
    except Exception:
        return

    if instance.student.status in ["discount", "negotiated"]:
        update_attendance_based_payments(
            instance.student, instance.group, instance.date
        )


@receiver(post_delete, sender=Attendance)
def handle_attendance_delete(sender, instance, **kwargs):
    """
    Attendance o'chirilganda ham
    discount/negotiated studentlar uchun joriy oyda qayta hisoblashni ishga tushiradi.
    """
    try:
        if not instance.student_id or not instance.student:
            return
    except Exception:
        return

    if instance.student.status in ["discount", "negotiated"]:
        update_attendance_based_payments(
            instance.student, instance.group, instance.date
        )

from django.db.models import Sum
from groups.models import Student
from finance.models import FinanceTransaction, StudentFinanceProfile

@receiver(post_save, sender=Student)
def create_student_finance_profile(sender, instance, created, **kwargs):
    """
    Yangi o'quvchi yaratilganda avtomatik Wallet profilini ham ochish.
    """
    if created:
        StudentFinanceProfile.objects.get_or_create(student=instance)

@receiver(post_save, sender=FinanceTransaction)
@receiver(post_delete, sender=FinanceTransaction)
def update_student_wallet(sender, instance, **kwargs):
    """
    Moliya tranzaksiyasi qo'shilganda yoki o'chirilganda Wallet statistikasini yangilash.
    """
    if not instance.student_id:
        return
        
    if instance.category in ['student_fee', 'refund']:
        student = instance.student
        profile, _ = StudentFinanceProfile.objects.get_or_create(student=student)
        
        paid_agg = FinanceTransaction.objects.filter(
            student=student, 
            transaction_type='income',
            category='student_fee'
        ).aggregate(total=Sum('amount'))
        
        refund_agg = FinanceTransaction.objects.filter(
            student=student, 
            transaction_type='expense',
            category='refund'
        ).aggregate(total=Sum('amount'))
        
        profile.total_paid_all_time = paid_agg['total'] or 0
        profile.total_refunded = refund_agg['total'] or 0
        
        last_payment = FinanceTransaction.objects.filter(
            student=student,
            transaction_type='income',
            category='student_fee'
        ).order_by('-date').first()
        
        if last_payment:
            profile.last_payment_date = last_payment.date
        else:
            profile.last_payment_date = None
            
        profile.save(update_fields=['total_paid_all_time', 'total_refunded', 'last_payment_date', 'updated_at'])
