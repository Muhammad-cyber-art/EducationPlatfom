import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings') # config bo'lishi mumkin
try:
    django.setup()
except:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    django.setup()

from archivebase.models import ArchivedStudent

last_archived = ArchivedStudent.objects.order_by('-archived_at').first()
if last_archived:
    print(f"Student: {last_archived.full_name}")
    print(f"Metadata Keys: {list(last_archived.metadata.keys())}")
    payments = last_archived.metadata.get('payments', [])
    print(f"Payments Count: {len(payments)}")
    if payments:
        print(f"First Payment: {payments[0]}")
    
    # Check student fields
    print(f"Branch ID in metadata: {last_archived.metadata.get('branch_id')} / {last_archived.metadata.get('branch')}")
else:
    print("No archived students found.")
