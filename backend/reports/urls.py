from django.urls import path
from .views import DailyReportExportView ,MonthlyFinanceExportView

urlpatterns = [
    path('', DailyReportExportView.as_view(), name='daily_attendance_export'),
     path('monthly-finance/', MonthlyFinanceExportView.as_view(), name='monthly_finance_export'),
]       