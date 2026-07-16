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
    StaffProfile, EmployeeAdvance, AdminExpense, MentorGroupSalaryConfig
)
from .serializers import (
    PaymentSerializer, FinanceTransactionSerializer, 
    EmployeePaymentSerializer, StaffProfileSerializer, 
    EmployeeAdvanceSerializer, FinanceDashboardSerializer,
    BranchFinanceDetailSerializer, SuccessSerializer, 
    AbsentStudentSerializer, PaymentStatisticsSerializer,
    AdminExpenseSerializer, MentorGroupSalaryConfigSerializer
)
from permissions.permissions import HasModulePermission
from .services import (
    generate_monthly_payments, handle_custom_payment,
    confirm_student_payment, get_finance_dashboard_stats,
    get_branch_finance_stats, process_absence_refunds,
    get_monthly_branch_trends
)
from .exports import export_absent_students_to_excel
from groups.models import Student, Group, Branch, GroupEnrollment
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

    def get_serializer_context(self):
        """OPTIMIZATSIYA: PaymentSerializer uchun lesson_dates cache"""
        context = super().get_serializer_context()
        if self.action not in ('list', 'retrieve'):
            return context
        try:
            # Barcha noyob (group, year, month) larni aniqlash
            queryset = self.filter_queryset(self.get_queryset())
            if self.action == 'list':
                page = self.paginate_queryset(queryset)
                items = page if page is not None else list(queryset)
            else:
                items = [self.get_object()]

            group_months = set()
            for p in items:
                if p.group_id and p.month:
                    group_months.add((p.group_id, p.month.year, p.month.month))

            lesson_dates_cache = {}
            group_ids = list(set(gid for gid, _, _ in group_months))
            groups_map = {
                g.id: g for g in Group.objects.filter(id__in=group_ids).prefetch_related(
                    'special_lesson_days', 'canceled_lesson_days'
                )
            }
            for gid, year, month in group_months:
                group = groups_map.get(gid)
                if group:
                    lesson_dates_cache[(gid, year, month)] = group.get_lesson_dates(year, month)
                else:
                    lesson_dates_cache[(gid, year, month)] = []

            context['lesson_dates_cache'] = lesson_dates_cache
        except Exception as e:
            logger.error(f"StudentPayment prefetch error: {e}")
        return context

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
    queryset = EmployeePayment.objects.select_related('employee', 'employee__branch', 'marked_by').all()
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

    def get_serializer_context(self):
        """OPTIMIZATSIYA: Serializer uchun batch-prefetched ma'lumotlarni tayyorlash"""
        context = super().get_serializer_context()
        # Faqat list va retrieve uchun prefetch qilish
        if self.action not in ('list', 'retrieve'):
            return context
        try:
            queryset = self.filter_queryset(self.get_queryset())
            if self.action == 'list':
                page = self.paginate_queryset(queryset)
                items = page if page is not None else list(queryset)
            else:
                items = [self.get_object()]

            if not items:
                return context

            # 1. Unique (employee_id, month) juftliklarini yig'ish
            employee_months = set()
            employee_ids = set()
            for ep in items:
                employee_months.add((ep.employee_id, str(ep.month)))
                employee_ids.add(ep.employee_id)

            # 2. Har bir xodim uchun guruhlar (mentor/admin)
            from django.contrib.auth import get_user_model
            User = get_user_model()
            employees = {u.id: u for u in User.objects.filter(id__in=employee_ids).select_related('branch')}

            mentor_ids = [uid for uid, u in employees.items() if u.role == 'mentor']
            admin_branch_ids = list(set(
                u.branch_id for uid, u in employees.items()
                if u.role == 'admin' and u.branch_id
            ))

            # Guruhlarni yig'ish
            groups_qs = Group.objects.none()
            if mentor_ids:
                groups_qs = groups_qs | Group.objects.filter(mentor_id__in=mentor_ids)
            if admin_branch_ids:
                groups_qs = groups_qs | Group.objects.filter(branch_id__in=admin_branch_ids)
            groups_qs = groups_qs.select_related('branch', 'mentor').prefetch_related(
                'special_lesson_days', 'canceled_lesson_days'
            )

            employee_groups = {}  # employee_id -> [Group]
            group_by_id = {}
            for g in groups_qs:
                group_by_id[g.id] = g
                if g.mentor_id in employee_ids:
                    employee_groups.setdefault(g.mentor_id, []).append(g)
            for uid, u in employees.items():
                if u.role == 'admin' and u.branch_id:
                    for g in groups_qs:
                        if g.branch_id == u.branch_id and g.id not in [
                            gg.id for gg in employee_groups.get(uid, [])
                        ]:
                            employee_groups.setdefault(uid, []).append(g)

            # 3. Lesson dates cache (har guruh uchun bir marta)
            lesson_dates_cache = {}
            for g in groups_qs:
                for (eid, month_str) in employee_months:
                    if eid in employee_groups and g.id in [
                        gg.id for gg in employee_groups.get(eid, [])
                    ]:
                        if g.id not in lesson_dates_cache:
                            parts = month_str.split('-')
                            lesson_dates_cache[g.id] = g.get_lesson_dates(
                                int(parts[0]), int(parts[1])
                            )

            # 4. Payments batch
            payment_conditions = Q()
            for eid, month_str in employee_months:
                parts = month_str.split('-')
                month_date = f"{parts[0]}-{parts[1]}-01"
                g_ids = [g.id for g in employee_groups.get(eid, [])]
                if g_ids:
                    payment_conditions |= Q(group_id__in=g_ids, month=month_date)

            payment_map_global = {}
            if payment_conditions != Q():
                for p in Payment.objects.filter(
                    payment_conditions
                ).select_related('student'):
                    payment_map_global[(p.student_id, p.group_id)] = p

            # 5. Extra transactions batch
            extras_map_global = {}
            if payment_conditions != Q():
                extra_conditions = Q(category='student_extra')
                date_conds = Q()
                for eid, month_str in employee_months:
                    parts = month_str.split('-')
                    date_conds |= Q(date__year=int(parts[0]), date__month=int(parts[1]))
                extra_conditions &= date_conds
                for tx in FinanceTransaction.objects.filter(extra_conditions).values(
                    'student_id', 'group_id', 'transaction_type', 'amount'
                ):
                    key = (tx['student_id'], tx['group_id'])
                    amt = Decimal(str(tx['amount'] or 0))
                    if tx['transaction_type'] == 'income':
                        extras_map_global[key] = extras_map_global.get(key, Decimal('0')) + amt
                    else:
                        extras_map_global[key] = extras_map_global.get(key, Decimal('0')) - amt

            # 6. Attendance cache
            all_group_ids = list(group_by_id.keys())
            attendance_cache = {}
            if all_group_ids:
                for month_str in set(m for _, m in employee_months):
                    parts = month_str.split('-')
                    for row in Attendance.objects.filter(
                        group_id__in=all_group_ids,
                        date__year=int(parts[0]),
                        date__month=int(parts[1]),
                        is_present=True,
                        marked_by__isnull=False,
                    ).values('group_id', 'student_id'):
                        k = (row['group_id'], row['student_id'])
                        attendance_cache[k] = attendance_cache.get(k, 0) + 1

            # 7. Enrollment cache
            enrollment_cache = {}
            _join_dates = {}
            if all_group_ids:
                for enr in GroupEnrollment.objects.filter(
                    group_id__in=all_group_ids
                ).select_related('student'):
                    if enr.group_id not in enrollment_cache:
                        enrollment_cache[enr.group_id] = {}
                    if enr.student:
                        enrollment_cache[enr.group_id][enr.student.id] = enr.student
                    if enr.joined_at:
                        _join_dates[(enr.student_id, enr.group_id)] = enr.joined_at.date()
            enrollment_cache['_join_dates'] = _join_dates

            # Legacy old_students_fk (eski tizimdan qolgan o'quvchilar)
            for st in Student.objects.filter(
                group_id__in=all_group_ids
            ).only('id', 'custom_fee', 'status', 'full_name', 'joined_at', 'group_id'):
                gid = st.group_id
                if gid not in enrollment_cache:
                    enrollment_cache[gid] = {}
                enrollment_cache[gid][st.id] = st

            # 8. Salary configs
            _salary_configs = {}
            if mentor_ids:
                for sc in MentorGroupSalaryConfig.objects.filter(
                    mentor_id__in=mentor_ids, group_id__in=all_group_ids
                ):
                    _salary_configs[(sc.mentor_id, sc.group_id)] = sc
            enrollment_cache['_salary_configs'] = _salary_configs

            # 9. Advances batch
            from .models import EmployeeAdvance
            current_month = timezone.localdate().replace(day=1)
            advances_map = {}
            for adv in EmployeeAdvance.objects.filter(
                employee_id__in=employee_ids, month=current_month
            ).order_by('-created_at'):
                key = (adv.employee_id, str(adv.month))
                advances_map.setdefault(key, []).append(adv)

            context['employee_prefetch'] = {
                'employee_groups': employee_groups,
                'payment_map': payment_map_global,
                'extras_map': extras_map_global,
                'lesson_dates_cache': lesson_dates_cache,
                'attendance_cache': attendance_cache,
                'enrollment_cache': enrollment_cache,
                'advances_map': advances_map,
            }
        except Exception as e:
            logger.error(f"EmployeePayment prefetch error: {e}")
        return context

    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        """Get the current month's employee payment for the logged-in user."""
        today = timezone.localdate()
        current_month = today.replace(day=1)
        qs = self.get_queryset().filter(month=current_month)
        payment = qs.first()
        if payment:
            return Response(EmployeePaymentSerializer(payment).data)
        return Response({"detail": "Current month payment not found."}, status=status.HTTP_404_NOT_FOUND)

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
                if hasattr(payment.employee, 'staff_profile'):
                    payment.recalculate_salary(commission_basis=commission_basis)
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
        
        # Optional: commission_basis parameter for recalculation
        commission_basis = str(request.data.get('commission_basis', 'paid')).lower()
        if commission_basis not in ['paid', 'expected']:
            commission_basis = 'paid'
        
        try:
            payment.recalculate_salary(commission_basis=commission_basis)
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
        # Moliya bo'limiga faqat super_admin kira oladi, shuning uchun barcha filiallarni ko'radi
        return self.queryset

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

    def perform_create(self, serializer):
        """Profile yaratishda xavfsizlikni tekshirish."""
        user_to_assign = serializer.validated_data.get('user')
        if self.request.user.role == 'admin':
            if user_to_assign.branch != self.request.user.branch:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Siz faqat o'z filialingiz xodimlari uchun profil yarata olasiz.")
        serializer.save()

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

    def get_queryset(self):
        # Moliya bo'limiga faqat super_admin kira oladi, shuning uchun barcha filiallarni ko'radi
        return self.queryset

    def perform_create(self, serializer):
        branch = serializer.validated_data.get('branch') or self.request.user.branch
        serializer.save(marked_by=self.request.user, branch=branch)

class EmployeeAdvanceViewSet(viewsets.ModelViewSet):
    """Xodimlar uchun avanslar"""
    queryset = EmployeeAdvance.objects.select_related('employee', 'marked_by').all()
    serializer_class = EmployeeAdvanceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'

    def get_queryset(self):
        # Moliya bo'limiga faqat super_admin kira oladi, shuning uchun barcha filiallarni ko'radi
        return self.queryset

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
            # Moliya bo'limiga faqat super_admin kira oladi, shuning uchun barcha filiallarni ko'radi
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
        try:
            user = request.user
            # Permission check
            if user.role == 'admin':
                allowed_branches = [user.branch_id] if user.branch_id else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(
                        user.branch_accesses.values_list('branch_id', flat=True)
                    )
                # None bo'lishi mumkin bo'lgan qiymatlarni int'ga o'girish xavfsiz
                safe_branches = [int(b) for b in allowed_branches if b is not None]
                if int(branch_id) not in safe_branches:
                    return Response({"error": "Ruxsat yo'q"}, status=403)

            today = timezone.localdate()
            search = request.query_params.get('search', '').strip()
            export_mode = request.query_params.get('export', 'json')

            # "Absent" ro'yxati student kesimida: agar student bugun hech bo'lmasa bitta guruhda
            # kelgan bo'lsa, u kelmaganlar ro'yxatiga tushmasligi kerak.
            base_qs = Attendance.objects.filter(group__branch_id=branch_id, date=today)
            present_ids = base_qs.filter(
                is_present=True,
                student__isnull=False
            ).values_list('student_id', flat=True).distinct()

            queryset = base_qs.filter(is_present=False).exclude(
                student_id__in=present_ids
            ).select_related('student', 'group')

            if search:
                # Snapshot fieldlarda ham qidirish (student o'chirilgan bo'lsa ham ishlaydi)
                queryset = queryset.filter(
                    Q(student__full_name__icontains=search) |
                    Q(student__phone__icontains=search) |
                    Q(group__name__icontains=search) |
                    Q(student_full_name__icontains=search) |
                    Q(group_name__icontains=search)
                )

            # 1. Takrorlanmasligi uchun avval barchasini Python'da filterlaymiz
            # Bu yerda recordlar soni kunlik hisobda bo'lgani uchun tez ishlaydi
            seen_students = set()
            unique_results = []
            for att in queryset:
                student_id = att.student_id
                if student_id is None:
                    continue

                if student_id in seen_students:
                    continue
                seen_students.add(student_id)

                if att.student is not None:
                    name = att.student.full_name
                    phone = att.student.phone or ""
                else:
                    name = att.student_full_name or ""
                    phone = ""

                if att.group is not None:
                    group_name = att.group.name
                else:
                    group_name = att.group_name or ""

                unique_results.append({
                    "id": student_id,
                    "name": name,
                    "phone": phone,
                    "group": group_name,
                })

            if export_mode == 'excel':
                branch = Branch.objects.get(id=branch_id)
                # Export ga ham filterlangan (takrorlanmagan) listni beramiz
                return export_absent_students_to_excel(unique_results, branch.name)

            paginator = HeavyResultsSetPagination()
            # unique_results oddiy python list bo'lsa ham DRF Paginator bemalol ishlaydi
            paginated_results = paginator.paginate_queryset(unique_results, request, view=self)

            return paginator.get_paginated_response(paginated_results)

        except Exception:
            logger.exception(
                "AbsentTodayStudentsView xatosi. branch_id=%s", branch_id
            )
            return Response(
                {"error": "Server xatosi yuz berdi. Iltimos, keyinroq urinib ko'ring."},
                status=500
            )


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

class MentorGroupSalaryConfigViewSet(viewsets.ModelViewSet):
    """
    Mentorlar uchun guruhga xos maosh konfiguratsiyalari.
    Super admin va adminlar (faqat o'z filialidagi mentorlar uchun) ishlata oladi.
    """
    queryset = MentorGroupSalaryConfig.objects.select_related('mentor', 'group', 'mentor__branch', 'group__branch').all()
    serializer_class = MentorGroupSalaryConfigSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['mentor__first_name', 'mentor__last_name', 'mentor__username', 'group__name']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        try:
            user = self.request.user
            qs = super().get_queryset()
            
            # Mentor filterini qo'llash (safe usulda)
            mentor_id = self.request.query_params.get('mentor')
            if mentor_id:
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    # Foydalanuvchi mavjud va mentor ekanligini tekshiramiz
                    if User.objects.filter(id=mentor_id, role='mentor').exists():
                        qs = qs.filter(mentor_id=mentor_id)
                    else:
                        # Agar mentor bo'lmasa, bo'sh queryset qaytaramiz
                        return qs.none()
                except (ValueError, TypeError):
                    # Noto'g'ri ID bo'lsa, bo'sh qaytaramiz
                    return qs.none()
            
            # Guruh filterini qo'llash
            group_id = self.request.query_params.get('group')
            if group_id:
                qs = qs.filter(group_id=group_id)
            
            # Salary type filterini qo'llash
            salary_type = self.request.query_params.get('salary_type')
            if salary_type:
                qs = qs.filter(salary_type=salary_type)
            
            # Ruxsatlarni tekshiramiz
            if user.role == 'super_admin':
                return qs
                
            if user.role == 'admin':
                # Admin faqat o'z filialidagi mentorlar uchun konfiguratsiyalarni ko'radi
                allowed_branches = [user.branch.id] if user.branch else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                return qs.filter(mentor__branch_id__in=allowed_branches)
                
            return qs.none()
        except Exception as e:
            logger.exception(f"MentorGroupSalaryConfigViewSet get_queryset error: {e}")
            return MentorGroupSalaryConfig.objects.none()

    def perform_create(self, serializer):
        try:
            # Xavfsizlikni tekshirish: admin faqat o'z filialidagi mentorlar uchun konfiguratsiya yaratishi mumkin
            user = self.request.user
            mentor = serializer.validated_data.get('mentor')
            group = serializer.validated_data.get('group')
            
            if user.role == 'admin':
                if (mentor and mentor.branch != user.branch) or (group and group.branch != user.branch):
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Siz faqat o'z filialingizdagi mentorlar va guruhlar uchun konfiguratsiya yaratishingiz mumkin.")
            
            serializer.save()
        except Exception as e:
            logger.exception(f"MentorGroupSalaryConfigViewSet perform_create error: {e}")
            raise


@extend_schema(responses={200: PaymentStatisticsSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_statistics_view(request):
    """Har bir guruh uchun to'lov statistikasi (N+1 optimallashtirilgan)"""
    from django.utils import timezone
    from django.db.models import Count, Q

    branch_id = request.query_params.get('branch_id')
    today = timezone.localdate()
    month_start = today.replace(day=1)

    # OPTIMIZATSIYA: annotate bilan student count ni birga olish
    groups_qs = Group.objects.filter(is_faol=True).select_related('branch').annotate(
        st_count=Count('enrollments', filter=Q(enrollments__is_active=True))
    )
    if branch_id:
        groups_qs = groups_qs.filter(branch_id=branch_id)

    # OPTIMIZATSIYA: Barcha to'lovlarni BIR so'rovda guruhlab olish
    all_group_ids = list(groups_qs.values_list('id', flat=True))
    payment_stats = {}
    if all_group_ids:
        stats_qs = Payment.objects.filter(
            group_id__in=all_group_ids, month=month_start
        ).values('group_id', 'is_paid').annotate(cnt=Count('id'))
        for row in stats_qs:
            gid = row['group_id']
            if gid not in payment_stats:
                payment_stats[gid] = {'paid': 0, 'unpaid': 0}
            if row['is_paid']:
                payment_stats[gid]['paid'] = row['cnt']
            else:
                payment_stats[gid]['unpaid'] = row['cnt']

    groups_data = []
    for group in groups_qs:
        students_count = group.st_count
        ps = payment_stats.get(group.id, {'paid': 0, 'unpaid': 0})
        paid_count = ps['paid']
        unpaid_count = ps['unpaid']
        no_payment = max(0, students_count - paid_count - unpaid_count)

        groups_data.append({
            "id": group.id,
            "name": group.name,
            "students_count": students_count,
            "paid_count": paid_count,
            "unpaid_count": unpaid_count + no_payment,
            "payment_rate": round((paid_count / students_count * 100) if students_count > 0 else 0, 1)
        })

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

from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from datetime import date
from decimal import Decimal
from .serializers import SpecialStudentDashboardResponseSerializer

class SpecialStudentsDashboardAPIView(APIView):
    """
    Filialdagi barcha "maxsus" statusga ega o'quvchilar va ularning dinamik moliyaviy ma'lumotlarini qaytaradi.
    Statuslar: 'discount', 'low_income', 'negotiated', 'teacher_negotiated'
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter('year', OpenApiTypes.INT, required=True),
            OpenApiParameter('month', OpenApiTypes.INT, required=True),
            OpenApiParameter('status', OpenApiTypes.STR, required=False, description="Masalan: discount, negotiated"),
        ],
        responses=SpecialStudentDashboardResponseSerializer
    )
    def get(self, request, branch_id):
        try:
            year = int(request.query_params.get('year', timezone.now().year))
            month = int(request.query_params.get('month', timezone.now().month))
            status_filter = request.query_params.get('status', None)
        except ValueError:
            return Response({"detail": "Yil yoki oy xato formatda"}, status=400)

        statuses = ['discount', 'low_income', 'negotiated', 'teacher_negotiated']
        if status_filter and status_filter in statuses:
            statuses = [status_filter]
            
        students = Student.objects.filter(
            branch_id=branch_id,
            status__in=statuses,
            is_active=True
        ).prefetch_related('enrollments__group', 'finance_profile', 'payments')

        data = []
        total_expected = Decimal(0)
        total_paid = Decimal(0)
        total_debt = Decimal(0)
        
        for student in students:
            # Har bir o'quvchining aktiv guruhlarini topamiz
            active_enrollments = student.enrollments.filter(is_active=True)
            for enr in active_enrollments:
                group = enr.group
                # Dinamik qarz hisoblash
                expected = student.calculate_accrued_amount(year, month, group=group)
                
                # Payment orqali to'langan qismini aniqlaymiz
                payments = [p for p in student.payments.all() if p.group_id == group.id and p.month and p.month.year == year and p.month.month == month]
                paid_amt = Decimal(sum([p.paid_amount for p in payments])) if payments else Decimal(0)
                
                debt = max(Decimal(0), expected - paid_amt)
                
                # Wallet
                wallet = getattr(student, 'finance_profile', None)
                w_paid = wallet.total_paid_all_time if wallet else Decimal(0)
                w_refunded = wallet.total_refunded if wallet else Decimal(0)
                w_date = wallet.last_payment_date if wallet else None
                
                total_expected += expected
                total_paid += paid_amt
                total_debt += debt
                
                data.append({
                    "student_id": student.id,
                    "full_name": student.full_name,
                    "phone": student.phone,
                    "status": student.status,
                    "status_display": student.get_status_display(),
                    "group_id": group.id,
                    "group_name": group.name,
                    "monthly_price": group.monthly_price,
                    "custom_fee": student.custom_fee,
                    "expected_amount": expected,
                    "paid_amount": paid_amt,
                    "debt": debt,
                    "wallet_total_paid": w_paid,
                    "wallet_total_refunded": w_refunded,
                    "last_payment_date": w_date,
                })

        status_counts = {
            'discount': 0,
            'low_income': 0,
            'negotiated': 0,
            'teacher_negotiated': 0
        }
        for s in students:
            if s.status in status_counts:
                status_counts[s.status] += 1
            else:
                status_counts[s.status] = 1

        summary = {
            "total_expected": total_expected,
            "total_paid": total_paid,
            "total_debt": total_debt,
            "students_count": len(data),
            "status_counts": status_counts
        }
        
        serializer = SpecialStudentDashboardResponseSerializer({
            "summary": summary,
            "students": data
        })
        
        return Response(serializer.data)
