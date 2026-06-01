from datetime import date, datetime
from decimal import Decimal
from django.forms.models import model_to_dict
from django.db import transaction
from .models import ArchivedStudent, ArchivedStaff, ArchivedGroup, ArchivedLid
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
    from groups.models import Student, GroupEnrollment
    
    # 1. Bog'liq ma'lumotlarni yig'ish
    from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
    from finance.models import FinanceTransaction
    
    payments = Payment.objects.filter(student=student)
    attendances = Attendance.objects.filter(student=student)
    submissions = HomeworkSubmission.objects.filter(student=student)
    mock_results = MockTestResult.objects.filter(student=student)
    transactions = FinanceTransaction.objects.filter(student=student)
    
    # 2. Student ma'lumotlarini dict qilish va sanalarni tozalash
    student_data = model_to_dict(student)
    cleaned_student_data = json_serializable_convert(student_data)
    
    # model_to_dict auto_now_add fieldlarni (joined_at) tashlab ketadi, 
    # shuning uchun ularni qo'lda qo'shamiz
    cleaned_student_data["joined_at"] = student.joined_at.isoformat() if student.joined_at else None
    cleaned_student_data["phone"] = student.phone
    cleaned_student_data["branch_id"] = student.branch_id
    cleaned_student_data["group_id"] = student.group_id
    cleaned_student_data["custom_fee"] = float(student.custom_fee) if student.custom_fee else None
    
    # 3. Bog'langan barcha o'quv ma'lumotlarini arxivga yig'amiz
    cleaned_student_data["payments"] = serialize_related(payments)
    cleaned_student_data["attendances"] = serialize_related(attendances)
    cleaned_student_data["submissions"] = serialize_related(submissions)
    cleaned_student_data["mock_results"] = serialize_related(mock_results)
    # Tranzaksiyalar ledger bo'lgani uchun ularni o'chirmaymiz, faqat IDlarini saqlaymiz
    cleaned_student_data["transaction_ids"] = list(transactions.values_list('id', flat=True))

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

    # 5. Soft delete: O'chirmaymiz, faqat arxivlangan va faol emasligini belgilaymiz
    from django.utils import timezone
    student.is_archived = True
    student.is_active = False
    student.archived_at = timezone.now()
    # Guruh foreign keyni tozalash, buni Student.save() qayta yaratmasligi uchun
    student.group = None
    student.save()

    # Barcha GroupEnrollmentlarni deactivate qilish
    GroupEnrollment.objects.filter(student=student).update(is_active=False)

    return archived

@transaction.atomic
def move_student_to_waiting_hall(student, archived_by, reason: str = "", branch=None):
    """O'quvchini oxirgi guruhidan chiqarganda kutish zaliga o'tkazish"""
    from groups.models import WaitingStudent
    
    # 1. Barcha kerakli ma'lumotlarni OLDIN o'qib olamiz (o'chirishdan oldin)
    target_branch = branch or student.branch
    student_id = student.id
    full_name = student.full_name
    phone = student.phone
    telegram_id = student.telegram_id
    parent_telegram_id = student.parent_telegram_id

    # 2. Arxivga saqlaymiz (To'lovlar va tarix yo'qolmasligi uchun)
    # Maxsus prefix qo'shamizki, Arxiv ro'yxatida ko'rinmasin
    hidden_reason = f"[WAITING_HALL] {reason}"
    archived = move_student_to_archive(student, archived_by, hidden_reason)
    
    # 3. Kutish zalida yangi record ochamiz (OLDIN o'qilgan ma'lumotlardan foydalanamiz)
    waiting = WaitingStudent.objects.create(
        full_name=full_name,
        phone=phone,
        branch=target_branch,
        notes=f"{reason} | Oldingi ID: {student_id}",
        telegram_id=telegram_id,
        parent_telegram_id=parent_telegram_id
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

    # 3. Soft delete: O'chirmaymiz, faqat faol emasligini belgilaymiz
    staff.is_active = False
    staff.save()
    return archived
def send_to_archive(instance, request_user, reason: str = ""):
    from groups.models import Student, WaitingStudent
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if isinstance(instance, Student):
        return move_student_to_archive(instance, archived_by=request_user, reason=reason)
    
    if isinstance(instance, User):
        return move_staff_to_archive(instance, archived_by=request_user, reason=reason)
    
    if isinstance(instance, WaitingStudent):
        return move_lid_to_archive(instance, archived_by=request_user, reason=reason)
    
    raise ValueError(f"Archive qo'llab-quvvatlanmagan model: {type(instance).__name__}")


@transaction.atomic
def move_group_to_archive(group, archived_by, reason: str = "") -> ArchivedGroup:
    from finance.models import Payment
    from django.utils import timezone
    
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
            move_student_to_waiting_hall(student, archived_by, f"Guruh arxivlangani uchun: {reason}", branch=group.branch)

    # 2. DIQQAT: O'quvchilar arxivlangandan keyin ham guruhga bog'langan 
    # qandaydir to'lovlar qolgan bo'lsa (masalan, tizimda adashib qolganlari),
    # ularni ham metadata ichiga yig'ib olamiz.
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

    # 5. Soft delete: Guruhni o'chirmaymiz, faqat arxivlanganligini belgilaymiz
    group.is_archived = True
    group.is_faol = False
    group.archived_at = timezone.now()
    group.save()

    return archived_group

# ==================== RESTORE FUNCTIONS ====================

@transaction.atomic
def restore_student_from_archive(archived_student_id, restored_by):
    """
    Arxivlangan studentni qayta tiklash.
    """
    from groups.models import Student, Group, GroupEnrollment

    archived = ArchivedStudent.objects.get(id=archived_student_id)
    
    # Try to find the existing student
    try:
        student = Student.objects.get(id=archived.original_id)
        # Un-archive the student
        student.is_archived = False
        student.is_active = True
        student.archived_at = None
        student.save()
        return student
    except Student.DoesNotExist:
        # Fallback to creating a new student if the original doesn't exist
        from branches.models import Branch
        from finance.models import Payment
        from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
        from django.contrib.auth import get_user_model
        from datetime import date as date_type, datetime as datetime_type
        from django.utils import timezone as tz
        User = get_user_model()

        metadata = archived.metadata

        # --- YORDAMCHI FUNKSIYALAR ---
        def parse_date(val):
            if not val:
                return None
            if isinstance(val, date_type):
                return val
            try:
                return date_type.fromisoformat(str(val)[:10])
            except Exception:
                return None

        def parse_datetime(val):
            if not val:
                return None
            if isinstance(val, datetime_type):
                return val
            try:
                from django.utils.dateparse import parse_datetime as dj_parse
                result = dj_parse(str(val))
                if result and result.tzinfo is None:
                    from django.utils import timezone as _tz
                    result = _tz.make_aware(result)
                return result
            except Exception:
                return None

        def safe_fk(Model, val):
            if not val:
                return None
            try:
                return Model.objects.filter(id=int(val)).first()
            except Exception:
                return None

        # 1. Branch va Group ni topish
        branch = safe_fk(Branch, metadata.get('branch_id') or metadata.get('branch'))
        group = safe_fk(Group, metadata.get('group_id') or metadata.get('group'))

        # 2. Studentni qayta yaratish
        student = Student.objects.create(
            full_name=archived.full_name,
            branch=branch,
            group=group,
            phone=metadata.get('phone', ''),
            birth_date=parse_date(metadata.get('birth_date')),
            parent_name=metadata.get('parent_name', ''),
            parent_phone=metadata.get('parent_phone', ''),
            address=metadata.get('address', ''),
            notes=metadata.get('notes', ''),
            color=metadata.get('color', '#ffffff'),
            telegram_id=metadata.get('telegram_id'),
            parent_telegram_id=metadata.get('parent_telegram_id'),
            status=metadata.get('status', 'regular'),
            custom_fee=metadata.get('custom_fee'),
        )

        # 3. Many-to-Many bog'liqlikni tiklash
        if group:
            GroupEnrollment.objects.get_or_create(
                student=student, group=group, defaults={'is_active': True}
            )

        # 4. TO'LOVLARNI TIKLASH — har bir maydon aniq ko'rsatiladi
        for pay_data in metadata.get('payments', []):
            try:
                old_pay_id = pay_data.get('id')
                pay_group = safe_fk(Group, pay_data.get('group'))
                pay_marked_by = safe_fk(User, pay_data.get('marked_by'))

                # transaction_id unique — bazada mavjud bo'lsa None qilamiz
                t_id = pay_data.get('transaction_id') or None
                if t_id and Payment.objects.filter(transaction_id=t_id).exists():
                    t_id = None

                p = Payment.objects.create(
                    student=student,
                    group=pay_group,
                    month=parse_date(pay_data.get('month')),
                    is_paid=bool(pay_data.get('is_paid', False)),
                    refund_ignored=bool(pay_data.get('refund_ignored', False)),
                    amount=pay_data.get('amount'),
                    marked_by=pay_marked_by,
                    paid_at=parse_datetime(pay_data.get('paid_at')),
                    transaction_id=t_id,
                    payer_name=pay_data.get('payer_name'),
                    payer_phone=pay_data.get('payer_phone'),
                    payer_card_mask=pay_data.get('payer_card_mask'),
                )

                # FinanceTransaction ni yangi payment ID ga bog'laymiz
                if old_pay_id:
                    from finance.models import FinanceTransaction
                    FinanceTransaction.objects.filter(
                        related_id=f"STP-{old_pay_id}"
                    ).update(related_id=f"STP-{p.id}")

            except Exception as e:
                print(f"[RESTORE] Payment error: {e} | data: {pay_data}")

        # 5. DAVOMAT tiklash
        for att_data in metadata.get('attendances', []):
            try:
                Attendance.objects.create(
                    student=student,
                    group=safe_fk(Group, att_data.get('group')),
                    date=parse_date(att_data.get('date')),
                    is_present=att_data.get('is_present', True),
                )
            except Exception as e:
                print(f"[RESTORE] Attendance error: {e}")

        # 6. UY VAZIFALARI tiklash
        for sub_data in metadata.get('submissions', []):
            try:
                from homework_attends.models import Homework
                hw = safe_fk(Homework, sub_data.get('homework'))
                if hw:
                    HomeworkSubmission.objects.get_or_create(
                        student=student,
                        homework=hw,
                        defaults={'status': sub_data.get('status', 'not_submitted')},
                    )
            except Exception as e:
                print(f"[RESTORE] Submission error: {e}")

        # 7. MOCK TESTLAR tiklash
        for mock_data in metadata.get('mock_results', []):
            try:
                from homework_attends.models import MockTest
                test = safe_fk(MockTest, mock_data.get('test'))
                if test:
                    MockTestResult.objects.get_or_create(
                        student=student,
                        test=test,
                        defaults={'score': mock_data.get('score', 0)},
                    )
            except Exception as e:
                print(f"[RESTORE] MockResult error: {e}")

        # 8. FINANCE TRANSACTIONS → yangi studentga bog'lash
        transaction_ids = metadata.get('transaction_ids', [])
        if transaction_ids:
            from finance.models import FinanceTransaction
            FinanceTransaction.objects.filter(id__in=transaction_ids).update(student=student)

        return student


@transaction.atomic
def restore_staff_from_archive(archived_staff_id, restored_by):
    """
    Arxivlangan xodimni (mentor/admin) qayta tiklash.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    archived = ArchivedStaff.objects.get(id=archived_staff_id)
    
    # Try to find the existing user
    try:
        user = User.objects.get(id=archived.original_id)
        # Un-archive the user
        user.is_active = True
        user.save()
        return user
    except User.DoesNotExist:
        # Fallback to creating a new user if the original doesn't exist
        from branches.models import Branch
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
        user.save()

        # StaffProfile ni tiklash
        if metadata.get('staff_profile'):
            try:
                from finance.models import StaffProfile
                profile_data = metadata['staff_profile']
                # FK larni to'g'rilaymiz (StaffProfile da hozircha faqat user)
                if 'id' in profile_data: del profile_data['id']
                if 'user' in profile_data: del profile_data['user']
                
                StaffProfile.objects.create(user=user, **profile_data)
            except Exception as e:
                print(f"StaffProfile tiklashda xato: {e}")
                pass
        
        return user

@transaction.atomic
def restore_group_from_archive(archived_group_id, restored_by):
    """
    Arxivlangan guruhni qayta tiklash.
    """
    from groups.models import Group
    
    archived = ArchivedGroup.objects.get(id=archived_group_id)
    
    # Try to find the existing group
    try:
        group = Group.objects.get(id=archived.original_id)
        # Un-archive the group
        group.is_archived = False
        group.is_faol = True
        group.archived_at = None
        group.save()
        return group
    except Group.DoesNotExist:
        # Fallback to creating a new group if the original doesn't exist
        from branches.models import Branch
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        metadata = archived.metadata
        
        # Branch va Mentorni topish
        branch_id = metadata.get('branch_id') or metadata.get('branch')
        branch = Branch.objects.filter(id=branch_id).first() if branch_id else None
        
        # BIZNES LOGIKA: Branch o'chirilgan bo'lsa, guruhni tiklab bo'lmaydi
        if not branch:
            raise ValueError("Guruhni tiklab bo'lmadi: Filial (Branch) topilmadi yoki o'chirilgan.")

        mentor_id = metadata.get('mentor_id') or metadata.get('mentor')
        mentor = User.objects.filter(id=mentor_id, role='mentor').first() if mentor_id else None
        
        admin_id = metadata.get('admin_id') or metadata.get('admin')
        admin = User.objects.filter(id=admin_id).first() if admin_id else None
        
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


@transaction.atomic
def move_lid_to_archive(waiting_student, archived_by, reason: str = "") -> ArchivedLid:
    from groups.models import WaitingStudent
    
    # 1. Ma'lumotlarni dict ko'rinishida yig'amiz
    waiting_data = model_to_dict(waiting_student)
    cleaned_data = json_serializable_convert(waiting_data)
    
    # Qo'shimcha fieldlarni qo'shish
    cleaned_data["created_at"] = waiting_student.created_at.isoformat() if waiting_student.created_at else None
    cleaned_data["phone"] = waiting_student.phone
    cleaned_data["branch_id"] = waiting_student.branch_id
    
    # 2. Arxiv yozuvi yaratish
    archived = ArchivedLid.objects.create(
        original_id=waiting_student.id,
        full_name=waiting_student.full_name,
        branch_name=getattr(waiting_student.branch, "name", "Noma'lum"),
        phone=waiting_student.phone,
        subject=waiting_student.subject,
        archived_by=archived_by,
        reason=reason,
        metadata=cleaned_data,
    )
    
    # 3. DB dan o'chirish
    waiting_student.delete()
    return archived


@transaction.atomic
def restore_lid_from_archive(archived_id, restored_by) -> 'WaitingStudent':
    from groups.models import WaitingStudent
    from branches.models import Branch
    
    archived = ArchivedLid.objects.get(id=archived_id)
    metadata = archived.metadata
    
    # Branch aniqlash
    branch_id = metadata.get('branch_id') or metadata.get('branch')
    branch = Branch.objects.filter(id=branch_id).first()
    if not branch:
        branch = Branch.objects.first()
        if not branch:
            raise ValueError("Kutish zaliga tiklash uchun kamida bitta filial bo'lishi kerak")
            
    waiting_student = WaitingStudent.objects.create(
        branch=branch,
        full_name=archived.full_name,
        phone=archived.phone or '',
        subject=archived.subject or '',
        notes=metadata.get('notes', '')
    )
    
    return waiting_student
