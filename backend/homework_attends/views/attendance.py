from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated,AllowAny
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse

import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter
from datetime import timedelta

from homework_attends.models import Attendance
from groups.models import Group
from homework_attends.serializers import AttendanceSerializer
from homework_attends.services import (
    get_or_create_attendance_records, 
    generate_weekly_attendance_report, 
    bulk_confirm_attendance, 
    get_monthly_attendance_data
)
from permissions.permissions import HasModulePermission

class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    module_name = 'homework'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
       group_id = self.request.query_params.get('group_id')
       date_str = self.request.query_params.get('date', str(timezone.localdate()))
       
       if not group_id:
           return Attendance.objects.none()
       
       try:
           requested_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
       except (ValueError, TypeError):
           requested_date = timezone.localdate()

       group = get_object_or_404(Group, id=group_id)
       return get_or_create_attendance_records(group, requested_date)

    @action(detail=False, methods=['get'])
    def weekly_report(self, request):
         group_id = request.query_params.get('group_id')
         group = get_object_or_404(Group, id=group_id)
         
         report = generate_weekly_attendance_report(group)
         return Response(report)
    
    def create(self, request, *args, **kwargs):
        attendance_id = request.data.get('id')
        is_present = request.data.get('is_present')
        student_id = request.data.get('student_id')
        date_str = request.data.get('date')

        # 1. Update existing record
        if attendance_id is not None:
            instance = get_object_or_404(Attendance, id=attendance_id)
            today = timezone.localdate()
            if instance.date != today:
                # Grace period: Tungi 4 gacha kechagi kunni o'zgartirishga ruxsat
                is_early_morning = timezone.localtime().hour < 4
                is_yesterday = instance.date == (today - timedelta(days=1))
                if not (is_early_morning and is_yesterday):
                    return Response({"detail": f"Faqat bugungi davomatni tahrirlash mumkin. (Sana: {instance.date}, Bugun: {today})"}, status=status.HTTP_400_BAD_REQUEST)
            
            instance.is_present = is_present
            instance.marked_by = request.user
            instance.save()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # 2. Create new record
        if not (student_id and date_str):
             return Response({"detail": "Student ID va kun (date) majburiy"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            requested_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Sana formati noto'g'ri (YYYY-MM-DD)"}, status=status.HTTP_400_BAD_REQUEST)

        group = get_object_or_404(Group, id=group_id)
        
        # User talabi: Faqat bugungi sana uchun davomat olish mumkin
        today = timezone.localdate()
        if requested_date != today:
            is_early_morning = timezone.localtime().hour < 4
            is_yesterday = requested_date == (today - timedelta(days=1))
            if not (is_early_morning and is_yesterday):
                return Response({"detail": f"Faqat bugungi sana uchun davomat olish ruxsat etilgan. (Tanlangan: {requested_date}, Bugun: {today})"}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(group.students, id=student_id)

        # Duplicate check
        attendance, created = Attendance.objects.get_or_create(
            student=student, 
            group=group, 
            date=requested_date,
            defaults={
                'is_present': is_present,
                'marked_by': request.user
            }
        )
        if not created:
            attendance.is_present = is_present
            attendance.marked_by = request.user
            attendance.save()

        serializer = self.get_serializer(attendance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='confirm')
    def confirm_attendance(self, request):
        group_id = request.data.get('group_id')
        date_str = request.data.get('date')
        attendances_payload = request.data.get('attendances', [])

        if not group_id or not date_str:
            return Response({"detail": "group_id va date majburiy"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            requested_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Sana formati noto'g'ri (YYYY-MM-DD)"}, status=status.HTTP_400_BAD_REQUEST)

        group = get_object_or_404(Group, id=group_id)
        
        # User talabi: Faqat bugungi sana uchun davomat olish mumkin
        today = timezone.localdate()
        if requested_date != today:
            is_early_morning = timezone.localtime().hour < 4
            is_yesterday = requested_date == (today - timedelta(days=1))
            if not (is_early_morning and is_yesterday):
                return Response({"detail": f"Faqat bugungi sana uchun davomat olish ruxsat etilgan. (Tanlangan: {requested_date}, Bugun: {today})"}, status=status.HTTP_400_BAD_REQUEST)


        
        queryset = bulk_confirm_attendance(group, requested_date, attendances_payload, request.user)
        serializer = AttendanceSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='monthly-report')
    def monthly_report(self, request):
        group_id = request.query_params.get('group_id')
        if not group_id:
            return Response({"detail": "group_id majburiy"}, status=status.HTTP_400_BAD_REQUEST)
            
        group = get_object_or_404(Group, id=group_id)
        today = timezone.localdate()
        
        try:
            month = int(request.query_params.get('month', today.month))
            year = int(request.query_params.get('year', today.year))
        except (ValueError, TypeError):
            month, year = today.month, today.year
            
        date_list, students, att_data = get_monthly_attendance_data(group, month, year)
        export_mode = request.query_params.get('export', 'json')
        
        if export_mode == 'excel':
            wb = openpyxl.Workbook()
            ws = wb.active
            
            # openpyxl sheet title has strict rules: max 31 chars, no forbidden chars: \ / ? * : [ ]
            safe_sheet_name = f"Davomat_{group.name[:20]}"
            for char in r"\/?:*[]":
                safe_sheet_name = safe_sheet_name.replace(char, "")
            safe_sheet_name = safe_sheet_name.strip()[:30]
            if not safe_sheet_name:
                safe_sheet_name = "Davomat"
            ws.title = safe_sheet_name
            
            header_font = Font(bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            center_align = Alignment(horizontal='center', vertical='center')
            
            headers = ["№", "O'quvchi ismi-familiyasi", "Telefon", "Ota-ona telefon"] + [d.day for d in date_list]
            for col_num, header in enumerate(headers, 1):
                cell = ws.cell(row=2, column=col_num)
                cell.value = header

            ws.column_dimensions['A'].width = 5
            ws.column_dimensions['B'].width = 30
            ws.column_dimensions['C'].width = 15
            ws.column_dimensions['D'].width = 15
            for col_num in range(5, len(headers) + 1):
                ws.column_dimensions[get_column_letter(col_num)].width = 4
                
            header_row = ws[2]
            for cell in header_row:
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = center_align

            for row_num, student in enumerate(students, 3):
                ws.cell(row=row_num, column=1).value = row_num - 2
                ws.cell(row=row_num, column=2).value = student.full_name
                ws.cell(row=row_num, column=3).value = student.phone or "-"
                ws.cell(row=row_num, column=4).value = student.parent_phone or "-"
                
                joined_at = student.joined_at.date() if student.joined_at else None
                
                for col_idx, d in enumerate(date_list, 5):
                    cell = ws.cell(row=row_num, column=col_idx)
                    
                    att_record = att_data.get(student.id, {}).get(str(d))
                    
                    if att_record:
                        if not att_record.get('is_confirmed'):
                            cell.value = "!" # Davomat olinmagan (tasdiqlanmagan)
                            cell.font = Font(color="FF0000", bold=True)
                        elif att_record.get('is_present') is True:
                            cell.value = "+"
                            cell.font = Font(color="008000", bold=True)
                        else:
                            cell.value = "K" 
                            cell.font = Font(color="FF0000", bold=True)
                    elif joined_at and d < joined_at:
                        cell.value = "-"
                    else:
                        # Record yo'q bo'lsa va dars kuni bo'lsa (date_list dars kunlaridan iborat)
                        cell.value = "!" 
                        cell.font = Font(color="FF0000", bold=True)
                    cell.alignment = center_align

            from urllib.parse import quote
            # Format filename safely to avoid UnicodeEncodeError in Content-Disposition header
            raw_filename = f"davomat_{group.name}_{year}_{month}.xlsx"
            # Remove characters that can break the HTTP header or represent directory traversal
            safe_filename = raw_filename.replace('\n', '').replace('\r', '').replace('"', '_').replace('/', '_').replace('\\', '_')
            encoded_filename = quote(safe_filename)
            
            response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{encoded_filename}"; filename*=utf-8\'\'{encoded_filename}'
            wb.save(response)
            return response

        # JSON Response
        report_data = []
        for student in students:
            history = []
            joined_at = student.joined_at.date() if student.joined_at else None
            for d in date_list:
                date_str = str(d)
                att_record = att_data.get(student.id, {}).get(date_str)
                
                if joined_at and d < joined_at:
                    status = "not_joined"
                elif att_record:
                    if not att_record.get('is_confirmed'):
                        status = "not_taken" # "!" belgisi o'rniga status
                    elif att_record.get('is_present'):
                        status = "present"
                    else:
                        status = "absent"
                else:
                    # Dars kuni, lekin rekord yo'q
                    if d < timezone.localdate():
                        status = "not_taken"
                    else:
                        status = "none"

                
                history.append({"date": date_str, "status": status})
            
            report_data.append({
                "student_id": student.id,
                "student_name": student.full_name,
                "attendance": history
            })

        return Response({
            "group_name": group.name,
            "period": f"{year}-{month:02d}",
            "data": report_data
        })
