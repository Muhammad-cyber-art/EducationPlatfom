
from homework_attends.models import Attendance
from django.utils import timezone

current_month = timezone.now().month
current_year = timezone.now().year

updated = Attendance.objects.filter(
    student_id=2,
    date__month=current_month,
    date__year=current_year
).update(is_present=True)

print(f"{updated} ta davomat yozuvi yangilandi!")
