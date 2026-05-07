import os
import django
import sys

# Add project root to sys.path
sys.path.append(r'c:\Users\Lenovo\Desktop\My Project\EducationPlatfom\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from homework_attends.models import Attendance
from groups.models import Group, Student, GroupEnrollment
from homework_attends.services import get_or_create_attendance_records, bulk_confirm_attendance
from django.utils import timezone

try:
    group = Group.objects.first()
    if not group:
        print("No group found")
        sys.exit(0)
    
    today = timezone.localdate()
    print(f"Testing for group: {group.name}, date: {today}")
    
    # Test get_or_create
    qs = get_or_create_attendance_records(group, today)
    print(f"get_or_create returned {qs.count()} records")
    
    # Test bulk_confirm
    payload = []
    for att in qs[:2]:
        payload.append({'student_id': att.student_id, 'is_present': not att.is_present})
    
    from django.contrib.auth import get_user_model
    User = get_user_model()
    admin = User.objects.filter(role='admin').first() or User.objects.first()
    
    print(f"Confirming with user: {admin.username}")
    res_qs = bulk_confirm_attendance(group, today, payload, admin)
    print(f"bulk_confirm successful, returned {res_qs.count()} records")

except Exception as e:
    import traceback
    traceback.print_exc()
