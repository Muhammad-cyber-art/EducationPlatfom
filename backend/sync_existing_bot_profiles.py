import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from telegram_bot.models import BotProfile
from groups.models import Student

print("Sinxronizatsiya boshlandi...")
profiles = BotProfile.objects.filter(role='student', student__isnull=False)

updated_count = 0
for profile in profiles:
    student = profile.student
    phone = profile.phone_number
    chat_id = profile.telegram_id
    
    update_fields = []
    
    if student.phone and (student.phone == phone or student.phone.endswith(phone[-9:])):
        if student.telegram_id != chat_id:
            student.telegram_id = chat_id
            update_fields.append('telegram_id')
            
    if student.parent_phone and (student.parent_phone == phone or student.parent_phone.endswith(phone[-9:])):
        if student.parent_telegram_id != chat_id:
            student.parent_telegram_id = chat_id
            update_fields.append('parent_telegram_id')
            
    if update_fields:
        student.save(update_fields=update_fields)
        updated_count += 1
        
print(f"Jami {updated_count} ta o'quvchining telegram_id si Student modeliga sinxronlashtirildi!")
