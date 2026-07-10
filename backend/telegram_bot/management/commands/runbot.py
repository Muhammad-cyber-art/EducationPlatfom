import logging
import re
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import Q
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes, ConversationHandler, TypeHandler
from groups.models import Student
from authenticatsiya.models import UserModel
from telegram_bot.models import BotProfile
from asgiref.sync import sync_to_async
from telegram_bot.bot_middleware import auth_middleware, require_roles, require_admin, require_super_admin, require_student, require_auth

# Logging sozlash
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# BOT_TOKEN
TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')

# Conversation states
PHONE, CONFIRM = range(2)

class Command(BaseCommand):
    help = 'Telegram botni ishga tushirish (Barcha rollar uchun universal bot)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Bot ishga tushmoqda...'))
        print(">>> Bot polling rejimida ishga tushirildi...")
        
        if not TOKEN:
            self.stdout.write(self.style.ERROR('XATO: TELEGRAM_BOT_TOKEN settings.py da topilmadi!'))
            return

        app = ApplicationBuilder().token(TOKEN).build()

        # TypeHandler barcha update'lardan oldin ishlashi uchun group=-1
        app.add_handler(TypeHandler(Update, auth_middleware), group=-1)

        # Conversation handler for authentication
        conv_handler = ConversationHandler(
            entry_points=[CommandHandler("start", start)],
            states={
                PHONE: [MessageHandler(filters.CONTACT, contact_handler)],
                CONFIRM: [MessageHandler(filters.TEXT & ~filters.COMMAND, confirm_handler)],
            },
            fallbacks=[CommandHandler("cancel", cancel)],
        )

        # Handlers
        app.add_handler(conv_handler)
        app.add_handler(CommandHandler("help", help_command))
        app.add_handler(CommandHandler("menu", show_main_menu))
        app.add_handler(CommandHandler("admin", admin_panel))
        app.add_handler(CallbackQueryHandler(button_callback))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

        self.stdout.write(self.style.SUCCESS('Bot muvaffaqiyatli ishga tushdi (Polling mode)'))
        app.run_polling()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start komandasi - ro'yxatdan o'tish jarayoni"""
    role = context.user_data.get('role', 'guest')
    
    if role != 'guest':
        await show_main_menu(update, context)
        return ConversationHandler.END
    
    # Ro'yxatdan o'tmagan bo'lsa, kontaktni so'rash
    keyboard = [[KeyboardButton("📞 Telefon raqamni yuborish", request_contact=True)]]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)
    
    await update.message.reply_html(
        f"<b>Assalomu alaykum!</b>\n\n"
        f"Ushbu bot orqali platformamizdan foydalanishingiz mumkin.\n"
        f"Botdan foydalanish uchun telefon raqamingizni yuboring:",
        reply_markup=reply_markup
    )
    
    return PHONE

@sync_to_async
def process_contact_and_create_profile(clean_phone, chat_id):
    """
    Telefon raqami bo'yicha UserModel va Student qidirish va BotProfile yaratish.
    """
    possible_numbers = {clean_phone}
    if clean_phone.startswith('998'):
        possible_numbers.add(clean_phone[3:])
    else:
        possible_numbers.add('998' + clean_phone)

    # 1. Admin/Super Admin qidirish
    for phone in possible_numbers:
        user = UserModel.objects.select_related('branch').filter(
            Q(phone_number=phone) | Q(phone_number__endswith=phone[-9:]),
            role__in=['admin', 'super_admin', 'teacher'],
            is_active=True
        ).first()
        if user:
            profile, created = BotProfile.objects.update_or_create(
                telegram_id=chat_id,
                defaults={
                    'phone_number': user.phone_number,
                    'role': user.role,
                    'user': user,
                    'is_active': True
                }
            )
            return profile, 'admin_confirm_needed'

    # 2. Student qidirish
    found_student_names = []
    student_profile_created = False
    profile = None
    
    for phone in possible_numbers:
        students = Student.objects.filter(
            Q(phone=phone) | Q(phone__endswith=phone[-9:]) | Q(parent_phone=phone) | Q(parent_phone__endswith=phone[-9:]),
            is_active=True
        )
        for student in students:
            if not student_profile_created:
                profile, created = BotProfile.objects.update_or_create(
                    telegram_id=chat_id,
                    defaults={
                        'phone_number': student.phone or student.parent_phone or phone,
                        'role': 'student',
                        'student': student,
                        'is_active': True
                    }
                )
                student_profile_created = True
            
            # Guruhlarni yig'ish
            active_groups = student.groups.filter(enrollments__is_active=True).distinct()
            if not active_groups and student.group:
                active_groups = [student.group]
            
            if not active_groups:
                found_student_names.append(f"{student.full_name.strip()} (Guruhsiz)")
            else:
                for group in active_groups:
                    found_student_names.append(f"{student.full_name.strip()} ({group.name})")

    if student_profile_created:
        return profile, found_student_names
    
    return None, None

async def contact_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Kontakt kelganda uni bazada qidirish (student va admin)"""
    contact = update.message.contact
    phone = contact.phone_number
    clean_phone = re.sub(r'\D', '', phone)
    chat_id = str(update.effective_chat.id)
    
    profile, result = await process_contact_and_create_profile(clean_phone, chat_id)
    
    if profile:
        context.user_data['bot_profile'] = profile
        context.user_data['role'] = profile.role
        
        if result == 'admin_confirm_needed':
            branch_name = profile.user.branch.name if profile.user.branch else 'Biriktirilmagan'
            await update.message.reply_html(
                f"✅ <b>Foydalanuvchi topildi!</b>\n\n"
                f"Ism: <b>{profile.get_full_name()}</b>\n"
                f"Rol: <b>{profile.get_role_display()}</b>\n"
                f"Filial: {branch_name}\n\n"
                f"Tasdiqlash uchun <b>HA</b> yozing, bekor qilish uchun <b>YO'Q</b>."
            )
            return CONFIRM
        else: # student
            student_names = ", ".join(list(set(result)))
            await update.message.reply_html(
                f"✅ <b>Tasdiqlandi!</b>\n\n"
                f"Siz quyidagi o'quvchilar bilan bog'landingiz: <b>{student_names}</b>\n"
            )
            await show_main_menu(update, context)
            return ConversationHandler.END
    else:
        await update.message.reply_html(
            f"❌ <b>Kechirasiz!</b>\n\n"
            f"Tizimda <code>{phone}</code> raqami topilmadi.\n"
            f"Iltimos, markazga murojaat qilib, raqamingizni to'g'irlatib oling."
        )
        return ConversationHandler.END

async def confirm_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin tasdiqlash jarayoni"""
    text = update.message.text.strip().upper()
    
    if text == 'HA':
        profile = context.user_data.get('bot_profile')
        if profile:
            await update.message.reply_html(
                f"✅ <b>Muvaffaqiyatli ro'yxatdan o'tdingiz!</b>\n\n"
                f"Assalomu alaykum, {profile.get_full_name()}!"
            )
            await show_main_menu(update, context)
            logger.info(f"User {profile.get_full_name()} authenticated as {profile.role}")
        else:
            await update.message.reply_html("<b>❌ Xatolik!</b>\n\nSessiya tugadi. Qaytadan /start bosing.")
        return ConversationHandler.END
    
    elif text == 'YOQ':
        context.user_data.clear() # Sessiyani tozalash
        await update.message.reply_html(
            "<b>❌ Bekor qilindi.</b>\n\nQaytadan ro'yxatdan o'tish uchun /start bosing."
        )
        return ConversationHandler.END
    else:
        await update.message.reply_html("Iltimos, <b>HA</b> yoki <b>YO'Q</b> deb javob bering.")
        return CONFIRM

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bekor qilish"""
    context.user_data.clear()
    await update.message.reply_html(
        "<b>❌ Bekor qilindi.</b>\n\nQaytadan ro'yxatdan o'tish uchun /start bosing."
    )
    return ConversationHandler.END

@require_auth
async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Asosiy menuni ko'rsatish (rolga qarab)"""
    role = context.user_data.get('role')
    profile = context.user_data.get('bot_profile')
    
    if role in ['admin', 'super_admin']:
        keyboard = [
            [InlineKeyboardButton("📋 Kunlik Hisobot", callback_data='daily_report')],
            [InlineKeyboardButton("📁 Oylik Davomat", callback_data='attendance_report')],
        ]
        if role == 'super_admin':
            keyboard.append([InlineKeyboardButton("💰 Moliyaviy Hisobot", callback_data='financial_report')])
        keyboard.append([InlineKeyboardButton("ℹ️ Yordam", callback_data='help')])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        branch_name = profile.user.branch.name if profile.user and profile.user.branch else 'Biriktirilmagan'
        
        await update.message.reply_html(
            f"<b>👋 Assalomu alaykum, {profile.get_full_name()}!</b>\n\n"
            f"Rol: <b>{profile.get_role_display()}</b>\n"
            f"Filial: {branch_name}\n\n"
            f"<b>Admin Panel</b>dan foydalanishingiz mumkin:",
            reply_markup=reply_markup
        )
    elif role == 'teacher':
        keyboard = [
            [InlineKeyboardButton("📚 Mening Guruhlarim", callback_data='my_groups')],
            [InlineKeyboardButton("📝 Uy vazifalari", callback_data='homework')],
            [InlineKeyboardButton("ℹ️ Yordam", callback_data='help')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_html(
            f"<b>👋 Assalomu alaykum, Ustoz!</b>\n\n"
            f"Quyidagi bo'limlardan foydalanishingiz mumkin:",
            reply_markup=reply_markup
        )
    else: # student
        keyboard = [
            [InlineKeyboardButton("📚 Mening Guruhim", callback_data='my_group')],
            [InlineKeyboardButton("📊 Davomat", callback_data='attendance')],
            [InlineKeyboardButton("💰 To'lovlar", callback_data='payments')],
            [InlineKeyboardButton("📝 Uy vazifalari", callback_data='homework')],
            [InlineKeyboardButton("ℹ️ Yordam", callback_data='help')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_html(
            f"<b>👋 Assalomu alaykum!</b>\n\n"
            f"Quyidagi bo'limlardan foydalanishingiz mumkin:",
            reply_markup=reply_markup
        )

@require_auth
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Yordam komandasi"""
    role = context.user_data.get('role')
    
    if role in ['admin', 'super_admin']:
        help_text = (
            f"<b>📚 Yordam</b>\n\n"
            f"<b>Mavjud buyruqlar:</b>\n"
            f"/start - Boshlash\n"
            f"/menu - Asosiy menyu\n"
            f"/admin - Admin panel\n"
            f"/help - Yordam\n\n"
            f"<b>Avtomatik hisobotlar:</b>\n"
            f"• Kunlik hisobot - Har kuni soat 20:00 da\n"
            f"• Oylik davomat - Oy oxirida soat 21:00 da\n"
            f"• Oylik moliya (Super Admin) - Oy oxirida soat 21:30 da"
        )
    else:
        help_text = (
            f"<b>📚 Yordam</b>\n\n"
            f"<b>Mavjud buyruqlar:</b>\n"
            f"/start - Boshlash\n"
            f"/menu - Asosiy menyu\n"
            f"/help - Yordam"
        )
    
    if update.message:
        await update.message.reply_html(help_text)
    elif update.callback_query:
        await update.callback_query.edit_message_text(help_text, parse_mode='HTML')

@require_admin
async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin panel"""
    await show_main_menu(update, context)

@require_auth
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Tugma callback'larini qayta ishlash"""
    query = update.callback_query
    await query.answer()
    
    callback_data = query.data
    role = context.user_data.get('role')
    profile = context.user_data.get('bot_profile')
    
    if callback_data == 'admin_panel':
        await show_main_menu(update, context)
    
    elif callback_data == 'daily_report':
        if role in ['admin', 'super_admin']:
            from reports.admin_tasks import send_manual_daily_report
            task = send_manual_daily_report.delay(profile.user.id)
            await query.edit_message_text(f"<b>⏳ Hisobot tayyorlanmoqda...</b>\n\nHisobot tez orada yuboriladi.", parse_mode='HTML')
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
    
    elif callback_data == 'attendance_report':
        if role in ['admin', 'super_admin']:
            from reports.admin_tasks import send_manual_monthly_attendance
            from django.utils import timezone
            now = timezone.now()
            task = send_manual_monthly_attendance.delay(profile.user.id, now.year, now.month)
            await query.edit_message_text(f"<b>⏳ Oylik davomat arxivi tayyorlanmoqda...</b>\n\nArxiv tez orada yuboriladi.", parse_mode='HTML')
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
    
    elif callback_data == 'financial_report':
        if role == 'super_admin':
            from reports.admin_tasks import send_manual_monthly_financial
            from django.utils import timezone
            now = timezone.now()
            task = send_manual_monthly_financial.delay(profile.user.id, now.year, now.month)
            await query.edit_message_text(f"<b>⏳ Oylik moliyaviy hisobot tayyorlanmoqda...</b>\n\nHisobot tez orada yuboriladi.", parse_mode='HTML')
        else:
            await query.edit_message_text("<b>❌ Ruxsat yo'q!</b>", parse_mode='HTML')
    
    elif callback_data == 'help':
        await help_command(update, context)
    
    else:
        await query.edit_message_text(f"<b>ℹ️ Ma'lumot</b>\n\nBu funksiya hozircha ishlab chiqilmoqda.\nTez orada qo'shiladi.", parse_mode='HTML')

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Oddiy matnlarga javob"""
    role = context.user_data.get('role', 'guest')
    
    if role != 'guest':
        await update.message.reply_html(
            f"<b>ℹ️ Menyu</b>\n\nAsosiy menyu uchun /menu buyrug'ini bering."
        )
    else:
        await update.message.reply_html(
            "Iltimos, pastdagi tugmani bosing yoki raqamingizni yuboring."
        )
