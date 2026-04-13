from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Group, Attendance
import logging

logger = logging.getLogger(__name__)

@shared_task
def create_attendance_task():
    logger.info("Davomat yaratish boshlandi...")
    tomorrow = timezone.localdate() + timedelta(days=1)
    groups = Group.objects.all()
    count = 0

    for group in groups:
        # User talabi: Boshlanish sanasi kelmaguncha davomat ishlamasligi kerak
        if not group.is_logic_enabled():
            continue

        # FAQAT ertangi kunga qadar qo'shilgan studentlar uchun yaratadi
        students = group.students.filter(joined_at__date__lte=tomorrow)
        
        if students.exists():
            for student in students:
                obj, created = Attendance.objects.get_or_create(
                    student=student,
                    group=group,
                    date=tomorrow,
                    defaults={'is_present': True}
                )
                if created:
                    count += 1
    
    logger.info(f"{tomorrow} uchun {count} ta davomat yaratildi.")
    return count
