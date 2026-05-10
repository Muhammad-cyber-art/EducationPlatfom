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
            # Yangi mantiq: Status va Guruh turi bo'yicha narxni aniqlash
            if student.status == 'discount':
                # Imtiyozli o'quvchilar har doim 0 (ikki toifada ham)
                raw_amount = Decimal('0')
            elif student.status == 'negotiated' and group.group_type == 'advanced':
                # User talabi: Advanced guruhda kelishilgan narx statusi o'tmaydi -> to'liq narx
                raw_amount = group.monthly_price
            elif student.status in ['low_income', 'negotiated']:
                # Standart guruhda yoki low_income bo'lsa - profildagi custom_fee
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

def process_absence_refunds(month_date=None):
    """
    O'quvchilarning o'tib bo'lgan darslarda qoldirgan kunlari uchun refund tranzaksiyasi yaratadi
    (har bir qoldirish uchun kunlik narx; bitta o'quvchi bir nechta guruh uchun alohida).
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

    ignore_refund = str(data.get('ignore_refund', False)).lower() in ['true', '1', 'yes']
    payment.refund_ignored = ignore_refund

    # Asosiy summa - guruh oylik narxidan
    base_amount = payment.group.monthly_price if payment.group else Decimal('0')
    
    # User talabi: Advanced guruhda negotiated statusi o'tmaydi
    is_advanced = payment.group and payment.group.group_type == 'advanced'
    student_status = payment.student.status if payment.student else 'regular'

    # Agar standart guruh bo'lsa va kelishilgan narx bo'lsa - shaxsiy narxni olamiz
    if not is_advanced and student_status in ['low_income', 'negotiated']:
        base_amount = payment.student.custom_fee if payment.student.custom_fee is not None else Decimal('0')
    # Low income advanced bo'lsa ham o'z kuchida qolishi mumkin (user faqat negotiatedni aytdi, 
    # lekin xavfsizlik uchun low_income ni ham advancedda tekshiramiz agar kerak bo'lsa)
    elif is_advanced and student_status == 'low_income':
        base_amount = payment.student.custom_fee if payment.student.custom_fee is not None else Decimal('0')

    # Imtiyozli o'quvchilar uchun kelgan kunlarga qarab hisoblash
    calculation_note = None
    try:
        if payment.student and hasattr(payment.student, 'status') and payment.student.status == 'discount' and payment.month:
            target_group = payment.group
            if target_group:
                lessons_count = len(target_group.get_lesson_dates(payment.month.year, payment.month.month))
                if lessons_count > 0:
                    absences = payment.student.get_absences_count(payment.month.year, payment.month.month, group=target_group)
                    attended_days = lessons_count - absences
                    if attended_days > 0:
                        daily_price = floor_amount(target_group.monthly_price / lessons_count)
                        base_amount = floor_amount(daily_price * attended_days)
                        calculation_note = f"Kelgan kunlar: {attended_days}/{lessons_count}. Kunlik narx: {daily_price}. Jami: {base_amount}"
                    else:
                        base_amount = floor_amount(target_group.monthly_price)
                        calculation_note = f"Kelgan kunlar: {attended_days}/{lessons_count}. Jami: {base_amount}"
    except Exception as e:
        logger.error(f"Discount student calculation error: {str(e)}")

    # Refund hisoblash - ignore_refund flagga qarab
    calculated_refund = Decimal('0')
    try:
        if not payment.refund_ignored and payment.month and payment.student:
            calculated_refund = payment.student.calculate_refund_amount(
                payment.month.year,
                payment.month.month,
                group=payment.group,
            )
            if float(calculated_refund) > 0:
                base_amount = floor_amount(base_amount - Decimal(str(calculated_refund)))
                payment.refund_amount = Decimal(str(calculated_refund))
    except Exception as e:
        logger.error(f"Refund calculation error: {str(e)}")

    # Frontend dan kelgan amount ni e'tiborsiz qoldiramiz, o'zimiz hisoblaymiz
    final_amount = base_amount
    payment.amount = final_amount
    payment.save()

    # Yangi maydonlarni extract qilamiz
    method = data.get('payment_method', 'cash')
    receipt = data.get('receipt_image')
    notes = data.get('notes', '')
    is_receiptless = str(data.get('is_receiptless', False)).lower() in ['true', '1', 'yes']

    # Discount va refund ma'lumotlarini notes ga qo'shamiz
    notes_parts = []
    if notes:
        notes_parts.append(notes)
    if calculation_note:
        notes_parts.append(calculation_note)
    if calculated_refund and float(calculated_refund) > 0:
        notes_parts.append(f"Refund: {calculated_refund} UZS (oylik: {payment.group.monthly_price if payment.group else 0})")

    notes = " | ".join(notes_parts) if notes_parts else None

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
    total_debt = _to_decimal(
        Payment.objects.filter(payment_filter, is_paid=False).aggregate(total=Sum('amount'))['total']
    )

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
        # Note: expected_income student statusiga bog'liq bo'lgani uchun uni baribir loopda hisoblash xavfsizroq, 
        # lekin prefetch_related orqali DB so'rovlarini kamaytiramiz.
        active_groups = Group.objects.filter(branch=branch, is_faol=True).select_related('mentor').prefetch_related(
            'enrollments__student'
        )
        
        expected_income = Decimal('0')
        groups_detail = []

        for group in active_groups:
            try:
                g_expected = Decimal('0')
                # Faqat faol enrollmentlarni filtrlaymiz
                group_enrollments = [e for e in group.enrollments.all() if e.is_active]
                student_count = len(group_enrollments)

                for enrollment in group_enrollments:
                    student = enrollment.student
                    if student.status == 'discount':
                        continue
                    
                    # User talabi: Advanced guruhda negotiated statusi o'tmaydi
                    if group.group_type == 'advanced' and student.status == 'negotiated':
                        g_expected += _to_decimal(group.monthly_price)
                    elif student.status in ['low_income', 'negotiated']:
                        g_expected += _to_decimal(student.custom_fee)
                    else:
                        g_expected += _to_decimal(group.monthly_price)

                expected_income += g_expected

                # Payment mapdan ma'lumotlarni olamiz
                p_stat = payment_map.get(group.id, {})
                g_received = _to_decimal(p_stat.get('received'))
                g_debt = _to_decimal(p_stat.get('debt'))

                # Refundlar: bu qism eng sekin ishlaydi, shuning uchun dars kunlarini bir marta olib loop qilamiz
                g_refunds = 0
                lesson_dates = group.get_lesson_dates(year, month)
                days_count = len(lesson_dates)
                
                # Refund hisoblash (agar studentlar juda ko'p bo'lsa buni ham optimallashtirish mumkin)
                for enrollment in group_enrollments:
                    try:
                        refund = enrollment.student.calculate_refund_amount(year, month, group=group)
                        g_refunds += float(refund)
                    except Exception:
                        continue

                mentor_name = group.mentor.get_full_name() if group.mentor else "Yo'q"
                
                g_monthly_price = float(group.monthly_price)
                g_daily_price = g_monthly_price / days_count if days_count > 0 else 0

                groups_detail.append({
                    "id": group.id,
                    "name": group.name,
                    "student_count": student_count,
                    "monthly_price": g_monthly_price,
                    "daily_price": round(g_daily_price, 2),
                    "expected_income": float(g_expected),
                    "received_income": float(g_received),
                    "refund_amount": g_refunds,
                    "real_income": float(g_received) - g_refunds,
                    "debt": float(g_debt),
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

