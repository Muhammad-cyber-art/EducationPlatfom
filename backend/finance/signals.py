import logging
from decimal import Decimal
from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from homework_attends.models import Attendance
from finance.models import Payment, EmployeePayment
from finance.services import apply_calculated_salary_to_employee_payment
from finance.utils import calculate_discount_student_payment, normalize_month

logger = logging.getLogger(__name__)


def recalculate_discount_student_payment(student, group, attendance_date):
    """
    Imtiyozli (discount status) student uchun Payment ni qayta hisoblash va mentor oyligini yangilash
    """
    month_date = normalize_month(attendance_date)
    
    try:
        # Discount student uchun payment yaratish yoki yangilash
        payment, created = Payment.objects.get_or_create(
            student=student,
            group=group,
            month=month_date,
            defaults={
                'amount': Decimal('0'),
                'paid_amount': Decimal('0'),
                'is_paid': False,
            }
        )
        
        if student.status == 'discount':
            # Yeni summani hisoblash
            new_amount = calculate_discount_student_payment(student, group, month_date)
            payment.amount = new_amount
            # Discount student uchun to'lov avtomatik tasdiqlangan (actual = expected deb hisoblaymiz, lekin is_paid False qoladi
            payment.save()
        
        # Mentor oyligini ham qayta hisoblash
        if hasattr(group, 'mentor') and group.mentor and hasattr(group.mentor, 'staff_profile'):
            mentor = group.mentor
            profile = mentor.staff_profile
            if profile.salary_type in ['percentage', 'student_count']:
                try:
                    emp_payment = EmployeePayment.objects.filter(
                        employee=mentor,
                        month=month_date,
                        is_paid=False
                    ).first()
                    
                    if emp_payment:
                        emp_payment.recalculate_salary()
                        emp_payment.save()
                    else:
                        # To'lov mavjud emas, yangi yaratish
                        emp_payment, _ = EmployeePayment.objects.get_or_create(
                            employee=mentor,
                            month=month_date,
                            defaults={
                                'salary_base': 0,
                                'bonus': 0,
                                'deductions': 0,
                                'is_paid': False,
                                'attendance_deductions': {}
                            }
                        )
                        emp_payment.recalculate_salary()
                        emp_payment.save()
                except Exception as salary_err:
                    logger.exception(f"Mentor oyligini qayta hisoblashda xatolik: {salary_err}")
                
    except Exception as err:
        logger.exception(f"To'lovni qayta hisoblashda xatolik: {err}")


@receiver(post_save, sender=Attendance)
def handle_attendance_save(sender, instance, created, **kwargs):
    """
    Attendance saqlanganda (yangi yaratilgan yoki o'zgartirilgan)
    imtiyozli student uchun paymentni qayta hisoblash
    """
    if instance.student.status == 'discount':
        with transaction.atomic():
            recalculate_discount_student_payment(
                student=instance.student,
                group=instance.group,
                attendance_date=instance.date
            )


@receiver(post_delete, sender=Attendance)
def handle_attendance_delete(sender, instance, **kwargs):
    """
    Attendance o'chirilganda ham
    imtiyozli student uchun paymentni qayta hisoblash
    """
    if instance.student.status == 'discount':
        with transaction.atomic():
            recalculate_discount_student_payment(
                student=instance.student,
                group=instance.group,
                attendance_date=instance.date
            )
