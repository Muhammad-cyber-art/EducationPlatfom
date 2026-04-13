from rest_framework import viewsets, status ,permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.utils import timezone 
from rest_framework.exceptions import PermissionDenied
from .models import Group, Student ,MentorGroupAssignment, GroupEnrollment, GroupTransfer
from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
from finance.models import Payment, FinanceTransaction
from .serializers import ( RemoveMentorSerializer,
    GroupSerializer, StudentSerializer, StudentNestedSerializer,AssignAdditionalMentorSerializer,
    MentorSerializer, GroupSimpleSerializer ,AdminUserSerializers ,MentorAssignmentSerializer,
    MentorListSerializer  # Yangi serializer
)
from django.db import models
from rest_framework import filters # Qidiruv uchun
from django_filters.rest_framework import DjangoFilterBackend # Filtr uchun
from .permissions import (
    IsAdminOnly, IsGroupOwnerOrSuperAdmin,
    IsStudentGroupOwnerOrSuperAdmin,IsAdminOrSuperAdmin ,IsMentorBranchAccessible
) 
from django.db.models import Prefetch, Q
from rest_framework.renderers import JSONRenderer
from archivebase.services import move_student_to_archive, send_to_archive
from archivebase.services import move_group_to_archive 
# from django_filters.rest_framework import DjangoFilterBackend

User = get_user_model()

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.select_related('mentor', 'admin').prefetch_related('students')
    serializer_class = GroupSerializer
    permission_classes = [IsGroupOwnerOrSuperAdmin]
    authentication_classes = [JWTAuthentication, SessionAuthentication]

    # --- QIDIRUV VA FILTR BACKENDLARI QO'SHILDI ---
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    # Guruh nomi va fan nomi bo'yicha qidirish imkoniyati
    search_fields = ['name', 'subject', 'mentor__first_name', 'mentor__last_name','mentor__username']

    from django.db.models import Q

    def get_queryset(self):
        user = self.request.user
        # Asosiy queryset (select_related va prefetch_related saqlab qolindi)
        qs = Group.objects.select_related('mentor', 'admin', 'branch').prefetch_related('students', 'additional_mentors')
        
        branch_id = self.request.query_params.get('branch_id')
       
        # 1. Super Admin (O'zgarishsiz)
        if user.role == 'super_admin':
            if branch_id and branch_id not in ['null', 'undefined', '']:
                return qs.filter(branch_id=branch_id)
            return qs
       
        # 2. Admin uchun
        if user.role == 'admin':
            allowed_branch_ids = []
            if user.branch:
                allowed_branch_ids.append(user.branch.id)
                
            extra_ids = list(user.branch_accesses.values_list('branch_id', flat=True))
            allowed_branch_ids.extend(extra_ids)
       
            admin_qs = qs.filter(branch_id__in=allowed_branch_ids)
       
            if branch_id and branch_id not in ['null', 'undefined', '']:
                try:
                    b_id = int(branch_id)
                    if b_id in allowed_branch_ids:
                        return admin_qs.filter(branch_id=b_id)
                    else:
                        return Group.objects.none()
                except ValueError:
                    pass
            return admin_qs
       
        # 3. Mentor uchun (Logika saqlangan, faqat branch_id filtri qo'shildi)
        if user.role == 'mentor':
            mentor_qs = qs.filter(
                models.Q(mentor=user) | models.Q(additional_mentors__mentor=user)
            ).distinct()
            
            # Mentor ham dropdown'dan branch tanlasa, faqat o'sha branch guruhlarini ko'rsin
            if branch_id and branch_id not in ['null', 'undefined', '']:
                return mentor_qs.filter(branch_id=branch_id)
                
            return mentor_qs
       
        return Group.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        # Frontenddan tanlangan branchni olamiz
        requested_branch = serializer.validated_data.get('branch')

        if user.role == 'super_admin':
            # Super admin o'zi tanlagan branch bilan saqlaydi
            serializer.save(branch=requested_branch)
        
        elif user.role == 'admin':
            # Agar frontenddan branch kelmasa, adminning o'z branchini oladi
            if not requested_branch:
                requested_branch = user.branch
            
            # Saqlash: Adminni biriktiramiz va branch'ni frontenddan kelganidek saqlaymiz
            serializer.save(admin=user, branch=requested_branch)
        
        elif user.role == 'mentor':
            serializer.save(mentor=user, branch=user.branch)
        else:
            raise PermissionDenied("Ruxsat yo'q.")

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminOrSuperAdmin()]
        return super().get_permissions()

    def retrieve(self, request, *args, **kwargs):
        """Bitta guruh sahifasini yuklashda N+1 muammosini oldini olish"""
        instance = Group.objects.select_related(
            'mentor', 'mentor__branch',
            'admin', 'branch'
        ).prefetch_related(
            Prefetch(
                'students',
                queryset=Student.objects.select_related('group', 'branch').only(
                    'id', 'full_name', 'phone', 'parent_phone',
                    'image', 'color', 'status', 'custom_fee',
                    'telegram_id', 'parent_telegram_id', 'group_id', 'branch_id'
                )
            ),
            'additional_mentors__mentor',
        ).get(pk=kwargs['pk'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        group = self.get_object()
        students = group.students.all()
        serializer = StudentNestedSerializer(students, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='enroll-student')
    def enroll_student(self, request, pk=None):
        group = self.get_object()
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({"error": "O'quvchi ID si ko'rsatilmadi"}, status=400)
        
        student = get_object_or_404(Student, id=student_id)
        
        create_payment = request.data.get('create_payment', True)
        if isinstance(create_payment, str):
            create_payment = create_payment.lower() == 'true'

        with transaction.atomic():
            enrollment, created = GroupEnrollment.objects.get_or_create(
                student=student,
                group=group
            )
            
            if created:
                # Also update the legacy 'group' field if it's currently empty
                if not student.group:
                    student.group = group
                    student.save()
                
                # Pro-rated to'lov varaqasini yaratish (SHARTLI)
                if create_payment:
                    from .utils import get_lessons_in_month
                    from finance.models import Payment
                    from decimal import Decimal
                    
                    today = timezone.now().date()
                    month_start = today.replace(day=1)
                    all_lessons = get_lessons_in_month(group.days, today.year, today.month)
                    remaining_lessons = [l for l in all_lessons if l >= today]
                    base_price = Decimal(str(student.custom_fee if student.custom_fee else group.monthly_price))
                    
                    if all_lessons:
                        price_per_lesson = base_price / Decimal(len(all_lessons))
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
                return Response({"status": "O'quvchi guruhga biriktirildi"}, status=201)
            else:
                return Response({"detail": "Ushbu o'quvchi allaqachon guruhda"}, status=200)

    @action(detail=True, methods=['post'], url_path='unenroll-student')
    def unenroll_student(self, request, pk=None):
        group = self.get_object()
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({"error": "O'quvchi ID si ko'rsatilmadi"}, status=400)
        
        student = get_object_or_404(Student, id=student_id)
        
        # Remove from group (M2M)
        from .models import GroupEnrollment
        enrollment = GroupEnrollment.objects.filter(
            student=student,
            group=group
        ).first()
        
        if enrollment:
            enrollment.delete()
            # If the student.group (Legacy FK) was pointing to this group, 
            # we should update it to another group they are in, or set to null.
            if student.group == group:
                next_group = student.groups.exclude(id=group.id).first()
                student.group = next_group
                student.save()
            return Response({"status": "O'quvchi guruhdan chiqarildi"}, status=200)
        else:
            return Response({"detail": "Ushbu o'quvchi bu guruhda emas"}, status=404)

    @action(detail=True, methods=['post'])
    def add_student(self, request, pk=None):
        group = self.get_object()
        data = request.data.copy()
        # Legacy support: set the first group
        data['group'] = group.id
        serializer = StudentSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            student = serializer.save()
            # Also add to the new ManyToMany through table
            from .models import GroupEnrollment
            GroupEnrollment.objects.get_or_create(student=student, group=group)
            
        response_serializer = StudentNestedSerializer(student)
        return Response(response_serializer.data, status=201)
    
    # Qo‘shimcha mas'ul mentorlarni ko‘rish
    @action(detail=True, methods=['get'], url_path='additional-mentors')
    def additional_mentors(self, request, pk=None):
            group = self.get_object()
            assignments = group.additional_mentors.all()
            serializer = MentorAssignmentSerializer(assignments, many=True)
            return Response(serializer.data)

    @action(
        detail=True, 
        methods=['get', 'post'], 
        url_path='assign-additional-mentor',
        permission_classes=[IsAdminOrSuperAdmin] ,
        serializer_class=AssignAdditionalMentorSerializer  # <-- MUHIM: Faqat shu serializer ishlaydi
    )
    def assign_additional_mentor(self, request, pk=None):
        group = self.get_object()

        if request.method == 'POST':
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            mentor_id = serializer.validated_data['mentor']
            mentor = get_object_or_404(User, id=mentor_id, role='mentor')

            user = request.user
            if user.role not in ['admin', 'super_admin']:
                return Response({"error": "Faqat admin yoki super_admin tayinlay oladi"}, status=403)

            if user.role == 'admin' and group.branch != user.branch:
                return Response({"error": "Faqat o‘z filialingizdagi guruhga tayinlash mumkin"}, status=403)

            assignment, created = MentorGroupAssignment.objects.get_or_create(
                mentor=mentor,
                group=group,
                defaults={'assigned_by': user}
            )

            if created:
                return Response({
                    "status": "Qo‘shimcha mentor muvaffaqiyatli tayinlandi",
                    "mentor": mentor.get_full_name() or mentor.username
                }, status=201)
            else:
                return Response({"detail": "Bu mentor allaqachon qo‘shimcha mas'ul"}, status=200)

        # GET da faqat forma chiqadi
        serializer = self.get_serializer()
        return Response(serializer.data)

    # Qo‘shimcha mas'ullikni olish
    @action(detail=True, methods=['get', 'post'], url_path='remove-additional-mentor', serializer_class=RemoveMentorSerializer)
    def remove_additional_mentor(self, request, pk=None):
        group = self.get_object()
        
        if request.method == 'POST':
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            m_id = serializer.validated_data['mentor_id']

            # DEBUG uchun: Kelayotgan ID ni terminalda ko'rish
            print(f"Guruh ID: {group.id}, Mentor ID: {m_id}")

            # Filtlashni kengaytiramiz (aniqroq topish uchun)
            assignment = MentorGroupAssignment.objects.filter(group=group, mentor_id=m_id).first()
            
            if not assignment:
                return Response({
                    "error": f"Ushbu guruhda {m_id} ID li yordamchi mentor topilmadi.",
                    "current_assignments": list(group.additional_mentors.values_list('mentor_id', flat=True))
                }, status=404)

            # Ruxsatlarni tekshirish logikasi...
            # ...
            
            assignment.delete()
            return Response({"status": "Muvaffaqiyatli olib tashlandi"}, status=200)

        serializer = self.get_serializer()
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        reason = request.data.get("reason", "Guruh admin tomonidan o'chirildi/arxivlandi")
        
        try:
            # Guruhni arxivga ko'chirish funksiyasini chaqiramiz
            move_group_to_archive(group, request.user, reason=reason)
            return Response(
                {"detail": "Guruh va uning barcha o'quvchilari arxivga ko'chirildi."}, 
                status=status.HTTP_204_NO_CONTENT
            )
        except Exception as e:
            return Response(
                {"error": f"Arxivlashda xato: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    permission_classes = [IsStudentGroupOwnerOrSuperAdmin] 

    # --- QIDIRUV VA FILTR QO'SHILDI ---
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    # Nimalar bo'yicha qidirishni belgilaymiz: ism va telefon
    search_fields = ['full_name', 'phone']
    # Agar guruh bo'yicha ham filtrlamoqchi bo'lsangiz
    filterset_fields = ['group']

    def get_queryset(self):
        user = self.request.user
        qs = Student.objects.select_related('group', 'branch')

        if user.role == 'super_admin':
            return qs

        if user.role == 'admin':
            # Admin o'z branchidagi barcha o'quvchilarni (guruhsiz bo'lsa ham) ko'ra olishi kerak
            return qs.filter(branch=user.branch)

        if user.role == 'mentor':
            # Mentor faqat o'zi dars o'tadigan guruh o'quvchilarini ko'radi
            return qs.filter(
                Q(group__mentor=user) | 
                Q(groups__mentor=user) | 
                Q(groups__additional_mentors__mentor=user)
            ).distinct()

        return Student.objects.none()

    @action(detail=False, methods=['get'], url_path='search')
    def search(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([])

        import re
        # Raqamlarni ajratib olish (telefon qidiruvi uchun)
        clean_phone = re.sub(r'\D', '', query)

        # Ham ism bo'yicha, ham telefon bo'yicha qidirish
        query_filter = Q(full_name__icontains=query)
        if clean_phone and len(clean_phone) >= 4: # Kamida 4 ta raqam bo'lganda telefon bo'yicha qidirish
            query_filter |= Q(phone__icontains=clean_phone)

        students = Student.objects.filter(query_filter).distinct()[:10]
        serializer = StudentSerializer(students, many=True)
        return Response(serializer.data)

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminOnly()]
        return super().get_permissions()

    # --- TO'LOV FUNKSIYASI (O'zgarishsiz qoldi) ---
    @action(detail=True, methods=['post'], url_path='pay')
    def pay(self, request, pk=None):
        student = self.get_object()
        group = student.group
        
        payment = Payment.objects.create(
            student=student,
            group=group,
            amount=group.monthly_price,
            month=timezone.now().date().replace(day=1),
            marked_by=request.user,
            is_paid=True,
            paid_at=timezone.now()
        )
        
        serializer = PaymentSerializer(payment)
        return Response({
            "status": "success",
            "message": f"{student.full_name} uchun to'lov muvaffaqiyatli saqlandi",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
        
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrSuperAdmin])
    def archive(self, request, pk=None):
        student = self.get_object()
        reason = request.data.get('reason', "Sabab ko'rsatilmadi")
        
        try:
            # Servisni chaqiramiz
            send_to_archive(instance=student, request_user=request.user, reason=reason)
            return Response({"detail": "Student arxivga ko'chirildi"}, status=200)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        
    def destroy(self, request, *args, **kwargs):
        """O'quvchini butunlay o'chirish (Archive qilish)"""
        
        try:
            student = self.get_object()
            reason = request.data.get("reason", "Tizimdan o'chirildi")
            
            from archivebase.services import move_student_to_archive
            move_student_to_archive(student, request.user, reason=reason)
            return Response(
                {"detail": "O'quvchi va uning barcha ma'lumotlari arxivga ko'chirildi."}, 
                status=status.HTTP_204_NO_CONTENT
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='remove-from-group')
    def remove_from_group(self, request, pk=None):
        """Guruhdan chiqarish amali - bu ham arxivga tushishi kerak"""
        student = self.get_object()
        reason = request.data.get("reason", "Guruhdan chiqarildi")
        
        # Agar shunchaki guruhdan chiqib, bazada qolishi kerak bo'lsa:
        # student.group = None; student.save()
        
        # Lekin siz arxivga saqlansin deganingiz uchun:
        try:
            move_student_to_archive(student, request.user, reason=reason)
            return Response({"detail": "O'quvchi guruhdan olindi va arxivlandi."}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)
    
    @action(detail=True, methods=['post'], url_path='transfer-group')
    def transfer_group(self, request, pk=None):
        student = self.get_object()
        new_group_id = request.data.get('new_group_id')
        reason = request.data.get('reason', 'Guruhdan guruhga o\'tkazildi')
        
        if not new_group_id:
            return Response({"error": "Yangi guruh ID si ko'rsatilmadi"}, status=400)

        new_group = get_object_or_404(Group, id=new_group_id)
        old_group = student.group

        if not old_group:
            return Response({"error": "O'quvchi hozirda bironta guruhda emas"}, status=400)
            
        if old_group == new_group:
            return Response({"error": "O'quvchi allaqachon ushbu guruhda"}, status=400)

        if request.user.role == 'admin' and new_group.branch != request.user.branch:
            return Response({"error": "Siz o'quvchini boshqa filial guruhiga o'tkaza olmaysiz"}, status=403)

        try:
            with transaction.atomic():
                from finance.models import Payment
                from .models import GroupTransfer, GroupEnrollment
                from decimal import Decimal

                today = timezone.now().date()
                current_month_start = today.replace(day=1)

                # 1. GroupEnrollment yangilash — student eski guruhdan butunlay chiqadi
                # Eski guruh enrollmentini O'CHIRIB yuboramiz (is_active=False yetarli emas,
                # chunki group.students.all() is_active ni filtrlashni bilmaydi)
                GroupEnrollment.objects.filter(student=student, group=old_group).delete()

                # Yangi guruhga enrollment yaratamiz yoki faollashtiramiz
                new_enroll, _created = GroupEnrollment.objects.get_or_create(
                    student=student,
                    group=new_group,
                    defaults={'is_active': True}
                )
                if not _created and not new_enroll.is_active:
                    new_enroll.is_active = True
                    new_enroll.save()

                # 2. TO'LOVNI KO'CHIRISH — yangi yaratmasdan, mavjudini ishlatamiz
                old_payment = Payment.objects.filter(
                    student=student,
                    group=old_group,
                    month=current_month_start
                ).first()

                new_monthly_amount = (
                    student.custom_fee if student.custom_fee is not None
                    else new_group.monthly_price
                )

                if old_payment:
                    existing_new = Payment.objects.filter(
                        student=student, group=new_group, month=current_month_start
                    ).first()
                    if not existing_new:
                        # Eskisini yangi guruhga ko'chiramiz
                        old_payment.group = new_group
                        if not old_payment.is_paid:
                            old_payment.amount = new_monthly_amount
                        old_payment.save()
                    else:
                        # Ikkala guruhda ham to'lov bor: to'langanini saqlaymiz
                        if old_payment.is_paid and not existing_new.is_paid:
                            existing_new.is_paid = True
                            existing_new.amount = old_payment.amount
                            existing_new.save()
                        old_payment.delete()
                else:
                    # To'lov yo'q bo'lsa, yaratib qo'yamiz
                    Payment.objects.get_or_create(
                        student=student,
                        group=new_group,
                        month=current_month_start,
                        defaults={'amount': new_monthly_amount, 'is_paid': False}
                    )

                # 3. TRANSFERNI LOG QILISH
                GroupTransfer.objects.create(
                    student=student,
                    from_group=old_group,
                    to_group=new_group,
                    transfer_date=today,
                    old_group_fee=Decimal('0'),
                    new_group_fee=Decimal('0'),
                    reason=reason,
                    marked_by=request.user
                )

                # 4. STUDENT MODELINI YANGILASH
                student.group = new_group
                student.branch = new_group.branch
                student.save()

                return Response({
                    "status": "success",
                    "message": f"{student.full_name} {old_group.name} dan {new_group.name} ga ko'chirildi",
                }, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get'])
    def transfers(self, request, pk=None):
        """O'quvchining transferlar tarixini ko'rish"""
        student = self.get_object()
        from .serializers import GroupTransferSerializer
        transfers = student.transfers.all()
        serializer = GroupTransferSerializer(transfers, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrSuperAdmin])
    def merge(self, request, pk=None):
        master = self.get_object()
        duplicate_id = request.data.get('duplicate_id')
        
        if not duplicate_id:
            return Response({"error": "Birlashtiriluvchi o'quvchi ID si ko'rsatilmadi"}, status=400)
            
        if str(master.id) == str(duplicate_id):
            return Response({"error": "O'quvchini o'zi bilan birlashtirib bo'lmaydi"}, status=400)
            
        duplicate = get_object_or_404(Student, id=duplicate_id)
        
        try:
            with transaction.atomic():
                # 1. Transfer Enrollments
                for enrollment in duplicate.enrollments.all():
                    GroupEnrollment.objects.get_or_create(
                        student=master, 
                        group=enrollment.group
                    )
                
                # Manual FK group field support
                if duplicate.group:
                    GroupEnrollment.objects.get_or_create(student=master, group=duplicate.group)

                # 2. Transfer Attendance
                Attendance.objects.filter(student=duplicate).update(student=master)
                # Handle duplicates (IntegrityError approach)
                # In modern Django update() might fail if unique constrained. 
                # So we iterate if we want to handle unique conflicts gracefully.
                attendances = Attendance.objects.filter(student=duplicate)
                for attr in attendances:
                    try:
                        attr.student = master
                        attr.save()
                    except IntegrityError:
                        attr.delete()

                # 3. Transfer Homework
                submissions = HomeworkSubmission.objects.filter(student=duplicate)
                for sub in submissions:
                    try:
                        sub.student = master
                        sub.save()
                    except IntegrityError:
                        sub.delete()

                # 4. Transfer Mock Tests
                mock_results = MockTestResult.objects.filter(student=duplicate)
                for res in mock_results:
                    try:
                        res.student = master
                        res.save()
                    except IntegrityError:
                        res.delete()

                # 5. Transfer Payments
                payments = Payment.objects.filter(student=duplicate)
                for pay in payments:
                    try:
                        pay.student = master
                        pay.save()
                    except IntegrityError:
                        pay.delete()

                # 6. Transfer Transactions
                FinanceTransaction.objects.filter(student=duplicate).update(student=master)

                # 7. Transfer Group Transfers
                GroupTransfer.objects.filter(student=duplicate).update(student=master)

                # 8. Merge Metadata
                if not master.telegram_id and duplicate.telegram_id:
                    master.telegram_id = duplicate.telegram_id
                if not master.parent_telegram_id and duplicate.parent_telegram_id:
                    master.parent_telegram_id = duplicate.parent_telegram_id
                if not master.birth_date and duplicate.birth_date:
                    master.birth_date = duplicate.birth_date
                
                new_notes = f"--- Merged from: {duplicate.full_name} (ID: {duplicate.id}) ---\n{duplicate.notes or ''}\n{master.notes or ''}"
                master.notes = new_notes.strip()
                master.save()

                # 9. Delete Duplicate
                duplicate.delete()

            return Response({
                "status": "success",
                "message": f"{duplicate.full_name} ma'lumotlari {master.full_name} profiliga muvaffaqiyatli ko'chirildi."
            }, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=400)
    
from django.db.models import Q, Prefetch # Q va Prefetch kerak bo'ladi
from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
# ... boshqa importlar ...

class MentorViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MentorSerializer
    permission_classes = [IsAuthenticated | IsMentorBranchAccessible]
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'username'] 

    def get_queryset(self):
        branch_id = self.request.query_params.get("branch_id")
        queryset = User.objects.filter(role="mentor")

        # LOGIKANI BUZMASDAN KENGAYTIRAMIZ
        # LOGIKANI BUZMASDAN KENGAYTIRAMIZ
        if branch_id:
            try:
                branch_id = int(branch_id)
                queryset = queryset.filter(
                    Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)
                ).distinct()
            except (ValueError, TypeError):
                branch_id = None
                queryset = queryset.none()
        
        # Admin uchun xavfsizlik: faqat ruxsat etilgan filial mentorlari
        user = self.request.user
        if user.role == 'admin':
            allowed_branches = [user.branch_id] if user.branch_id else []
            allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            
            queryset = queryset.filter(
                 Q(branch_id__in=allowed_branches) | Q(branch_accesses__branch_id__in=allowed_branches)
            ).distinct()

        return queryset.prefetch_related(
            Prefetch(
                'mentor_groups',
                queryset=Group.objects.filter(branch_id=branch_id) if branch_id else Group.objects.all()
            )
        )
class StudentNestedView(viewsets.ReadOnlyModelViewSet):
    serializer_class = StudentNestedSerializer
    permission_classes = [IsAuthenticated]
    
    # --- QIDIRUV VA FILTR BACKENDLARINI YOQAMIZ ---
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    # Qidiriladigan maydonlar: ism, telefon va ota-ona ismi
    search_fields = ['full_name', 'phone', 'parent_name']

    def get_queryset(self):
        user = self.request.user
        qs = Student.objects.select_related('group', 'group__mentor', 'group__admin', 'group__branch').prefetch_related('group__additional_mentors', 'groups')

        # 1. Frontend query param (Branch bo'yicha filtr)
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            try:
                branch_id = int(branch_id)
                qs = qs.filter(group__branch_id=branch_id)
            except ValueError:
                qs = qs.none()

        # 2. Role based filter (Xavfsizlik mantiqi + YANGI MENTOR CHECK)
        if user.role == 'super_admin':
            return qs
        elif user.role == 'admin':
            # Admin o'z filiali va access berilgan filiallardagi studentlarni ko'rishi kerak
            allowed_branches = []
            if user.branch:
                allowed_branches.append(user.branch.id)
            
            # Qo'shimcha ruxsatlar
            access_ids = list(user.branch_accesses.values_list('branch_id', flat=True))
            allowed_branches.extend(access_ids)
            
            return qs.filter(group__branch_id__in=allowed_branches)
        elif user.role == 'mentor':
            # YANGI: asosiy mentor YOKI qo‘shimcha mentor
            return qs.filter(
                models.Q(group__mentor=user) | models.Q(group__additional_mentors__mentor=user)
            ).distinct()

        return Student.objects.none()

class GroupSimpleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GroupSimpleSerializer
    permission_classes = [IsAuthenticated] 

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin':
            return Group.objects.all()
        elif user.role == 'admin':
            return Group.objects.all()
        elif user.role == 'mentor':
            return Group.objects.filter(mentor=user)
        return Group.objects.none()
    

class AdminViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminUserSerializers
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Asosiy queryset: Faqat "admin" rolli userlar
        queryset = User.objects.filter(role='admin').distinct()

        # Super Admin uchun filtrlash
        if user.is_superuser:
            branch_id = self.request.query_params.get('branch_id')
            if branch_id:
                try:
                    branch_id = int(branch_id)  # string → integer
                    queryset = queryset.filter(
                        Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)
                    ).distinct()
                except (ValueError, TypeError):
                    # noto‘g‘ri param → bo‘sh queryset
                    queryset = queryset.none()
            return queryset

        # Oddiy admin → faqat o‘z branch
        if user.branch:
            allowed = list(user.branch_accesses.values_list('branch_id', flat=True))
            allowed.append(user.branch.id)
            return queryset.filter(
                Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed)
            ).distinct()

        return queryset.none()

# Oddiy mentorlar ro'yxati uchun ViewSet
class MentorListViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Oddiy mentorlar ro'yxati - nested ma'lumotlarsiz.
    Faqat id, full_name, role va branch_id qaytaradi.
    """
    serializer_class = MentorListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'username']
    filterset_fields = ['branch_id']

    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.filter(role='mentor')
        
        # Branch bo'yicha filtrash
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            try:
                branch_id = int(branch_id)
                # Asosiy branch yoki BranchAccess orqali ruxsat berilgan
                queryset = queryset.filter(
                    Q(branch_id=branch_id) | Q(branch_accesses__branch_id=branch_id)
                ).distinct()
            except (ValueError, TypeError):
                queryset = queryset.none()
        
        # Role based access (xavfsizlik)
        if user.role == 'super_admin':
            return queryset
        elif user.role == 'admin':
            # Admin o'z filialidagi va ruxsat berilgan filiallardagi mentorlarni ko'radi
            allowed_branches = [user.branch_id] if user.branch_id else []
            allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return queryset.filter(
                Q(branch_id__in=allowed_branches) | Q(branch_accesses__branch_id__in=allowed_branches)
            ).distinct()
        elif user.role == 'mentor':
            # Mentor faqat o'zini ko'radi
            return queryset.filter(id=user.id)
        
        return queryset.none()
