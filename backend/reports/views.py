

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .services import generate_daily_full_report
from datetime import datetime

class DailyReportExportView(APIView):
    # Faqat admin yoki mas'ul xodimlar kira olishi uchun:
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Role check
        if request.user.role not in ['admin', 'super_admin']:
            return Response({"error": "Sizda hisobotlarni yuklash huquqi yo'q"}, status=403)

        # Sanani query parametrdan olamiz (masalan: ?date=2025.01.11)
        # Agar sana berilmasa, bugungi sanani oladi
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
            target_date = datetime.now().date()

        # Excelni yaratish
        wb = generate_daily_full_report(target_date)
        
        # Fayl nomi: 2025.01.11.xlsx
        filename = f"{target_date.strftime('%Y.%m.%d')}.xlsx"
        
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        wb.save(response)
        return response
    
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from .services import get_full_monthly_report
from datetime import datetime
from rest_framework.response import Response

class MonthlyFinanceExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'super_admin':
            return Response({"error": "Faqat SuperAdmin hisobotni yuklay oladi"}, status=403)

        year = int(request.query_params.get('year', datetime.now().year))
        month = int(request.query_params.get('month', datetime.now().month))
        
        wb = get_full_monthly_report(year, month)
        
        filename = f"Moliya_Hisoboti_{year}_{month:02d}.xlsx"
        
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        wb.save(response)
        return response