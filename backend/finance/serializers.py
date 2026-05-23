from rest_framework import serializers
from .models import (
    Payment, FinanceTransaction, EmployeePayment, 
    StaffProfile, EmployeeAdvance, AdminExpense
)
from authenticatsiya.models import UserModel
from groups.models import Group, Student, Branch
from drf_spectacular.utils import extend_schema_field
from decimal import Decimal
from finance.utils import floor_amount

class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name']

class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name')
    group_name = serializers.ReadOnlyField(source='group.name')
    branch_name = serializers.ReadOnlyField(source='group.branch.name')
    lessons_count = serializers.SerializerMethodField()
    daily_price = serializers.SerializerMethodField()
    absences_count = serializers.SerializerMethodField()
    refund_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'student', 'student_name', 'group', 'group_name',
            'branch_name', 'amount', 'paid_amount', 'remaining_amount',
            'is_partial', 'month', 'is_paid', 'paid_at',
            'created_at', 'refund_amount', 'refund_ignored', 'notes',
            'lessons_count', 'daily_price', 'absences_count'
        ]
        read_only_fields = ['id', 'created_at', 'paid_at', 'paid_amount', 'is_partial', 'remaining_amount']

    def get_remaining_amount(self, obj):
        return float(obj.remaining_amount)

    def get_lessons_count(self, obj):
        try:
            return len(obj.group.get_lesson_dates(obj.month.year, obj.month.month))
        except Exception:
            return 0
            
    def get_daily_price(self, obj):
        try:
            from finance.utils import floor_amount
            lessons_count = self.get_lessons_count(obj)
            if lessons_count > 0:
                base_price = obj.student.custom_fee if obj.student.custom_fee is not None and obj.student.status in ['low_income', 'negotiated'] else obj.group.monthly_price
                return float(floor_amount(float(base_price) / lessons_count))
            return 0
        except Exception:
            return 0
            
    def get_absences_count(self, obj):
        try:
            return obj.student.get_absences_count(obj.month.year, obj.month.month, group=obj.group)
        except Exception:
            return 0

    def get_refund_amount(self, obj):
        if obj.is_paid:
            return float(obj.refund_amount) if obj.refund_amount else 0
        try:
            return float(obj.student.calculate_refund_amount(obj.month.year, obj.month.month, group=obj.group))
        except Exception:
            return 0

class EmployeePaymentSerializer(serializers.ModelSerializer):
    employee_first_name = serializers.ReadOnlyField(source='employee.first_name')
    employee_last_name = serializers.ReadOnlyField(source='employee.last_name')
    employee_role = serializers.ReadOnlyField(source='employee.role')
    employee_id = serializers.ReadOnlyField(source='employee.id')
    employee_branch = serializers.SerializerMethodField()
    karta = serializers.SerializerMethodField()
    salary_type = serializers.SerializerMethodField()
    fixed_salary = serializers.SerializerMethodField()
    commission_percentage = serializers.SerializerMethodField()
    per_student_amount = serializers.SerializerMethodField()
    groups_income = serializers.SerializerMethodField()
    calculated_commission = serializers.SerializerMethodField()
    calculated_per_student = serializers.SerializerMethodField()
    mentor_groups = serializers.SerializerMethodField() 
    attendance_based_salary = serializers.SerializerMethodField() 
    total_advances = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    advances_history = serializers.SerializerMethodField()
    payment_history = serializers.SerializerMethodField() 
    
    class Meta:
        model = EmployeePayment
        fields = [
            'id', 'employee_id', 'employee_first_name', 'employee_last_name',
            'employee_role', 'employee_branch', 'month', 'salary_base',
            'bonus', 'deductions', 'total_amount', 'karta',
            'salary_type', 'fixed_salary', 'commission_percentage',
            'per_student_amount', 'groups_income', 'calculated_commission',
            'calculated_per_student', 'mentor_groups', 'attendance_based_salary',
            'total_advances', 'advances_history', 'payment_history',
            'is_paid', 'paid_at', 'marked_by'
        ]
        read_only_fields = ['id', 'employee_id', 'total_amount', 'paid_at', 'marked_by']
    
    def get_employee_branch(self, obj) -> int:
        try:
            return obj.employee.branch.id if obj.employee.branch else None
        except:
            return None
    
    def get_karta(self, obj) -> str:
        try:
            return obj.employee.staff_profile.karta if hasattr(obj.employee, 'staff_profile') else None
        except:
            return None
    
    def get_salary_type(self, obj) -> str:
        try:
            return obj.employee.staff_profile.salary_type if hasattr(obj.employee, 'staff_profile') else None
        except:
            return None
    
    def get_fixed_salary(self, obj) -> float:
        try:
            if hasattr(obj.employee, 'staff_profile'):
                return float(obj.employee.staff_profile.fixed_salary)
            return None
        except:
            return None
    
    def get_commission_percentage(self, obj) -> float:
        try:
            if hasattr(obj.employee, 'staff_profile'):
                return float(obj.employee.staff_profile.commission_percentage)
            return None
        except:
            return None

    def get_per_student_amount(self, obj) -> float:
        try:
            if hasattr(obj.employee, 'staff_profile'):
                return float(obj.employee.staff_profile.per_student_amount)
            return None
        except:
            return None
    
    def get_groups_income(self, obj) -> int:
        try:
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return 0
            profile = obj.employee.staff_profile
            inc = profile.calculate_monthly_income(obj.month)
            return int(floor_amount(inc))
        except:
            return 0
    
    def get_calculated_commission(self, obj) -> float:
        try:
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type != 'percentage':
                return None
            sal = profile.calculate_salary_for_month(obj.month)
            return int(floor_amount(sal))
        except:
            return None

    @extend_schema_field(serializers.DictField())
    def get_attendance_based_salary(self, obj) -> dict:
        try:
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return None
            profile = obj.employee.staff_profile
            salary, details = profile.calculate_attendance_based_salary(obj.month)
            return {'salary': int(salary), 'details': details}
        except:
            return None

    def get_calculated_per_student(self, obj) -> float:
        try:
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type != 'student_count':
                return None
            sal = profile.calculate_salary_for_month(obj.month)
            return int(floor_amount(sal))
        except:
            return None
    
    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_mentor_groups(self, obj) -> list:
        try:
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return []
            
            profile = obj.employee.staff_profile
            per_student_rate = float(profile.per_student_amount)
            is_percentage = profile.salary_type == 'percentage'
            is_student_count = profile.salary_type == 'student_count'
            commission_pct = float(profile.commission_percentage) / 100.0 if is_percentage else 0

            if obj.employee.role == 'mentor':
                groups_qs = Group.objects.filter(mentor=obj.employee)
            elif obj.employee.role == 'admin' and obj.employee.branch:
                groups_qs = Group.objects.filter(branch=obj.employee.branch)
            else:
                return []

            mentor_groups = list(groups_qs.select_related('branch').prefetch_related(
                'students', 
                'old_students_fk',
                'enrollments',
                'enrollments__student'
            ))
            if not mentor_groups: return []
            group_ids = [g.id for g in mentor_groups]

            # Barcha to'lovlarni bitta queryda olamiz
            _all_payments = Payment.objects.filter(
                group_id__in=group_ids, 
                month__year=obj.month.year, 
                month__month=obj.month.month
            ).select_related('student')
            
            payment_map = {(p.student_id, p.group_id): p for p in _all_payments}

            groups_data = []
            for group in mentor_groups:
                group_real_income = Decimal('0')
                group_expected_income = Decimal('0')
                mentor_share_paid = Decimal('0')
                mentor_share_expected = Decimal('0')
                
                paid_students = []
                unpaid_students = []
                
                # Guruhga tegishli barcha o'quvchilarni yig'amiz
                all_students_map = {}
                
                # 1. GroupEnrollment orqali (Yangi tizim)
                for enr in group.enrollments.select_related('student').all():
                    if enr.student:
                        all_students_map[enr.student.id] = enr.student
                
                # 2. Legacy ForeignKey orqali (Eski tizim)
                for st in group.old_students_fk.all():
                    all_students_map[st.id] = st
                
                all_students = list(all_students_map.values())
                
                print(f"DEBUG: Group {group.name} has {len(all_students)} students")
                
                for student in all_students:
                    p = payment_map.get((student.id, group.id))
                    
                    # Talaba uchun bazaviy narxni aniqlash
                    if student.status in ['low_income', 'negotiated']:
                        base_price = float(student.custom_fee if student.custom_fee is not None else group.monthly_price)
                    else:
                        base_price = float(group.monthly_price)
                    
                    
                    base_price_floored = float(floor_amount(base_price))
                    
                    # Talaba ma'lumotlari modal uchun
                    student_info = {
                        'id': student.id,
                        'name': student.full_name,
                        'status': student.get_status_display(),
                        'financial_status': student.status,
                        'financial_status_label': student.get_status_display(),
                        'negotiated_price': float(student.custom_fee) if student.custom_fee else None,
                        'expected': base_price_floored,
                        'actual': 0,
                        'refund_amount': 0,
                        'refund_ignored': False,
                        'paid_at': None,
                        'payment_method': None
                    }

                    if p:
                        student_info['actual'] = float(p.amount) if p.is_paid else 0
                        student_info['refund_amount'] = float(p.refund_amount) if p.refund_amount else 0
                        student_info['refund_ignored'] = p.refund_ignored
                        student_info['paid_at'] = p.paid_at.strftime('%Y-%m-%d %H:%M') if p.paid_at else None
                        student_info['payment_method'] = p.get_payment_method_display() if p.payment_method else None
                        
                        if p.is_paid:
                            actual_amount = Decimal(str(p.amount))
                            group_real_income += actual_amount
                            paid_students.append(student_info)
                            
                            # Mentor ulushini hisoblash
                            if is_percentage:
                                mentor_share_paid += actual_amount * Decimal(str(commission_pct))
                            elif is_student_count:
                                mentor_share_paid += Decimal(str(min(float(actual_amount), per_student_rate)))
                        else:
                            unpaid_students.append(student_info)
                    else:
                        # To'lov yaratilmagan holat
                        unpaid_students.append(student_info)
                    
                    # Kutilayotgan tushum (refundlarni hisobga olmaganda)
                    group_expected_income += Decimal(str(base_price_floored))
                    if is_percentage:
                        mentor_share_expected += Decimal(str(base_price_floored)) * Decimal(str(commission_pct))
                    elif is_student_count:
                        mentor_share_expected += Decimal(str(per_student_rate))

                groups_data.append({
                    'id': group.id,
                    'name': group.name,
                    'monthly_price': float(group.monthly_price),
                    'students_count': len(all_students),
                    'paid_students_count': len(paid_students),
                    'real_income': int(floor_amount(group_real_income)),
                    'monthly_income': int(floor_amount(group_real_income)), # Legacy support
                    'expected_income': int(floor_amount(group_expected_income)),
                    'mentor_share_paid': int(floor_amount(mentor_share_paid)),
                    'mentor_share_expected': int(floor_amount(mentor_share_expected)),
                    'paid_students': paid_students,
                    'unpaid_students': unpaid_students,
                })
            return groups_data
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"get_mentor_groups error: {e}")
            return []

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_advances_history(self, obj) -> list:
        from .models import EmployeeAdvance
        qs = EmployeeAdvance.objects.filter(employee=obj.employee, month=obj.month).order_by('-created_at')
        return EmployeeAdvanceSerializer(qs, many=True).data

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_payment_history(self, obj) -> list:
        history = EmployeePayment.objects.filter(employee=obj.employee).order_by('-month', '-id')
        return [{
            'id': p.id,
            'month': p.month,
            'total_amount': float(p.total_amount),
            'is_paid': p.is_paid,
            'paid_at': p.paid_at
        } for p in history]

class StaffProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    branch_name = serializers.CharField(source='user.branch.name', read_only=True)
    salary_display = serializers.CharField(source='get_salary_display', read_only=True)
    current_payment_id = serializers.SerializerMethodField()

    class Meta:
        model = StaffProfile
        fields = [
            'id', 'user', 'full_name', 'username', 'role', 'branch_name',
            'salary_type', 'fixed_salary', 'commission_percentage',
            'per_student_amount', 'salary_display', 'karta', 'current_payment_id'
        ]

    def get_current_payment_id(self, obj):
        try:
            from django.utils import timezone
            current_month = timezone.localdate().replace(day=1)
            payment = EmployeePayment.objects.filter(employee=obj.user, month=current_month).first()
            return payment.id if payment else None
        except Exception:
            return None

class BranchStatSerializer(serializers.Serializer):
    name = serializers.CharField()
    income = serializers.DecimalField(max_digits=15, decimal_places=2)
    expense = serializers.DecimalField(max_digits=15, decimal_places=2)
    profit = serializers.DecimalField(max_digits=15, decimal_places=2)

class GroupStatSerializer(serializers.Serializer):
    name = serializers.CharField()
    profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    student_count = serializers.IntegerField()

class FinanceDashboardSerializer(serializers.Serializer):
    total_income = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_debt = serializers.DecimalField(max_digits=15, decimal_places=2)
    branches = BranchStatSerializer(many=True)
    top_groups = GroupStatSerializer(many=True)

class BranchFinanceDetailSerializer(serializers.Serializer):
    branch = serializers.DictField()
    stats = serializers.DictField()
    finance = serializers.DictField()
    groups = serializers.ListField()
    period = serializers.DictField()

class FinanceTransactionSerializer(serializers.ModelSerializer):
    marked_by_name = serializers.SerializerMethodField()
    student_name = serializers.ReadOnlyField(source='student.full_name')
    branch_name = serializers.ReadOnlyField(source='branch.name')
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = FinanceTransaction
        fields = [
            'id', 'transaction_type', 'transaction_type_display', 
            'category', 'category_display', 'amount', 'date', 
            'marked_by', 'marked_by_name', 'branch', 'branch_name', 
            'student', 'student_name', 'group', 'payer_name',
            'title', 'description', 'related_id', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'marked_by']

    def get_marked_by_name(self, obj) -> str:
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return "Tizim"

class CustomPaymentSerializer(serializers.Serializer):
    student = serializers.IntegerField()
    group = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = serializers.ChoiceField(choices=[('income', 'Kirim'), ('expense', 'Chiqim')], default='income')
    payer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    date = serializers.DateField(required=False)

class EmployeeAdvanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)
    marked_by_name = serializers.CharField(source='marked_by.get_full_name', read_only=True)
    
    class Meta:
        model = EmployeeAdvance
        fields = ['id', 'employee', 'employee_name', 'month', 'amount', 'description', 'date', 'marked_by', 'marked_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'marked_by']

class SuccessSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField(required=False, allow_null=True)
    count = serializers.IntegerField(required=False, allow_null=True)

class AbsentStudentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    phone = serializers.CharField()
    group = serializers.CharField()

class PaymentStatisticsSerializer(serializers.Serializer):
    groups = serializers.ListField(child=serializers.DictField())
    statistics = serializers.DictField()

class AdminExpenseSerializer(serializers.ModelSerializer):
    marked_by_name = serializers.CharField(source='marked_by.get_full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = AdminExpense
        fields = [
            'id', 'title', 'description', 'amount', 'date', 
            'branch', 'branch_name', 'marked_by', 'marked_by_name', 
            'created_at'
        ]
        read_only_fields = ['id', 'marked_by', 'created_at']
