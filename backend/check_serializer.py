import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from groups.models import Group
from groups.serializers import GroupSerializer

group = Group.objects.filter(name="Byust").first()
if group:
    serializer = GroupSerializer(group)
    data = serializer.data
    print(f"Group: {data['name']} (ID: {data['id']})")
    print(f"Students count: {len(data['students'])}")
    for s in data['students']:
        print(f" - {s['full_name']} (ID: {s['id']})")
else:
    print("Group 'Byust' not found")
