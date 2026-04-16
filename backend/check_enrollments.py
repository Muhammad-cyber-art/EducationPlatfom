import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from groups.models import Student, Group, GroupEnrollment

# Check last 5 students
latest_students = Student.objects.all().order_by('-id')[:5]
for s in latest_students:
    print(f"Student: {s.full_name} (ID: {s.id})")
    print(f"  FK Group: {s.group.name if s.group else 'None'}")
    enrollments = GroupEnrollment.objects.filter(student=s)
    print(f"  Enrollments: {[f'{e.group.name} (Active: {e.is_active})' for e in enrollments]}")
    m2m_groups = s.groups.all()
    print(f"  M2M Groups: {[g.name for g in m2m_groups]}")
    print("-" * 20)
