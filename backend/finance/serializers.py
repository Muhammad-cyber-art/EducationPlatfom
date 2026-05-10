from rest_framework import serializers
from .models import Payment ,EmployeePayment, StaffProfile, EmployeeAdvance

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
            'refund_ignored', 'payment_method', 'receipt_image', 'is_receiptless', 'notes',
            'is_verified', 'verified_by', 'verified_at'
        ]

    def get_lessons_count(self, obj):
        if not obj.group or not obj.month: return 0
        return len(obj.group.get_lesson_dates(obj.month.year, obj.month.month))

    def get_daily_price(self, obj):
        if not obj.group or not obj.month: return 0
        return obj.group.get_daily_price(obj.month.year, obj.month.month)

    def get_absences_count(self, obj):
        if not obj.student or not obj.month:
            return 0
        return obj.student.get_absences_count(
            obj.month.year, obj.month.month, group=obj.group
        )

    def get_refund_amount(self, obj):
        if not obj.student or not obj.month:
            return 0
        return obj.student.calculate_refund_amount(
            obj.month.year, obj.month.month, group=obj.group
        )

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
    per_student_amount = serializers.SerializerMethodField()
    
    # ✅ QO'SHIMCHA FIELD: Mentor guruhlari daromadi
    groups_income = serializers.SerializerMethodField()
    calculated_commission = serializers.SerializerMethodField()
    calculated_per_student = serializers.SerializerMethodField()
    mentor_groups = serializers.SerializerMethodField() # ✅ QO'SHILDI
    attendance_based_salary = serializers.SerializerMethodField() # ✅ Yangi: Davomat asosidagi mentor oyligi
    total_advances = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    advances_history = serializers.SerializerMethodField()
    payment_history = serializers.SerializerMethodField()  # ✅ QO'SHILDI
    
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
            'per_student_amount',
            'groups_income',           # ✅ QO'SHILDI
            'calculated_commission',    # ✅ QO'SHILDI
            'calculated_per_student',   # ✅ QO'SHILDI
            'mentor_groups',            # ✅ QO'SHILDI (Guruhlar tafsiloti)
            'attendance_based_salary',        # ✅ QO'SHILDI - Yangi: Davomat asosidagi mentor oyligi
            'total_advances',           # ✅ QO'SHILDI
            'advances_history',         # ✅ QO'SHILDI
            'payment_history',          # ✅ QO'SHILDI (O'tgan oylar tarixi)
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

    def get_per_student_amount(self, obj):
        """Per student amount ni xavfsiz olish"""
        try:
            if hasattr(obj.employee, 'staff_profile'):
                return float(obj.employee.staff_profile.per_student_amount)
            return None
        except:
            return None
    
    def get_groups_income(self, obj):
        """Xodimga tegishli (mentor uchun o'zining, admin uchun filiali) guruhlardan tushgan sof tushum"""
        try:
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return 0
            from finance.utils import floor_amount
            profile = obj.employee.staff_profile
            # calculate_monthly_income metodini chaqiramiz (u role-ga qarab o'zi filtrlaydi)
            inc = profile.calculate_monthly_income(obj.month)
            return int(floor_amount(inc))
        except Exception as e:
            print(f"groups_income hisoblashda xato: {e}")
            return 0
    
    def get_calculated_commission(self, obj):
        """Foizli maosh — brutto tushumdan foiz (davomat jarimalari yo'q)."""
        try:
            from finance.utils import floor_amount
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type != 'percentage':
                return None
            sal = profile.calculate_salary_for_month(obj.month)
            return int(floor_amount(sal))
        except Exception as e:
            print(f"calculated_commission hisoblashda xato: {e}")
            return None
    def get_attendance_based_salary(self, obj):
        """Davomat asosidagi mentor oyligini hisoblash"""
        try:
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return None
            
            profile = obj.employee.staff_profile
            salary, details = profile.calculate_attendance_based_salary(obj.month)
            
            return {
                'salary': int(salary),
                'details': details
            }
        except Exception as e:
            print(f"attendance_based_salary hisoblashda xato: {e}")
            import traceback
            traceback.print_exc()
            return None


    def get_calculated_per_student(self, obj):
        """Har bir o'quvchi ulushi — model hisobi (brutto, davomat jarimalari yo'q)."""
        try:
            from finance.utils import floor_amount
            if not obj.month or not hasattr(obj.employee, 'staff_profile'):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type != 'student_count':
                return None
            sal = profile.calculate_salary_for_month(obj.month)
            return int(floor_amount(sal))
        except Exception as e:
            print(f"calculated_per_student hisoblashda xato: {e}")
            return None
    
    def get_mentor_groups(self, obj):
        """Xodimga tegishli guruhlar ro'yxati (Mentor uchun o'ziniki, Admin uchun filiali)"""
        try:
            if not obj.month:
                return None
            
            from finance.utils import floor_amount
            from decimal import Decimal
            
            # Guruhlarni aniqlash
            if obj.employee.role == 'mentor':
                groups_qs = Group.objects.filter(mentor=obj.employee)
            elif obj.employee.role == 'admin' and obj.employee.branch:
                groups_qs = Group.objects.filter(branch=obj.employee.branch)
            else:
                # Boshqa rollar uchun (masalan super_admin biror filialda bo'lsa)
                if hasattr(obj.employee, 'branch') and obj.employee.branch:
                    groups_qs = Group.objects.filter(branch=obj.employee.branch)
                else:
                    return None

            mentor_groups = groups_qs.select_related('branch').prefetch_related('students')
            
            groups_data = []
            per_student_amount = Decimal('0')
            if hasattr(obj.employee, 'staff_profile'):
                per_student_amount = Decimal(str(obj.employee.staff_profile.per_student_amount or 0))

            for group in mentor_groups:
                group_revenue = 0
                group_refunds = 0
                group_extra = 0
                expected_income = 0
                expected_students_count = group.students.count()
                paid_students_count = 0
                
                unpaid_students = []
                paid_students = []
                for student in group.students.all():
                    month_payment = Payment.objects.filter(
                        student=student,
                        group=group,
                        month__year=obj.month.year,
                        month__month=obj.month.month
                    ).first()

                    expected_payment = student.custom_fee if student.custom_fee is not None else group.monthly_price
                    actual_payment = float(month_payment.amount) if month_payment and month_payment.is_paid else 0

                    # Moliyaviy holatni aniqlash
                    financial_status = student.status
                    financial_status_label = {
                        'regular': 'Oddiy',
                        'discount': 'Imtiyozli',
                        'low_income': 'Kam ta\'minlangan',
                        'negotiated': 'Kelishilgan narx'
                    }.get(student.status, 'Oddiy')

                    # To'lov sanasi va usuli
                    paid_at = month_payment.paid_at.strftime('%Y-%m-%d %H:%M') if month_payment and month_payment.paid_at else None
                    payment_method = month_payment.get_payment_method_display() if month_payment else None

                    # Kelishilgan narx ma'lumotlari
                    negotiated_price = int(floor_amount(student.custom_fee)) if student.custom_fee is not None else None
                    original_price = int(floor_amount(group.monthly_price))

                    if month_payment:
                        expected_income += float(month_payment.amount or 0)
                        if month_payment.is_paid:
                            group_revenue += float(month_payment.amount)
                            paid_students_count += 1
                            # Refund ma'lumotini hisoblash
                            refund_amount = 0
                            if month_payment.month and not month_payment.refund_ignored:
                                refund_amount = student.calculate_refund_amount(
                                    month_payment.month.year,
                                    month_payment.month.month,
                                    group=group
                                )
                            paid_students.append({
                                'id': student.id,
                                'name': student.full_name,
                                'expected': int(floor_amount(expected_payment)),
                                'actual': int(floor_amount(month_payment.amount)),
                                'status': 'To\'langan',
                                'financial_status': financial_status,
                                'financial_status_label': financial_status_label,
                                'paid_at': paid_at,
                                'payment_method': payment_method,
                                'negotiated_price': negotiated_price,
                                'original_price': original_price,
                                'refund_amount': int(floor_amount(refund_amount)),
                                'refund_ignored': month_payment.refund_ignored
                            })
                        else:
                            unpaid_students.append({
                                'id': student.id,
                                'name': student.full_name,
                                'expected': int(floor_amount(month_payment.amount or 0)),
                                'actual': 0,
                                'status': 'To\'lanmagan',
                                'financial_status': financial_status,
                                'financial_status_label': financial_status_label,
                                'paid_at': paid_at,
                                'payment_method': payment_method,
                                'negotiated_price': negotiated_price,
                                'original_price': original_price
                            })
                    else:
                        expected_income += float(floor_amount(expected_payment))
                        unpaid_students.append({
                            'id': student.id,
                            'name': student.full_name,
                            'expected': int(floor_amount(expected_payment)),
                            'actual': 0,
                            'status': 'Kutilmoqda',
                            'financial_status': financial_status,
                            'financial_status_label': financial_status_label,
                            'paid_at': paid_at,
                            'payment_method': payment_method,
                            'negotiated_price': negotiated_price,
                            'original_price': original_price
                        })

                    if getattr(month_payment, 'refund_ignored', False):
                        refund = 0
                    else:
                        refund = float(
                            student.calculate_refund_amount(
                                obj.month.year, obj.month.month, group=group
                            )
                        )
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
                
                # Yangi logika: har bir o'quvchi uchun alohida min(to'lov, ulush) ni hisoblaymiz
                mentor_share_paid_total = Decimal('0')
                mentor_share_expected_total = Decimal('0')
                
                for student in group.students.all():
                    # Expected share
                    st_expected_price = student.custom_fee if student.custom_fee is not None else group.monthly_price
                    mentor_share_expected_total += min(Decimal(str(st_expected_price)), per_student_amount)
                    
                    # Paid share
                    payment = Payment.objects.filter(
                        student=student, group=group, 
                        month__year=obj.month.year, month__month=obj.month.month,
                        is_paid=True
                    ).first()
                    if payment:
                        mentor_share_paid_total += min(Decimal(str(payment.amount)), per_student_amount)

                groups_data.append({
                    'id': group.id,
                    'name': group.name,
                    'monthly_price': int(floor_amount(group.monthly_price or 0)),
                    'branch_name': group.branch.name if group.branch else None,
                    'students_count': group.students.count(),
                    'paid_students_count': paid_students_count,
                    'monthly_income': int(floor_amount(group_revenue)),
                    'expected_income': int(floor_amount(expected_income)),
                    'refund_amount': int(floor_amount(group_refunds)),
                    'extra_income': int(floor_amount(group_extra)),
                    'real_income': int(floor_amount(net)),
                    'mentor_share_paid': int(floor_amount(mentor_share_paid_total)),
                    'mentor_share_expected': int(floor_amount(mentor_share_expected_total)),
                    'unpaid_students': unpaid_students[:15],
                    'paid_students': paid_students[:15],
                    'is_faol': group.is_faol
                })
            
            return groups_data
            
        except Exception as e:
            print(f"mentor_groups olishda xato: {e}")
            return None

    def get_advances_history(self, obj):
        """
        Ushbu oy uchun berilgan barcha avanslar + carry-overlar.
        User talabiga ko'ra: to'langan bo'lsa ham barcha avanslar ko'rinishi kerak.
        """
        from .models import EmployeeAdvance, EmployeePayment
        from django.db.models import Q
        
        # 1. Ushbu oyga biriktirilgan BARCHA avanslar (to'langan-to'lanmaganidan qat'iy nazar)
        main_query = Q(employee=obj.employee, month=obj.month)
        
        # 2. Agar bu oy hali to'lanmagan bo'lsa, o'tgan oylardan 'kechikkan' avanslarni ham qo'shamiz
        if not obj.is_paid:
            last_paid = EmployeePayment.objects.filter(
                employee=obj.employee, 
                month__lt=obj.month,
                is_paid=True
            ).order_by('-month').first()
            
            if last_paid:
                main_query |= Q(employee=obj.employee, month__lt=obj.month, created_at__gt=last_paid.paid_at)
            else:
                main_query |= Q(employee=obj.employee, month__lt=obj.month)
        else:
            # Agar bu oy to'langan bo'lsa, uning total_amount iga ta'sir qilgan 
            # o'tgan oylardagi 'kechikkan' avanslarni ham tarixda ko'rsatishimiz kerak
            # (chunki ular shu oy to'lovidan ayrilgan)
            prev_paid = EmployeePayment.objects.filter(
                employee=obj.employee, 
                month__lt=obj.month,
                is_paid=True
            ).order_by('-month').first()
            
            if prev_paid:
                # O'tgan to'lov va joriy to'lov oralig'ida yaratilgan barcha eski oylik avanslar
                main_query |= Q(
                    employee=obj.employee, 
                    month__lt=obj.month, 
                    created_at__gt=prev_paid.paid_at,
                    created_at__lte=obj.paid_at
                )
            else:
                main_query |= Q(
                    employee=obj.employee, 
                    month__lt=obj.month, 
                    created_at__lte=obj.paid_at
                )

        qs = EmployeeAdvance.objects.filter(main_query).distinct().order_by('-created_at')
        return EmployeeAdvanceSerializer(qs, many=True).data

    def get_total_advances(self, obj):
        """Ushbu oy uchun berilgan jami avanslar (model property-dan foydalanamiz)"""
        return float(obj.total_advances)

    def get_payment_history(self, obj):
        """Xodimning barcha (o'tgan va joriy) to'lovlari tarixi"""
        from .models import EmployeePayment
        # Joriy paymentdan tashqari barcha paymentlarni qaytaramiz (yoki hammasini)
        history = EmployeePayment.objects.filter(
            employee=obj.employee
        ).order_by('-month', '-id')
        
        # Cheksiz rekursiyani oldini olish uchun oddiyroq ma'lumot qaytaramiz yoki limitlaymiz
        return [{
            'id': p.id,
            'month': p.month,
            'salary_base': float(p.salary_base),
            'bonus': float(p.bonus),
            'deductions': float(p.deductions),
            'total_amount': float(p.total_amount),
            'is_paid': p.is_paid,
            'paid_at': p.paid_at
        } for p in history]

class StaffProfileSerializer(serializers.ModelSerializer):
    # Foydalanuvchi ma'lumotlari (read-only)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    branch_name = serializers.CharField(source='user.branch.name', read_only=True)
    branch_id = serializers.IntegerField(source='user.branch.id', read_only=True)
    
    # Maosh ma'lumotini chiroyli ko'rsatish
    salary_display = serializers.CharField(source='get_salary_display', read_only=True)
    current_payment_id = serializers.SerializerMethodField()

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
            'per_student_amount',
            'salary_display',
            'karta',
            'current_payment_id'
        ]

    def get_current_payment_id(self, obj):
        from .models import EmployeePayment
        from django.utils import timezone
        current_month = timezone.now().date().replace(day=1)
        payment = EmployeePayment.objects.filter(employee=obj.user, month=current_month).first()
        return payment.id if payment else None
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

class EmployeeAdvanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.ReadOnlyField(source='employee.full_name')
    marked_by_name = serializers.ReadOnlyField(source='marked_by.full_name')
    
    class Meta:
        model = EmployeeAdvance
        fields = ['id', 'employee', 'employee_name', 'month', 'amount', 'description', 'date', 'marked_by', 'marked_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'marked_by']
