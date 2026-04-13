import threading
import requests
from django.conf import settings
from django.db.models import Q
import logging

# Circular importni oldini olish uchun modelni funksiya ichida import qilamiz
# yoki Student modelini groups.models dan olamiz.
# Lekin Student modeli groups.models da ekanligini bilamiz.

logger = logging.getLogger(__name__)

# BOT_TOKEN ni settings dan olish (settings.py da .env dan yuklanadi)
BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')

if not BOT_TOKEN:
    logger.warning("TELEGRAM_BOT_TOKEN sozlanmagan! .env faylini tekshiring.")

def get_student_telegram_ids(student):
    """
    O'quvchi va uning ota-onasiga tegishli barcha unikal Telegram IDlarni yig'ish.
    Bir xil telefon raqamli boshqa o'quvchilardan ham IDlarni qidiradi (aka-ukalar uchun).
    """
    from groups.models import Student 
    chat_ids = set()
    
    # 1. Bevosita o'zining IDlari
    if student.telegram_id:
        chat_ids.add(student.telegram_id)
    if student.parent_telegram_id:
        chat_ids.add(student.parent_telegram_id)
        
    return chat_ids

def send_telegram_message_async(chat_id, text):
    """Xabarni asinxron (threading orqali) jo'natish - serverni qotirmaydi"""
    if not chat_id:
        return
    
    thread = threading.Thread(target=_send_message_sync, args=(chat_id, text))
    thread.start()

def _send_message_sync(chat_id, text):
    """Xabarni yuborishning sinxron qismi"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML'
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code != 200:
            logger.error(f"Telegram error: {response.text}")
    except Exception as e:
        logger.error(f"Telegram connection error: {e}")
