import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from groups.models import Student
from finance.models import Payment
from archivebase.services import move_student_to_archive, restore_student_from_archive
from django.contrib.auth import get_user_model
User = get_user_model()

admin = User.objects.filter(role__in=['super_admin', 'admin']).first()

# Birinchi studentni olamiz va uning to'lovini to'langan deb belgilaymiz
student = Student.objects.filter(payments__isnull=False).first()
payment = Payment.objects.filter(student=student).first()

print(f"Student: {student.full_name} (ID: {student.id})")
print(f"To'lov oldin: is_paid={payment.is_paid}")

# To'lovni to'langan deb belgilaymiz
payment.mark_as_paid(admin)
payment.refresh_from_db()
print(f"To'lov tasdiqdan keyin: is_paid={payment.is_paid}")

pays_before = list(Payment.objects.filter(student=student).values('month', 'is_paid', 'amount'))
print(f"\nArxivlashdan oldin: {pays_before}")

# Arxivlash
archived = move_student_to_archive(student, admin, "Test to'liq")
archived_pays = archived.metadata.get('payments', [])
print(f"Arxivdagi to'lov: is_paid={archived_pays[0]['is_paid'] if archived_pays else 'EMPTY'}")

# Tiklash
restored = restore_student_from_archive(archived.id, admin)
archived.delete()

pays_after = list(Payment.objects.filter(student=restored).values('month', 'is_paid', 'amount'))
print(f"\nTiklangandan keyin: {pays_after}")

if pays_after and pays_after[0]['is_paid'] == True:
    print("\n>>> MUVAFFAQIYAT: is_paid=True saqlanib qoldi! <<<")
else:
    print("\n>>> XATO: is_paid o'zgarib qoldi! <<<")
