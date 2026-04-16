import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from groups.models import Group, Student, GroupEnrollment

# Check the "Byust" group
group = Group.objects.filter(name="Byust").first()
if not group:
    group = Group.objects.first()

print(f"=== Group: {group.name} (ID: {group.id}) ===")
print()

# Method 1: obj.students.all() - what GroupSerializer uses
print("--- obj.students.all() (M2M through table) ---")
students_m2m = group.students.all()
for s in students_m2m:
    print(f"  {s.full_name} (ID: {s.id})")
print(f"  Total: {students_m2m.count()}")
print()

# Method 2: enrollments
print("--- GroupEnrollment records ---")
enrollments = GroupEnrollment.objects.filter(group=group)
for e in enrollments:
    print(f"  {e.student.full_name} (ID: {e.student.id}) | is_active: {e.is_active}")
print(f"  Total: {enrollments.count()}")
print()

# Method 3: Active enrollments
print("--- Active enrollments (is_active=True) ---")
active = GroupEnrollment.objects.filter(group=group, is_active=True)
for e in active:
    print(f"  {e.student.full_name} (ID: {e.student.id})")
print(f"  Total: {active.count()}")
print()

# Check the student (ali valiyev / ID 6)
student = Student.objects.get(id=6)
print(f"=== Student: {student.full_name} (ID: {student.id}) ===")
print(f"  FK group: {student.group}")
print(f"  M2M groups: {list(student.groups.values_list('name', flat=True))}")
print(f"  Enrollments: {list(student.enrollments.values('group__name', 'is_active'))}")
