import os
from celery import Celery
from celery.schedules import crontab

# Django sozlamalarini celery uchun o'rnatish
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('educational_platform')

# Django settings'dagi CELERY prefiksli barcha sozlamalarni o'qiydi
app.config_from_object('django.conf:settings', namespace='CELERY')

# Barcha installed app'lardagi tasks.py fayllarini avtomatik qidiradi
app.autodiscover_tasks()

# Celery Beat Schedule for Admin Bot Reporting
app.conf.beat_schedule = {
    # Daily reports to admins - runs every day at 8:00 PM (20:00)
    'send-daily-reports-to-admins': {
        'task': 'reports.send_daily_reports_to_admins',
        'schedule': crontab(hour=20, minute=0),  # 8:00 PM every day
    },
    
    # Monthly attendance ZIP to admins - runs on last day of month at 9:00 PM
    'send-monthly-attendance-to-admins': {
        'task': 'reports.send_monthly_attendance_to_admins',
        'schedule': crontab(hour=21, minute=0, day_of_month='28-31'),  # 9:00 PM on 28-31 (will check if last day)
    },
    
    # Monthly financial report to super_admins - runs on last day of month at 9:30 PM
    'send-monthly-financial-to-super-admins': {
        'task': 'reports.send_monthly_financial_to_super_admins',
        'schedule': crontab(hour=21, minute=30, day_of_month='28-31'),  # 9:30 PM on 28-31 (will check if last day)
    },
}

app.conf.timezone = 'UTC'

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
