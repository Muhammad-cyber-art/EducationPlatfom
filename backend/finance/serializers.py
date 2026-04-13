from rest_framework import serializers
from .models import Payment ,EmployeePayment,StaffProfile

class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name')
    group_name = serializers.ReadOnlyField(source='group.name')
    
    # Hammasini read_only qilamiz, shunda selection fieldlar yo'qoladi
    student = serializers.PrimaryKeyRelatedField(read_only=True)
    group = serializers.PrimaryKeyRelatedField(read_only=True)
    month = serializers.DateField(required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    marked_by = serializers.StringRelatedField(read_only=True)
    
    # Yangi maydonlar: Darslar soni, kunlik narxi va refund hisobi
    lessons_count = serializers.SerializerMethodField()
    daily_price = serializers.SerializerMethodField()
    absences_count = serializers.SerializerMethodField()
    refund_amount = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'student', 'student_name', 'group', 'group_name', 
            'month', 'amount', 'is_paid', 'paid_at', 'marked_by',
            'lessons_count', 'daily_price', 'absences_count', 'refund_amount',
            'refund_ignored'
        ]

    def get_lessons_count(self, obj):
        if not obj.group or not obj.month: return 0
        return len(obj.group.get_lesson_dates(obj.month.year, obj.month.month))

    def get_daily_price(self, obj):
        if not obj.group or not obj.month: return 0
        return obj.group.get_daily_price(obj.month.year, obj.month.month)

    def get_absences_count(self, obj):
        if not obj.student or not obj.month: return 0
        return obj.student.get_absences_count(obj.month.year, obj.month.month)

    def get_refund_amount(self, obj):
        if not obj.student or not obj.month: return 0
        return obj.student.calculate_refund_amount(obj.month.year, obj.month.month)

from groups.models import Group

class EmployeePaymentSerializer(serializers.ModelSerializer):
    # Employee ma'lumotlari (read-only)
    employee_first_name = serializers.CharField(source='employee.first_name', read_only=True)
    employee_last_name = serializers.CharField(source='employee.last_name', read_only=True)
    employee_id = serializers.IntegerField(source='employee.id', read_only=True)
    employee_role = serializers.CharField(source='employee.role', read_only=True)
    employee_branch = serializers.SerializerMethodField()  # ✅ TUZATILDI
    karta = serializers.SerializerMethodField()  # ✅ TUZATILDI
    
    # Yangi fieldlar (StaffProfile dan)
    salary_type = serializers.SerializerMethodField()  # ✅ TUZATILDI
    fixed_salary = serializers.SerializerMethodField()  # ✅ TUZATILDI
    commission_percentage = serializers.SerializerMethodField()  # ✅ TUZATILDI
    
    # ✅ QO'SHIMCHA FIELD: Mentor guruhlari daromadi
    groups_income = serializers.SerializerMethodField()
    calculated_commission = serializers.SerializerMethodField()
    mentor_groups = serializers.SerializerMethodField() # ✅ QO'SHILDI
    
    class Meta:
        model = EmployeePayment
        fields = [
            'id', 
            'employee_id', 
            'employee_first_name',
            'employee_last_name',
            'employee_role', 
            'employee_branch',
            'month', 
            'salary_base',
            'bonus',
            'deductions', 
            'total_amount',
            'karta',
            'salary_type',
            'fixed_salary',
            'commission_percentage',
            'groups_income',           # ✅ QO'SHILDI
            'calculated_commission',    # ✅ QO'SHILDI
            'mentor_groups',            # ✅ QO'SHILDI (Guruhlar tafsiloti)
            'is_paid', 
            'paid_at', 
            'marked_by'
        ]
        read_only_fields = [
            'id', 
            'employee_id', 
            'total_amount', 
            'paid_at', 
            'marked_by'
        ]
    
    def get_employee_branch(self, obj):
        """Employee branch ID ni xavfsiz olish"""
        try:
            return obj.employee.branch.id if obj.employee.branch else None
        except:
            return None
    
    def get_karta(self, obj):
        """Karta raqamini xavfsiz olish"""
        try:
            return obj.employee.staff_profile.karta if hasattr(obj.employee, 'staff_profile') else None
        except:
            return None
    
    def get_salary_type(self, obj):
        """Salary type ni xavfsiz olish"""
        try:
            return obj.employee.staff_profile.salary_type if hasattr(obj.employee, 'staff_profile') else None
        except:
            return None
    
    def get_fixed_salary(self, obj):
        """Fixed salary ni xavfsiz olish"""
        try:
            if hasattr(obj.employee, 'staff_profile'):
                return float(obj.employee.staff_profile.fixed_salary)
            return None
        except:
            return None
    
    def get_commission_percentage(self, obj):
        """Commission percentage ni xavfsiz olish"""
        try:
            if hasattr(obj.employee, 'staff_profile'):
                return float(obj.employee.staff_profile.commission_percentage)
            return None
        except:
            return None
    
    def get_groups_income(self, obj):
        """Mentorning guruhlaridan tushgan daromad (floor qilingan)"""
        try:
            if obj.employee.role != 'mentor':
                return None
            if not hasattr(obj.employee, 'staff_profile'):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type != 'percentage':
                return None
            
            from finance.utils import floor_amount
            mentor_groups = Group.objects.filter(
                mentor=obj.employee,
                is_faol=True
            )
            if not mentor_groups.exists():
                return 0
            
            total_income = 0
            for group in mentor_groups:
                for student in group.students.all():
                    payment = Payment.objects.filter(
                        student=student,
                        group=group,
                        month__year=obj.month.year,
                        month__month=obj.month.month,
                        is_paid=True
                    ).first()
                    if payment:
                        total_income += float(payment.amount)
                    
                    if getattr(payment, 'refund_ignored', False):
                        refund = 0
                    else:
                        refund = float(student.calculate_refund_amount(obj.month.year, obj.month.month))
                    total_income -= refund

                    extra_txs = FinanceTransaction.objects.filter(
                        student=student,
                        group=group,
                        category='student_extra',
                        date__year=obj.month.year,
                        date__month=obj.month.month
                    )
                    for tx in extra_txs:
                        if tx.transaction_type == 'income':
                            total_income += float(tx.amount)
                        else:
                            total_income -= float(tx.amount)
            
            return int(floor_amount(total_income))
            
        except Exception as e:
            print(f"groups_income hisoblashda xato: {e}")
            return None
    
    def get_calculated_commission(self, obj):
        """Hisoblangan komissiya — floor qilingan"""
        try:
            from finance.utils import floor_amount
            groups_income = self.get_groups_income(obj)
            if groups_income is None:
                return None
            try:
                profile = obj.employee.staff_profile
                commission_percentage = float(profile.commission_percentage)
            except:
                return None
            calculated = float(groups_income) * (commission_percentage / 100)
            return int(floor_amount(calculated))
        except Exception as e:
            print(f"calculated_commission hisoblashda xato: {e}")
            return None
    
    def get_mentor_groups(self, obj):
        """Mentorning guruhlari ro'yxati (floor qilingan summalar)"""
        try:
            if obj.employee.role != 'mentor':
                return None
            from finance.utils import floor_amount
            mentor_groups = Group.objects.filter(
                mentor=obj.employee,
                is_faol=True
            ).select_related('branch')
            
            groups_data = []
            for group in mentor_groups:
                group_revenue = 0
                group_refunds = 0
                group_extra = 0
                
                for student in group.students.all():
                    payment = Payment.objects.filter(
                        student=student, 
                        group=group, 
                        month__year=obj.month.year, 
                        month__month=obj.month.month,
                        is_paid=True
                    ).first()
                    if payment:
                        group_revenue += float(payment.amount)
                    
                    if getattr(payment, 'refund_ignored', False):
                        refund = 0
                    else:
                        refund = float(student.calculate_refund_amount(obj.month.year, obj.month.month))
                    group_refunds += refund

                    extra_txs = FinanceTransaction.objects.filter(
                        student=student,
                        group=group,
                        category='student_extra',
                        date__year=obj.month.year,
                        date__month=obj.month.month
                    )
                    for tx in extra_txs:
                        if tx.transaction_type == 'income':
                            group_extra += float(tx.amount)
                        else:
                            group_extra -= float(tx.amount)

                net = group_revenue - group_refunds + group_extra
                groups_data.append({
                    'id': group.id,
                    'name': group.name,
                    'monthly_price': int(floor_amount(group.monthly_price or 0)),
                    'branch_name': group.branch.name if group.branch else None,
                    'students_count': group.students.count(),
                    'monthly_income': int(floor_amount(group_revenue)),
                    'refund_amount': int(floor_amount(group_refunds)),
                    'extra_income': int(floor_amount(group_extra)),
                    'real_income': int(floor_amount(net)),
                    'is_faol': group.is_faol
                })
            
            return groups_data
            
        except Exception as e:
            print(f"mentor_groups olishda xato: {e}")
            return None
        
class StaffProfileSerializer(serializers.ModelSerializer):
    # Foydalanuvchi ma'lumotlari (read-only)
    full_name = serializers.CharField(source='user.first_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    branch_name = serializers.CharField(source='user.branch.name', read_only=True)
    branch_id = serializers.IntegerField(source='user.branch.id', read_only=True)
    
    # Maosh ma'lumotini chiroyli ko'rsatish
    salary_display = serializers.CharField(source='get_salary_display', read_only=True)
    
    class Meta:
        model = StaffProfile
        fields = [
            'id', 
            'user', 
            'full_name', 
            'username', 
            'role', 
            'branch_id',
            'branch_name',
            'salary_type',
            'fixed_salary',
            'commission_percentage',
            'salary_display',
            'karta'
        ]
        # user va salary_type o'zgartirilmasligi kerak bo'lsa
        # read_only_fields = ['user']


# ========================= STATISTICS SECTION ==================================

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
    # Umumiy raqamlar
    total_income = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_debt = serializers.DecimalField(max_digits=15, decimal_places=2) # To'lanmagan o'quvchi pullari
    
    # Ro'yxatlar
    branches = BranchStatSerializer(many=True)
    top_groups = GroupStatSerializer(many=True)

class BranchFinanceDetailSerializer(serializers.Serializer):
    branch = serializers.DictField()
    stats = serializers.DictField()
    finance = serializers.DictField()
    groups = serializers.ListField()
    period = serializers.DictField()


from .models import FinanceTransaction

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

    def get_marked_by_name(self, obj):
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
