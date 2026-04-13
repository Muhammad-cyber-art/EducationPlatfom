import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from groups.models import Group
try:
    g = Group.objects.get(id=1)
    print(f"Group 1 exists: {g.name}")
except Group.DoesNotExist:
    print("Group 1 does NOT exist")
except Exception as e:
    print(f"Error: {e}")
