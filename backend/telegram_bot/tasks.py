from celery import shared_task
import time
import logging
from .utils import _send_message_sync, get_student_telegram_ids

logger = logging.getLogger(__name__)

@shared_task
def send_attendance_notifications_task(attendance_ids):
    """
    Davomat xabarnomalarini fonda (Celery orqali) navbat bilan yuborish.
    """
    from homework_attends.models import Attendance
    from .signals import send_attendance_notification
    
    attendances = Attendance.objects.filter(id__in=attendance_ids).select_related('student', 'group')
    
    for att in attendances:
        try:
            # async_send=False qilamiz, chunki o'zi fon taskida ketayapti, 
            # har bir xabar uchun alohida thread shartmas, aksincha ularni navbat bilan yuboramiz.
            send_attendance_notification(att, async_send=False)
            time.sleep(0.05) # Telegram bot limitini buzmaslik uchun
        except Exception as e:
            logger.error(f"Error in send_attendance_notifications_task for att {att.id}: {e}")

@shared_task
def send_broadcast_message_task(chat_ids, message):
    """
    Ommaviy xabarlarni (Broadcast) fonda, navbat bilan yuborish.
    """
    if not chat_ids:
        return
    
    # Unikal IDlar ro'yxatiga o'tkazamiz
    ids_list = list(set(chat_ids))
    
    for chat_id in ids_list:
        try:
            _send_message_sync(chat_id, message)
            time.sleep(0.05) # ~20 xabar/sekund (Telegram limitiga mos)
        except Exception as e:
            logger.error(f"Error in send_broadcast_message_task for chat {chat_id}: {e}")
