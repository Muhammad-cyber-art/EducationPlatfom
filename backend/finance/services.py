from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q, F, Count
from django.shortcuts import get_object_or_404
from .models import Payment, EmployeePayment, StaffProfile, FinanceTransaction, EmployeeAdvance
from groups.models import Group, Student, Branch
from homework_attends.models import Attendance
from django.contrib.auth import get_user_model
from finance.utils import normalize_month, floor_amount
from decimal import Decimal
import traceback
import logging

logger = logging.getLogger(__name__)
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
                        'amount': floor_amount(group.monthly_price),
                        'is_paid': False
                    }
                )
                
@transaction.atomic
def generate_monthly_payments(month_date=None):
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)
    else:
        month_date = normalize_month(month_date)

    created_count = 0

    # 1. STUDENT PAYMENTS
    active_groups = [g for g in Group.objects.filter(is_faol=True).prefetch_related('students') if g.is_logic_enabled()]
    for group in active_groups:
        for student in group.students.all():
            # Yangi mantiq: Status bo'yicha narxni aniqlash
            if student.status == 'discount':
                # Imtiyozli o'quvchilar uchun 0
                raw_amount = Decimal('0')
            elif student.status in ['low_income', 'negotiated']:
                # Kam ta'minlangan yoki kelishilgan narx - profildagi custom_fee
                raw_amount = student.custom_fee if student.custom_fee is not None else Decimal('0')
            else:
                # Oddiy o'quvchilar - guruh narxi
                raw_amount = group.monthly_price
            
            payment_amount = floor_amount(raw_amount)
            
            _, created = Payment.objects.get_or_create(
                student=student,
                group=group,
                month=month_date,
                defaults={
                    'amount': payment_amount,
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
    elif profile.salary_type == 'student_count':
        # Mentorning barcha guruhlaridagi faol o'quvchilar sonini hisoblash
        from groups.models import GroupEnrollment
        import calendar
        
        last_day_num = calendar.monthrange(month_date.year, month_date.month)[1]
        last_day = month_date.replace(day=last_day_num)
        
        # Mentor guruhlari
        mentor_groups = Group.objects.filter(mentor=profile.user)
        
        # O'quvchilar soni (Duplikatsiz)
        total_students = GroupEnrollment.objects.filter(
            group__in=mentor_groups,
            joined_at__date__lte=last_day,
            is_active=True
        ).values('student_id').distinct().count()
        
        salary = Decimal(str(total_students)) * Decimal(str(profile.per_student_amount))
        return floor_amount(salary)
    
    return Decimal('0')

def process_absence_refunds(month_date=None):
    """
    O'quvchilarning qoldirgan darslari uchun (agar > 4 ta bo'lsa) refund yaratadi.
    Endi bir o'quvchi bir nechta guruh uchun alohida refund olishi mumkin.
    """
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)
    
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

def handle_custom_payment(request_user, data):
    """O'quvchi uchun maxsus (oylikdan tashqari) to'lovni boshqarish"""
    id_student = data['student']
    id_group = data['group']
    amount = data['amount']
    transaction_type = data['transaction_type']
    payer_name = data.get('payer_name', '')
    description = data.get('description', '')
    date_val = data.get('date', timezone.localdate())
    
    student = get_object_or_404(Student, id=id_student)
    group = get_object_or_404(Group, id=id_group)
    
    branch_instance = student.branch or group.branch
    if not branch_instance and hasattr(request_user, 'branch'):
        branch_instance = request_user.branch

    if not branch_instance:
        raise ValueError("Filialni aniqlab bo'lmadi.")

    final_payer = payer_name if (payer_name and payer_name.strip()) else student.full_name
    title_val = f"Qo'shimcha to'lov: {student.full_name}" if transaction_type == 'income' else f"Chiqim (Portal): {student.full_name}"

    with transaction.atomic():
        ft = FinanceTransaction.objects.create(
            transaction_type=transaction_type,
            category='student_extra',
            amount=amount,
            date=date_val,
            marked_by=request_user,
            branch=branch_instance,
            student=student,
            group=group,
            payer_name=final_payer,
            title=title_val,
            description=description
        )
        
        # Mentor oyligini qayta hisoblash
        mentor_salary_updated = False
        try:
            mentor = group.mentor
            if mentor and hasattr(mentor, 'staff_profile'):
                profile = mentor.staff_profile
                if profile.salary_type in ['percentage', 'student_count']:
                    payment_month = date_val.replace(day=1)
                    emp_payment = EmployeePayment.objects.filter(employee=mentor, month=payment_month, is_paid=False).first()
                    
                    if emp_payment:
                        emp_payment.salary_base = profile.calculate_salary_for_month(payment_month)
                        emp_payment.save()
                    else:
                        EmployeePayment.objects.get_or_create(
                            employee=mentor,
                            month=payment_month,
                            defaults={'salary_base': profile.calculate_salary_for_month(payment_month), 'is_paid': False}
                        )
                    mentor_salary_updated = True
        except Exception as salary_err:
            logger.error(f"Mentor salary recalculate error: {salary_err}")

    return ft, mentor_salary_updated

def confirm_student_payment(request_user, payment, data):
    """O'quvchi to'lovini tasdiqlash va tegishli amallarni bajarish"""
    ignore_refund = str(data.get('ignore_refund', False)).lower() in ['true', '1', 'yes']
    payment.refund_ignored = ignore_refund
    
    new_amount = data.get('amount')
    if new_amount is not None:
        payment.amount = Decimal(str(new_amount))

    elif not payment.refund_ignored and payment.month:
        refund = payment.student.calculate_refund_amount(payment.month.year, payment.month.month)
        if float(refund) > 0:
            current_amount = Decimal(str(payment.amount or payment.group.monthly_price))
            payment.amount = floor_amount(current_amount - Decimal(str(refund)))
    
    payment.save()
    
    # Yangi maydonlarni extract qilamiz
    method = data.get('payment_method', 'cash')
    receipt = data.get('receipt_image')
    notes = data.get('notes')
    is_receiptless = str(data.get('is_receiptless', False)).lower() in ['true', '1', 'yes']
    
    payment.mark_as_paid(request_user, method=method, receipt=receipt, notes=notes, is_receiptless=is_receiptless)
    
    # Mentor oyligini qayta hisoblash
    try:
        mentor = payment.group.mentor
        if mentor and hasattr(mentor, 'staff_profile'):
            profile = mentor.staff_profile
            if profile.salary_type in ['percentage', 'student_count']:
                payment_month = payment.month.replace(day=1) if payment.month else None
                if payment_month:
                    emp_payment = EmployeePayment.objects.filter(employee=mentor, month=payment_month, is_paid=False).first()
                    if emp_payment:
                        emp_payment.salary_base = profile.calculate_salary_for_month(payment_month)
                        emp_payment.save()
    except Exception as salary_err:
        logger.error(f"Mentor salary recalculate error: {salary_err}")

    return payment

def get_finance_dashboard_stats(user, month, year):
    """Moliya dashboardi uchun statistikani yig'ish"""
    today = timezone.localdate()
    payment_filter = Q(month__month=month, month__year=year)
    employee_filter = Q(month__month=month, month__year=year)
    transaction_filter = Q(date__month=month, date__year=year)

    if user.role == 'admin':
        payment_filter &= Q(group__branch=user.branch)
        employee_filter &= Q(employee__branch=user.branch)
        transaction_filter &= Q(branch=user.branch)

    total_income = FinanceTransaction.objects.filter(transaction_filter, transaction_type='income').aggregate(total=Sum('amount'))['total'] or 0
    total_expense = FinanceTransaction.objects.filter(transaction_filter, transaction_type='expense').aggregate(total=Sum('amount'))['total'] or 0
    total_debt = Payment.objects.filter(payment_filter, is_paid=False).aggregate(total=Sum('amount'))['total'] or 0

    branches_data = []
    if user.role == 'super_admin':
        for branch in Branch.objects.all():
            b_income = FinanceTransaction.objects.filter(branch=branch, date__month=month, date__year=year, transaction_type='income').aggregate(total=Sum('amount'))['total'] or 0
            b_expense = FinanceTransaction.objects.filter(branch=branch, date__month=month, date__year=year, transaction_type='expense').aggregate(total=Sum('amount'))['total'] or 0
            branches_data.append({
                "id": branch.id, "name": branch.name,
                "income": float(b_income), "expense": float(b_expense), "profit": float(b_income - b_expense)
            })

    top_groups_qs = Group.objects.filter(is_faol=True)
    if user.role == 'admin': top_groups_qs = top_groups_qs.filter(branch=user.branch)
    top_groups_data = top_groups_qs.annotate(
        group_income=Sum('payments__amount', filter=Q(payments__month__month=month, payments__month__year=year, payments__is_paid=True)),
        st_count=Count('students', distinct=True)
    ).order_by('-group_income')[:5]

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_tx_filter = Q(date__month=prev_month, date__year=prev_year)
    if user.role == 'admin': prev_tx_filter &= Q(branch=user.branch)
    prev_income = FinanceTransaction.objects.filter(prev_tx_filter, transaction_type='income').aggregate(total=Sum('amount'))['total'] or 0
    prev_expense = FinanceTransaction.objects.filter(prev_tx_filter, transaction_type='expense').aggregate(total=Sum('amount'))['total'] or 0

    def calc_trend(curr, prev):
        curr, prev = float(curr), float(prev)
        if prev == 0: return 100.0 if curr > 0 else (-100.0 if curr < 0 else 0.0)
        return round(((curr - prev) / abs(prev)) * 100, 1)

    return {
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "net_profit": float(total_income - total_expense),
        "total_debt": float(total_debt),
        "income_trend": calc_trend(total_income, prev_income),
        "expense_trend": calc_trend(total_expense, prev_expense),
        "profit_trend": calc_trend(total_income - total_expense, prev_income - prev_expense),
        "branches": branches_data,
        "top_groups": [{"name": g.name, "profit": float(g.group_income or 0), "student_count": g.st_count} for g in top_groups_data],
        "stats": {
            "students": Student.objects.filter(enrollments__is_active=True).distinct().count(),
            "mentors": User.objects.filter(role='mentor', is_active=True).count(),
            "groups": Group.objects.filter(is_faol=True).count(),
            "admins": User.objects.filter(role='admin', is_active=True).count(),
            "attendance_today": {
                "absent": Attendance.objects.filter(date=today, is_present=False).filter(**({'group__branch': user.branch} if user.role == 'admin' else {})).count(),
                "total": Attendance.objects.filter(date=today).filter(**({'group__branch': user.branch} if user.role == 'admin' else {})).count()
            }
        }
    }

def get_branch_finance_stats(branch_id, month, year):
    """Filial uchun moliya statistikasini yig'ish (Optimallashgan)"""
    try:
        branch = get_object_or_404(Branch, id=branch_id)
        today = timezone.localdate()

        # Statistikani yig'ish
        mentors_count = User.objects.filter(branch=branch, role='mentor', is_active=True).count()
        admins_count = User.objects.filter(branch=branch, role='admin', is_active=True).count()
        groups_count = Group.objects.filter(branch=branch, is_faol=True).count()
        students_count = Student.objects.filter(branch=branch, enrollments__is_active=True).distinct().count()

        expected_income = Decimal('0')
        groups_detail = []
        
        # N+1 muammosini oldini olish uchun prefetch ishlatamiz
        active_groups = Group.objects.filter(branch=branch, is_faol=True).select_related('mentor').prefetch_related(
            'students',
            'enrollments',
            'students__enrollments'
        )
        
        for group in active_groups:
            g_expected = Decimal('0')
            # group.students.all() o'rniga enrollments dan foydalanamiz (tezroq)
            group_enrollments = group.enrollments.filter(is_active=True).select_related('student')
            student_count = group_enrollments.count()
            
            for enrollment in group_enrollments:
                student = enrollment.student
                if student.status == 'discount':
                    pass
                elif student.status in ['low_income', 'negotiated']:
                    g_expected += student.custom_fee or Decimal('0')
                else:
                    g_expected += group.monthly_price
            
            expected_income += g_expected
            
            # To'lovlarni bitta aggregate da olamiz
            payments_stats = Payment.objects.filter(
                group=group, 
                month__month=month, 
                month__year=year
            ).aggregate(
                received=Sum('amount', filter=Q(is_paid=True)),
                debt=Sum('amount', filter=Q(is_paid=False))
            )
            
            g_received = payments_stats['received'] or 0
            g_debt = payments_stats['debt'] or 0
            
            # Refundlarni hisoblash (bu hali ham biroz sekin, lekin prefetch yordam beradi)
            g_refunds = 0
            for enrollment in group_enrollments:
                try:
                    refund = enrollment.student.calculate_refund_amount(year, month, group=group)
                    g_refunds += float(refund)
                except Exception:
                    continue
            
            groups_detail.append({
                "id": group.id, 
                "name": group.name, 
                "student_count": student_count,
                "expected_income": float(g_expected),
                "received_income": float(g_received), 
                "refund_amount": g_refunds,
                "real_income": float(g_received) - g_refunds, 
                "debt": float(g_debt),
                "mentor": group.mentor.get_full_name() if group.mentor else "Yo'q"
            })

        # Umumiy tranzaksiyalar
        received_income = FinanceTransaction.objects.filter(
            branch=branch, 
            date__month=month, 
            date__year=year, 
            transaction_type='income'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        expenses = FinanceTransaction.objects.filter(
            branch=branch, 
            date__month=month, 
            date__year=year, 
            transaction_type='expense'
        ).aggregate(total=Sum('amount'))['total'] or 0

        return {
            "branch": {"id": branch.id, "name": branch.name},
            "stats": {
                "mentors": mentors_count, "admins": admins_count, "groups": groups_count, "students": students_count,
                "attendance_today": {
                    "absent": Attendance.objects.filter(group__branch=branch, date=today, is_present=False).count(),
                    "total": Attendance.objects.filter(group__branch=branch, date=today).count()
                }
            },
            "finance": {
                "expected_income": float(expected_income), "received_income": float(received_income),
                "expenses": float(expenses), "net_profit": float(received_income) - float(expenses)
            },
            "groups": groups_detail
        }
    except Exception as e:
        logger.error(f"Error in get_branch_finance_stats: {str(e)}")
        logger.error(traceback.format_exc())
        raise e
