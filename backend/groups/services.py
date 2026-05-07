import logging
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Group, Student, GroupEnrollment, GroupTransfer, WaitingStudent
from finance.models import Payment, FinanceTransaction
from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult

logger = logging.getLogger(__name__)

def enroll_student_to_group(group, student_id, create_payment=True):
    """O'quvchini guruhga biriktirish logikasi"""
    student = get_object_or_404(Student, id=student_id)
    
    with transaction.atomic():
        enrollment, created = GroupEnrollment.objects.get_or_create(
            student=student,
            group=group
        )
        
        if created:
            # Legacy FK field support
            if not student.group:
                student.group = group
                student.save()
            
            if create_payment:
                from finance.utils import floor_amount
                today = timezone.now().date()
                month_start = today.replace(day=1)
                base_price = student.custom_fee if student.custom_fee is not None else group.monthly_price
                final_amount = floor_amount(base_price)

                Payment.objects.get_or_create(
                    student=student,
                    group=group,
                    month=month_start,
                    defaults={
                        'amount': final_amount,
                        'is_paid': False
                    }
                )
            return enrollment, True
        return enrollment, False

def unenroll_student_from_group(group, student_id, request_user):
    """O'quvchini guruhdan chiqarish logikasi"""
    student = get_object_or_404(Student, id=student_id)
    enrollment = GroupEnrollment.objects.filter(student=student, group=group).first()
    
    if not enrollment:
        raise ValueError("Ushbu o'quvchi bu guruhda emas")

    with transaction.atomic():
        enrollment.delete()
        
        remaining_groups = student.groups.all()
        if remaining_groups.count() == 0:
            from archivebase.services import move_student_to_waiting_hall
            move_student_to_waiting_hall(student, request_user, reason=f"{group.name} guruhidan chiqarildi")
            return "waiting_hall"
        else:
            if student.group == group:
                student.group = remaining_groups.first()
                student.save()
            return "active_elsewhere"

def transfer_student_to_group(student, new_group_id, request_user, reason, from_group_id=None):
    """O'quvchini bir guruhdan boshqasiga o'tkazish"""
    new_group = get_object_or_404(Group, id=new_group_id)
    
    if from_group_id:
        old_group = get_object_or_404(Group, id=from_group_id)
    else:
        old_group = student.group

    if not old_group:
        raise ValueError("O'quvchi hozirda bironta guruhda emas")
        
    if old_group == new_group:
        raise ValueError("O'quvchi allaqachon ushbu guruhda")

    with transaction.atomic():
        from finance.utils import floor_amount
        today = timezone.now().date()
        current_month_start = today.replace(day=1)

        # 0. Snapshot fees
        old_group_fee = floor_amount(
            student.custom_fee if student.custom_fee is not None else old_group.monthly_price
        )
        new_group_fee = floor_amount(
            student.custom_fee if student.custom_fee is not None else new_group.monthly_price
        )

        # 1. Enrollmentlar bilan ishlash
        GroupEnrollment.objects.filter(student=student, group=old_group).delete()
        GroupEnrollment.objects.get_or_create(student=student, group=new_group)

        # 2. To'lovni ko'chirish
        old_payment = Payment.objects.filter(
            student=student,
            group=old_group,
            month=current_month_start
        ).first()

        if old_payment:
            existing_new = Payment.objects.filter(
                student=student, group=new_group, month=current_month_start
            ).first()
            if not existing_new:
                old_payment.group = new_group
                if not old_payment.is_paid:
                    old_payment.amount = new_group_fee
                old_payment.save()
            else:
                if old_payment.is_paid and not existing_new.is_paid:
                    existing_new.is_paid = True
                    existing_new.amount = old_payment.amount
                    existing_new.save()
                old_payment.delete()
        else:
            Payment.objects.get_or_create(
                student=student,
                group=new_group,
                month=current_month_start,
                defaults={'amount': new_group_fee, 'is_paid': False}
            )

        # 3. Transfer log
        GroupTransfer.objects.create(
            student=student,
            from_group=old_group,
            to_group=new_group,
            transfer_date=today,
            reason=reason,
            marked_by=request_user,
            old_group_fee=old_group_fee,
            new_group_fee=new_group_fee
        )

        # 4. Student model yangilash (agar student.group shu eski guruh bo'lsa yoki umuman bo'lmasa)
        if student.group == old_group or not student.group:
            student.group = new_group
            student.branch = new_group.branch
            student.save()
        
    return True

def merge_student_profiles(master, duplicate_id):
    """Ikki o'quvchi profilini birlashtirish"""
    duplicate = get_object_or_404(Student, id=duplicate_id)
    
    with transaction.atomic():
        # 1. Enrollments
        for enrollment in duplicate.enrollments.all():
            GroupEnrollment.objects.get_or_create(student=master, group=enrollment.group)
        
        # 2. Attendance
        Attendance.objects.filter(student=duplicate).update(student=master)
        # Handle unique conflicts for same date/lesson
        attendances = Attendance.objects.filter(student=duplicate)
        for attr in attendances:
            try:
                attr.student = master
                attr.save()
            except IntegrityError:
                attr.delete()

        # 3. Homework & Results
        HomeworkSubmission.objects.filter(student=duplicate).update(student=master)
        MockTestResult.objects.filter(student=duplicate).update(student=master)

        # 4. Finance
        Payment.objects.filter(student=duplicate).update(student=master)
        FinanceTransaction.objects.filter(student=duplicate).update(student=master)

        # 5. History
        GroupTransfer.objects.filter(student=duplicate).update(student=master)

        # 6. Metadata merge
        if not master.telegram_id: master.telegram_id = duplicate.telegram_id
        if not master.parent_telegram_id: master.parent_telegram_id = duplicate.parent_telegram_id
        
        master.notes = f"{master.notes or ''}\n[MERGED FROM {duplicate.id}]: {duplicate.notes or ''}".strip()
        master.save()

        # 7. Delete duplicate
        duplicate.delete()
        
    return master

def assign_waiting_student_to_group(waiting_student, group_id, request_user):
    """Kutish zalidagi o'quvchini guruhga biriktirish"""
    group = get_object_or_404(Group, id=group_id)
    
    with transaction.atomic():
        from archivebase.models import ArchivedStudent
        from archivebase.services import restore_student_from_archive
        
        # Arxivdan tekshirish
        archived = ArchivedStudent.objects.filter(
            full_name=waiting_student.full_name,
            metadata__phone=waiting_student.phone
        ).order_by('-archived_at').first()

        if archived:
            student = restore_student_from_archive(archived.id, request_user)
            student.group = group
            student.save()
            archived.delete()
        else:
            student = Student.objects.create(
                branch=group.branch,
                group=group,
                full_name=waiting_student.full_name,
                phone=waiting_student.phone,
                notes=waiting_student.notes
            )
        
        # Many-to-Many link
        GroupEnrollment.objects.get_or_create(student=student, group=group)
        waiting_student.delete()
        
    return student
