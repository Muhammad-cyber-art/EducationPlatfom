import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from groups.models import Group

print("Existing Group IDs:")
for group in Group.objects.all():
    print(f"ID: {group.id}, Name: {group.name}")
