import os
import django
from django.forms.models import model_to_dict

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
try:
    django.setup()
except:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    django.setup()

from finance.models import Payment

p = Payment.objects.filter(is_paid=True).first()
if p:
    print(f"Payment ID: {p.id}")
    print(f"is_paid in model: {p.is_paid}")
    d = model_to_dict(p)
    print(f"is_paid in dict: {d.get('is_paid')}")
    print(f"Dict keys: {list(d.keys())}")
else:
    print("No paid payments found.")
