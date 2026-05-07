import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from finance.services import get_branch_finance_stats
from django.utils import timezone

try:
    today = timezone.localdate()
    # Assuming branch ID 1 exists as per the error log
    res = get_branch_finance_stats(1, today.month, today.year)
    print("Success")
    print(res)
except Exception as e:
    import traceback
    traceback.print_exc()
