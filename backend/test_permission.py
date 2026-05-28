import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from groups.models import Student
from groups.permissions import IsStudentGroupOwnerOrSuperAdmin
from rest_framework.test import APIRequestFactory

User = get_user_model()
factory = APIRequestFactory()

def run_tests():
    print("=== Testing Permission Classes ===")
    mentors = User.objects.filter(role='mentor')
    print(f"Total mentors: {mentors.count()}")
    for m in mentors:
        try:
            perms = m.staff_permissions.permissions or {}
        except Exception as e:
            perms = f"Error: {e}"
        print(f"Mentor: {m.username} (ID: {m.id}), Role: {m.role}, Branch ID: {m.branch_id}, Perms: {perms}")
        
    # Get a specific mentor with students permission if exists
    mentor = mentors.filter(staff_permissions__permissions__students__isnull=False).first()
    if not mentor:
        mentor = mentors.first()
    
    # Fetch first student (no slicing before .first())
    student = Student.objects.first()
    if mentor and student:
        print("\nSimulating DELETE request from mentor...")
        request = factory.delete(f'/api/v1/groups/students/{student.id}/')
        request.user = mentor
        permission_class = IsStudentGroupOwnerOrSuperAdmin()
        has_perm = permission_class.has_permission(request, None)
        print(f"has_permission: {has_perm}")
        has_obj_perm = permission_class.has_object_permission(request, None, student)
        print(f"has_object_permission: {has_obj_perm}")
        print(f"Student branch: {student.branch_id}, Student group: {getattr(student, 'group_id', None)}")
        # Show allowed branches for mentor
        allowed = []
        if mentor.branch_id:
            allowed.append(mentor.branch_id)
        if hasattr(mentor, 'branch_accesses'):
            allowed.extend(mentor.branch_accesses.values_list('branch_id', flat=True))
        print(f"Mentor allowed branches: {allowed}")
    else:
        print("No mentor or student found for test.")

if __name__ == '__main__':
    run_tests()
