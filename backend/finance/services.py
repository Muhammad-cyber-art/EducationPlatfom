from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q
from .models import Payment, EmployeePayment, StaffProfile
from groups.models import Group
from django.contrib.auth import get_user_model
from finance.utils import normalize_month
User = get_user_model()
def generate_monthly_student_payments(month_date=None):
    """
    Har oy barcha faol guruhlardagi studentlar uchun payment yaratadi
    """
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)

    with transaction.atomic():
        # User talabi: Boshlanish sanasi kelmaguncha to'lovlar yaratilmasligi kerak
        active_groups = [g for g in Group.objects.filter(is_faol=True) if g.is_logic_enabled()]

        for group in active_groups:
            for student in group.students.all():
                Payment.objects.get_or_create(
                    student=student,
                    group=group,
                    month=month_date,
                    defaults={
                        'amount': group.monthly_price,
                        'is_paid': False
                    }
                )
                
@transaction.atomic
def generate_monthly_payments(month_date=None):
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)
    else:
        month_date = normalize_month(month_date)

    from finance.utils import floor_amount
    created_count = 0

    # 1. STUDENT PAYMENTS (Guruh narxi o'zgarishi mumkin, shuning uchun amount'ni saqlaymiz)
    # User talabi: Boshlanish sanasi kelmaguncha to'lovlar yaratilmasligi kerak
    active_groups = [g for g in Group.objects.filter(is_faol=True).prefetch_related('students') if g.is_logic_enabled()]
    for group in active_groups:
        for student in group.students.all():
            # Agar student uchun maxsus narx belgilangan bo'lsa shuni olamiz, aks holda guruh narxini
            raw_amount = student.custom_fee if student.custom_fee is not None else group.monthly_price
            payment_amount = floor_amount(raw_amount)  # ✅ Floor: butun songa yaxlitlash
            
            _, created = Payment.objects.get_or_create(
                student=student,
                group=group,
                month=month_date,
                defaults={
                    'amount': payment_amount, # Snapshot: Floor qilingan individual yoki guruh narxi
                    'is_paid': False
                }
            )
            if created: created_count += 1

    # 2. EMPLOYEE PAYMENTS
    profiles = StaffProfile.objects.select_related('user').filter(user__is_active=True)
    for profile in profiles:
        salary = profile.calculate_salary_for_month(month_date)
        _, created = EmployeePayment.objects.get_or_create(
            employee=profile.user,
            month=month_date,
            defaults={
                'salary_base': salary,
                'bonus': 0,
                'deductions': 0,
                'is_paid': False
            }
        )
        if created: created_count += 1

    return created_count

def calculate_employee_salary(profile, month_date):
    """Xodim maoshini hisoblash (Mavjud foyiz logikasi buzilmadi, floor qo'shildi)"""
    from finance.utils import floor_amount
    from decimal import Decimal

    if profile.salary_type == 'fixed':
        return floor_amount(profile.fixed_salary)
    
    elif profile.salary_type == 'percentage':
        # Mentor uchun o'z guruhlaridan tushum
        if profile.user.role == 'mentor':
            total_income = Decimal('0')
            # Mentorning barcha guruhlarini (faol va nofaol) inobatga olamiz, chunki tarixiy to'lovlar bo'lishi mumkin
            mentor_groups = Group.objects.filter(mentor=profile.user)
            
            for group in mentor_groups:
                # O'sha oydagi ushbu guruhga tushgan barcha TASDIQLANGAN to'lovlar
                payments = Payment.objects.filter(
                    group=group,
                    month__year=month_date.year,
                    month__month=month_date.month,
                    is_paid=True
                ).select_related('student')
                
                for payment in payments:
                    student = payment.student
                    student_revenue = Decimal(str(payment.amount))
                    
                    # Refundni aynan SHU guruh uchun hisoblaymiz (agar bekor qilinmagan bo'lsa)
                    if getattr(payment, 'refund_ignored', False):
                        refund = Decimal('0')
                    else:
                        refund = Decimal(str(student.calculate_refund_amount(month_date.year, month_date.month, group=group)))
                    total_income += (student_revenue - refund)

                    # Portal orqali qo'shimcha tushum/chiqim (specific for this student in this group)
                    from .models import FinanceTransaction
                    extra_txs = FinanceTransaction.objects.filter(
                        student=student,
                        group=group,
                        category='student_extra',
                        date__year=month_date.year,
                        date__month=month_date.month
                    )
                    for tx in extra_txs:
                        tx_amount = Decimal(str(tx.amount))
                        if tx.transaction_type == 'income':
                            total_income += tx_amount
                        else:
                            total_income -= tx_amount
        # Admin uchun o'z filialidan tushum
        elif profile.user.role == 'admin' and profile.user.branch:
            total_income = Decimal(str(
                Payment.objects.filter(
                    group__branch=profile.user.branch,
                    month__month=month_date.month,
                    month__year=month_date.year,
                    is_paid=True
                ).aggregate(total=Sum('amount'))['total'] or 0
            ))
        else:
            total_income = Decimal('0')
        
        commission = total_income * (Decimal(str(profile.commission_percentage)) / Decimal('100'))
        return floor_amount(commission)
    return Decimal('0')

def process_absence_refunds(month_date=None):
    """
    O'quvchilarning qoldirgan darslari uchun (agar > 4 ta bo'lsa) refund yaratadi.
    Endi bir o'quvchi bir nechta guruh uchun alohida refund olishi mumkin.
    """
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)
    
    from finance.models import FinanceTransaction
    from groups.models import Group
    
    refund_count = 0
    total_refund_amount = 0
    
    # Barcha faol guruhlarni olamiz
    active_groups = [g for g in Group.objects.filter(is_faol=True).prefetch_related('students') if g.is_logic_enabled()]
    
    for group in active_groups:
        for student in group.students.all():
            # Refundni aynan shu guruh uchun hisoblaymiz
            refund_amount = student.calculate_refund_amount(month_date.year, month_date.month, group=group)
            
            if refund_amount > 0:
                # unique related_id: REF-STUDENT_ID-GROUP_ID-YYYY-MM
                rel_id = f"REF-{student.id}-{group.id}-{month_date.year}-{month_date.month}"
                
                # Agar oldin yaratilgan bo'lsa, qayta yaratmaymiz
                if not FinanceTransaction.objects.filter(related_id=rel_id).exists():
                    branch_instance = student.branch or group.branch
                    
                    FinanceTransaction.objects.create(
                        transaction_type='expense',
                        category='refund',
                        amount=refund_amount,
                        date=timezone.localdate(),
                        branch=branch_instance,
                        student=student,
                        group=group,
                        title=f"Refund: {student.full_name} ({group.name})",
                        description=f"{group.name} guruhi uchun {month_date.strftime('%Y-%m')} oyi uchun {student.get_absences_count(month_date.year, month_date.month, group=group)} ta dars qoldirilganligi sababli refund.",
                        related_id=rel_id
                    )
                    refund_count += 1
                    total_refund_amount += refund_amount
                
    return refund_count, total_refund_amount