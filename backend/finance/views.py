import logging
import traceback
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q, F, Count
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from .models import (
    Payment, FinanceTransaction, EmployeePayment, 
    StaffProfile, EmployeeAdvance
)
from .serializers import (
    PaymentSerializer, FinanceTransactionSerializer, 
    EmployeePaymentSerializer, StaffProfileSerializer, 
    EmployeeAdvanceSerializer
)
from permissions.permissions import HasModulePermission
from .services import (
    generate_monthly_payments, handle_custom_payment,
    confirm_student_payment, get_finance_dashboard_stats,
    get_branch_finance_stats, process_absence_refunds
)
from .exports import export_absent_students_to_excel
from groups.models import Student, Group, Branch
from homework_attends.models import Attendance

logger = logging.getLogger(__name__)


def _parse_month_year(query_params):
    """Parse and validate month/year query params with safe defaults."""
    today = timezone.localdate()
    raw_month = query_params.get('month', today.month)
    raw_year = query_params.get('year', today.year)

    try:
        month = int(raw_month)
        year = int(raw_year)
    except (TypeError, ValueError):
        raise ValueError("month va year raqam bo'lishi kerak")

    if not 1 <= month <= 12:
        raise ValueError("month 1 dan 12 gacha bo'lishi kerak")
    if not 2000 <= year <= 2100:
        raise ValueError("year noto'g'ri formatda")

    return month, year

# --- Pagination ---

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class HeavyResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

# --- ViewSets ---

class StudentPaymentViewSet(viewsets.ModelViewSet):
    """O'quvchilar to'lovlarini boshqarish"""
    queryset = Payment.objects.select_related('student', 'group', 'marked_by').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'is_paid': ['exact'],
        'month': ['exact'],
        'group': ['exact'],
        'student': ['exact'],
        'payment_method': ['exact'],
        'paid_at': ['exact', 'date', 'gte', 'lte'],
        'student__branch': ['exact']
    }
    search_fields = ['student__full_name', 'student__phone', 'group__name']
    ordering_fields = ['month', 'paid_at', 'created_at']
    ordering = ['-month', '-id']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == 'admin':
            return qs.filter(Q(group__branch=user.branch) | Q(student__branch=user.branch))
        elif user.role != 'super_admin':
            return Payment.objects.none()
        return qs

    def perform_update(self, serializer):
        """Adminlar tasdiqlangan to'lovni tahrirlaganda Ledger'ni yangilash"""
        instance = self.get_object()
        old_amount = instance.amount
        old_is_paid = instance.is_paid
        
        updated_instance = serializer.save()
        
        if old_is_paid and updated_instance.is_paid and old_amount != updated_instance.amount:
            related_id = f"STP-{updated_instance.id}"
            FinanceTransaction.objects.filter(related_id=related_id).update(
                amount=updated_instance.amount,
                description=f"Tahrirlandi: {updated_instance.student.full_name} to'lovi ({updated_instance.month})"
            )

    @action(detail=False, methods=['post'], url_path='custom-payment')
    def custom_payment(self, request):
        try:
            ft, mentor_updated = handle_custom_payment(request.user, request.data)
            return Response({
                "status": "success",
                "message": "To'lov muvaffaqiyatli saqlandi",
                "mentor_salary_updated": mentor_updated,
                "data": FinanceTransactionSerializer(ft).data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        payment = self.get_object()
        if payment.is_paid:
            return Response({"detail": "Ushbu to'lov allaqachon amalga oshirilgan"}, status=400)
        
        try:
            updated_payment = confirm_student_payment(request.user, payment, request.data)
            return Response({
                "status": "success",
                "data": PaymentSerializer(updated_payment).data
            })
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        payment = self.get_object()
        if not payment.is_paid:
            return Response({"detail": "Faqat to'langan to'lovlarni tasdiqlash mumkin"}, status=400)
        
        if request.user.role != 'super_admin':
            return Response({"detail": "Faqat super admin tasdiqlay oladi"}, status=403)
            
        payment.is_verified = True
        payment.verified_by = request.user
        payment.verified_at = timezone.now()
        payment.save()
        
        return Response({
            "status": "success",
            "message": "To'lov muvaffaqiyatli tasdiqlandi (imzo qo'yildi)",
            "data": PaymentSerializer(payment).data
        })

    @action(detail=False, methods=['get'], url_path='student-history/(?P<student_id>[^/.]+)')
    def student_history(self, request, student_id=None):
        student = get_object_or_404(Student, id=student_id)
        payments = Payment.objects.filter(student=student).order_by('-month')
        extras = FinanceTransaction.objects.filter(student=student, category='student_extra').order_by('-date')
        refunds = FinanceTransaction.objects.filter(student=student, category='refund').order_by('-date')
        
        return Response({
            "student": {"id": student.id, "name": student.full_name},
            "monthly_payments": PaymentSerializer(payments, many=True).data,
            "extra_transactions": FinanceTransactionSerializer(extras, many=True).data,
            "refunds": FinanceTransactionSerializer(refunds, many=True).data
        })

class EmployeePaymentViewSet(viewsets.ModelViewSet):
    """Xodimlar maoshlarini boshqarish"""
    queryset = EmployeePayment.objects.select_related('employee', 'marked_by').all()
    serializer_class = EmployeePaymentSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_paid', 'month', 'employee__role', 'employee__branch']
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__username']
    ordering_fields = ['month', 'salary_base']
    ordering = ['-month']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == 'admin':
            return qs.filter(employee__branch=user.branch)
        elif user.role != 'super_admin':
            return qs.filter(employee=user)
        return qs

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        payment = self.get_object()
        if payment.is_paid:
            return Response({"detail": "Allaqachon to'langan"}, status=400)
        
        if request.user.role != 'super_admin':
            return Response({"detail": "Faqat super admin tasdiqlay oladi"}, status=403)
            
        with transaction.atomic():
            payment.is_paid = True
            payment.paid_at = timezone.now()
            payment.marked_by = request.user
            payment.save()
            
            FinanceTransaction.objects.create(
                transaction_type='expense',
                category='salary',
                amount=payment.total_amount,
                date=timezone.localdate(),
                marked_by=request.user,
                branch=payment.employee.branch,
                title=f"Maosh: {payment.employee.get_full_name()}",
                description=f"{payment.month.strftime('%Y-%m')} oyi uchun",
                related_id=f"EMP-{payment.id}"
            )
            
        return Response({"status": "success", "data": EmployeePaymentSerializer(payment).data})

    @action(detail=True, methods=['post'], url_path='recalculate')
    def recalculate(self, request, pk=None):
        """Xodim maoshini qayta hisoblash (masalan, o'quvchilar soni o'zgarganda)"""
        payment = self.get_object()
        if payment.is_paid:
            return Response({"error": "To'langan maoshni qayta hisoblab bo'lmaydi"}, status=400)
        
        try:
            payment.recalculate_salary()
            payment.save()
            return Response({
                "status": "success",
                "message": "Maosh muvaffaqiyatli qayta hisoblandi",
                "data": EmployeePaymentSerializer(payment).data
            })
        except Exception as e:
            logger.error(f"Recalculate error: {e}")
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='add-advance')
    def add_advance(self, request, pk=None):
        """Ushbu oydagi maosh uchun avans qo'shish"""
        payment = self.get_object()
        amount = request.data.get('amount')
        description = request.data.get('description', '')

        if not amount:
            return Response({"error": "Avans summasini kiritish shart"}, status=400)

        try:
            with transaction.atomic():
                EmployeeAdvance.objects.create(
                    employee=payment.employee,
                    month=payment.month,
                    amount=Decimal(str(amount)),
                    description=description,
                    marked_by=request.user
                )
                
                # To'lanmagan bo'lsa, ayirmalarni yangilaymiz
                if not payment.is_paid:
                    payment.deductions = F('deductions') + Decimal(str(amount))
                    payment.save()
                    payment.refresh_from_db()

            return Response({
                "status": "success",
                "message": "Avans muvaffaqiyatli qo'shildi",
                "data": EmployeePaymentSerializer(payment).data
            })
        except Exception as e:
            logger.error(f"Add advance error: {e}")
            return Response({"error": str(e)}, status=400)

class StaffProfileViewSet(viewsets.ModelViewSet):
    """Xodimlar profili va maosh sozlamalari"""
    queryset = StaffProfile.objects.select_related('user').all()
    serializer_class = StaffProfileSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['user__role', 'user__branch']
    search_fields = ['user__first_name', 'user__last_name', 'user__username']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return self.queryset.filter(user__branch=user.branch)
        elif user.role == 'super_admin':
            return self.queryset
        return self.queryset.filter(user=user)

class FinanceTransactionViewSet(viewsets.ModelViewSet):
    """Markaziy moliya daftari (Ledger)"""
    queryset = FinanceTransaction.objects.select_related('marked_by', 'branch').all()
    serializer_class = FinanceTransactionSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    pagination_class = StandardResultsSetPagination
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['transaction_type', 'category', 'branch', 'date']
    search_fields = ['title', 'description', 'payer_name']

    def perform_create(self, serializer):
        branch = serializer.validated_data.get('branch') or self.request.user.branch
        serializer.save(marked_by=self.request.user, branch=branch)

class EmployeeAdvanceViewSet(viewsets.ModelViewSet):
    """Xodimlar uchun avanslar"""
    queryset = EmployeeAdvance.objects.select_related('employee', 'marked_by').all()
    serializer_class = EmployeeAdvanceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'

    def perform_create(self, serializer):
        with transaction.atomic():
            advance = serializer.save(marked_by=self.request.user)
            # Update EmployeePayment deductions if exists
            payment = EmployeePayment.objects.filter(
                employee=advance.employee, 
                month=advance.month, 
                is_paid=False
            ).first()
            if payment:
                payment.deductions += advance.amount
                payment.save()

# --- Statistics Views ---

class FinanceDashboardView(APIView):
    """Moliya dashboardi statistikasi"""
    permission_classes = [IsAuthenticated, HasModulePermission] 
    module_name = 'finance'

    def get(self, request):
        try:
            month, year = _parse_month_year(request.query_params)
            data = get_finance_dashboard_stats(request.user, month, year)
            return Response(data)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            logger.exception("Dashboard error")
            return Response({
                "total_income": 0.0,
                "total_expense": 0.0,
                "net_profit": 0.0,
                "total_debt": 0.0,
                "income_trend": 0.0,
                "expense_trend": 0.0,
                "profit_trend": 0.0,
                "branches": [],
                "top_groups": [],
                "stats": {
                    "students": 0,
                    "mentors": 0,
                    "groups": 0,
                    "admins": 0,
                    "attendance_today": {"absent": 0, "total": 0}
                },
                "warning": "Dashboard ma'lumotlari vaqtincha to'liq emas"
            }, status=200)

class BranchFinanceDetailView(APIView):
    """Filial bo'yicha batafsil moliya"""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'

    def get(self, request, branch_id):
        try:
            if request.user.role == 'admin' and request.user.branch_id != int(branch_id):
                return Response({"error": "Siz faqat o'z filialingiz statistikalarini ko'ra olasiz"}, status=403)
            month, year = _parse_month_year(request.query_params)
            data = get_branch_finance_stats(branch_id, month, year)
            return Response(data)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            logger.exception("Branch stats error")
            return Response({
                "branch": {"id": int(branch_id), "name": "Noma'lum filial"},
                "stats": {
                    "mentors": 0, "admins": 0, "groups": 0, "students": 0,
                    "attendance_today": {"absent": 0, "total": 0}
                },
                "finance": {
                    "expected_income": 0.0, "received_income": 0.0,
                    "expenses": 0.0, "net_profit": 0.0
                },
                "groups": [],
                "warning": "Filial statistikasi vaqtincha to'liq emas"
            }, status=200)

class AbsentTodayStudentsView(APIView):
    """Bugun darsga kelmagan o'quvchilar ro'yxati"""
    permission_classes = [IsAuthenticated]

    def get(self, request, branch_id):
        user = request.user
        # Permission check
        if user.role == 'admin' and user.branch_id != int(branch_id):
             return Response({"error": "Ruxsat yo'q"}, status=403)
        
        today = timezone.localdate()
        search = request.query_params.get('search', '').strip()
        export_mode = request.query_params.get('export', 'json')
        
        queryset = Attendance.objects.filter(
            group__branch_id=branch_id, 
            date=today, 
            is_present=False
        ).select_related('student', 'group')

        if search:
            queryset = queryset.filter(
                Q(student__full_name__icontains=search) |
                Q(student__phone__icontains=search) |
                Q(group__name__icontains=search)
            )

        if export_mode == 'excel':
            branch = Branch.objects.get(id=branch_id)
            return export_absent_students_to_excel(queryset, branch.name)

        paginator = HeavyResultsSetPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request, view=self)
        
        results = [
            {
                "id": att.student.id,
                "name": att.student.full_name,
                "phone": att.student.phone,
                "group": att.group.name
            } for att in paginated_queryset
        ]
        return paginator.get_paginated_response(results)

# --- Triggers ---

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_monthly_payments(request):
    try:
        count = generate_monthly_payments()
        return Response({'success': True, 'count': count}, status=200)
    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_absence_refunds(request):
    try:
        month_str = request.data.get('month')
        month_date = timezone.datetime.strptime(month_str, "%Y-%m-%d").date() if month_str else timezone.localdate().replace(day=1)
        count, amount = process_absence_refunds(month_date)
        return Response({'success': True, 'count': count, 'amount': float(amount)}, status=200)
    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_statistics_view(request):
    """Har bir guruh uchun to'lov statistikasi"""
    from django.utils import timezone

    branch_id = request.query_params.get('branch_id')
    today = timezone.localdate()
    month_start = today.replace(day=1)

    # Faol guruhlarni olish
    groups_qs = Group.objects.filter(is_faol=True).select_related('branch')
    if branch_id:
        groups_qs = groups_qs.filter(branch_id=branch_id)

    groups_data = []
    for group in groups_qs:
        # Shu guruhda faol o'quvchilar soni
        students_count = group.enrollments.filter(is_active=True).count()

        # Shu oy uchun to'lovlar
        payments_qs = Payment.objects.filter(group=group, month=month_start)
        paid_count = payments_qs.filter(is_paid=True).count()
        unpaid_count = payments_qs.filter(is_paid=False).count()
        # Agar hali payment yaratilmagan bo'lsa
        no_payment = students_count - paid_count - unpaid_count
        if no_payment < 0:
            no_payment = 0

        groups_data.append({
            "id": group.id,
            "name": group.name,
            "students_count": students_count,
            "paid_count": paid_count,
            "unpaid_count": unpaid_count + no_payment,
            "payment_rate": round((paid_count / students_count * 100) if students_count > 0 else 0, 1)
        })

    # Umumiy statistika
    total_groups = len(groups_data)
    total_students = sum(g['students_count'] for g in groups_data)
    total_paid = sum(g['paid_count'] for g in groups_data)
    total_unpaid = sum(g['unpaid_count'] for g in groups_data)
    avg_rate = round((total_paid / total_students * 100) if total_students > 0 else 0, 1)

    return Response({
        "groups": groups_data,
        "statistics": {
            "total_groups": total_groups,
            "total_students": total_students,
            "total_paid": total_paid,
            "total_unpaid": total_unpaid,
            "completion_rate": avg_rate
        }
    })
