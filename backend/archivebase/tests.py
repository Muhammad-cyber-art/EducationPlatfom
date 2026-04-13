from django.test import TestCase
from django.contrib.auth import get_user_model
from branches.models import Branch
from groups.models import Group, Student
from finance.models import Payment
from archivebase.models import ArchivedStudent, ArchivedGroup, ArchivedStaff
from archivebase.services import move_student_to_archive, move_group_to_archive, restore_student_from_archive
from django.utils import timezone
from decimal import Decimal

User = get_user_model()

class ArchiveServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.super_admin = User.objects.create_user(username='super', password='pw', role='super_admin')
        self.mentor = User.objects.create_user(username='mentor1', password='pw', role='mentor', branch=self.branch)
        self.group = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'))
        self.student = Student.objects.create(full_name="S1", group=self.group)
        self.payment = Payment.objects.create(
            student=self.student, group=self.group, 
            month=timezone.now().date().replace(day=1),
            amount=Decimal('100000')
        )

    def test_move_student_to_archive(self):
        # 1. Archive student
        archived = move_student_to_archive(self.student, self.super_admin, "Test Reason")
        
        # 2. Check original is gone
        self.assertFalse(Student.objects.filter(id=self.student.id).exists())
        self.assertFalse(Payment.objects.filter(student_id=self.student.id).exists())
        
        # 3. Check archive exists
        self.assertEqual(ArchivedStudent.objects.count(), 1)
        self.assertEqual(archived.full_name, "S1")
        self.assertEqual(archived.reason, "Test Reason")
        
        # 4. Check metadata contains payments
        self.assertIn('payments', archived.metadata)
        self.assertEqual(len(archived.metadata['payments']), 1)
        self.assertEqual(archived.metadata['payments'][0]['amount'], 100000.0)

    def test_restore_student(self):
        archived = move_student_to_archive(self.student, self.super_admin, "Reason")
        
        restored_student = restore_student_from_archive(archived.id, self.super_admin)
        
        self.assertEqual(restored_student.full_name, "S1")
        self.assertEqual(restored_student.group.id, self.group.id)
        self.assertEqual(restored_student.branch.id, self.branch.id)

    def test_move_group_to_archive(self):
        # Add another student to group
        student2 = Student.objects.create(full_name="S2", group=self.group)
        
        # Archive group
        archived_group = move_group_to_archive(self.group, self.super_admin, "Closing group")
        
        # Verify group is gone
        self.assertFalse(Group.objects.filter(id=self.group.id).exists())
        # Verify students are gone
        self.assertFalse(Student.objects.filter(group_id=self.group.id).exists())
        # Verify archive contains 1 group and 2 students
        self.assertEqual(ArchivedGroup.objects.count(), 1)
        self.assertEqual(ArchivedStudent.objects.count(), 2)
        
        self.assertEqual(archived_group.full_name, "G1")
        self.assertEqual(archived_group.mentor_name, "mentor1")
