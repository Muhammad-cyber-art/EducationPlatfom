from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from rest_framework.response import Response
from .services import generate_daily_full_report, get_full_monthly_report
from .models import ReportDownloadTrack
from datetime import datetime, date
from drf_spectacular.utils import extend_schema, OpenApiTypes
from django.utils import timezone
from zoneinfo import ZoneInfo

class DailyReportQuerySerializer(serializers.Serializer):
    date = serializers.DateField(required=False, help_text="Sana (YYYY.MM.DD). Default: bugun")

class MonthlyFinanceQuerySerializer(serializers.Serializer):
    year = serializers.IntegerField(required=False)
    month = serializers.IntegerField(required=False)

class PendingNotificationResponseSerializer(serializers.Serializer):
    pending_daily = serializers.BooleanField()
    pending_monthly = serializers.BooleanField()
    daily_message = serializers.CharField(allow_null=True)
    monthly_message = serializers.CharField(allow_null=True)

class DailyReportExportView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[DailyReportQuerySerializer], 
        responses={(200, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): OpenApiTypes.BINARY}
    )
    def get(self, request):
        if request.user.role not in ['admin', 'super_admin']:
            return Response({"error": "Sizda hisobotlarni yuklash huquqi yo'q"}, status=403)

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y.%m.%d').date()
            except ValueError:
                return HttpResponse(
                    "Sana formati noto'g'ri. Namuna: 2025.01.11", 
                    status=400
                )
        else:
            # Tashkent vaqti bo'yicha bugun
            tashkent_tz = ZoneInfo('Asia/Tashkent')
            target_date = timezone.now().astimezone(tashkent_tz).date()

        # Excelni yaratish
        wb = generate_daily_full_report(target_date)
        
        # Yuklanganligini belgilab qo'yish
        ReportDownloadTrack.objects.get_or_create(
            user=request.user,
            report_type='daily',
            report_date=target_date
        )
        
        filename = f"{target_date.strftime('%Y.%m.%d')}.xlsx"
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        wb.save(response)
        return response

class MonthlyFinanceExportView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[MonthlyFinanceQuerySerializer], 
        responses={(200, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): OpenApiTypes.BINARY}
    )
    def get(self, request):
        if request.user.role != 'super_admin':
            return Response({"error": "Faqat SuperAdmin hisobotni yuklay oladi"}, status=403)

        tashkent_tz = ZoneInfo('Asia/Tashkent')
        now_tashkent = timezone.now().astimezone(tashkent_tz)

        year = int(request.query_params.get('year', now_tashkent.year))
        month = int(request.query_params.get('month', now_tashkent.month))
        
        wb = get_full_monthly_report(year, month)
        
        # Yuklanganligini belgilab qo'yish
        report_date = date(year, month, 1)
        ReportDownloadTrack.objects.get_or_create(
            user=request.user,
            report_type='monthly',
            report_date=report_date
        )
        
        filename = f"Moliya_Hisoboti_{year}_{month:02d}.xlsx"
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        wb.save(response)
        return response

class CheckPendingNotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PendingNotificationResponseSerializer})
    def get(self, request):
        user = request.user
        if user.role not in ['admin', 'super_admin']:
            return Response({
                "pending_daily": False,
                "pending_monthly": False,
                "daily_message": None,
                "monthly_message": None
            })

        tashkent_tz = ZoneInfo('Asia/Tashkent')
        now_tashkent = timezone.now().astimezone(tashkent_tz)
        today_tashkent = now_tashkent.date()
        current_hour = now_tashkent.hour
        current_minute = now_tashkent.minute
        current_day = now_tashkent.day

        pending_daily = False
        # Har kuni 18:30 dan keyin (18:30 = 18 soat, 30 daqiqa)
        is_after_six_thirty = current_hour > 18 or (current_hour == 18 and current_minute >= 30)
        
        if is_after_six_thirty:
            # Check if this user has downloaded daily report for today
            downloaded = ReportDownloadTrack.objects.filter(
                user=user,
                report_type='daily',
                report_date=today_tashkent
            ).exists()
            if not downloaded:
                pending_daily = True

        pending_monthly = False
        # Har oyning 28, 29, 30 (va 31) sanalarida
        if user.role == 'super_admin' and current_day in [28, 29, 30, 31]:
            # Check if downloaded monthly report for this month
            monthly_report_date = date(now_tashkent.year, now_tashkent.month, 1)
            downloaded_monthly = ReportDownloadTrack.objects.filter(
                user=user,
                report_type='monthly',
                report_date=monthly_report_date
            ).exists()
            if not downloaded_monthly:
                pending_monthly = True

        return Response({
            "pending_daily": pending_daily,
            "pending_monthly": pending_monthly,
            "daily_message": "Bugungi kundalik Excel hisoboti tayyor. Iltimos, uni yuklab oling!" if pending_daily else None,
            "monthly_message": "Ushbu oy uchun oylik moliya hisoboti tayyor. Iltimos, uni yuklab oling!" if pending_monthly else None
        })