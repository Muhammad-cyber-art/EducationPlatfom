from django.test import TestCase
from django.contrib.auth import get_user_model
from branches.models import Branch
from groups.models import Group, Student
from finance.models import Payment, EmployeePayment, StaffProfile, FinanceTransaction
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.utils import timezone
from decimal import Decimal

User = get_user_model()

class FinanceModelTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.super_admin = User.objects.create_user(username='super', password='pw', role='super_admin')
        self.mentor = User.objects.create_user(username='mentor1', password='pw', role='mentor', branch=self.branch)
        self.group = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'))
        self.student = Student.objects.create(full_name="S1", group=self.group)
        self.payment_month = timezone.now().date().replace(day=1)

    def test_payment_mark_as_paid_creates_transaction(self):
        payment = Payment.objects.create(
            student=self.student,
            group=self.group,
            month=self.payment_month,
            amount=self.group.monthly_price
        )
        self.assertFalse(payment.is_paid)
        
        payment.mark_as_paid(self.super_admin)
        
        self.assertTrue(payment.is_paid)
        self.assertEqual(payment.marked_by, self.super_admin)
        
        # Check FinanceTransaction (bo'lib-to'lov yozuvlari INS prefiksi bilan)
        transaction = FinanceTransaction.objects.filter(related_id__startswith=f"STP-{payment.id}").first()
        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.amount, payment.amount)
        self.assertEqual(transaction.transaction_type, 'income')
        self.assertEqual(transaction.category, 'student_fee')
        self.assertEqual(payment.paid_amount, payment.amount)

    def test_partial_payment_flow(self):
        payment = Payment.objects.create(
            student=self.student,
            group=self.group,
            month=self.payment_month,
            amount=Decimal('100000'),
        )
        payment.apply_payment(self.super_admin, Decimal('40000'), is_full_amount=False)
        payment.refresh_from_db()
        self.assertFalse(payment.is_paid)
        self.assertTrue(payment.is_partial)
        self.assertEqual(payment.paid_amount, Decimal('40000'))
        self.assertEqual(payment.remaining_amount, Decimal('60000'))

        payment.apply_payment(self.super_admin, Decimal('60000'))
        payment.refresh_from_db()
        self.assertTrue(payment.is_paid)
        self.assertFalse(payment.is_partial)
        self.assertEqual(payment.paid_amount, Decimal('100000'))

    def test_mentor_commission_calculation(self):
        # Create a paid payment for the student so income is calculated
        payment = Payment.objects.create(
            student=self.student,
            group=self.group,
            month=self.payment_month,
            amount=self.group.monthly_price,
            is_paid=True,
            marked_by=self.super_admin
        )
        
        # Create staff profile for mentor
        profile = StaffProfile.objects.create(
            user=self.mentor,
            salary_type='percentage',
            commission_percentage=Decimal('50')
        )
        
        income = profile.calculate_monthly_income(self.payment_month)
        self.assertEqual(income, Decimal('100000'))
        
        salary = profile.calculate_salary_for_month(self.payment_month)
        self.assertEqual(salary, Decimal('50000'))

class FinanceAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.super_admin = User.objects.create_user(username='super', password='pw', role='super_admin')
        self.admin = User.objects.create_user(username='adm1', password='pw', role='admin', branch=self.branch)
        self.mentor = User.objects.create_user(username='men1', password='pw', role='mentor', branch=self.branch)
        
        # Create necessary profiles for salary tests
        StaffProfile.objects.create(user=self.mentor, salary_type='fixed', fixed_salary=Decimal('5000000'))
        
        self.group = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'))
        self.student = Student.objects.create(full_name="S1", group=self.group)
        self.month = timezone.now().date().replace(day=1)
        self.payment = Payment.objects.create(student=self.student, group=self.group, month=self.month, amount=self.group.monthly_price)

    def test_admin_confirms_payment(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('student-payment-confirm', kwargs={'pk': self.payment.pk})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertTrue(self.payment.is_paid)
        self.assertEqual(self.payment.marked_by, self.admin)

    def test_admin_confirms_partial_payment(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('student-payment-confirm', kwargs={'pk': self.payment.pk})
        response = self.client.post(url, {
            'amount': '50000',
            'is_partial_payment': 'true',
            'payment_method': 'cash',
            'ignore_refund': 'true',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertTrue(self.payment.is_partial)
        self.assertFalse(self.payment.is_paid)
        self.assertEqual(self.payment.paid_amount, Decimal('50000'))
        self.assertEqual(self.payment.remaining_amount, Decimal('50000'))

    def test_super_admin_confirms_salary(self):
        # Create salary record
        salary = EmployeePayment.objects.create(
            employee=self.mentor,
            month=self.month,
            salary_base=Decimal('5000000')
        )
        
        self.client.force_authenticate(user=self.super_admin)
        url = reverse('employee-payment-confirm', kwargs={'pk': salary.pk})
        
        # Super admin adds bonus
        response = self.client.post(url, {'bonus': 200000})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        salary.refresh_from_db()
        self.assertTrue(salary.is_paid)
        self.assertEqual(salary.bonus, Decimal('200000'))
        self.assertEqual(salary.total_amount, Decimal('5200000'))
        
        # Check FinanceTransaction for salary
        transaction = FinanceTransaction.objects.get(related_id=f"EMP-{salary.id}")
        self.assertEqual(transaction.amount, Decimal('5200000'))
        self.assertEqual(transaction.transaction_type, 'expense')

    def test_duplicate_payment_restriction(self):
        # Already have one payment in setUp. Try to create another same one.
        with self.assertRaises(Exception):
            Payment.objects.create(
                student=self.student,
                group=self.group,
                month=self.month,
                amount=self.group.monthly_price
            )
