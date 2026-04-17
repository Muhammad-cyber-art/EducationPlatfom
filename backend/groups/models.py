from django.db import models
from django.contrib.auth import get_user_model
from branches.models import Branch
from django.core.validators import RegexValidator
from config.validators import validate_image_file
import datetime
from django.utils import timezone
User = get_user_model()
color_validator = RegexValidator(
    regex=r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
    message='Xato format! Rang #ffffff kabi bo\'lishi kerak.'
)

class Group(models.Model):
    # Yangi field uchun tanlovlar (choices)
    DAYS_TYPES = [
        ('odd', 'Toq kunlar'),
        ('even', 'Juft kunlar'),
        ('everyday', 'Har kuni'),
    ]
    color = models.CharField(max_length=7, default="#ffffff", validators=[color_validator])

    name = models.CharField(max_length=200)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='groups'
    )

    course_time = models.TextField(blank=True, null=True)

    mentor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        limit_choices_to={'role': 'mentor'},
        related_name='mentor_groups'
    )

    admin = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='admin_groups',
        limit_choices_to={'role__in': ['admin', 'super_admin']}
    )
    start_date = models.DateField(null=True, blank=True)
    
    # Eskisiga tegmadik
    dars_kunlari = models.CharField(max_length=50, blank=True, null=True) 
    
    # YANGI FIELD: Qisqa va tanlovli (selection)
    days = models.CharField(
        max_length=10, 
        choices=DAYS_TYPES, 
        default='odd',
        verbose_name="Dars kunlari turi",blank=True,null=True)

    dars_vaqti = models.CharField(max_length=20, blank=True, null=True)
    description = models.TextField(blank=True)
    is_faol = models.BooleanField(default=True)
    subject = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def get_lesson_dates(self, year, month):
        from .utils import get_lessons_in_month
        return get_lessons_in_month(self.days, year, month)

    def is_lesson_day(self, date_obj):
        from .utils import is_lesson_day
        return is_lesson_day(self.days, date_obj)

    def get_daily_price(self, year, month):
        from finance.utils import floor_amount
        lessons = self.get_lesson_dates(year, month)
        if not lessons:
            return 0
        return floor_amount(self.monthly_price / len(lessons))

    @property
    def computed_status(self):
        """
        Guruh holatini hisoblab beradi:
        - 'inactive': is_faol = False
        - 'waiting': is_faol = True va start_date > today
        - 'activating_soon': is_faol = True va today <= start_date <= today + 5 kun
        - 'active': is_faol = True va (start_date is None yoki start_date <= today)
        """
        if not self.is_faol:
            return 'inactive'
        
        if not self.start_date:
            return 'active'
            
        today = timezone.localdate()
        
        if self.start_date > today:
            # Agar 5 kun ichida boshlansa
            if self.start_date <= today + datetime.timedelta(days=5):
                return 'activating_soon'
            return 'waiting'
            
        return 'active'

    @property
    def is_currently_active(self):
        """
        Tizim logikasi uchun: Guruh haqiqatdan ham darslarni boshlaganmi?
        """
        return self.computed_status in ['active', 'activating_soon'] # 'activating_soon' dars boshlanishidan oldin ham ba'zi logikalar ishlashi kerak bo'lishi mumkin, lekin user "sana kelmaguncha faollashmasligi kerak" dedi.
        # Aslida user: "sana kelmaguncha faollashmasligi kerak" dedi. Shuning uchun faqat 'active' qaytaramiz.
    
    def is_logic_enabled(self):
        """
        Davomat va to'lovlar yaratilishi mumkinmi?
        """
        if not self.is_faol or not self.start_date:
            return self.is_faol
            
        return self.start_date <= timezone.localdate()

    def __str__(self):
        return f"{self.name} | Mentor: {self.mentor} | Kun: {self.get_days_display()}"

class Student(models.Model):
    branch = models.ForeignKey(
        Branch, 
        on_delete=models.CASCADE, 
        related_name='branch_students',
        null=True, blank=True # Avtomatik to'ldirilishi uchun boshida null ruxsat beramiz
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,null=True,blank=True,
        related_name='old_students_fk'
    )
    color = models.CharField(max_length=7, default="#ffffff", validators=[color_validator])
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    parent_name = models.CharField(max_length=200, blank=True)
    parent_phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(
        upload_to='students/', 
        null=True, 
        blank=True,
        validators=[validate_image_file]
    )
    telegram_id = models.CharField(max_length=20, blank=True, null=True, verbose_name="Student Telegram Chat ID")
    parent_telegram_id = models.CharField(max_length=20, blank=True, null=True, verbose_name="Parent Telegram Chat ID")

    # YANGI FIELDLAR: O'quvchi statusi va individual narxi
    STUDENT_STATUS = [
        ('regular', 'Oddiy'),
        ('discount', 'Imtiyozli'),
        ('low_income', 'Kam ta\'minlangan'),
        ('negotiated', 'Kelishilgan narx'),
    ]
    groups = models.ManyToManyField(
        Group, 
        through='GroupEnrollment', 
        related_name='students',
        verbose_name="O'quvchi guruhlari"
    )
    status = models.CharField(max_length=20, choices=STUDENT_STATUS, default='regular', verbose_name="O'quvchi holati")
    custom_fee = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True, 
        verbose_name="Individual narx",
        help_text="Agar o'quvchi guruh narxidan boshqa (masalan, kamroq) narxda o'qisa, shu yerga yozing."
    )

    def save(self, *args, **kwargs):
        # Agar guruh biriktirilgan bo'lsa va branch hali yo'q bo'lsa, 
        # branchni guruhdan olamiz
        if self.group and not self.branch:
            self.branch = self.group.branch
        
        is_new = self.pk is None
        super(Student, self).save(*args, **kwargs)

        # ✅ Task 1: M2M va Enrollment synchronization
        # Agar ForeignKey 'group' o'rnatilgan bo'lsa, Enrollment ham mavjudligiga ishonch hosil qilamiz
        if self.group:
            GroupEnrollment.objects.get_or_create(
                student=self,
                group=self.group,
                defaults={'is_active': True}
            )

    def get_absences_count(self, year, month, group=None):
        """O'quvchining berilgan oydagi qoldirgan darslari sonini qaytaradi"""
        target_group = group or self.group
        if not target_group:
            return 0
        lesson_dates = target_group.get_lesson_dates(year, month)
        return self.attendances.filter(
            date__year=year, 
            date__month=month, 
            date__in=lesson_dates,
            is_present=False
        ).count()

    def calculate_refund_amount(self, year, month, group=None):
        """
        Dars qoldirganlik uchun refund summasini hisoblash.
        Asosiy qoida: bir oyda darslar sonidan kelib chiqib kunlik narx aniqlanadi.
        Agar o'quvchi 4 tadan ko'p dars qoldirsa (absences > 4), 
        unda 4 tadan oshiqcha qoldirilgan har bir dars uchun pul qaytariladi (absences - 4).
        Natija har doim quyi butun songa yaxlitlanadi (floor).
        """
        from finance.utils import floor_amount
        target_group = group or self.group
        if not target_group: return 0
        
        absences = self.get_absences_count(year, month, group=target_group)
        if absences > 4:
            # O'quvchining individual narxi yoki guruhning umumiy narxi
            base_price = self.custom_fee if self.custom_fee is not None else target_group.monthly_price
            
            # Oydagi jami darslar soni (dam olish kunlarisiz)
            lessons_count = len(target_group.get_lesson_dates(year, month))
            
            if lessons_count > 0:
                # Bir kunlik dars narxi (floor)
                daily_price = floor_amount(base_price / lessons_count)
                
                # Faqat 4 tadan oshiqcha qoldirilgan darslar uchun refund beriladi
                # Natija ham floor qilinadi
                return floor_amount(daily_price * (absences - 4))
                
        return 0


    def __str__(self):
        group_name = self.group.name if self.group else "Guruhsiz"
        return f"{self.full_name} ({group_name})" 

class GroupEnrollment(models.Model):
    """
    O'quvchi va guruhni bog'lovchi oraliq jadval (Many-to-Many).
    Bu orqali bir o'quvchini bir nechta guruhga biriktirish mumkin.
    """
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='enrollments')
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    # Guruh uchun individual narx (agar student modelidagidan farq qilsa)
    # Hozircha Student modelidagi custom_fee ishlatiladi, lekin kelajakda guruh kesimida bo'lishi mumkin.

    class Meta:
        unique_together = ('student', 'group')
        verbose_name = "O'quvchi guruhga birikishi"
        verbose_name_plural = "O'quvchilar guruhga birikishi"

    def __str__(self):
        return f"{self.student.full_name} -> {self.group.name}"

class GroupTransfer(models.Model):
    """O'quvchining guruhdan guruhga o'tish tarixi va moliyaviy hisobi"""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transfers')
    from_group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='transfers_out')
    to_group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='transfers_in')
    
    transfer_date = models.DateField(default=timezone.now)
    
    # Moliyaviy snapshot
    old_group_fee = models.DecimalField(max_digits=10, decimal_places=2, help_text="Eski guruh uchun qolgan qarz/to'lov")
    new_group_fee = models.DecimalField(max_digits=10, decimal_places=2, help_text="Yangi guruh uchun boshlang'ich to'lov")
    
    reason = models.TextField(blank=True, null=True)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class MentorGroupAssignment(models.Model):
    """Qo‘shimcha mas'ul mentorlarni — asosiy mentor (Group.mentor) o‘zgarmaydi"""
    mentor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='additional_assigned_groups',
        limit_choices_to={'role': 'mentor'}
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='additional_mentors'
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_additional_mentors'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('mentor', 'group')
        verbose_name = "Qo‘shimcha mentor tayinlash"
        verbose_name_plural = "Qo‘shimcha mentorlar tayinlashlari"

    def __str__(self):
        return f"{self.mentor.get_full_name() or self.mentor.username} → {self.group.name} (qo‘shimcha)"
    

class WaitingStudent(models.Model):
    """Kutishlar zali - guruhga birikmagan, rejalashtirilgan o'quvchilar"""
    branch = models.ForeignKey(
        Branch, 
        on_delete=models.CASCADE, 
        related_name='waiting_students'
    )
    full_name = models.CharField(max_length=200, verbose_name="Ism Familiya")
    phone = models.CharField(max_length=20, verbose_name="Telefon")
    subject = models.CharField(max_length=100, blank=True, null=True, verbose_name="Qiziqqan fan")
    notes = models.TextField(blank=True, verbose_name="Izoh")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Kutayotgan o'quvchi"
        verbose_name_plural = "Kutayotgan o'quvchilar"

    def __str__(self):
        return f"{self.full_name} ({self.subject or 'Umumiy'})"
