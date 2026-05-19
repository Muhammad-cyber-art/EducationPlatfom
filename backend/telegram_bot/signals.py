from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Q
from groups.models import Student
from homework_attends.models import Attendance, MockTestResult, HomeworkSubmission, Homework
from finance.models import Payment
from .utils import send_telegram_message_async, get_student_telegram_ids


@receiver(post_save, sender=Student)
def sync_student_telegram_id(sender, instance, created, **kwargs):
    """
    Yangi o'quvchi qo'shilganda yoki tahrirlanganda, agar uning telefon raqami 
    boshqa bir o'quvchida mavjud bo'lsa va unga Telegram ID biriktirilgan bo'lsa, o'sha IDni nusxalaymiz.
    """
    import re
    update_fields = {}
    
    # 1. O'quvchi raqami orqali qidirish
    if instance.phone and not instance.telegram_id:
        clean_phone = re.sub(r'\D', '', instance.phone)
        if clean_phone.isdigit() and len(clean_phone) >= 9:
            last_9 = clean_phone[-9:]
            
            # Telegram IDga ega bo'lgan boshqa o'quvchilarni tekshiramiz
            candidates = Student.objects.exclude(id=instance.id).filter(
                Q(telegram_id__isnull=False, telegram_id__gt='') | 
                Q(parent_telegram_id__isnull=False, parent_telegram_id__gt='')
            )
            
            for other in candidates:
                if other.phone:
                    other_clean = re.sub(r'\D', '', other.phone)
                    if other_clean.endswith(last_9):
                        update_fields['telegram_id'] = other.telegram_id or other.parent_telegram_id
                        break
                if other.parent_phone:
                    other_p_clean = re.sub(r'\D', '', other.parent_phone)
                    if other_p_clean.endswith(last_9):
                        update_fields['telegram_id'] = other.parent_telegram_id or other.telegram_id
                        break
    
    # 2. Ota-ona raqami orqali qidirish
    if instance.parent_phone and not instance.parent_telegram_id:
        clean_p = re.sub(r'\D', '', instance.parent_phone)
        if clean_p.isdigit() and len(clean_p) >= 9:
            last_9_p = clean_p[-9:]
            
            # Telegram IDga ega bo'lgan boshqa o'quvchilarni tekshiramiz
            candidates = Student.objects.exclude(id=instance.id).filter(
                Q(telegram_id__isnull=False, telegram_id__gt='') | 
                Q(parent_telegram_id__isnull=False, parent_telegram_id__gt='')
            )
            
            for other_p in candidates:
                if other_p.parent_phone:
                    other_p_clean = re.sub(r'\D', '', other_p.parent_phone)
                    if other_p_clean.endswith(last_9_p):
                        update_fields['parent_telegram_id'] = other_p.parent_telegram_id or other_p.telegram_id
                        break
                if other_p.phone:
                    other_clean = re.sub(r'\D', '', other_p.phone)
                    if other_clean.endswith(last_9_p):
                        update_fields['parent_telegram_id'] = other_p.telegram_id or other_p.parent_telegram_id
                        break
    
    if update_fields:
        Student.objects.filter(id=instance.id).update(**update_fields)
        for key, value in update_fields.items():
            setattr(instance, key, value)


def send_attendance_notification(attendance, async_send=True):
    """Davomat xabarnomasi - Takrorlanishni oldini olish bilan"""
    # Agar bu holat uchun xabar allaqachon yuborilgan bo'lsa, qaytamiz
    if attendance.last_sent_status == attendance.is_present:
        return

    student = attendance.student
    status = "✅ Keldi" if attendance.is_present else "❌ Kelmadi"
    text = (
        f"<b>Davomat xabarnomasi</b>\n\n"
        f"O'quvchi: {student.full_name}\n"
        f"Sana: {attendance.date}\n"
        f"Guruh: {attendance.group.name if attendance.group else 'Nomalum'}\n"
        f"Holati: {status}"
    )
    
    chat_ids = get_student_telegram_ids(student)
    sent = False
    for cid in chat_ids:
        if async_send:
            send_telegram_message_async(cid, text)
        else:
            from .utils import _send_message_sync
            _send_message_sync(cid, text)
        sent = True
    
    # Holatni saqlab qo'yamiz (takror yubormaslik uchun)
    if sent:
        attendance.last_sent_status = attendance.is_present
        attendance.save(update_fields=['last_sent_status'])


@receiver(post_save, sender=Student)
def notify_new_student(sender, instance, created, **kwargs):
    """Yangi o'quvchi ro'yxatdan o'tganda"""
    if created:
        text = (
            f"<b>Salom, {instance.full_name}!</b>\n\n"
            f"Siz muvaffaqiyatli ro'yxatdan o'tdingiz.\n"
            f"Guruh: {instance.group.name if instance.group else 'Biriktirilmagan'}\n"
            f"Sana: {instance.joined_at.strftime('%Y-%m-%d')}"
        )
        
        chat_ids = get_student_telegram_ids(instance)
        for cid in chat_ids:
            send_telegram_message_async(cid, text)


@receiver(post_save, sender=Payment)
def notify_payment(sender, instance, created, **kwargs):
    """To'lov tasdiqlanganda"""
    if instance.is_paid:
        student = instance.student
        text = (
            f"<b>To'lov tasdiqlandi!</b>\n\n"
            f"O'quvchi: {student.full_name}\n"
            f"Guruh: {instance.group.name if instance.group else 'Nomalum'}\n"
            f"Oy: {instance.month.strftime('%B %Y') if instance.month else ''}\n"
            f"Summa: {float(instance.amount) if instance.amount else 0:,.0f} so'm\n"
            f"Sana: {instance.paid_at.strftime('%Y-%m-%d %H:%M') if instance.paid_at else ''}"
        )
        
        chat_ids = get_student_telegram_ids(student)
        for cid in chat_ids:
            send_telegram_message_async(cid, text)


@receiver(post_save, sender=MockTestResult)
def notify_mock_test(sender, instance, created, **kwargs):
    """Mock test natijasi"""
    student = instance.student
    test = instance.test
    text = (
        f"<b>Imtihon natijasi!</b>\n\n"
        f"O'quvchi: {student.full_name}\n"
        f"Test: {test.subject if test else 'Nomalum'}\n"
        f"Natija: <code>{instance.score}</code>\n"
        f"Sana: {test.date if test else ''}"
    )
    
    chat_ids = get_student_telegram_ids(student)
    for cid in chat_ids:
        send_telegram_message_async(cid, text)


@receiver(post_save, sender=Homework)
def notify_new_homework_assigned(sender, instance, created, **kwargs):
    """Guruh uchun yangi uy ishi yaratilganda yuboriladigan xabarnoma"""
    
    # Faqat yangi vazifa berilgandagina yuboramiz (tahrirlanganda yubormaslik uchun)
    if not created:
        return
        
    group = instance.group
    students = group.students.all()
    
    desc_part = f"\nQo'shimcha: {instance.description}" if instance.description else ""
    
    text = (
        f"<b>Yangi uy vazifasi berildi 🔔</b>\n\n"
        f"Guruh: {group.name}\n"
        f"Mavzu: {instance.title}{desc_part}\n\n"
        f"Iltimos, farzandingiz ushbu vazifani vaqtida bajarishini nazorat qiling."
    )
    
    # Bir tarmoqda nechta foydalanuvchi bo'lmasin, hammalarining chat_id'sini set() ga yig'amiz
    target_chat_ids = set()
    for student in students:
        chat_ids = get_student_telegram_ids(student)
        target_chat_ids.update(chat_ids)
        
    for cid in target_chat_ids:
        send_telegram_message_async(cid, text)
@receiver(post_save, sender=HomeworkSubmission)
def notify_homework_submission(sender, instance, created, **kwargs):
    """Uy ishi baholanganda (yoki topshirganda) xabar yuborish"""
    
    # Hali topshirmagan holatda daxshatli ko'p sms ketib qolishini oldini olamiz (faqat birinchi yaratilganda)
    if created and instance.status == 'not_submitted':
        return
        
    student = instance.student
    homework = instance.homework
    
    # Holat matnini chiroyli ko'rinishga keltirish
    if instance.status == 'full':
        status_text = "To'liq topshirgan ✅"
    elif instance.status == 'half':
        status_text = "Yarim topshirgan ⚠️"
    else:
        status_text = "Topshirmagan ❌"
        
    text = (
        f"<b>Uy ishi natijasi 📝</b>\n\n"
        f"O'quvchi: {student.full_name}\n"
        f"Guruh: {homework.group.name if homework and homework.group else 'Nomalum'}\n"
        f"Vazifa: {homework.title if homework else 'Nomalum'}\n"
        f"Holati: <b>{status_text}</b>"
    )
    
    chat_ids = get_student_telegram_ids(student)
    for cid in chat_ids:
        send_telegram_message_async(cid, text)

