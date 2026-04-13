import logging
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
    """
    clean_phone = clean_phone.replace(' ', '').replace('-', '').replace('+', '')
    if len(clean_phone) < 7:
        return []

    last_9 = clean_phone[-9:]
    
    # Bazadagi o'quvchilarni olamiz (faqat raqami borlarni)
    all_students = Student.objects.exclude(phone='', parent_phone='')
    
    found_student_info = []
    seen_entries = set()

    for student in all_students:
        is_match = False
        
        # Student o'zining raqami
        if student.phone:
            s_phone_clean = student.phone.replace(' ', '').replace('-', '').replace('+', '')
            if last_9 in s_phone_clean:
                student.telegram_id = chat_id
                is_match = True
        
        # Ota-ona raqami
        if student.parent_phone:
            p_phone_clean = student.parent_phone.replace(' ', '').replace('-', '').replace('+', '')
            if last_9 in p_phone_clean:
                student.parent_telegram_id = chat_id
                is_match = True
        
        if is_match:
            student.save()
            # Guruh nomini ham qo'shamiz
            group_name = student.group.name if student.group else "Guruhsiz"
            # Ismdagi ortiqcha bo'shliqlarni olib tashlaymiz va formatlaymiz
            full_name = student.full_name.strip()
            entry = f"{full_name} ({group_name})"
            
            # Har xil yozilgan (masalan: "Ali" va "ali") ismlarni bitta deb hisoblash uchun
            if entry.lower() not in seen_entries:
                found_student_info.append(entry)
                seen_entries.add(entry.lower())
            
    return found_student_info

async def contact_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Kontakt kelganda uni bazada qidirish"""
    contact = update.message.contact
    phone = contact.phone_number
    
    # Raqamni normallash (masalan: +998901234567 -> 998901234567)
    clean_phone = phone.replace('+', '').replace(' ', '')
    if clean_phone.startswith('998'):
        clean_phone = clean_phone # To'liq format
    elif len(clean_phone) == 9:
        clean_phone = '998' + clean_phone

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
