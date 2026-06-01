
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from homework_attends.models import Attendance
from groups.models import Student

for student_id in [2, 3]:
    print(f"\nO'quvchi ID: {student_id} uchun davomatlarni yangilamoqda...")
    
    try:
        student = Student.objects.get(id=student_id)
        print(f"O'quvchi: {student.full_name}")
        
        attendances = Attendance.objects.filter(student_id=student_id).order_by('date')
        print(f"Jami davomat yozuvi: {attendances.count()} ta")
        
        if attendances.count() >= 10:
            last_10_attendances = attendances[attendances.count() - 10:]
            updated = last_10_attendances.update(is_present=True)
            print(f"Oxirgi 10 davomat yozuvi 'True' ga yangilandi!")
        else:
            updated = attendances.update(is_present=True)
            print(f"Barcha {updated} ta davomat yozuvi 'True' ga yangilandi (kamida 10 ta emas)!")
            
    except Student.DoesNotExist:
        print(f"Xato: ID {student_id} li o'quvchi topilmadi!")
