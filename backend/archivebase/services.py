from datetime import date, datetime
from decimal import Decimal
from django.forms.models import model_to_dict
from django.db import transaction
from .models import ArchivedStudent, ArchivedStaff ,ArchivedGroup
from finance.models import Payment
import json
def json_serializable_convert(obj):
    """
    Sana, vaqt, Decimal va Django model ob'ektlarini 
    JSON tushunadigan formatga o'tkazuvchi yordamchi funksiya
    """
    from django.db.models.fields.files import FieldFile
    from django.db.models import Model, QuerySet
    from datetime import date, datetime
    from decimal import Decimal
    
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, FieldFile):
        return obj.name if obj else None
    if isinstance(obj, Model):
        # Model ob'ektini string ko'rinishida yoki ID sini qaytaramiz
        return str(obj)
    if isinstance(obj, QuerySet):
        return list(obj) # QuerySetni listga o'girib, qayta rekursiv chaqiramiz
    if isinstance(obj, dict):
        return {k: json_serializable_convert(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_serializable_convert(i) for i in obj]
    return obj

def serialize_related(queryset):
    """QuerySetni list[dict] ko'rinishiga o'tkazadi va sanalarni tozalaydi"""
    data_list = [model_to_dict(obj) for obj in queryset]
    return json_serializable_convert(data_list)

@transaction.atomic
def move_student_to_archive(student, archived_by, reason: str = "") -> ArchivedStudent:
    from groups.models import Student 
    
    # 1. Bog'liq ma'lumotlarni yig'ish
    from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
    
    payments = Payment.objects.filter(student=student)
    attendances = Attendance.objects.filter(student=student)
    submissions = HomeworkSubmission.objects.filter(student=student)
    mock_results = MockTestResult.objects.filter(student=student)
    
    # 2. Student ma'lumotlarini dict qilish va sanalarni tozalash
    student_data = model_to_dict(student)
    cleaned_student_data = json_serializable_convert(student_data)
    
    # Qo'shimcha ID larni qo'shish
    cleaned_student_data["branch_id"] = student.branch_id
    cleaned_student_data["group_id"] = student.group_id
    
    # 3. Bog'langan barcha o'quv ma'lumotlarini arxivga yig'amiz
    cleaned_student_data["payments"] = serialize_related(payments)
    cleaned_student_data["attendances"] = serialize_related(attendances)
    cleaned_student_data["submissions"] = serialize_related(submissions)
    cleaned_student_data["mock_results"] = serialize_related(mock_results)

    # 4. Arxiv yaratish
    archived = ArchivedStudent.objects.create(
        original_id=student.id,
        full_name=student.full_name,
        branch_name=getattr(student.branch, "name", "Noma'lum"),
        last_group_name=getattr(student.group, "name", "Guruhsiz"),
        archived_by=archived_by,
        reason=reason,
        metadata=cleaned_student_data,
    )

    # 5. O'chirish (Zanjirli o'chirish hamma bog'liqlarni tozalaydi)
    student.delete()

    return archived

@transaction.atomic
def move_student_to_waiting_hall(student, archived_by, reason: str = ""):
    """O'quvchini oxirgi guruhidan chiqarganda kutish zaliga o'tkazish"""
    from groups.models import WaitingStudent
    
    # 1. Arxivga saqlaymiz (Tarix yo'qolmasligi uchun)
    archived = move_student_to_archive(student, archived_by, reason)
    
    # 2. Kutish zalida yangi record ochamiz
    waiting = WaitingStudent.objects.create(
        full_name=student.full_name,
        phone=student.phone,
        branch=student.branch,
        notes=f"{reason} | Oldingi ID: {student.id}"
    )
    return waiting, archived

# move_staff_to_archive funksiyasida ham xuddi shunday cleaned_data ishlating
@transaction.atomic
def move_staff_to_archive(staff, archived_by, reason: str = "") -> ArchivedStaff:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # 1. Ma'lumotlarni yig'ish (faqat kerakli maydonlarni)
    staff_data = {
        "id": staff.id,
        "username": staff.username,
        "first_name": staff.first_name,
        "last_name": staff.last_name,
        "email": staff.email,
        "role": getattr(staff, 'role', 'mentor'),
        "phone_number": getattr(staff, "phone_number", ""),
        "date_joined": staff.date_joined.isoformat() if staff.date_joined else None,
        "branch": staff.branch_id, # Filtr ishlashi uchun branch ID
    }
    
    # 1.1 StaffProfile (To'lov ma'lumotlari) ni saqlash
    if hasattr(staff, 'staff_profile'):
        try:
            profile_data = model_to_dict(staff.staff_profile)
            # ID ni olib tashlaymiz, chunki tiklanganda yangi ID beriladi
            if 'id' in profile_data: del profile_data['id']
            if 'user' in profile_data: del profile_data['user']
            staff_data['staff_profile'] = json_serializable_convert(profile_data)
        except Exception:
            pass
    
    # Metadata uchun to'liq tozalangan ma'lumot
    cleaned_staff_data = json_serializable_convert(staff_data)
    
    # 2. Arxiv yaratish (O'chirishdan OLDIN)
    archived = ArchivedStaff.objects.create(
        original_id=staff.id,
        full_name=f"{staff.first_name} {staff.last_name}".strip() or staff.username,
        role=getattr(staff, 'role', 'mentor'),
        phone=getattr(staff, "phone_number", ""),
        branch_id=staff.branch.id if staff.branch else None,
        archived_by=archived_by,
        reason=reason,
        metadata=cleaned_staff_data,
    )

    # 3. O'chirish
    # Dastlab StaffProfile ni o'chiramiz (Signal ishlashi va Paymentlar arxivlanishi uchun)
    if hasattr(staff, 'staff_profile'):
        try:
            staff.staff_profile.delete()
        except Exception:
            pass # Profil bo'lmasa yoki xato bo'lsa, davom etamiz
            
    staff.delete()
    return archived
def send_to_archive(instance, request_user, reason: str = ""):
    from groups.models import Student
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if isinstance(instance, Student):
        return move_student_to_archive(instance, archived_by=request_user, reason=reason)
    
    if isinstance(instance, User):
        return move_staff_to_archive(instance, archived_by=request_user, reason=reason)
    
    raise ValueError(f"Archive qo'llab-quvvatlanmagan model: {type(instance).__name__}")


@transaction.atomic
def move_group_to_archive(group, archived_by, reason: str = "") -> ArchivedGroup:
    from groups.models import Group
    from finance.models import Payment
    
    # 1. Guruhdagi barcha o'quvchilarni tekshiramiz
    students = list(group.students.all())
    for student in students:
        # BIZNES LOGIKA: Agar talaba bir nechta guruhda o'qisa, bittasi o'chsa ham talaba qolishi kerak
        if student.groups.count() > 1:
            # Talabani shunchaki guruhdan chiqaramiz (Unenroll)
            from groups.models import GroupEnrollment
            GroupEnrollment.objects.filter(student=student, group=group).delete()
            
            # Agar legacy 'group' fieldi shu guruhga bog'langan bo'lsa, boshqasiga o'tkazamiz
            if student.group_id == group.id:
                next_group = student.groups.exclude(id=group.id).first()
                student.group = next_group
                student.save()
        else:
            # Talaba faqat shu guruhda bo'lsa, uni kutish zaliga o'tkazamiz
            # Bu funksiya ham arxivlaydi, ham kutish zaliga qo'shadi
            move_student_to_waiting_hall(student, archived_by, f"Guruh arxivlangani uchun: {reason}")

    # 2. DIQQAT: O'quvchilar arxivlangandan keyin ham guruhga bog'langan 
    # qandaydir to'lovlar qolgan bo'lsa (masalan, tizimda adashib qolganlari),
    # ularni ham metadata ichiga yig'ib olamiz va o'chiramiz.
    remaining_payments = Payment.objects.filter(group=group)
    payments_data = serialize_related(remaining_payments) # Metadata uchun saqlab qolamiz

    # 3. Guruh ma'lumotlarini snapshot qilish
    group_data = model_to_dict(group)
    group_data = json_serializable_convert(group_data)
    group_data["orphan_payments"] = payments_data # "Yetim" to'lovlarni ham saqlaymiz

    # 4. Arxiv yaratish
    archived_group = ArchivedGroup.objects.create(
        original_id=group.id,
        full_name=group.name,
        branch_name=getattr(group.branch, "name", "Noma'lum"),
        mentor_name=str(group.mentor) if group.mentor else "Ustozsiz",
        subject=group.subject,
        archived_by=archived_by,
        reason=reason,
        metadata=group_data,
    )

    # 5. Guruhni o'chirganimizda moliya ma'lumotlari (Payment) bazada qoladi (SET_NULL),
    # chunki guruh o'chirilishi haqiqiy to'lovlar tarixini yo'qotmasligi kerak.
    # Ular metadata ichida ham zaxira sifatida bor.
    pass 

    # 6. Endi guruhni o'chirsak, ProtectedError bermaydi
    group.delete()

    return archived_group

# ==================== RESTORE FUNCTIONS ====================

@transaction.atomic
def restore_student_from_archive(archived_student_id, restored_by):
    """
    Arxivlangan studentni qayta tiklash.
    Metadata dan barcha ma'lumotlarni olib, yangi Student obyekti yaratadi.
    """
    from groups.models import Student, Group, GroupEnrollment
    from branches.models import Branch
    from finance.models import Payment
    from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
    
    archived = ArchivedStudent.objects.get(id=archived_student_id)
    metadata = archived.metadata
    
    # 1. Branch va Group ni topish (ID kalitlari metadata ichida _id bilan saqlangan)
    branch_id = metadata.get('branch_id') or metadata.get('branch')
    branch = Branch.objects.filter(id=branch_id).first() if branch_id else None
    
    group_id = metadata.get('group_id') or metadata.get('group')
    group = Group.objects.filter(id=group_id).first() if group_id else None
    
    # 2. Studentni qayta yaratish
    student = Student.objects.create(
        full_name=archived.full_name,
        branch=branch,
        group=group,
        phone=metadata.get('phone', ''),
        birth_date=metadata.get('birth_date'),
        parent_name=metadata.get('parent_name', ''),
        parent_phone=metadata.get('parent_phone', ''),
        address=metadata.get('address', ''),
        notes=metadata.get('notes', ''),
        color=metadata.get('color', '#ffffff'),
    )

    # 3. Many-to-Many bog'liqlikni tiklash (Guruhga a'zolik)
    if group:
        GroupEnrollment.objects.get_or_create(student=student, group=group)
        
    # 4. Bog'langan ma'lumotlarni tiklash (Agar metadata ichida bo'lsa)
    # Eslatma: ID lar yangi yaratiladi, shuning uchun **data usulidan foydalanamiz
    
    # To'lovlar
    for pay_data in metadata.get('payments', []):
        if 'id' in pay_data: del pay_data['id']
        if 'student' in pay_data: del pay_data['student']
        Payment.objects.create(student=student, **pay_data)
        
    # Davomat
    for att_data in metadata.get('attendances', []):
        if 'id' in att_data: del att_data['id']
        if 'student' in att_data: del att_data['student']
        Attendance.objects.create(student=student, **att_data)

    # Uy vazifalari
    for sub_data in metadata.get('submissions', []):
        if 'id' in sub_data: del sub_data['id']
        if 'student' in sub_data: del sub_data['student']
        HomeworkSubmission.objects.create(student=student, **sub_data)

    # Mock testlar
    for mock_data in metadata.get('mock_results', []):
        if 'id' in mock_data: del mock_data['id']
        if 'student' in mock_data: del mock_data['student']
        MockTestResult.objects.create(student=student, **mock_data)

    return student

@transaction.atomic
def restore_staff_from_archive(archived_staff_id, restored_by):
    """
    Arxivlangan xodimni (mentor/admin) qayta tiklash.
    """
    from django.contrib.auth import get_user_model
    from branches.models import Branch
    User = get_user_model()
    
    archived = ArchivedStaff.objects.get(id=archived_staff_id)
    metadata = archived.metadata
    
    # Branch ni topish
    branch = None
    if metadata.get('branch'):
        branch = Branch.objects.filter(id=metadata['branch']).first()
    
    # Usernameni unique qilish (agar kerak bo'lsa)
    original_username = metadata.get('username', f"user_{archived.original_id}")
    username = original_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{original_username}_{counter}"
        counter += 1
    
    # Xodimni qayta yaratish
    user = User.objects.create(
        username=username,
        first_name=metadata.get('first_name', ''),
        last_name=metadata.get('last_name', ''),
        email=metadata.get('email', ''),
        role=archived.role,
        branch=branch,
        phone_number=archived.phone,
    )
    
    # Parolni o'rnatish (default)
    user.set_password('changeme123')
    user.set_password('changeme123')
    user.save()

    # StaffProfile ni tiklash
    if metadata.get('staff_profile'):
        try:
            from finance.models import StaffProfile
            profile_data = metadata['staff_profile']
            # Yangi userga bog'laymiz
            StaffProfile.objects.create(user=user, **profile_data)
        except Exception as e:
            # Profil tiklanmasa ham user tiklandi, shuning uchun xatoni yutib yuboramiz
            # yoki log qilamiz. Asosiy maqsad user tiklanishi.
            print(f"StaffProfile tiklashda xato: {e}")
            pass
    
    return user

@transaction.atomic
def restore_group_from_archive(archived_group_id, restored_by):
    """
    Arxivlangan guruhni qayta tiklash.
    DIQQAT: Guruh tiklanadi, lekin studentlar alohida tiklanishi kerak.
    """
    from groups.models import Group
    from branches.models import Branch
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    archived = ArchivedGroup.objects.get(id=archived_group_id)
    metadata = archived.metadata
    
    # Branch va Mentorni topish
    branch = None
    if metadata.get('branch'):
        branch = Branch.objects.filter(id=metadata['branch']).first()
    
    mentor = None
    if metadata.get('mentor'):
        mentor = User.objects.filter(id=metadata['mentor'], role='mentor').first()
    
    admin = None
    if metadata.get('admin'):
        admin = User.objects.filter(id=metadata['admin']).first()
    
    # Guruhni qayta yaratish
    group = Group.objects.create(
        name=archived.full_name,
        branch=branch,
        mentor=mentor,
        admin=admin,
        monthly_price=metadata.get('monthly_price', 0),
        subject=archived.subject,
        course_time=metadata.get('course_time', ''),
        dars_kunlari=metadata.get('dars_kunlari', ''),
        days=metadata.get('days', 'odd'),
        dars_vaqti=metadata.get('dars_vaqti', ''),
        description=metadata.get('description', ''),
        is_faol=metadata.get('is_faol', True),
        color=metadata.get('color', '#ffffff'),
    )
    
    return group
