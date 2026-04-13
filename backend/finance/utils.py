# finance/utils.py
from datetime import date
from decimal import Decimal
import math

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


