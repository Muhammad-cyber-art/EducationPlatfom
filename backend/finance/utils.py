# finance/utils.py
import math
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone


def normalize_month(value: date) -> date:
    """
    Har qanday sanani o'sha oyning 1-kuniga keltiradi
    """
    if not value:
        return None
    return value.replace(day=1)


def floor_amount(value) -> Decimal:
    """
    Har qanday pul miqdorini eng yaqin past 1000 ga yaxlitlaydi (floor to 1000).
    Masalan:
        350548  -> 350000
        125750  -> 125000
        999     -> 0
        1001    -> 1000
        300000  -> 300000  (o'zgarmaydi)

    Barcha to'lov hisoblashlarida ishlatiladi:
      - Student to'lovlari
      - Refund summasi
      - Mentor / admin oylik maoshi
      - Qo'shimcha to'lovlar
    """
    if value is None:
        return Decimal("0")
    try:
        amount = float(value)
        floored = math.floor(amount / 1000) * 1000
        return Decimal(str(floored))
    except (TypeError, ValueError):
        return Decimal("0")


def calculate_attendance_based_student_payment(student, group, month_date, ignore_today_check=False):
    """
    Imtiyozli (discount) va Kelishilgan (negotiated) student uchun to'lov summasini hisoblash:
    (Oylik narx / oydagi darslar soni) * (Kelgan darslar soni)
    Maksimal summasi guruh oylik narxidan oshmasligi kerak!

    Qo'shimcha qoida:
    - Agar student oy o'rtasida qo'shilgan bo'lsa, faqat join_date'dan keyingi darslar hisoblanadi.
    """
    from groups.models import GroupEnrollment
    from homework_attends.models import Attendance

    # Asosiy narxni aniqlash
    base_price = group.monthly_price
    if student.status in ["low_income", "negotiated", "discount"]:
        if student.custom_fee is not None:
            base_price = student.custom_fee

    # Join date aniqlash (GroupEnrollment -> fallback Student.joined_at)
    join_date = None
    enrollment = (
        GroupEnrollment.objects.filter(student=student, group=group)
        .only("joined_at")
        .first()
    )
    if enrollment and enrollment.joined_at:
        join_date = enrollment.joined_at.date()
    elif student.joined_at:
        join_date = student.joined_at.date()

    # Guruh dars kunlari shu oyda (get_lesson_dates allaqachon bekor qilingan kunlarni olib tashlaydi)
    lesson_dates = group.get_lesson_dates(month_date.year, month_date.month)
    if join_date:
        lesson_dates = [d for d in lesson_dates if d >= join_date]

    total_lessons_count = len(lesson_dates)
    if total_lessons_count <= 0:
        return Decimal("0")

    # Bir kunlik dars narxi (Student.calculate_accrued_amount kabi)
    daily_price = floor_amount(Decimal(str(base_price)) / total_lessons_count)

    # Faqat o'tib ketgan va oydagi dars kunlarini olamiz (agar ignore_today_check bo'lsa, barchasini olamiz)
    if not ignore_today_check:
        today = timezone.localdate()
        active_lesson_dates = [d for d in lesson_dates if d <= today]
    else:
        active_lesson_dates = lesson_dates

    # Kelgan darslar sonini hisoblash:
    # - Faqat oydagi dars kunlari
    # - join_date'dan keyin
    # - is_present=True
    # - faqat tasdiqlangan (marked_by mavjud)
    attendance_filters = {
        "student": student,
        "group": group,
        "date__year": month_date.year,
        "date__month": month_date.month,
        "date__in": active_lesson_dates,
        "is_present": True,
        "marked_by__isnull": False,
    }
    if join_date:
        attendance_filters["date__gte"] = join_date

    present_count = Attendance.objects.filter(**attendance_filters).count()

    total_amount = daily_price * Decimal(str(present_count))

    # Maksimal summasi guruh oylik narxidan oshmasin
    if total_amount > Decimal(str(base_price)):
        total_amount = Decimal(str(base_price))

    return floor_amount(total_amount)


# Backward compatibility
calculate_discount_student_payment = calculate_attendance_based_student_payment


def calculate_attendance_based_mentor_share(
    student, group, month_date, per_student_amount, commission_percentage=None, ignore_today_check=False
):
    """
    Per_student yoki foizli mentor uchun imtiyozli (discount) va kelishilgan (negotiated) student uchun ulush summasini hisoblash:

    LOGIC AS PER REQUIREMENTS:
    1. (Guruh oylik narxi / oydagi darslar soni) = bir dars narxi
    2. Imtiyozli o'quvchining kelgan darslar sonini hisoblash (is_present=True)
    3. (Kelgan darslar soni * bir dars narxi) = o'quvchining total summasi
    4. Mentor ulushi:
       - Agar commission_percentage bo'lsa: total summadan foiz olinadi
       - Aks holda: (per_student_amount / total darslar) * kelgan darslar

    Qo'shimcha qoida:
    - Agar student oy o'rtasida qo'shilgan bo'lsa, faqat join_date'dan keyingi darslar hisoblanadi.
    """
    from groups.models import GroupEnrollment
    from homework_attends.models import Attendance

    # Step 1: Asosiy student narxini aniqlash (custom fee yoki group price)
    base_price = group.monthly_price
    if student.status in ["low_income", "negotiated", "discount"]:
        if student.custom_fee is not None:
            base_price = student.custom_fee

    # Join date aniqlash
    join_date = None
    enrollment = (
        GroupEnrollment.objects.filter(student=student, group=group)
        .only("joined_at")
        .first()
    )
    if enrollment and enrollment.joined_at:
        join_date = enrollment.joined_at.date()
    elif student.joined_at:
        join_date = student.joined_at.date()

    # Step 2: Guruh dars kunlari shu oyda
    lesson_dates = group.get_lesson_dates(month_date.year, month_date.month)
    if join_date:
        lesson_dates = [d for d in lesson_dates if d >= join_date]

    total_lessons_count = len(lesson_dates)
    if total_lessons_count <= 0:
        return Decimal("0")

    # Bir dars narxi (student summasidan hisoblash)
    per_lesson_price = floor_amount(Decimal(str(base_price)) / total_lessons_count)

    # Step 3: Faqat o'tib ketgan va oydagi dars kunlarini olamiz (agar ignore_today_check bo'lsa, barchasini olamiz)
    if not ignore_today_check:
        today = timezone.localdate()
        active_lesson_dates = [d for d in lesson_dates if d <= today]
    else:
        active_lesson_dates = lesson_dates

    # Kelgan darslar sonini hisoblash
    attendance_filters = {
        "student": student,
        "group": group,
        "date__year": month_date.year,
        "date__month": month_date.month,
        "date__in": active_lesson_dates,
        "is_present": True,
        "marked_by__isnull": False,
    }
    if join_date:
        attendance_filters["date__gte"] = join_date

    present_count = Attendance.objects.filter(**attendance_filters).count()

    # Step 4: O'quvchining total summasi (kelgan darslar asosida)
    student_total = per_lesson_price * Decimal(str(present_count))
    if student_total > Decimal(str(base_price)):
        student_total = Decimal(str(base_price))

    # Step 5: Mentor ulushini hisoblash
    if commission_percentage and commission_percentage > 0:
        # Foizli ulush
        mentor_share = student_total * (
            Decimal(str(commission_percentage)) / Decimal("100")
        )
    else:
        # Per student ulush (darslar asosida)
        per_lesson_mentor = floor_amount(
            Decimal(str(per_student_amount)) / total_lessons_count
        )
        mentor_share = per_lesson_mentor * Decimal(str(present_count))
        if mentor_share > Decimal(str(per_student_amount)):
            mentor_share = Decimal(str(per_student_amount))

    return floor_amount(mentor_share)


# Backward compatibility
calculate_discount_student_payment_for_per_student_mentor = (
    calculate_attendance_based_mentor_share
)


def attendance_refund_queryset(year, month, branch=None, paid_only=False):
    """
    Davomat (kelmaganlik) bo'yicha Payment.refund_amount yozuvlari.
    FinanceTransaction 'refund' kategoriyasidan farqli — pul kassadan chiqmaydi,
    to'lov summasidan chegirma sifatida qo'llanadi.
    """
    from finance.models import Payment

    qs = Payment.objects.filter(
        month__year=year,
        month__month=month,
        refund_ignored=False,
        refund_amount__gt=0,
    )
    if branch is not None:
        qs = qs.filter(group__branch=branch)
    if paid_only:
        qs = qs.filter(Q(is_paid=True) | Q(paid_amount__gt=0))
    return qs


def aggregate_attendance_refunds(year, month, branch=None, paid_only=False):
    total = attendance_refund_queryset(
        year, month, branch=branch, paid_only=paid_only
    ).aggregate(total=Sum("refund_amount"))["total"]
    return float(total or 0)


def aggregate_attendance_refunds_by_branch(year, month, paid_only=False):
    """{branch_id: refund_sum}"""
    qs = attendance_refund_queryset(year, month, branch=None, paid_only=paid_only)
    rows = qs.values("group__branch_id").annotate(total=Sum("refund_amount"))
    return {
        r["group__branch_id"]: float(r["total"] or 0)
        for r in rows
        if r["group__branch_id"]
    }


def calculate_group_revenue_and_mentor_share(
    group, month_date, profile=None, payment_map=None, extra_map=None, ignore_today_check=False
):
    """
    Bir guruh uchun taxminiy tushum, real tushum va mentor ulushini hisoblash (reusable utility).
    Mentor guruhi uchun guruh konfiguratsiyasini (agar mavjud bo'lsa) ishlatadi.

    Args:
        group: Group model object
        month_date: Date object (oyning 1-kuni yoki istalgan sana, normalize_month ishlatiladi)
        profile: StaffProfile object (faqat mentor uchun kerak)
        payment_map: {(student_id, group_id): Payment} (agar yo'q bo'lsa, query qilinadi)
        extra_map: {(student_id, group_id): Decimal} (student_extra tranzaksiyalar, agar yo'q bo'lsa query qilinadi)

    Returns:
        dict: {
            'group_id': group.id,
            'actual_revenue': Decimal,
            'expected_revenue': Decimal,
            'mentor_share_paid': Decimal (faqat mentor uchun),
            'mentor_share_expected': Decimal (faqat mentor uchun),
            'paid_students': list,
            'unpaid_students': list
        }
    """
    from groups.models import Group

    from finance.models import FinanceTransaction, MentorGroupSalaryConfig, Payment

    month_date = normalize_month(month_date)

    # To'lovlar va extra tranzaksiyalar mapini tayyorlash (agar berilmagan bo'lsa)
    if payment_map is None:
        _payments = Payment.objects.filter(
            group=group, month=month_date
        ).select_related("student")
        payment_map = {(p.student_id, p.group_id): p for p in _payments}

    if extra_map is None:
        extra_map = {}
        _extra_tx = FinanceTransaction.objects.filter(
            category="student_extra",
            date__year=month_date.year,
            date__month=month_date.month,
            group=group,
        ).values("student_id", "group_id", "transaction_type", "amount")
        for tx in _extra_tx:
            key = (tx["student_id"], tx["group_id"])
            amt = Decimal(str(tx["amount"] or 0))
            if tx["transaction_type"] == "income":
                extra_map[key] = extra_map.get(key, Decimal("0")) + amt
            else:
                extra_map[key] = extra_map.get(key, Decimal("0")) - amt

    # Guruch uchun konfiguratsiyani olish (faqat mentor uchun)
    group_config = None
    is_percentage = False
    is_student_count = False
    commission_pct = Decimal("0")
    per_student_rate = Decimal("0")

    if profile and profile.user.role == "mentor":
        group_config = MentorGroupSalaryConfig.objects.filter(
            mentor=profile.user, group=group
        ).first()

        if group_config:
            if group_config.salary_type == "percentage":
                is_percentage = True
                commission_pct = group_config.commission_percentage / Decimal("100")
            elif group_config.salary_type == "student_count":
                is_student_count = True
                per_student_rate = group_config.per_student_amount
        else:
            if profile.salary_type == "percentage":
                is_percentage = True
                commission_pct = profile.commission_percentage / Decimal("100")
            elif profile.salary_type == "student_count":
                is_student_count = True
                per_student_rate = profile.per_student_amount

    # Guruhdagi barcha o'quvchilarni yig'ish
    all_students_map = {}
    for enr in group.enrollments.select_related("student").all():
        if enr.student:
            all_students_map[enr.student.id] = enr.student
    for st in group.old_students_fk.all():
        all_students_map[st.id] = st
    all_students = list(all_students_map.values())
    processed_pairs = set()

    # Hisoblash
    actual_revenue = Decimal("0")
    expected_revenue = Decimal("0")
    mentor_share_paid = Decimal("0")
    mentor_share_expected = Decimal("0")
    paid_students = []
    unpaid_students = []

    for student in all_students:
        key = (student.id, group.id)
        if key in processed_pairs:
            continue
        processed_pairs.add(key)

        p = payment_map.get(key)
        extra_amount = extra_map.get(key, Decimal("0"))

        status = student.status
        is_discount = status == "discount"
        is_negotiated = status == "negotiated"
        is_teacher_negotiated = status == "teacher_negotiated"

        # Shartnoma (contract) narxi
        contract_base = group.monthly_price
        if student.custom_fee is not None and status in [
            "low_income",
            "negotiated",
            "discount",
            "teacher_negotiated",
        ]:
            contract_base = student.custom_fee
        contract_amount = floor_amount(Decimal(str(contract_base)))

        paid_amount = Decimal(str(p.paid_amount or 0)) if p else Decimal("0")

        attendance_amount = None
        if is_discount or is_negotiated:
            attendance_amount = calculate_attendance_based_student_payment(
                student, group, month_date, ignore_today_check=ignore_today_check
            )

        # Expected va Actual bazalar
        if is_discount:
            base_expected = attendance_amount
            base_actual = attendance_amount
        else:
            base_expected = contract_amount
            base_actual = paid_amount

        base_expected_floored = floor_amount(base_expected)

        # Talaba ma'lumotlari
        student_info = {
            "id": student.id,
            "name": student.full_name,
            "status": student.get_status_display(),
            "financial_status": student.status,
            "financial_status_label": student.get_status_display(),
            "negotiated_price": float(student.custom_fee)
            if student.custom_fee
            else None,
            "contract_amount": float(contract_amount),
            "paid_amount": float(paid_amount),
            "expected": float(base_expected_floored),
            "actual": 0.0,
            "refund_amount": float(p.refund_amount) if p and p.refund_amount else 0.0,
            "refund_ignored": p.refund_ignored if p else False,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M")
            if p and p.paid_at
            else None,
            "payment_method": p.get_payment_method_display()
            if p and p.payment_method
            else None,
            "is_attendance_based": is_discount,
            "mentor_salary_excluded": is_teacher_negotiated,
        }

        # ----------------------------------------------------------
        # 1) Refund: faqat regular / low_income uchun ishlaydi.
        #    discount/negotiated uchun refund yo'q (davomat o'zi hisoblab beradi).
        #    teacher_negotiated uchun 0.
        # ----------------------------------------------------------
        refund_for_expected = Decimal("0")
        if not is_discount and not is_negotiated and not is_teacher_negotiated:
            try:
                raw_refund = student.calculate_refund_amount(
                    month_date.year, month_date.month, group=group
                )
                refund_for_expected = floor_amount(Decimal(str(raw_refund)))
            except Exception:
                refund_for_expected = Decimal("0")

        # ----------------------------------------------------------
        # 2) Actual / Expected bazalar
        # ----------------------------------------------------------
        net_actual = (base_actual or Decimal("0")) + extra_amount

        # Expected for frontend:
        #   teacher_negotiated → 0 (mentor uchun)
        #   discount/negotiated → attendance asosida
        #   regular/low_income  → CONTRACT AMOUNT (refund chiqarmaymiz! frontend uchun kerak)
        if is_teacher_negotiated:
            net_expected = Decimal("0")
        elif is_discount or is_negotiated:
            net_expected = (base_expected_floored or Decimal("0")) + extra_amount
        else:
            # Regular/Low Income uchun: expected = CONTRACT AMOUNT (refund chiqarmaymiz)
            net_expected = (base_expected_floored or Decimal("0")) + extra_amount

        student_info["actual"] = float(net_actual)
        student_info["expected"] = float(net_expected)

        if net_actual != 0:
            actual_revenue += net_actual
            paid_students.append(student_info)
        else:
            unpaid_students.append(student_info)

        expected_revenue += net_expected

        # ----------------------------------------------------------
        # 3) Mentor ulushi
        #    teacher_negotiated → 0 (har doim)
        #    discount           → attendance asosida (paid va expected bir xil)
        #    negotiated         → (mentor_stafka / lesson_count * present_count)
        #    regular/low_income → paid: real to'lov × %; expected: (contract−refund) × %
        # ----------------------------------------------------------
        if profile and profile.user.role == "mentor" and not is_teacher_negotiated:
            # Birinchi, kelgan darslar sonini hisoblash (barcha statuslar uchun kerak)
            present_count = 0
            try:
                from homework_attends.models import Attendance
                lesson_dates = group.get_lesson_dates(month_date.year, month_date.month)
                present_count = Attendance.objects.filter(
                    student=student,
                    group=group,
                    date__year=month_date.year,
                    date__month=month_date.month,
                    date__in=lesson_dates,
                    is_present=True,
                    marked_by__isnull=False,
                ).count()
            except Exception:
                present_count = 0
            lessons_count = len(group.get_lesson_dates(month_date.year, month_date.month)) if group.get_lesson_dates(month_date.year, month_date.month) else 1

            if is_discount:
                if is_percentage:
                    mentor_share_paid += net_actual * commission_pct
                    mentor_share_expected += net_expected * commission_pct
                elif is_student_count:
                    mentor_fee = calculate_attendance_based_mentor_share(
                        student, group, month_date, per_student_rate, ignore_today_check=ignore_today_check
                    )
                    mentor_share_paid += mentor_fee
                    mentor_share_expected += mentor_fee

            elif is_negotiated:
                # Negotiated o'quvchilar uchun logika:
                # Foiz asosida: (custom_fee / lesson_count * present_count) * commission_percentage
                # Student boshiga: (per_student_amount / lesson_count * present_count)
                if is_percentage:
                    # Foiz asosida: negotiated custom_fee asosida hisoblash
                    if lessons_count > 0:
                        per_lesson_fee = floor_amount(contract_amount / lessons_count)
                        student_expected_amount = floor_amount(per_lesson_fee * present_count)
                        mentor_share_expected += student_expected_amount * commission_pct
                        # Paid uchun: faqat to'lov amalga oshirilgan bo'lsa
                        if paid_amount > 0:
                            mentor_share_paid += student_expected_amount * commission_pct
                elif is_student_count:
                    # Student boshiga: mentor_stafka asosida hisoblash
                    if lessons_count > 0:
                        per_lesson_student = floor_amount(per_student_rate / lessons_count)
                        mentor_fee = floor_amount(per_lesson_student * present_count)
                        mentor_share_expected += mentor_fee
                        # Paid uchun: faqat to'lov amalga oshirilgan bo'lsa
                        if paid_amount > 0:
                            mentor_share_paid += mentor_fee

            else:
                # regular / low_income
                # paid share: haqiqiy to'langan asosida
                # expected share: FULL CONTRACT (REFUND HISOBGA OLINMASIN!)
                expected_base = (contract_amount or Decimal("0")) + extra_amount

                if is_percentage:
                    mentor_share_paid += net_actual * commission_pct
                    mentor_share_expected += expected_base * commission_pct
                elif is_student_count:
                    if net_actual > 0:
                        mentor_share_paid += per_student_rate
                    # per_student: refund ta'sir qilmaydi (har student uchun sobit)
                    mentor_share_expected += per_student_rate

    return {
        "group_id": group.id,
        "actual_revenue": floor_amount(actual_revenue),
        "expected_revenue": floor_amount(expected_revenue),
        "mentor_share_paid": floor_amount(mentor_share_paid),
        "mentor_share_expected": floor_amount(mentor_share_expected),
        "paid_students": paid_students,
        "unpaid_students": unpaid_students,
    }
