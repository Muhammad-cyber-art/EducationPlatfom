import calendar
from datetime import date
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


def apply_calculated_salary_to_employee_payment(profile, month_date, emp_payment):
    """
    StaffProfile.calculate_salary_for_month natijasini EmployeePayment ga yozadi.
    """
    salary = profile.calculate_salary_for_month(month_date)
    emp_payment.salary_base = salary
    emp_payment.attendance_deductions = {}


def _to_decimal(value):
    """Safely cast any numeric-like value to Decimal."""
    if value is None:
        return Decimal('0')
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal('0')


def _safe_attendance_stats_for_branch(branch, today):
    """Attendance query xato bersa ham finance statistikasi yiqilmasin."""
    try:
        return {
            "absent": Attendance.objects.filter(group__branch=branch, date=today, is_present=False).count(),
            "total": Attendance.objects.filter(group__branch=branch, date=today).count(),
        }
    except Exception:
        logger.exception("Attendance branch statistikasi xatoligi: branch_id=%s", getattr(branch, "id", None))
        return {"absent": 0, "total": 0}


def _safe_attendance_stats_for_user(user, today):
    """Dashboard attendance hisobida fallback."""
    try:
        filters = {'group__branch': user.branch} if user.role == 'admin' else {}
        return {
            "absent": Attendance.objects.filter(date=today, is_present=False).filter(**filters).count(),
            "total": Attendance.objects.filter(date=today).filter(**filters).count(),
        }
    except Exception:
        logger.exception("Attendance user statistikasi xatoligi: user_id=%s", getattr(user, "id", None))
        return {"absent": 0, "total": 0}

                
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
            # REFUND LOGIC: Boshlang'ich summa qilib to'liq narx belgilanadi.
            base_price = group.monthly_price
            if student.status in ['low_income', 'negotiated']:
                if student.custom_fee is not None: base_price = student.custom_fee
            
            if student.status == 'teacher_negotiated':
                payment_amount = Decimal('0')
            else:
                payment_amount = Decimal(str(floor_amount(base_price)))
            
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

def process_absence_refunds(month_date=None):
    """
    OLD LOGIC: Refund endi ishlatilmaydi. 
    Chunki to'lov endi davomatga qarab to'ldirib boriladi.
    """
    return 0, 0

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
                        apply_calculated_salary_to_employee_payment(profile, payment_month, emp_payment)
                        emp_payment.save()
                    else:
                        emp_payment, _ = EmployeePayment.objects.get_or_create(
                            employee=mentor,
                            month=payment_month,
                            defaults={
                                'salary_base': Decimal('0'),
                                'is_paid': False,
                                'attendance_deductions': {},
                            },
                        )
                        apply_calculated_salary_to_employee_payment(profile, payment_month, emp_payment)
                        emp_payment.save()
                    mentor_salary_updated = True
        except Exception as salary_err:
            logger.error(f"Mentor salary recalculate error: {salary_err}")

    return ft, mentor_salary_updated

def confirm_student_payment(request_user, payment, data):
    """O'quvchi to'lovini tasdiqlash va tegishli amallarni bajarish"""
    import logging
    from finance.utils import floor_amount
    logger = logging.getLogger(__name__)

    # REFUND LOGIC: To'lov miqdori qoldirilgan darslar bo'yicha hisoblanadi (Chegirma/Jarima)
    pay_full_month = str(data.get('pay_full_month', False)).lower() in ['true', '1', 'yes']
    ignore_refund = str(data.get('ignore_refund', False)).lower() in ['true', '1', 'yes']

    if payment.student.status in ['low_income', 'negotiated']:
        base_amount = payment.student.custom_fee if payment.student.custom_fee is not None else payment.group.monthly_price
    else:
        base_amount = payment.group.monthly_price

    if pay_full_month or payment.student.status == 'negotiated' or ignore_refund:
        # To'liq oylik to'lash yoki kelishilgan narx
        final_amount = Decimal(str(floor_amount(base_amount)))
        payment.refund_amount = Decimal('0')
        if ignore_refund:
            payment.refund_ignored = True
    elif payment.student.status == 'teacher_negotiated':
        final_amount = Decimal('0')
        payment.refund_amount = Decimal('0')
    else:
        # Jarimani aniqlash
        refund_val = payment.student.calculate_refund_amount(
            payment.month.year,
            payment.month.month,
            group=payment.group,
        )
        payment.refund_amount = Decimal(str(refund_val))
        payment.refund_ignored = False
        final_amount = Decimal(str(max(0, floor_amount(base_amount) - refund_val)))
        
    # Kutilayotgan oylik summa (qarz)
    payment.amount = final_amount
    payment.save()

    is_partial_payment = str(data.get('is_partial_payment', False)).lower() in ['true', '1', 'yes']

    provided_amount = data.get('amount')
    installment_amount = None
    if provided_amount is not None and str(provided_amount).strip():
        try:
            installment_amount = Decimal(str(provided_amount).strip())
        except Exception:
            pass

    if installment_amount is None:
        remaining = payment.remaining_amount
        installment_amount = remaining if remaining > 0 else final_amount
    elif not is_partial_payment:
        # To'liq to'lash: qolgan summani yopish
        remaining = payment.remaining_amount
        if remaining > 0:
            installment_amount = remaining

    # Yangi maydonlarni extract qilamiz
    method = data.get('payment_method', 'cash')
    receipt = data.get('receipt_image')
    notes = data.get('notes', '')
    is_receiptless = str(data.get('is_receiptless', False)).lower() in ['true', '1', 'yes']

    # Davomat ma'lumotlarini notes ga qo'shamiz
    notes_parts = []
    if notes:
        notes_parts.append(notes)
    
    lesson_dates = payment.group.get_lesson_dates(payment.month.year, payment.month.month)
    present_count = Attendance.objects.filter(
        student=payment.student, 
        group=payment.group, 
        date__year=payment.month.year, 
        date__month=payment.month.month, 
        is_present=True
    ).count()
    
    notes_parts.append(f"Davomat: {present_count}/{len(lesson_dates)} dars")
    if is_partial_payment:
        notes_parts.append("Bo'lib to'lov")
    notes = " | ".join(notes_parts)

    payment.apply_payment(
        request_user,
        installment_amount,
        method=method,
        receipt=receipt,
        notes=notes,
        is_receiptless=is_receiptless,
        is_full_amount=pay_full_month and not is_partial_payment,
    )
    
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
                        apply_calculated_salary_to_employee_payment(profile, payment_month, emp_payment)
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

    total_income = _to_decimal(
        FinanceTransaction.objects.filter(transaction_filter, transaction_type='income').aggregate(total=Sum('amount'))['total']
    )
    total_expense = _to_decimal(
        FinanceTransaction.objects.filter(transaction_filter, transaction_type='expense').aggregate(total=Sum('amount'))['total']
    )
    unpaid_payments = Payment.objects.filter(payment_filter, is_paid=False)
    total_debt = Decimal('0')
    for p in unpaid_payments.only('amount', 'paid_amount'):
        total_debt += p.remaining_amount

    branches_data = []
    if user.role == 'super_admin':
        # N+1 muammosini hal qilish: barcha filiallar uchun tranzaksiyalarni bitta so'rovda guruhlab olamiz
        branch_stats_qs = FinanceTransaction.objects.filter(
            date__month=month, 
            date__year=year
        ).values('branch_id', 'transaction_type').annotate(total=Sum('amount'))

        # Filiallar xaritasini yaratamiz
        all_branches = Branch.objects.all().values('id', 'name')
        branch_map = {b['id']: {"id": b['id'], "name": b['name'], "income": 0.0, "expense": 0.0, "profit": 0.0} for b in all_branches}

        for stat in branch_stats_qs:
            b_id = stat['branch_id']
            if b_id in branch_map:
                val = float(stat['total'] or 0)
                if stat['transaction_type'] == 'income':
                    branch_map[b_id]['income'] = val
                else:
                    branch_map[b_id]['expense'] = val
        
        for b_id in branch_map:
            branch_map[b_id]['profit'] = branch_map[b_id]['income'] - branch_map[b_id]['expense']
        
        branches_data = list(branch_map.values())

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
    prev_income = _to_decimal(
        FinanceTransaction.objects.filter(prev_tx_filter, transaction_type='income').aggregate(total=Sum('amount'))['total']
    )
    prev_expense = _to_decimal(
        FinanceTransaction.objects.filter(prev_tx_filter, transaction_type='expense').aggregate(total=Sum('amount'))['total']
    )

    def calc_trend(curr, prev):
        curr, prev = float(curr), float(prev)
        if prev == 0: return 100.0 if curr > 0 else (-100.0 if curr < 0 else 0.0)
        return round(((curr - prev) / abs(prev)) * 100, 1)

    attendance_today = _safe_attendance_stats_for_user(user, today)

    # Statistika uchun filtrlarni aniqlash (Admin uchun faqat o'z filiali)
    stats_filters = {}
    enrollment_filters = {'is_active': True}
    if user.role == 'admin':
        stats_filters['branch'] = user.branch
        enrollment_filters['group__branch'] = user.branch

    # Student countni optimallashtirish: Student o'rniga Enrollmentdan sanaymiz (tezroq)
    from groups.models import GroupEnrollment
    students_count = GroupEnrollment.objects.filter(**enrollment_filters).values('student').distinct().count()

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
            "students": students_count,
            "mentors": User.objects.filter(role='mentor', is_active=True, **stats_filters).count(),
            "groups": Group.objects.filter(is_faol=True, **stats_filters).count(),
            "admins": User.objects.filter(role='admin', is_active=True, **stats_filters).count(),
            "attendance_today": attendance_today
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
        
        # 1. Barcha to'lovlarni bitta so'rovda guruhlab olamiz
        payment_stats_qs = Payment.objects.filter(
            group__branch=branch,
            month__month=month,
            month__year=year
        ).values('group_id').annotate(
            received=Sum('amount', filter=Q(is_paid=True)),
            debt=Sum('amount', filter=Q(is_paid=False))
        )
        payment_map = {p['group_id']: p for p in payment_stats_qs}

        # 2. Guruhlar va ulardagi studentlar sonini/holatini olamiz
        active_groups = Group.objects.filter(branch=branch, is_faol=True).select_related('mentor').prefetch_related(
            'enrollments__student'
        )
        
        # 3. Barcha davomatlarni bitta so'rovda olamiz (O(1) so'rov O(N) loop o'rniga)
        att_stats = Attendance.objects.filter(
            group__branch=branch,
            date__year=year,
            date__month=month,
            is_present=True
        ).values('student_id', 'group_id').annotate(count=Count('id'))
        att_map = {(a['student_id'], a['group_id']): a['count'] for a in att_stats}

        expected_income = Decimal('0')
        groups_detail = []

        for group in active_groups:
            try:
                g_expected = Decimal('0')
                group_enrollments = [e for e in group.enrollments.all() if e.is_active]
                student_count = len(group_enrollments)

                # Dars kunlarini bitta guruh uchun bir marta hisoblaymiz
                lesson_dates = group.get_lesson_dates(year, month)
                days_count = len(lesson_dates)
                
                g_accrued = 0
                for enrollment in group_enrollments:
                    student = enrollment.student
                    
                    # O'quvchi narxi mantiqi
                    base_price = group.monthly_price
                    if student.status in ['low_income', 'negotiated']:
                        if student.custom_fee is not None: base_price = student.custom_fee

                    # REFUND LOGIC: Kutilayotgan daromad = Asosiy narx - Jarima
                    if student.status == 'teacher_negotiated':
                        expected_student_income = 0
                    elif student.status == 'negotiated':
                        expected_student_income = floor_amount(base_price)
                    else:
                        passed_lessons = [d for d in lesson_dates if d <= today]
                        join_date = enrollment.joined_at.date()
                        passed_lessons = [d for d in passed_lessons if d >= join_date]
                        
                        passed_count = len(passed_lessons)
                        present_count = att_map.get((student.id, group.id), 0)
                        absences = max(0, passed_count - present_count)
                        
                        daily_price = floor_amount(base_price / days_count) if days_count > 0 else 0
                        refund = floor_amount(daily_price * absences)
                        
                        base_floor = floor_amount(base_price)
                        if refund > base_floor:
                            refund = base_floor
                            
                        expected_student_income = max(0, base_floor - refund)
                    
                    g_accrued += float(expected_student_income)

                expected_income += Decimal(str(g_accrued))
                
                # Payment mapdan ma'lumotlarni olamiz
                p_stat = payment_map.get(group.id, {})
                g_received = _to_decimal(p_stat.get('received'))

                mentor_name = group.mentor.get_full_name() if group.mentor else "Yo'q"
                
                g_monthly_price = float(group.monthly_price)
                g_daily_price = g_monthly_price / days_count if days_count > 0 else 0

                groups_detail.append({
                    "id": group.id,
                    "name": group.name,
                    "student_count": student_count,
                    "monthly_price": g_monthly_price,
                    "daily_price": round(g_daily_price, 2),
                    "expected_income": float(g_accrued), # Endi kutilayotgan tushum - davomatga asoslangan
                    "received_income": float(g_received),
                    "refund_amount": 0, # Refund endi yo'q
                    "real_income": float(g_received),
                    "debt": max(0, float(g_accrued) - float(g_received)),
                    "mentor": mentor_name
                })
            except Exception:
                logger.exception("Group statistikada xatolik: group_id=%s", group.id)
                continue

        # Umumiy tranzaksiyalar
        received_income = _to_decimal(FinanceTransaction.objects.filter(
            branch=branch, 
            date__month=month, 
            date__year=year, 
            transaction_type='income'
        ).aggregate(total=Sum('amount'))['total'])
        
        expenses = _to_decimal(FinanceTransaction.objects.filter(
            branch=branch, 
            date__month=month, 
            date__year=year, 
            transaction_type='expense'
        ).aggregate(total=Sum('amount'))['total'])

        return {
            "branch": {"id": branch.id, "name": branch.name},
            "stats": {
                "mentors": mentors_count, "admins": admins_count, "groups": groups_count, "students": students_count,
                "attendance_today": _safe_attendance_stats_for_branch(branch, today)
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

        # Fail-safe response: frontend sahifasi yiqilmasligi uchun
        fallback_branch = Branch.objects.filter(id=branch_id).values('id', 'name').first()
        return {
            "branch": {
                "id": fallback_branch['id'] if fallback_branch else branch_id,
                "name": fallback_branch['name'] if fallback_branch else "Noma'lum filial",
            },
            "stats": {
                "mentors": 0,
                "admins": 0,
                "groups": 0,
                "students": 0,
                "attendance_today": {"absent": 0, "total": 0},
            },
            "finance": {
                "expected_income": 0.0,
                "received_income": 0.0,
                "expenses": 0.0,
                "net_profit": 0.0,
            },
            "groups": [],
            "warning": "Ma'lumotlar vaqtincha to'liq emas. Server loglarini tekshiring.",
        }


def get_monthly_branch_trends(user, end_month, end_year, months_back=6):
    """
    Har oy kesimida filiallar bo'yicha tushum/chiqim trendi.
    Frontend bitta chartda barcha filiallarni ko'rsatishi uchun qaytariladi.
    """
    try:
        months_back = max(1, min(int(months_back), 24))
    except (TypeError, ValueError):
        months_back = 6

    end_month = int(end_month)
    end_year = int(end_year)

    month_points = []
    y, m = end_year, end_month
    for _ in range(months_back):
        month_points.append((y, m))
        if m == 1:
            y -= 1
            m = 12
        else:
            m -= 1
    month_points.reverse()

    if user.role == 'admin' and user.branch_id:
        branches = Branch.objects.filter(id=user.branch_id)
    else:
        branches = Branch.objects.all()

    branch_rows = list(branches.values('id', 'name'))
    branch_ids = [b['id'] for b in branch_rows]

    if not branch_ids:
        return {"months": [], "branches": []}

    start_year, start_month = month_points[0]
    end_year_last, end_month_last = month_points[-1]
    start_date = date(start_year, start_month, 1)
    end_day = calendar.monthrange(end_year_last, end_month_last)[1]
    end_date = date(end_year_last, end_month_last, end_day)

    tx_qs = FinanceTransaction.objects.filter(
        branch_id__in=branch_ids,
        date__gte=start_date,
        date__lte=end_date
    )

    aggregated = tx_qs.values(
        'branch_id', 'date__year', 'date__month', 'transaction_type'
    ).annotate(total=Sum('amount'))

    bucket = {}
    for row in aggregated:
        key = (row['date__year'], row['date__month'], row['branch_id'])
        if key not in bucket:
            bucket[key] = {'income': Decimal('0'), 'expense': Decimal('0')}
        tx_type = row['transaction_type']
        bucket[key][tx_type] = _to_decimal(row['total'])

    month_payload = []
    for year, month in month_points:
        month_label = f"{year}-{str(month).zfill(2)}"
        branch_stats = []
        for branch in branch_rows:
            totals = bucket.get((year, month, branch['id']), {'income': Decimal('0'), 'expense': Decimal('0')})
            branch_stats.append({
                "branch_id": branch['id'],
                "branch_name": branch['name'],
                "income": float(totals['income']),
                "expense": float(totals['expense']),
                "profit": float(totals['income'] - totals['expense']),
            })

        month_payload.append({
            "month": month_label,
            "branches": branch_stats
        })

    return {
        "months": month_payload,
        "branches": branch_rows
    }

