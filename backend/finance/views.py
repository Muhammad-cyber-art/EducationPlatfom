import logging
import traceback
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q, F, Count
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from .models import (
    Payment, FinanceTransaction, EmployeePayment, 
    StaffProfile, EmployeeAdvance, AdminExpense
)
from .serializers import (
    PaymentSerializer, FinanceTransactionSerializer, 
    EmployeePaymentSerializer, StaffProfileSerializer, 
    EmployeeAdvanceSerializer, FinanceDashboardSerializer,
    BranchFinanceDetailSerializer, SuccessSerializer, 
    AbsentStudentSerializer, PaymentStatisticsSerializer,
    AdminExpenseSerializer
)
from permissions.permissions import HasModulePermission
from .services import (
    generate_monthly_payments, handle_custom_payment,
    confirm_student_payment, get_finance_dashboard_stats,
    get_branch_finance_stats, process_absence_refunds,
    get_monthly_branch_trends
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
        'paid_at': ['exact', 'date', 'gte', 'lte', 'date__gte', 'date__lte'],
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
            return Response({"detail": "Ushbu to'lov allaqachon to'liq amalga oshirilgan"}, status=400)

        try:
            updated_payment = confirm_student_payment(request.user, payment, request.data)
            message = "To'lov muvaffaqiyatli qabul qilindi"
            if updated_payment.is_partial and not updated_payment.is_paid:
                message = (
                    f"Bo'lib to'lov qabul qilindi. "
                    f"Qolgan: {float(updated_payment.remaining_amount):,.0f} UZS"
                )
            return Response({
                "status": "success",
                "message": message,
                "data": PaymentSerializer(updated_payment).data
            })
        except Exception as e:
            import traceback
            return Response({"error": str(e), "traceback": traceback.format_exc()}, status=400)

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
            
        # Yangi: Modal orqali kelgan bonus va ayirmalarni olish
        bonus = request.data.get('bonus', 0)
        deductions = request.data.get('deductions', 0)
        commission_basis = str(request.data.get('commission_basis', 'paid')).lower()
        if commission_basis not in ['paid', 'expected']:
            commission_basis = 'paid'
        
        with transaction.atomic():
            try:
                # Oylik maoshni qayta hisoblaymiz (yangi tushumlar asosida)
                if (
                    hasattr(payment.employee, 'staff_profile')
                    and payment.employee.staff_profile.salary_type == 'percentage'
                ):
                    payment.salary_base = payment.employee.staff_profile.calculate_salary_for_month(
                        payment.month,
                        commission_basis=commission_basis,
                    )
                else:
                    payment.recalculate_salary()
            except Exception as e:
                logger.error(f"Salary recalculation error during confirm: {e}")

            # Bonus va ayirmalarni yangilash
            payment.bonus = Decimal(str(bonus))
            payment.deductions = Decimal(str(deductions))
            
            payment.is_paid = True
            payment.paid_at = timezone.now()
            payment.marked_by = request.user
            payment.save()
            
            # Centralized Finance Ledger yaratish
            from .models import FinanceTransaction
            FinanceTransaction.objects.create(
                transaction_type='expense',
                category='salary',
                amount=payment.total_amount,
                date=timezone.localdate(),
                marked_by=request.user,
                branch=payment.employee.branch,
                title=f"Maosh: {payment.employee.get_full_name() or payment.employee.username}",
                description=f"{payment.month.strftime('%Y-%m')} oyi uchun xizmat haqi",
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

            return Response({
                "status": "success",
                "message": "Avans muvaffaqiyatli qo'shildi",
                "data": EmployeePaymentSerializer(payment).data
            })
        except Exception as e:
            logger.error(f"Add advance error: {e}")
            return Response({"error": str(e)}, status=400)

class StaffProfileViewSet(viewsets.ModelViewSet):
    """Xodimlar profili va maosh sozlamalari. 

    Lookup: user_id bo'yicha ishlaydi (frontend employee_id yuboradi).
    Serializer `id` maydoni ham user.id ni qaytaradi.
    """
    queryset = StaffProfile.objects.select_related('user').all()
    serializer_class = StaffProfileSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    lookup_field = 'user_id'

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

    @action(detail=False, methods=['get', 'patch', 'delete'], url_path='by-user/(?P<user_id>[^/.]+)')
    def by_user(self, request, user_id=None):
        """Frontendga qulay: user_id orqali StaffProfile CRUD."""
        profile = get_object_or_404(self.get_queryset(), user_id=user_id)
        self.check_object_permissions(request, profile)
        if request.method == 'GET':
            return Response(StaffProfileSerializer(profile).data)
        if request.method == 'PATCH':
            serializer = StaffProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        if request.method == 'DELETE':
            profile.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

class FinanceTransactionViewSet(viewsets.ModelViewSet):
    """Markaziy moliya daftari (Ledger)"""
    queryset = FinanceTransaction.objects.select_related('marked_by', 'branch').all()
    serializer_class = FinanceTransactionSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    pagination_class = StandardResultsSetPagination
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'transaction_type': ['exact'],
        'category': ['exact'],
        'branch': ['exact'],
        'date': ['exact', 'gte', 'lte']
    }
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
        # Avanslar alohida EmployeeAdvance jadvalida; yakuniy summa total_advances orqali ayiriladi
        serializer.save(marked_by=self.request.user)

# --- Statistics Views ---

class FinanceDashboardView(APIView):
    """Moliya dashboardi statistikasi"""
    permission_classes = [IsAuthenticated, HasModulePermission] 
    module_name = 'finance'
    serializer_class = FinanceDashboardSerializer

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
                "total_attendance_refunds": 0.0,
                "total_attendance_refunds_paid": 0.0,
                "refund_share_percent": 0.0,
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
    serializer_class = BranchFinanceDetailSerializer

    def get(self, request, branch_id):
        try:
            if request.user.role == 'admin':
                allowed_branches = [request.user.branch_id] if request.user.branch_id else []
                if hasattr(request.user, 'branch_accesses'):
                    allowed_branches.extend(request.user.branch_accesses.values_list('branch_id', flat=True))
                if int(branch_id) not in allowed_branches:
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
                    "refunds": 0.0, "attendance_refunds": 0.0,
                    "attendance_refunds_paid": 0.0, "refund_share_percent": 0.0,
                    "real_revenue": 0.0, "expenses": 0.0, "net_profit": 0.0
                },
                "groups": [],
                "warning": "Filial statistikasi vaqtincha to'liq emas"
            }, status=200)

class AbsentTodayStudentsView(APIView):
    """Bugun darsga kelmagan o'quvchilar ro'yxati"""
    permission_classes = [IsAuthenticated]
    serializer_class = AbsentStudentSerializer

    def get(self, request, branch_id):
        user = request.user
        # Permission check
        if user.role == 'admin':
            allowed_branches = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            if int(branch_id) not in allowed_branches:
                return Response({"error": "Ruxsat yo'q"}, status=403)
        
        today = timezone.localdate()
        search = request.query_params.get('search', '').strip()
        export_mode = request.query_params.get('export', 'json')

        # "Absent" ro'yxati student kesimida: agar student bugun hech bo'lmasa bitta guruhda kelgan bo'lsa,
        # u kelmaganlar ro'yxatiga tushmasligi kerak (student bir nechta guruhda bo'lishi mumkin).
        base_qs = Attendance.objects.filter(group__branch_id=branch_id, date=today)
        present_ids = base_qs.filter(is_present=True).values_list('student_id', flat=True).distinct()

        queryset = base_qs.filter(is_present=False).exclude(
            student_id__in=present_ids
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


class MonthlyBranchTrendsView(APIView):
    """Filiallar bo'yicha oylik tushum/chiqim trendi."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    serializer_class = SuccessSerializer

    def get(self, request):
        try:
            month, year = _parse_month_year(request.query_params)
            months_back = request.query_params.get('months_back', 6)
            data = get_monthly_branch_trends(request.user, month, year, months_back)
            return Response(data)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception:
            logger.exception("Monthly branch trends error")
            return Response({"months": [], "branches": []}, status=200)

# --- Triggers ---

from drf_spectacular.utils import extend_schema
@extend_schema(request=None, responses={200: SuccessSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_monthly_payments(request):
    try:
        count = generate_monthly_payments()
        return Response({'success': True, 'count': count}, status=200)
    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=500)

class AdminExpenseViewSet(viewsets.ModelViewSet):
    """
    Adminlar tomonidan kiritiladigan mayda harajatlar.
    Bu harajatlar asosiy moliya balansiga qo'shilmaydi.
    """
    queryset = AdminExpense.objects.all().select_related('branch', 'marked_by')
    serializer_class = AdminExpenseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['branch', 'date']
    search_fields = ['title', 'description']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        
        # Branch filteri (query param orqali)
        branch_id = self.request.query_params.get('branch_id')
        
        if user.role == 'super_admin':
            return qs.filter(branch_id=branch_id) if branch_id else qs
            
        if user.role == 'admin':
            # Admin faqat o'z filialidagi harajatlarni ko'radi
            allowed_branches = [user.branch.id] if user.branch else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            
            qs = qs.filter(branch_id__in=allowed_branches)
            return qs.filter(branch_id=branch_id) if branch_id else qs
            
        return qs.none()

    def perform_create(self, serializer):
        # Filialni avtomatik aniqlash (agar berilmagan bo'lsa)
        user = self.request.user
        branch = serializer.validated_data.get('branch')
        if not branch and user.role == 'admin':
            branch = user.branch
            
        serializer.save(marked_by=user, branch=branch)


@extend_schema(responses={200: PaymentStatisticsSerializer})
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
