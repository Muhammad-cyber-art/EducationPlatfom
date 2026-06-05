import calendar
import logging
import traceback
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from groups.models import Branch, Group, GroupEnrollment, Student
from homework_attends.models import Attendance

from finance.utils import (
    aggregate_attendance_refunds,
    aggregate_attendance_refunds_by_branch,
    calculate_attendance_based_student_payment,
    floor_amount,
    normalize_month,calculate_discount_student_payment
)

from .models import (
    EmployeeAdvance,
    EmployeePayment,
    FinanceTransaction,
    Payment,
    StaffProfile,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def update_attendance_based_payments(student, group, date):
    """
    Davomat o'zgarganda:
      1) Discount student uchun (faqat joriy oy): Payment.amount qayta hisoblanadi.
      2) Discount/Negotiated studentlar uchun (joriy oy): mentor maoshi qayta hisoblanadi.
    """
    from finance.models import EmployeePayment, Payment
    from finance.utils import (
        calculate_attendance_based_student_payment,
        normalize_month,
    )

    month_date = normalize_month(date)
    current_month = normalize_month(timezone.localdate())

    # 1. Discount student uchun Payment.amount ni yangilash (faqat joriy oy, to'lanmagan bo'lsa)
    if student.status == "discount" and month_date == current_month:
        try:
            payment, _ = Payment.objects.get_or_create(
                student=student,
                group=group,
                month=month_date,
                defaults={"amount": Decimal("0"), "is_paid": False},
            )
            if not payment.is_paid:
                new_amount = calculate_attendance_based_student_payment(
                    student, group, month_date
                )
                if payment.amount != new_amount:
                    payment.amount = new_amount
                    payment.save()
        except Exception as e:
            logger.error(
                "Failed to update discount payment for student %s, group %s, date %s: %s",
                student.id,
                group.id,
                date,
                e,
            )

    # 2. Mentor maoshi (discount/negotiated uchun) — faqat joriy oy
    if student.status in ["discount", "negotiated"] and month_date == current_month:
        try:
            mentor = group.mentor
            if mentor and hasattr(mentor, "staff_profile"):
                profile = mentor.staff_profile
                if profile.salary_type in ["percentage", "student_count"]:
                    emp_payment = EmployeePayment.objects.filter(
                        employee=mentor, month=month_date, is_paid=False
                    ).first()
                    if emp_payment:
                        apply_calculated_salary_to_employee_payment(
                            profile, month_date, emp_payment
                        )
                        emp_payment.save()
                    else:
                        emp_payment, _ = EmployeePayment.objects.get_or_create(
                            employee=mentor,
                            month=month_date,
                            defaults={
                                "salary_base": Decimal("0"),
                                "is_paid": False,
                                "attendance_deductions": {},
                            },
                        )
                        apply_calculated_salary_to_employee_payment(
                            profile, month_date, emp_payment
                        )
                        emp_payment.save()
        except Exception as e:
            logger.error(
                "Failed to update mentor salary for group %s, date %s: %s",
                group.id,
                date,
                e,
            )


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
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _safe_attendance_stats_for_branch(branch, today):
    """Attendance query xato bersa ham finance statistikasi yiqilmasin."""
    try:
        from groups.utils import is_lesson_day

        weekday = today.weekday()
        if weekday == 6:  # Yakshanba, hech kim darsga kelmaydi
            return {"absent": 0, "total": 0}

        # Guruhlarni bugun darslari borlarini qidiramiz, lekin bekor qilinganlarni chiqarib tashlaymiz
        # Birinchi, special dars kunlari bor guruhlar, lekin bekor qilinmaganlar
        groups_with_special_lesson = (
            Group.objects.filter(branch=branch, special_lesson_days__date=today)
            .exclude(canceled_lesson_days__date=today)
            .values_list("id", flat=True)
        )

        # Keyin, kunlar turiga qarab darslari bor guruhlar (odd, even, everyday)
        # va special dars kuni yo'qlar va bekor qilinmaganlar
        groups_with_regular_lesson = []
        if weekday in [0, 2, 4]:  # Du-Chor-Ju (odd)
            groups_with_regular_lesson = (
                Group.objects.filter(branch=branch, days__in=["odd", "everyday"])
                .exclude(id__in=groups_with_special_lesson)
                .exclude(canceled_lesson_days__date=today)
                .values_list("id", flat=True)
            )
        elif weekday in [1, 3, 5]:  # Se-Pay-Shan (even)
            groups_with_regular_lesson = (
                Group.objects.filter(branch=branch, days__in=["even", "everyday"])
                .exclude(id__in=groups_with_special_lesson)
                .exclude(canceled_lesson_days__date=today)
                .values_list("id", flat=True)
            )

        # Barcha bugun darslari bor guruhlar
        lesson_group_ids = list(groups_with_special_lesson) + list(
            groups_with_regular_lesson
        )

        # Endi faqat shu guruhlarda aktiv bo'lgan talabalarni olamiz
        total_active_students_qs = Student.objects.filter(
            enrollments__is_active=True, enrollments__group__id__in=lesson_group_ids
        ).distinct()

        total_students_ids = set(total_active_students_qs.values_list("id", flat=True))

        # Davomat qaydlarini olamiz
        base_attendance_qs = Attendance.objects.filter(group__branch=branch, date=today)
        present_ids = set(
            base_attendance_qs.filter(is_present=True)
            .values_list("student_id", flat=True)
            .distinct()
        )

        present_count = len(total_students_ids & present_ids)
        absent_count = len(total_students_ids) - present_count

        return {
            "absent": absent_count,
            "total": len(total_students_ids),
        }
    except Exception:
        logger.exception(
            "Attendance branch statistikasi xatoligi: branch_id=%s",
            getattr(branch, "id", None),
        )
        return {"absent": 0, "total": 0}


def _safe_attendance_stats_for_user(user, today):
    """Dashboard attendance hisobida fallback."""
    try:
        from groups.utils import is_lesson_day

        weekday = today.weekday()
        if weekday == 6:  # Yakshanba
            return {"absent": 0, "total": 0}

        # Foydalanuvchi roliga qarab guruhlarni olamiz
        if user.role == "admin":
            branch_filter = {"branch": user.branch}
        else:
            branch_filter = {}

        # Guruhlarni bugun darslari borlarini qidiramiz, bekor qilinganlarni chiqarib tashlaymiz
        groups_with_special_lesson = (
            Group.objects.filter(**branch_filter, special_lesson_days__date=today)
            .exclude(canceled_lesson_days__date=today)
            .values_list("id", flat=True)
        )

        groups_with_regular_lesson = []
        if weekday in [0, 2, 4]:  # Du-Chor-Ju (odd)
            groups_with_regular_lesson = (
                Group.objects.filter(**branch_filter, days__in=["odd", "everyday"])
                .exclude(id__in=groups_with_special_lesson)
                .exclude(canceled_lesson_days__date=today)
                .values_list("id", flat=True)
            )
        elif weekday in [1, 3, 5]:  # Se-Pay-Shan (even)
            groups_with_regular_lesson = (
                Group.objects.filter(**branch_filter, days__in=["even", "everyday"])
                .exclude(id__in=groups_with_special_lesson)
                .exclude(canceled_lesson_days__date=today)
                .values_list("id", flat=True)
            )

        lesson_group_ids = list(groups_with_special_lesson) + list(
            groups_with_regular_lesson
        )

        # Faqat shu guruhlarda aktiv talabalar
        total_active_students_qs = Student.objects.filter(
            enrollments__is_active=True, enrollments__group__id__in=lesson_group_ids
        ).distinct()

        total_students_ids = set(total_active_students_qs.values_list("id", flat=True))

        # Davomat qaydlarini olamiz
        base_attendance_qs = Attendance.objects.filter(date=today)
        if user.role == "admin":
            base_attendance_qs = base_attendance_qs.filter(group__branch=user.branch)

        present_ids = set(
            base_attendance_qs.filter(is_present=True)
            .values_list("student_id", flat=True)
            .distinct()
        )

        present_count = len(total_students_ids & present_ids)
        absent_count = len(total_students_ids) - present_count

        return {
            "absent": absent_count,
            "total": len(total_students_ids),
        }
    except Exception:
        logger.exception(
            "Attendance user statistikasi xatoligi: user_id=%s",
            getattr(user, "id", None),
        )
        return {"absent": 0, "total": 0}


@transaction.atomic
def generate_monthly_payments(month_date=None):
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)
    else:
        month_date = normalize_month(month_date)

    created_count = 0

    # 1. STUDENT PAYMENTS
    active_groups = [
        g
        for g in Group.objects.filter(is_faol=True).prefetch_related("students")
        if g.is_logic_enabled()
    ]
    for group in active_groups:
        for student in group.students.all():
            # REFUND LOGIC: Boshlang'ich summa qilib to'liq narx belgilanadi.
            base_price = group.monthly_price
            if student.status in [
                "low_income",
                "negotiated",
                "discount",
                "teacher_negotiated",
            ]:
                if student.custom_fee is not None:
                    base_price = student.custom_fee

            if student.status == "discount":
                # Imtiyozli student uchun davomatga asoslangan hisoblash
                payment_amount = calculate_attendance_based_student_payment(
                    student, group, month_date
                )
            else:
                # negotiated, teacher_negotiated, low_income va regular: shartnoma summasi
                payment_amount = Decimal(str(floor_amount(base_price)))

            _, created = Payment.objects.get_or_create(
                student=student,
                group=group,
                month=month_date,
                defaults={"amount": payment_amount, "is_paid": False},
            )
            if created:
                created_count += 1

    # 2. EMPLOYEE PAYMENTS
    profiles = StaffProfile.objects.select_related("user").filter(user__is_active=True)
    for profile in profiles:
        salary = profile.calculate_salary_for_month(month_date)
        _, created = EmployeePayment.objects.get_or_create(
            employee=profile.user,
            month=month_date,
            defaults={
                "salary_base": salary,
                "bonus": 0,
                "deductions": 0,
                "is_paid": False,
            },
        )
        if created:
            created_count += 1

    return created_count


def process_absence_refunds(month_date=None):
    """
    OLD LOGIC: Refund endi ishlatilmaydi.
    Chunki to'lov endi davomatga qarab to'ldirib boriladi.
    """
    return 0, 0


def handle_custom_payment(request_user, data):
    """O'quvchi uchun maxsus (oylikdan tashqari) to'lovni boshqarish"""
    id_student = data["student"]
    id_group = data["group"]
    amount = data["amount"]
    transaction_type = data["transaction_type"]
    payer_name = data.get("payer_name", "")
    description = data.get("description", "")
    date_val = data.get("date", timezone.localdate())

    student = get_object_or_404(Student, id=id_student)
    group = get_object_or_404(Group, id=id_group)

    branch_instance = student.branch or group.branch
    if not branch_instance and hasattr(request_user, "branch"):
        branch_instance = request_user.branch

    if not branch_instance:
        raise ValueError("Filialni aniqlab bo'lmadi.")

    final_payer = (
        payer_name if (payer_name and payer_name.strip()) else student.full_name
    )
    title_val = (
        f"Qo'shimcha to'lov: {student.full_name}"
        if transaction_type == "income"
        else f"Chiqim (Portal): {student.full_name}"
    )

    with transaction.atomic():
        ft = FinanceTransaction.objects.create(
            transaction_type=transaction_type,
            category="student_extra",
            amount=amount,
            date=date_val,
            marked_by=request_user,
            branch=branch_instance,
            student=student,
            group=group,
            payer_name=final_payer,
            title=title_val,
            description=description,
        )

        # Mentor oyligini qayta hisoblash
        mentor_salary_updated = False
        try:
            mentor = group.mentor
            if mentor and hasattr(mentor, "staff_profile"):
                profile = mentor.staff_profile
                if profile.salary_type in ["percentage", "student_count"]:
                    payment_month = date_val.replace(day=1)
                    emp_payment = EmployeePayment.objects.filter(
                        employee=mentor, month=payment_month, is_paid=False
                    ).first()

                    if emp_payment:
                        apply_calculated_salary_to_employee_payment(
                            profile, payment_month, emp_payment
                        )
                        emp_payment.save()
                    else:
                        emp_payment, _ = EmployeePayment.objects.get_or_create(
                            employee=mentor,
                            month=payment_month,
                            defaults={
                                "salary_base": Decimal("0"),
                                "is_paid": False,
                                "attendance_deductions": {},
                            },
                        )
                        apply_calculated_salary_to_employee_payment(
                            profile, payment_month, emp_payment
                        )
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
    pay_full_month = str(data.get("pay_full_month", False)).lower() in [
        "true",
        "1",
        "yes",
    ]
    ignore_refund = str(data.get("ignore_refund", False)).lower() in [
        "true",
        "1",
        "yes",
    ]
    is_partial_payment = str(data.get("is_partial_payment", False)).lower() in [
        "true",
        "1",
        "yes",
    ]
    is_custom_amount = str(data.get("is_custom_amount", False)).lower() in [
        "true",
        "1",
        "yes",
    ]

    # Amount ni olish
    provided_amount = data.get("amount")
    installment_amount = None
    if provided_amount is not None and str(provided_amount).strip():
        try:
            installment_amount = Decimal(str(provided_amount).strip())
        except Exception:
            pass

    if is_custom_amount:
        # ---------------------------------------------------------------
        # CUSTOM PAYMENT: foydalanuvchi tomonidan belgilangan summa.
        # payment.amount = custom summa (contract o'zgaradi),
        # installment shu summada qoladi — ortiqcha reset YO'Q.
        # ---------------------------------------------------------------
        if installment_amount is None:
            raise ValueError("Custom to'lov uchun summa kiritish shart")
        if installment_amount <= 0:
            raise ValueError("Custom to'lov summasi 0 dan katta bo'lishi kerak")
        payment.amount = floor_amount(installment_amount)
        payment.refund_amount = Decimal("0")
        payment.refund_ignored = True
        # installment custom rejimda o'zgartirilmaydi — foydalanuvchi tanlaganida qoladi
    else:
        # ---------------------------------------------------------------
        # ODDIY REJIM: to'liq / bo'lib / refund bilan
        # ---------------------------------------------------------------
        status = payment.student.status
        if status in ["low_income", "negotiated", "discount", "teacher_negotiated"]:
            base_amount = (
                payment.student.custom_fee
                if payment.student.custom_fee is not None
                else payment.group.monthly_price
            )
        else:
            base_amount = payment.group.monthly_price

        contract_amount = Decimal(str(floor_amount(base_amount)))

        if status == "discount":
            # Discount: faqat davomat asosida (refund yo'q)
            if payment.amount is None:
                from finance.utils import calculate_attendance_based_student_payment

                final_amount = calculate_attendance_based_student_payment(
                    payment.student, payment.group, payment.month
                )
            else:
                final_amount = payment.amount
            payment.refund_amount = Decimal("0")
            payment.refund_ignored = True
        elif status == "negotiated":
            # Negotiated: shartnoma summasi, attendance refund qo'llanilmaydi
            final_amount = contract_amount
            payment.refund_amount = Decimal("0")
            payment.refund_ignored = True
        else:
            if pay_full_month or ignore_refund:
                # To'liq oylik to'lash (ignore refund)
                final_amount = contract_amount
                payment.refund_amount = Decimal("0")
                if ignore_refund:
                    payment.refund_ignored = True
            else:
                # Jarimani aniqlash
                refund_val = payment.student.calculate_refund_amount(
                    payment.month.year,
                    payment.month.month,
                    group=payment.group,
                )
                payment.refund_amount = Decimal(str(refund_val))
                payment.refund_ignored = False
                final_amount = Decimal(
                    str(max(Decimal("0"), contract_amount - Decimal(str(refund_val))))
                )

        # Kutilayotgan oylik summa (qarz)
        payment.amount = final_amount

        # Installment hisoblash — faqat oddiy rejimda
        if installment_amount is None:
            remaining = payment.remaining_amount
            installment_amount = remaining if remaining > 0 else final_amount
        elif not is_partial_payment:
            # To'liq to'lash: qolgan summani yopish
            remaining = payment.remaining_amount
            if remaining > 0:
                installment_amount = remaining
            else:
                installment_amount = final_amount

    # Yangi maydonlarni extract qilamiz
    method = data.get("payment_method", "cash")
    receipt = data.get("receipt_image")
    notes = data.get("notes", "")
    is_receiptless = str(data.get("is_receiptless", False)).lower() in [
        "true",
        "1",
        "yes",
    ]

    # Davomat ma'lumotlarini notes ga qo'shamiz
    notes_parts = []
    if notes:
        notes_parts.append(notes)

    lesson_dates = payment.group.get_lesson_dates(
        payment.month.year, payment.month.month
    )
    present_count = Attendance.objects.filter(
        student=payment.student,
        group=payment.group,
        date__year=payment.month.year,
        date__month=payment.month.month,
        is_present=True,
    ).count()

    notes_parts.append(f"Davomat: {present_count}/{len(lesson_dates)} dars")
    if is_partial_payment:
        notes_parts.append("Bo'lib to'lov")
    if is_custom_amount:
        notes_parts.append("Custom to'lov")
    notes = " | ".join(notes_parts)

    payment.apply_payment(
        request_user,
        installment_amount,
        method=method,
        receipt=receipt,
        notes=notes,
        is_receiptless=is_receiptless,
        is_full_amount=pay_full_month and not is_partial_payment,
        is_custom_amount=is_custom_amount,
    )

    # Mentor oyligini qayta hisoblash
    try:
        mentor = payment.group.mentor
        if mentor and hasattr(mentor, "staff_profile"):
            profile = mentor.staff_profile
            if profile.salary_type in ["percentage", "student_count"]:
                payment_month = payment.month.replace(day=1) if payment.month else None
                if payment_month:
                    emp_payment = EmployeePayment.objects.filter(
                        employee=mentor, month=payment_month, is_paid=False
                    ).first()
                    if emp_payment:
                        apply_calculated_salary_to_employee_payment(
                            profile, payment_month, emp_payment
                        )
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

    if user.role == "admin":
        payment_filter &= Q(group__branch=user.branch)
        employee_filter &= Q(employee__branch=user.branch)
        transaction_filter &= Q(branch=user.branch)

    total_income = _to_decimal(
        FinanceTransaction.objects.filter(
            transaction_filter, transaction_type="income"
        ).aggregate(total=Sum("amount"))["total"]
    )
    total_expense = _to_decimal(
        FinanceTransaction.objects.filter(
            transaction_filter, transaction_type="expense"
        ).aggregate(total=Sum("amount"))["total"]
    )
    unpaid_payments = Payment.objects.filter(payment_filter, is_paid=False)
    total_debt = Decimal("0")
    for p in unpaid_payments.only("amount", "paid_amount"):
        total_debt += p.remaining_amount

    branches_data = []
    if user.role == "super_admin":
        # N+1 muammosini hal qilish: barcha filiallar uchun tranzaksiyalarni bitta so'rovda guruhlab olamiz
        branch_stats_qs = (
            FinanceTransaction.objects.filter(date__month=month, date__year=year)
            .values("branch_id", "transaction_type")
            .annotate(total=Sum("amount"))
        )

        # Filiallar xaritasini yaratamiz
        all_branches = Branch.objects.all().values("id", "name")
        branch_map = {
            b["id"]: {
                "id": b["id"],
                "name": b["name"],
                "income": 0.0,
                "expense": 0.0,
                "profit": 0.0,
            }
            for b in all_branches
        }

        for stat in branch_stats_qs:
            b_id = stat["branch_id"]
            if b_id in branch_map:
                val = float(stat["total"] or 0)
                if stat["transaction_type"] == "income":
                    branch_map[b_id]["income"] = val
                else:
                    branch_map[b_id]["expense"] = val

        for b_id in branch_map:
            branch_map[b_id]["profit"] = (
                branch_map[b_id]["income"] - branch_map[b_id]["expense"]
            )
            branch_map[b_id]["attendance_refunds"] = 0.0

        refund_by_branch = aggregate_attendance_refunds_by_branch(year, month)
        for b_id, refund_val in refund_by_branch.items():
            if b_id in branch_map:
                branch_map[b_id]["attendance_refunds"] = refund_val

        branches_data = list(branch_map.values())

    # 1. Barcha to'lgan paymentlarni guruh bo'yicha sum (paid_amount ni ishlatamiz!)
    group_payment_income = {}
    payment_qs = Payment.objects.filter(month__month=month, month__year=year)
    if user.role == "admin":
        payment_qs = payment_qs.filter(group__branch=user.branch)
    payment_qs = payment_qs.values("group_id").annotate(total=Sum("paid_amount"))
    for p in payment_qs:
        group_payment_income[p["group_id"]] = _to_decimal(p["total"])

    # 2. Barcha student_extra income tranzaksiyalarini guruh bo'yicha sum
    group_extra_income = {}
    extra_qs = FinanceTransaction.objects.filter(
        category="student_extra",
        transaction_type="income",
        date__year=year,
        date__month=month,
    )
    if user.role == "admin":
        extra_qs = extra_qs.filter(branch=user.branch)
    extra_qs = extra_qs.values("group_id").annotate(total=Sum("amount"))
    for x in extra_qs:
        group_extra_income[x["group_id"]] = _to_decimal(x["total"])

    # 3. Guruhlarni olish va income ni hisoblash
    top_groups_qs = Group.objects.filter(is_faol=True)
    if user.role == "admin":
        top_groups_qs = top_groups_qs.filter(branch=user.branch)
    top_groups_qs = top_groups_qs.annotate(st_count=Count("students", distinct=True))

    # Har guruh uchun total income ni hisoblash va sort qilish
    groups_with_income = []
    for g in top_groups_qs:
        p_inc = group_payment_income.get(g.id, Decimal("0"))
        e_inc = group_extra_income.get(g.id, Decimal("0"))
        total_inc = p_inc + e_inc
        groups_with_income.append({"group": g, "income": total_inc})

    # Eng yuqori income li 5 ta guruhni olish
    groups_with_income.sort(key=lambda x: x["income"], reverse=True)
    top_groups_data = []
    for item in groups_with_income[:5]:
        top_groups_data.append(item["group"])

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_tx_filter = Q(date__month=prev_month, date__year=prev_year)
    if user.role == "admin":
        prev_tx_filter &= Q(branch=user.branch)
    prev_income = _to_decimal(
        FinanceTransaction.objects.filter(
            prev_tx_filter, transaction_type="income"
        ).aggregate(total=Sum("amount"))["total"]
    )
    prev_expense = _to_decimal(
        FinanceTransaction.objects.filter(
            prev_tx_filter, transaction_type="expense"
        ).aggregate(total=Sum("amount"))["total"]
    )

    def calc_trend(curr, prev):
        curr, prev = float(curr), float(prev)
        if prev == 0:
            return 100.0 if curr > 0 else (-100.0 if curr < 0 else 0.0)
        return round(((curr - prev) / abs(prev)) * 100, 1)

    attendance_today = _safe_attendance_stats_for_user(user, today)

    # Statistika uchun filtrlarni aniqlash (Admin uchun faqat o'z filiali)
    stats_filters = {}
    enrollment_filters = {"is_active": True}
    if user.role == "admin":
        stats_filters["branch"] = user.branch
        enrollment_filters["group__branch"] = user.branch

    # Student countni optimallashtirish: Student o'rniga Enrollmentdan sanaymiz (tezroq)
    from groups.models import GroupEnrollment

    students_count = (
        GroupEnrollment.objects.filter(**enrollment_filters)
        .values("student")
        .distinct()
        .count()
    )

    branch_for_refunds = user.branch if user.role == "admin" else None
    total_attendance_refunds = aggregate_attendance_refunds(
        year, month, branch=branch_for_refunds
    )
    total_attendance_refunds_paid = aggregate_attendance_refunds(
        year, month, branch=branch_for_refunds, paid_only=True
    )
    refund_share_percent = 0.0
    gross_student_fees = float(total_income) + total_attendance_refunds_paid
    if gross_student_fees > 0:
        refund_share_percent = round(
            (total_attendance_refunds_paid / gross_student_fees) * 100, 1
        )

    return {
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "net_profit": float(total_income - total_expense),
        "total_debt": float(total_debt),
        "total_attendance_refunds": total_attendance_refunds,
        "total_attendance_refunds_paid": total_attendance_refunds_paid,
        "refund_share_percent": refund_share_percent,
        "income_trend": calc_trend(total_income, prev_income),
        "expense_trend": calc_trend(total_expense, prev_expense),
        "profit_trend": calc_trend(
            total_income - total_expense, prev_income - prev_expense
        ),
        "branches": branches_data,
        "top_groups": [
            {
                "name": item["group"].name,
                "profit": float(item["income"]),
                "student_count": item["group"].st_count,
            }
            for item in groups_with_income[:5]
        ],
        "stats": {
            "students": students_count,
            "mentors": User.objects.filter(
                role="mentor", is_active=True, **stats_filters
            ).count(),
            "groups": Group.objects.filter(is_faol=True, **stats_filters).count(),
            "admins": User.objects.filter(
                role="admin", is_active=True, **stats_filters
            ).count(),
            "attendance_today": attendance_today,
        },
    }


def get_branch_finance_stats(branch_id, month, year):
    """Filial uchun moliya statistikasini yig'ish (Optimallashgan)"""
    try:
        from decimal import Decimal

        from finance.utils import floor_amount

        branch = get_object_or_404(Branch, id=branch_id)
        today = timezone.localdate()

        # Statistikani yig'ish
        mentors_count = User.objects.filter(
            branch=branch, role="mentor", is_active=True
        ).count()
        admins_count = User.objects.filter(
            branch=branch, role="admin", is_active=True
        ).count()
        groups_count = Group.objects.filter(branch=branch, is_faol=True).count()
        students_count = (
            Student.objects.filter(branch=branch, enrollments__is_active=True)
            .distinct()
            .count()
        )

        # 1. Barcha to'lovlarni bitta so'rovda guruhlab olamiz
        payment_qs = Payment.objects.filter(
            group__branch=branch, month__month=month, month__year=year
        )
        payment_map = {}  # key: (student_id, group_id)
        group_payment_refunds = {}  # key: group_id, value: total refund_amount
        for p in payment_qs:
            key = (p.student_id, p.group_id)
            payment_map[key] = p
            # Guruh uchun umumiy refundni hisoblash
            group_payment_refunds[p.group_id] = group_payment_refunds.get(
                p.group_id, Decimal("0")
            ) + _to_decimal(p.refund_amount)

        # 2. Barcha student_extra tranzaksiyalarini olamiz
        extra_qs = FinanceTransaction.objects.filter(
            branch=branch, category="student_extra", date__year=year, date__month=month
        )
        extra_map = {}
        for tx in extra_qs:
            key = (tx.student_id, tx.group_id)
            if key not in extra_map:
                extra_map[key] = Decimal("0")
            if tx.transaction_type == "income":
                extra_map[key] += _to_decimal(tx.amount)
            else:
                extra_map[key] -= _to_decimal(tx.amount)

        # 3. Guruhlar va ulardagi studentlarni olamiz
        active_groups = (
            Group.objects.filter(branch=branch, is_faol=True)
            .select_related("mentor")
            .prefetch_related("enrollments__student", "old_students_fk")
        )

        expected_income = Decimal("0")
        total_received = Decimal("0")
        total_payment_refunds = sum(
            group_payment_refunds.values(), Decimal("0")
        )  # Umumiy refund miqdori
        groups_detail = []

        for group in active_groups:
            try:
                g_expected = Decimal("0")
                g_received = Decimal("0")
                # Barcha studentlarni olamiz
                all_students_map = {}
                for enrollment in group.enrollments.all():
                    if enrollment.student:
                        all_students_map[enrollment.student.id] = enrollment.student
                for s in group.old_students_fk.all():
                    all_students_map[s.id] = s
                students = list(all_students_map.values())
                student_count = len(students)
                processed_pairs = set()

                for student in students:
                    key = (student.id, group.id)
                    if key in processed_pairs:
                        continue
                    processed_pairs.add(key)

                    student_extra = extra_map.get(key, Decimal("0"))

                    if student.status == "teacher_negotiated":
                        base_expected = Decimal(
                            str(student.custom_fee or group.monthly_price or 0)
                        )
                    elif student.status == "discount":
                        base_expected = calculate_attendance_based_student_payment(
                            student, group, date(year, month, 1)
                        )
                    elif student.status in ["negotiated", "low_income"]:
                        base_expected = Decimal(
                            str(student.custom_fee or group.monthly_price or 0)
                        )
                    else:  # regular
                        base_expected = Decimal(str(group.monthly_price or 0))
                    base_expected = floor_amount(base_expected)

                    # Actual summa: to'langan summa yoki davomat asosida (discount) + student_extra
                    p = payment_map.get(key)
                    actual_base = Decimal("0")
                    if student.status == "discount":
                        actual_base = calculate_discount_student_payment(
                            student, group, date(year, month, 1)
                        )
                    elif p:
                        actual_base = Decimal(str(p.paid_amount or 0))
                    actual_total = actual_base + student_extra
                    expected_total = base_expected + student_extra

                    g_expected += expected_total
                    g_received += actual_total

                expected_income += g_expected
                total_received += g_received

                mentor_name = group.mentor.get_full_name() if group.mentor else "Yo'q"
                g_monthly_price = float(group.monthly_price)
                g_refund_amount = float(
                    group_payment_refunds.get(group.id, Decimal("0"))
                )

                groups_detail.append(
                    {
                        "id": group.id,
                        "name": group.name,
                        "student_count": student_count,
                        "monthly_price": g_monthly_price,
                        "daily_price": round(
                            g_monthly_price
                            / max(len(group.get_lesson_dates(year, month)), 1),
                            2,
                        ),
                        "expected_income": float(g_expected),
                        "received_income": float(g_received),
                        "refund_amount": g_refund_amount,
                        "real_income": float(g_received),
                        "debt": max(0, float(g_expected) - float(g_received)),
                        "mentor": mentor_name,
                    }
                )
            except Exception:
                logger.exception("Group statistikada xatolik: group_id=%s", group.id)
                continue

        # Umumiy tranzaksiyalar
        received_income = _to_decimal(
            FinanceTransaction.objects.filter(
                branch=branch,
                date__month=month,
                date__year=year,
                transaction_type="income",
            ).aggregate(total=Sum("amount"))["total"]
        )

        expenses = _to_decimal(
            FinanceTransaction.objects.filter(
                branch=branch,
                date__month=month,
                date__year=year,
                transaction_type="expense",
            ).aggregate(total=Sum("amount"))["total"]
        )

        attendance_refunds = aggregate_attendance_refunds(year, month, branch=branch)
        attendance_refunds_paid = aggregate_attendance_refunds(
            year, month, branch=branch, paid_only=True
        )
        refund_share_percent = 0.0
        if float(received_income) + attendance_refunds_paid > 0:
            refund_share_percent = round(
                (
                    attendance_refunds_paid
                    / (float(received_income) + attendance_refunds_paid)
                )
                * 100,
                1,
            )

        return {
            "branch": {"id": branch.id, "name": branch.name},
            "stats": {
                "mentors": mentors_count,
                "admins": admins_count,
                "groups": groups_count,
                "students": students_count,
                "attendance_today": _safe_attendance_stats_for_branch(branch, today),
            },
            "finance": {
                "expected_income": float(expected_income),
                "received_income": float(received_income),
                "refunds": attendance_refunds,
                "total_payment_refunds": float(
                    total_payment_refunds
                ),  # Umumiy refund miqdori (Payment.refund_amount)
                "attendance_refunds": attendance_refunds,
                "attendance_refunds_paid": attendance_refunds_paid,
                "refund_share_percent": refund_share_percent,
                "real_revenue": float(received_income),
                "expenses": float(expenses),
                "net_profit": float(received_income) - float(expenses),
            },
            "groups": groups_detail,
        }
    except Exception as e:
        logger.error(f"Error in get_branch_finance_stats: {str(e)}")
        logger.error(traceback.format_exc())

        # Fail-safe response: frontend sahifasi yiqilmasligi uchun
        fallback_branch = (
            Branch.objects.filter(id=branch_id).values("id", "name").first()
        )
        return {
            "branch": {
                "id": fallback_branch["id"] if fallback_branch else branch_id,
                "name": fallback_branch["name"]
                if fallback_branch
                else "Noma'lum filial",
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
                "refunds": 0.0,
                "attendance_refunds": 0.0,
                "attendance_refunds_paid": 0.0,
                "refund_share_percent": 0.0,
                "real_revenue": 0.0,
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

    if user.role == "admin" and user.branch_id:
        branches = Branch.objects.filter(id=user.branch_id)
    else:
        branches = Branch.objects.all()

    branch_rows = list(branches.values("id", "name"))
    branch_ids = [b["id"] for b in branch_rows]

    if not branch_ids:
        return {"months": [], "branches": []}

    start_year, start_month = month_points[0]
    end_year_last, end_month_last = month_points[-1]
    start_date = date(start_year, start_month, 1)
    end_day = calendar.monthrange(end_year_last, end_month_last)[1]
    end_date = date(end_year_last, end_month_last, end_day)

    tx_qs = FinanceTransaction.objects.filter(
        branch_id__in=branch_ids, date__gte=start_date, date__lte=end_date
    )

    aggregated = tx_qs.values(
        "branch_id", "date__year", "date__month", "transaction_type"
    ).annotate(total=Sum("amount"))

    bucket = {}
    for row in aggregated:
        key = (row["date__year"], row["date__month"], row["branch_id"])
        if key not in bucket:
            bucket[key] = {"income": Decimal("0"), "expense": Decimal("0")}
        tx_type = row["transaction_type"]
        bucket[key][tx_type] = _to_decimal(row["total"])

    month_payload = []
    for year, month in month_points:
        month_label = f"{year}-{str(month).zfill(2)}"
        branch_stats = []
        for branch in branch_rows:
            totals = bucket.get(
                (year, month, branch["id"]),
                {"income": Decimal("0"), "expense": Decimal("0")},
            )
            branch_stats.append(
                {
                    "branch_id": branch["id"],
                    "branch_name": branch["name"],
                    "income": float(totals["income"]),
                    "expense": float(totals["expense"]),
                    "profit": float(totals["income"] - totals["expense"]),
                }
            )

        month_payload.append({"month": month_label, "branches": branch_stats})

    return {"months": month_payload, "branches": branch_rows}
