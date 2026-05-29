# finance/utils.py
from datetime import date
from decimal import Decimal
import math

from django.db.models import Sum, Q
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
        return Decimal('0')
    try:
        amount = float(value)
        floored = math.floor(amount / 1000) * 1000
        return Decimal(str(floored))
    except (TypeError, ValueError):
        return Decimal('0')

def calculate_discount_student_payment(student, group, month_date):
    """
    Imtiyozli (discount status) student uchun to'lov summasini hisoblash:
    (Oylik narx / oydagi darslar soni) * (Kelgan darslar soni)
    Maksimal summasi guruh oylik narxidan oshmasligi kerak!
    """
    from homework_attends.models import Attendance

    # Asosiy narxni aniqlash
    base_price = group.monthly_price
    if student.status in ['low_income', 'negotiated', 'discount']:
        if student.custom_fee is not None:
            base_price = student.custom_fee

    # Guruh dars kunlari shu oyda (get_lesson_dates allaqachon bekor qilingan kunlarni olib tashlaydi)
    lesson_dates = group.get_lesson_dates(month_date.year, month_date.month)
    total_lessons_count = len(lesson_dates)
    if total_lessons_count <= 0:
        return Decimal('0')

    # Bir kunlik dars narxi (Student.calculate_accrued_amount kabi)
    daily_price = floor_amount(Decimal(str(base_price)) / total_lessons_count)

    # Kelgan darslar sonini hisoblash:
    # - Faqat oydagi dars kunlari
    # - is_present=True
    present_count = Attendance.objects.filter(
        student=student,
        group=group,
        date__in=lesson_dates,
        is_present=True
    ).count()

    total_amount = daily_price * Decimal(str(present_count))
    
    # Maksimal summasi guruh oylik narxidan oshmasin
    if total_amount > Decimal(str(base_price)):
        total_amount = Decimal(str(base_price))
        
    return floor_amount(total_amount)


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
    total = attendance_refund_queryset(year, month, branch=branch, paid_only=paid_only).aggregate(
        total=Sum('refund_amount')
    )['total']
    return float(total or 0)


def aggregate_attendance_refunds_by_branch(year, month, paid_only=False):
    """{branch_id: refund_sum}"""
    qs = attendance_refund_queryset(year, month, branch=None, paid_only=paid_only)
    rows = qs.values('group__branch_id').annotate(total=Sum('refund_amount'))
    return {r['group__branch_id']: float(r['total'] or 0) for r in rows if r['group__branch_id']}


