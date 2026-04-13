from rest_framework import serializers
from .models import Group, Student ,MentorGroupAssignment
from django.contrib.auth import get_user_model
from branches.serializers import BranchSerializer
from branches.models import Branch
from django.utils import timezone
from finance.models import Payment
User = get_user_model()

class GroupSimpleSerializer(serializers.ModelSerializer):
    students_count = serializers.SerializerMethodField()
    branch = BranchSerializer(read_only=True)
    today_attendance_confirmed = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ('id', 'name', 'is_faol', 'computed_status', 'color', 'subject','mentor','monthly_price','dars_kunlari','dars_vaqti','students_count','branch', 'today_attendance_confirmed')

    def get_today_attendance_confirmed(self, obj):
        from homework_attends.models import Attendance
        from django.utils import timezone
        return Attendance.objects.filter(group=obj, date=timezone.localdate(), marked_by__isnull=False).exists()

    def get_students_count(self, obj):
        # Faqat is_active=True bo'lgan o'quvchilarni sanaymiz
        return obj.enrollments.filter(is_active=True).count()


# Oddiy mentorlar ro'yxati uchun serializer
class MentorListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    accessible_branches = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'full_name', 'role', 'branch_id', 'accessible_branches')
    
    def get_full_name(self, obj):
        """To'liq ism-familiyani qaytaradi"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.username

    def get_accessible_branches(self, obj):
        """Mentorga ruxsat berilgan qo'shimcha filiallar ro'yxati"""
        try:
            accesses = obj.branch_accesses.all().select_related('branch')
            return [
                {
                    "id": acc.branch.id, 
                    "branch_name": acc.branch.name
                } for acc in accesses
            ]
        except Exception:
            return []
        
class MentorAssignmentSerializer(serializers.ModelSerializer):
    mentor_name = serializers.CharField(source='mentor.get_full_name', read_only=True)
    mentor_username = serializers.CharField(source='mentor.username', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = MentorGroupAssignment
        fields = ['id', 'mentor', 'mentor_name', 'mentor_username', 'assigned_at', 'assigned_by', 'assigned_by_name']
        read_only_fields = ['assigned_at', 'assigned_by', 'assigned_by_name']

class RemoveMentorSerializer(serializers.Serializer):
    mentor_id = serializers.IntegerField(help_text="Olib tashlanadigan mentorning ID raqami")

class AssignAdditionalMentorSerializer(serializers.Serializer):
    """Faqat bitta field — mentor tanlash uchun. Forma faqat shu chiqadi"""
    mentor = serializers.ChoiceField(choices=[], help_text="Mavjud mentorlardan birini tanlang")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Faqat mentorlarni olamiz
            mentor_qs = User.objects.filter(role='mentor')
            if request.user.role == 'admin':
                mentor_qs = mentor_qs.filter(branch=request.user.branch)

            # Har bir mentor uchun (id, display_name) juftligi
            choices = []
            for mentor in mentor_qs:
                display_name = mentor.get_full_name() or mentor.username
                choices.append((mentor.id, f"{display_name} (ID: {mentor.id})"))

            self.fields['mentor'].choices = choices

class StudentSerializer(serializers.ModelSerializer):
    group = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all(), allow_null=True)
    groups = GroupSimpleSerializer(many=True, read_only=True)
    # Yangi qo'shiladigan maydonlar
    current_payment_status = serializers.SerializerMethodField()
    current_payment_id = serializers.SerializerMethodField()
    create_payment = serializers.BooleanField(write_only=True, default=True)
    
    class Meta:
        model = Student
        fields = (
            'id', 'full_name', 'branch_id', 'group', 'groups', 'phone', 'birth_date', 
            'parent_name', 'parent_phone', 'address', 'notes', 'color', 'image',
            'joined_at', 'current_payment_status', 'current_payment_id',
            'telegram_id', 'parent_telegram_id', 'status', 'custom_fee', 'create_payment'
        )
        read_only_fields = ('joined_at',)

    def get_current_payment_status(self, obj):
        """O'quvchining shu oydagi to'lov holati (True/False)"""
        today = timezone.now().date()
        first_day_of_month = today.replace(day=1)
        
        # Payment modelidan shu o'quvchi va shu oyga tegishlisini qidiramiz
        payment = Payment.objects.filter(
            student=obj, 
            month=first_day_of_month
        ).first()
        
        return payment.is_paid if payment else False

    def get_current_payment_id(self, obj):
        """Frontend uchun to'lovni tasdiqlashda kerak bo'ladigan Payment ID"""
        today = timezone.now().date()
        first_day_of_month = today.replace(day=1)
        
        payment = Payment.objects.filter(
            student=obj, 
            month=first_day_of_month
        ).first()
        
        return payment.id if payment else None
    
    def create(self, validated_data):
        from django.db import transaction
        from .models import GroupEnrollment
        from finance.models import Payment
        from django.utils import timezone

        request = self.context.get('request')
        group = validated_data.get('group')
        create_payment = validated_data.pop('create_payment', True)
        
        # Branch aniqlash
        branch = validated_data.get('branch')
        if not branch and request and hasattr(request.user, 'branch'):
            branch = request.user.branch
        if not branch and group:
            branch = group.branch

        with transaction.atomic():
            # 1. Studentni yaratish
            student = Student.objects.create(branch=branch, **validated_data)

            # 2. Agar guruh tanlangan bo'lsa, M2M bog'liqlikni yaratish
            if group:
                from .models import GroupEnrollment
                from .utils import get_lessons_in_month
                from decimal import Decimal

                GroupEnrollment.objects.get_or_create(
                    student=student,
                    group=group
                )

                # 3. Pro-rated to'lov varaqasini yaratish (SHARTLI)
                if create_payment:
                    today = timezone.now().date()
                    month_start = today.replace(day=1)
                    
                    # Oydagi barcha va qolgan darslarni hisoblash
                    all_lessons = get_lessons_in_month(group.days, today.year, today.month)
                    remaining_lessons = [l for l in all_lessons if l >= today]
                    
                    # Asosiy narxni aniqlash
                    base_price = Decimal(str(student.custom_fee if student.custom_fee else group.monthly_price))
                    
                    if all_lessons:
                        # Bir dars narxi = Oylik to'lov / Jami darslar
                        price_per_lesson = base_price / Decimal(len(all_lessons))
                        # To'lov summasi = Bir dars narxi * Qolgan darslar
                        pro_rated_amount = price_per_lesson * Decimal(len(remaining_lessons))
                    else:
                        pro_rated_amount = base_price

                    Payment.objects.get_or_create(
                        student=student,
                        group=group,
                        month=month_start,
                        defaults={
                            'amount': pro_rated_amount.quantize(Decimal('0.01')),
                            'is_paid': False
                        }
                    )

            return student
# serializers.py

class GroupShortSerializer(serializers.ModelSerializer):
    # Bu serializer guruhning faqat kerakli qismlarini qaytaradi
    branch_name = serializers.ReadOnlyField(source='branch.name')
    today_attendance_confirmed = serializers.SerializerMethodField()

    class Meta:
        model = Group  # Sizning guruh modelingiz nomi
        fields = (
            'id', 
            'name', 
            'subject', 
            'dars_kunlari', 
            'dars_vaqti', 
            'students_count', 
            'branch_name',
            'branch_id', # Frontendda filterlash uchun kerak
            'today_attendance_confirmed'
        )

    def get_today_attendance_confirmed(self, obj):
        from homework_attends.models import Attendance
        from django.utils import timezone
        return Attendance.objects.filter(group=obj, date=timezone.localdate(), marked_by__isnull=False).exists()
class MentorNestedSerializer(serializers.ModelSerializer):
    # Branch ob'ektini to'liq ko'rinishi
    branch = BranchSerializer(read_only=True) 
    
    # Branch ID sini boshqarish
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        source='branch',
        required=True,
        allow_null=True
    )
    
    # Yangi maydonlar
    accessible_branches = serializers.SerializerMethodField()
    mentor_groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name', 'last_name', 'subject', 
            'phone_number', 'is_active', 'role', 'branch', 'branch_id', 
            'accessible_branches', 'mentor_groups'
        )

    def get_accessible_branches(self, obj):
        """Mentorga ruxsat berilgan qo'shimcha filiallar ro'yxati"""
        try:
            # related_name='branch_accesses' ekanligiga ishonch hosil qiling
            accesses = obj.branch_accesses.all().select_related('branch')
            return [
                {
                    "id": acc.branch.id, 
                    "branch_name": acc.branch.name
                } for acc in accesses
            ]
        except Exception:
            return []

    def get_mentor_groups(self, obj):
        """Guruhlarni birlashtirish va branch_id bo'yicha filterlash"""
        request = self.context.get('request')
        # URL orqali kelgan branch_id (?branch_id=1)
        active_branch_id = request.query_params.get('branch_id') if request else None

        # 1. Mentor asosiy mentor bo'lgan guruhlar
        main_groups = obj.mentor_groups.all()

        # 2. Mentor yordamchi/qo'shimcha mentor bo'lgan guruhlar
        # (Model nomingizga qarab filterlang, masalan: additional_mentors__mentor=obj)
        additional_groups = Group.objects.filter(additional_mentors__mentor=obj)

        # 3. Ikkala turdagi guruhlarni birlashtiramiz
        all_groups = (main_groups | additional_groups).distinct()

        # 4. Filterlash logikasi
        if active_branch_id:
            try:
                all_groups = all_groups.filter(branch_id=int(active_branch_id))
            except ValueError:
                pass
        else:
            # Agar branch_id kelmasa, faqat mentorning o'z branchiga tegishli guruhlar
            all_groups = all_groups.filter(branch_id=obj.branch_id)

        # 5. Natijani qaytarish (Sizda bor bo'lgan GroupSimpleSerializer orqali)
        return GroupSimpleSerializer(all_groups, many=True, context=self.context).data
    
class AdminNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name')

class GroupNestedSerializer(serializers.ModelSerializer):
    mentor = MentorNestedSerializer(read_only=True)
    admin = AdminNestedSerializer(read_only=True)

    class Meta:
        model = Group
        fields = ('id', 'name', 'subject','monthly_price', 'mentor', 'admin', 'is_faol')

class StudentNestedSerializer(serializers.ModelSerializer):
    group = GroupNestedSerializer(read_only=True)
    groups = GroupNestedSerializer(many=True, read_only=True)
    branch_id = serializers.IntegerField(source='group.branch.id', read_only=True)
    class Meta:
        model = Student
        fields = (
            'id', 'group', 'groups', 'full_name', 'branch_id', 'phone', 'birth_date',
            'parent_name', 'parent_phone', 'address', 'image', 'color', 'notes', 
            'telegram_id', 'parent_telegram_id', 'status', 'custom_fee', 'joined_at'
        )
        read_only_fields = ('joined_at',)

from django.db.models import Q
class GroupSerializer(serializers.ModelSerializer):
    mentor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='mentor'),
        source='mentor',
        required=False,
        allow_null=True
    )
    additional_mentors = MentorAssignmentSerializer(many=True, read_only=True)
    mentor = MentorNestedSerializer(read_only=True)
    admin = AdminNestedSerializer(read_only=True)
    students_count = serializers.SerializerMethodField()
    students = serializers.SerializerMethodField()
    branch = BranchSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        source='branch',
        required=True,
        allow_null=True,
        write_only=True
    )
    today_attendance_confirmed = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            'id', 'name', 'monthly_price', 'branch', 'branch_id', 'days',
            'dars_kunlari', 'dars_vaqti', 'subject',
            'mentor', 'mentor_id', 'color',
            'admin', 'start_date', 'computed_status',
            'description', 'created_at',
            'students_count', 'students', 'additional_mentors', 'today_attendance_confirmed'
        )
        read_only_fields = ('created_at', 'students_count')

    def get_students_count(self, obj):
        # Faqat is_active=True bo'lgan o'quvchilarni sanaymiz
        return obj.enrollments.filter(is_active=True).count()

    def get_students(self, obj):
        """
        N+1 muammosini bartaraf etish: barcha to'lov ma'lumotlarini bitta so'rovda olamiz.
        """
        from django.utils import timezone
        from finance.models import Payment
        from django.db.models import Q

        students_qs = obj.students.select_related('group', 'branch').all()
        today = timezone.now().date()
        month_start = today.replace(day=1)

        # Barcha studentlar uchun ushbu oydagi to'lovlarni BITTA so'rovda olamiz
        student_ids = list(students_qs.values_list('id', flat=True))
        payments = Payment.objects.filter(
            student_id__in=student_ids,
            month=month_start
        ).values('student_id', 'id', 'is_paid')

        # To'lovlarni dict ga aylantiramiz: {student_id: {id, is_paid}}
        payment_map = {p['student_id']: p for p in payments}

        result = []
        for student in students_qs:
            payment_info = payment_map.get(student.id)
            result.append({
                'id': student.id,
                'full_name': student.full_name,
                'phone': student.phone,
                'parent_phone': student.parent_phone,
                'image': student.image.url if student.image else None,
                'color': student.color,
                'status': student.status,
                'custom_fee': student.custom_fee,
                'telegram_id': student.telegram_id,
                'parent_telegram_id': student.parent_telegram_id,
                'current_payment_status': payment_info['is_paid'] if payment_info else False,
                'current_payment_id': payment_info['id'] if payment_info else None,
            })
        return result

    def get_today_attendance_confirmed(self, obj):
        from homework_attends.models import Attendance
        from django.utils import timezone
        return Attendance.objects.filter(group=obj, date=timezone.localdate(), marked_by__isnull=False).exists()
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if not (request and request.user.is_authenticated): return
        
        user = request.user
        from authenticatsiya.models import BranchAccess

        # MUVOZANATNI SAQLASH: Admin uchun mentorlar ro'yxatini kengaytiramiz
        if user.role == 'admin':
            # Admin boshqara oladigan branchlar
            allowed_b_ids = [user.branch_id] + list(BranchAccess.objects.filter(user=user).values_list('branch_id', flat=True))
            
            # Mentor 11-ID ni topa olishi uchun querysetni shunday quramiz:
            # Mentor yo shu branchlarning birida asosiysi bo'lishi kerak, 
            # yoki shu branchlarning biriga access'i bo'lishi kerak.
            from django.db.models import Q
            self.fields['mentor_id'].queryset = User.objects.filter(
                Q(role='mentor') & (
                    Q(branch_id__in=allowed_b_ids) | 
                    Q(branch_accesses__branch_id__in=allowed_b_ids)
                )
            ).distinct()
        
        elif user.role == 'super_admin':
            self.fields['mentor_id'].queryset = User.objects.filter(role='mentor')

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user
        from authenticatsiya.models import BranchAccess

        # Mentor va Branch ob'ektlarini aniqlaymiz (PUT/POST uchun)
        mentor = attrs.get('mentor') or (self.instance.mentor if self.instance else None)
        requested_branch = attrs.get('branch') or (self.instance.branch if self.instance else None)

        if user.role == 'admin':
            # Admin boshqara oladigan branchlar
            admin_allowed_ids = [user.branch_id] + list(BranchAccess.objects.filter(user=user).values_list('branch_id', flat=True))

            # a) Branch tekshiruvi (O'zgarishsiz)
            if requested_branch and requested_branch.id not in admin_allowed_ids:
                raise serializers.ValidationError({"branch_id": "Siz bu filialda guruh boshqara olmaysiz."})

            # b) Mentor tekshiruvi (YANGI MANTIQ - Muvozanat uchun)
            if mentor and requested_branch:
                # Mentor shu tanlangan branchga tegishlimi (Asosiy yoki Access)?
                mentor_can_work = (mentor.branch_id == requested_branch.id) or \
                                  BranchAccess.objects.filter(user=mentor, branch=requested_branch).exists()

                if not mentor_can_work:
                    raise serializers.ValidationError({
                        "mentor_id": f"Mentor {mentor.first_name} ushbu filialga ({requested_branch.name}) biriktirilmagan."
                    })
        return attrs

class MentorSerializer(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        required=True,
        allow_null=True,
        source='branch' # Model dagi branch maydoniga bog'laymiz
    )
    # Yangi maydon
    accessible_branches = serializers.SerializerMethodField()
    # Guruhlar metod orqali olinadi
    mentor_groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name','color','image','last_name','subject', 
            'phone_number', 'is_active', 'role', 'branch', 'branch_id', 
            'accessible_branches', 'mentor_groups'
        )

    def get_accessible_branches(self, obj):
        """Faqat qo'shimcha ruxsat berilgan branchlarni qaytaradi"""
        # related_name='branch_accesses' ekanligiga ishonch hosil qiling
        accesses = obj.branch_accesses.all().select_related('branch')
        return [
            {
                "id": acc.branch.id, 
                "branch_name": acc.branch.name
            } for acc in accesses
        ]

    def get_mentor_groups(self, obj):
        """Guruhlarni birlashtiradi va branch_id bo'yicha filterlaydi"""
        
        # 1. URL dan branch_id ni olamiz (?branch_id=...)
        request = self.context.get('request')
        active_branch_id = request.query_params.get('branch_id') if request else None

        # 2. Asosiy guruhlar (Group.mentor = user)
        main_groups = obj.mentor_groups.all()

        # 3. Qo‘shimcha guruhlar (MentorGroupAssignment orqali)
        additional_groups = Group.objects.filter(additional_mentors__mentor=obj)

        # 4. Birlashtiramiz
        all_groups = (main_groups | additional_groups).distinct()

        # 5. FILTERLASH LOGIKASI
        if active_branch_id:
            # Agar frontenddan branch_id kelgan bo'lsa, o'shani filterlaymiz
            all_groups = all_groups.filter(branch_id=active_branch_id)
        else:
            # Agar branch_id kelmasa, mentorning asosiy filialidagilarni ko'rsatamiz
            all_groups = all_groups.filter(branch_id=obj.branch_id)

        return GroupSimpleSerializer(all_groups, many=True, context=self.context).data
    
class AdminUserSerializers(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
    # Parolni faqat yozish uchun qo'shamiz
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'color','image', 'password', 'first_name', 'last_name', 'phone_number', 'role', 'branch')

    def create(self, validated_data):
        # Parolni ajratib olamiz
        password = validated_data.pop('password', None)
        # Foydalanuvchini yaratamiz
        user = super().create(validated_data)
        if password:
            user.set_password(password) # Shifrlab saqlash
            user.save()
        return user

    def update(self, instance, validated_data):
        # Parolni ajratib olamiz
        password = validated_data.pop('password', None)
        # Boshqa maydonlarni yangilaymiz
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password) # Yangi parolni shifrlab saqlash
            user.save()
        return user
from .models import GroupTransfer

class GroupTransferSerializer(serializers.ModelSerializer):
    from_group_name = serializers.CharField(source='from_group.name', read_only=True)
    to_group_name = serializers.CharField(source='to_group.name', read_only=True)
    marked_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupTransfer
        fields = (
            'id', 'from_group', 'from_group_name', 'to_group', 'to_group_name',
            'transfer_date', 'old_group_fee', 'new_group_fee', 'reason',
            'marked_by', 'marked_by_name', 'created_at'
        )

    def get_marked_by_name(self, obj):
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return "Tizim"
