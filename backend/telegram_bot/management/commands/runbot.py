import logging
import re
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import Q
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from groups.models import Student
from asgiref.sync import sync_to_async

# Logging sozlash
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# BOT_TOKEN
TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')

class Command(BaseCommand):
    help = 'Telegram botni ishga tushirish'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Bot ishga tushmoqda...'))
        print(">>> Bot polling rejimida ishga tushirildi...")
        
        if not TOKEN:
            self.stdout.write(self.style.ERROR('XATO: TELEGRAM_BOT_TOKEN settings.py da topilmadi!'))
            return

        app = ApplicationBuilder().token(TOKEN).build()

        # Handlers
        app.add_handler(CommandHandler("start", start))
        app.add_handler(MessageHandler(filters.CONTACT, contact_handler))
        app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), text_handler))

        self.stdout.write(self.style.SUCCESS('Bot muvaffaqiyatli ishga tushdi (Polling mode)'))
        app.run_polling()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start komandasi - kontakni so'rash"""
    keyboard = [[KeyboardButton("📞 Telefon raqamni yuborish", request_contact=True)]]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)
    
    await update.message.reply_html(
        f"<b>Assalomu alaykum!</b>\n\n"
        f"Ushbu bot orqali o'quvchining davomati, to'lovlari va test natijalarni kuzatib borishingiz mumkin.\n"
        f"Botdan foydalanish uchun telefon raqamingizni yuboring:",
        reply_markup=reply_markup
    )

@sync_to_async
def get_and_update_students(clean_phone, chat_id):
    """
    Telefon raqami bo'yicha barcha mos keluvchi o'quvchilarni topish va 
    ularning Telegram IDlarini yangilash.
    Optimizatsiya: bulk_update orqali signal triggerlarini oldini oladi.
    """
    clean_phone = re.sub(r'\D', '', clean_phone)
    if len(clean_phone) < 7:
        return []

    last_9 = clean_phone[-9:]
    
    # Bazadagi barcha o'quvchilarni tekshiramiz
    all_students = Student.objects.all()
    
    found_student_info = []
    seen_entries = set()
    to_update = []  # bulk_update uchun

    for student in all_students:
        is_match = False
        
        # Student o'zining raqami (aniq moslik: oxirgi 9 raqam)
        if student.phone:
            s_phone_clean = re.sub(r'\D', '', student.phone)
            if s_phone_clean.endswith(last_9):
                student.telegram_id = chat_id
                is_match = True
        
        # Ota-ona raqami (aniq moslik: oxirgi 9 raqam)
        if student.parent_phone:
            p_phone_clean = re.sub(r'\D', '', student.parent_phone)
            if p_phone_clean.endswith(last_9):
                student.parent_telegram_id = chat_id
                is_match = True
        
        if is_match:
            to_update.append(student)
            # Guruh nomini ham qo'shamiz
            group_name = student.group.name if student.group else "Guruhsiz"
            full_name = student.full_name.strip()
            entry = f"{full_name} ({group_name})"
            
            if entry.lower() not in seen_entries:
                found_student_info.append(entry)
                seen_entries.add(entry.lower())
    
    # Optimizatsiya: bulk_update orqali signallarni trigger qilmasdan saqlash
    if to_update:
        update_fields = []
        for s in to_update:
            if s.telegram_id == chat_id and 'telegram_id' not in update_fields:
                update_fields.append('telegram_id')
            if s.parent_telegram_id == chat_id and 'parent_telegram_id' not in update_fields:
                update_fields.append('parent_telegram_id')
        Student.objects.bulk_update(to_update, update_fields)
            
    return found_student_info

async def contact_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Kontakt kelganda uni bazada qidirish"""
    contact = update.message.contact
    phone = contact.phone_number
    
    # Faqat raqamlar qolishini ta'minlash (xavfsiz va aniq moslik uchun)
    clean_phone = re.sub(r'\D', '', phone)
    chat_id = str(update.effective_chat.id)
    
    # Studentlarni qidirish va yangilash
    student_names_list = await get_and_update_students(clean_phone, chat_id)

    if student_names_list:
        student_names = ", ".join(student_names_list)
        await update.message.reply_html(
            f"✅ <b>Tasdiqlandi!</b>\n\n"
            f"Siz quyidagi o'quvchilar bilan bog'landingiz: <b>{student_names}</b>\n"
            f"Endi barcha yangiliklar ushbu botga yuborib turiladi."
        )
    else:
        await update.message.reply_html(
            f"❌ <b>Kechirasiz!</b>\n\n"
            f"Tizimda <code>{phone}</code> raqami topilmadi.\n"
            f"Iltimos, o'quv markaziga murojaat qilib, raqamingizni to'g'irlatib oling."
        )

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Oddiy matnlarga javob"""
    await update.message.reply_text("Iltimos, pastdagi tugmani bosing yoki raqamingizni yuboring.")
