import logging
from django.db import transaction, models
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied

from .models import (
    Group, Student, MentorGroupAssignment, 
    GroupEnrollment, GroupTransfer, WaitingStudent
)
from .serializers import (
    GroupSerializer, GroupSimpleSerializer, StudentSerializer, 
    StudentNestedSerializer, AssignAdditionalMentorSerializer,
    RemoveMentorSerializer, MentorAssignmentSerializer,
    MentorListSerializer, WaitingStudentSerializer, MentorSerializer,
    AdminUserSerializers
)
from .permissions import (
    IsAdminOnly, IsGroupOwnerOrSuperAdmin,
    IsStudentGroupOwnerOrSuperAdmin, IsAdminOrSuperAdmin, 
    IsMentorBranchAccessible
)
from .services import (
    enroll_student_to_group, unenroll_student_from_group,
    transfer_student_to_group, merge_student_profiles,
    assign_waiting_student_to_group
)

logger = logging.getLogger(__name__)

# --- Pagination ---

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

# --- ViewSets ---

class GroupViewSet(viewsets.ModelViewSet):
    """Guruhlarni boshqarish ViewSet"""
    queryset = Group.objects.select_related('mentor', 'admin', 'branch').prefetch_related('students', 'additional_mentors')
    serializer_class = GroupSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsGroupOwnerOrSuperAdmin]
    module_name = 'groups'

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name', 'subject', 'mentor__first_name', 'mentor__last_name']

    def get_serializer_class(self):
        if self.action == 'list':
            return GroupSimpleSerializer
        return GroupSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        branch_id = self.request.query_params.get('branch_id')

        if user.role == 'super_admin':
            return qs.filter(branch_id=branch_id) if branch_id else qs
        
        if user.role == 'admin':
            allowed = [user.branch.id] if user.branch else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            qs = qs.filter(branch_id__in=allowed)
            return qs.filter(branch_id=branch_id) if branch_id else qs
        
        if user.role == 'mentor':
            return qs.filter(Q(mentor=user) | Q(additional_mentors__mentor=user)).distinct()
        
        return Group.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get('branch') or (user.branch if user.role == 'admin' else None)
        if user.role in ['admin', 'super_admin']:
            serializer.save(admin=user, branch=branch)
        else:
            serializer.save(mentor=user, branch=user.branch)

    def retrieve(self, request, *args, **kwargs):
        """N+1 muammosini oldini olish bilan retrieve"""
        queryset = self.get_queryset().select_related(
            'mentor', 'mentor__branch', 'admin', 'branch'
        ).prefetch_related('additional_mentors__mentor')
        
        exclude_students = request.query_params.get('exclude_students', 'false').lower() == 'true'
        if not exclude_students:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'students',
                    queryset=Student.objects.select_related('group', 'branch').order_by('full_name')
                )
            )
            
        instance = get_object_or_404(queryset, pk=kwargs['pk'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='enroll-student')
    def enroll_student(self, request, pk=None):
        group = self.get_object()
        student_id = request.data.get('student_id')
        create_payment = request.data.get('create_payment', True)
        
        try:
            enrollment, created = enroll_student_to_group(group, student_id, create_payment)
            if created:
                return Response({"status": "O'quvchi guruhga biriktirildi"}, status=201)
            return Response({"detail": "Ushbu o'quvchi allaqachon guruhda"}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='unenroll-student')
    def unenroll_student(self, request, pk=None):
        group = self.get_object()
        student_id = request.data.get('student_id')
        
        try:
            status_result = unenroll_student_from_group(group, student_id, request.user)
            msg = "O'quvchi guruhdan chiqarildi"
            if status_result == "waiting_hall":
                msg += " va kutish zaliga o'tkazildi"
            return Response({"status": msg}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def add_student(self, request, pk=None):
        group = self.get_object()
        data = request.data.copy()
        data['group'] = group.id
        serializer = StudentSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            student = serializer.save()
            GroupEnrollment.objects.get_or_create(student=student, group=group)
            
        return Response(StudentNestedSerializer(student).data, status=201)

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Guruhdagi o'quvchilar ro'yxati"""
        group = self.get_object()
        students = group.students.all()
        serializer = StudentNestedSerializer(students, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='additional-mentors')
    def additional_mentors(self, request, pk=None):
        """Guruhning qo'shimcha mentorlari"""
        group = self.get_object()
        assignments = group.additional_mentors.all()
        serializer = MentorAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='assign-additional-mentor', permission_classes=[IsAdminOrSuperAdmin])
    def assign_additional_mentor(self, request, pk=None):
        group = self.get_object()
        serializer = AssignAdditionalMentorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        mentor = get_object_or_404(User, id=serializer.validated_data['mentor'], role='mentor')
        
        assignment, created = MentorGroupAssignment.objects.get_or_create(
            mentor=mentor, group=group, defaults={'assigned_by': request.user}
        )
        if created:
            return Response({"status": "Mentor tayinlandi"}, status=201)
        return Response({"detail": "Allaqachon tayinlangan"}, status=200)

    @action(detail=True, methods=['post'], url_path='remove-additional-mentor', permission_classes=[IsAdminOrSuperAdmin])
    def remove_additional_mentor(self, request, pk=None):
        group = self.get_object()
        serializer = RemoveMentorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        MentorGroupAssignment.objects.filter(group=group, mentor_id=serializer.validated_data['mentor_id']).delete()
        return Response({"status": "Muvaffaqiyatli olib tashlandi"}, status=200)

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        reason = request.data.get("reason", "Guruh arxivlandi")
        from archivebase.services import move_group_to_archive
        try:
            move_group_to_archive(group, request.user, reason=reason)
            return Response({"detail": "Arxivlandi"}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class StudentViewSet(viewsets.ModelViewSet):
    """O'quvchilarni boshqarish ViewSet"""
    queryset = Student.objects.select_related('group', 'branch').all()
    serializer_class = StudentSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsStudentGroupOwnerOrSuperAdmin]
    module_name = 'students'

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'phone']
    filterset_fields = ['group', 'branch']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == 'super_admin': return qs
        if user.role == 'admin': return qs.filter(branch=user.branch)
        if user.role == 'mentor':
            return qs.filter(Q(group__mentor=user) | Q(groups__mentor=user) | Q(groups__additional_mentors__mentor=user)).distinct()
        return Student.objects.none()

    @action(detail=True, methods=['post'], url_path='transfer-group')
    def transfer_group(self, request, pk=None):
        student = self.get_object()
        new_group_id = request.data.get('new_group_id')
        reason = request.data.get('reason', "Guruhdan guruhga o'tkazildi")
        try:
            transfer_student_to_group(student, new_group_id, request.user, reason)
            return Response({"status": "success", "message": "Ko'chirildi"}, status=200)
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
        try:
            merge_student_profiles(master, duplicate_id)
            return Response({"status": "success", "message": "Birlashtirildi"}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def destroy(self, request, *args, **kwargs):
        student = self.get_object()
        reason = request.data.get("reason", "O'chirildi")
        from archivebase.services import move_student_to_archive
        try:
            move_student_to_archive(student, request.user, reason=reason)
            return Response({"detail": "Arxivlandi"}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class MentorViewSet(viewsets.ModelViewSet):
    """Mentorlarni boshqarish"""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    queryset = User.objects.filter(role='mentor').select_related('branch')
    serializer_class = MentorSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsAuthenticated, IsMentorBranchAccessible]
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'username']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        branch_id = self.request.query_params.get('branch_id')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return qs.filter(Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed)).distinct()
        return qs

class StudentNestedView(viewsets.ReadOnlyModelViewSet):
    """Studentlar haqida batafsil ma'lumot (ReadOnly)"""
    queryset = Student.objects.select_related('group', 'branch').prefetch_related('groups').order_by('full_name')
    serializer_class = StudentNestedSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'phone']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role == 'super_admin': return qs
        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return qs.filter(branch_id__in=allowed)
        if user.role == 'mentor':
            return qs.filter(Q(group__mentor=user) | Q(group__additional_mentors__mentor=user)).distinct()
        return Student.objects.none()

class WaitingStudentViewSet(viewsets.ModelViewSet):
    """Kutishlar zali"""
    queryset = WaitingStudent.objects.all().order_by('full_name')
    serializer_class = WaitingStudentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['full_name', 'phone', 'subject']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin': return self.queryset
        return self.queryset.filter(branch=user.branch)

    @action(detail=True, methods=['post'], url_path='assign-to-group')
    def assign_to_group(self, request, pk=None):
        waiting_student = self.get_object()
        group_id = request.data.get('group_id')
        try:
            student = assign_waiting_student_to_group(waiting_student, group_id, request.user)
            return Response({"message": "Guruhga qo'shildi", "student_id": student.id}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class AdminViewSet(viewsets.ReadOnlyModelViewSet):
    """Adminlar ro'yxati (ReadOnly)"""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    queryset = User.objects.filter(role='admin').distinct()
    serializer_class = AdminUserSerializers
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser: return self.queryset
        if user.branch:
            allowed = list(user.branch_accesses.values_list('branch_id', flat=True))
            allowed.append(user.branch.id)
            return self.queryset.filter(Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed))
        return self.queryset.none()

class GroupSimpleViewSet(viewsets.ReadOnlyModelViewSet):
    """Guruhlar ro'yxati (oddiy)"""
    queryset = Group.objects.all()
    serializer_class = GroupSimpleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin': return self.queryset
        if user.role == 'admin': return self.queryset.filter(branch=user.branch)
        return self.queryset.filter(mentor=user)

class MentorListViewSet(viewsets.ReadOnlyModelViewSet):
    """Mentorlar ro'yxati (oddiy)"""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    queryset = User.objects.filter(role='mentor').select_related('branch')
    serializer_class = MentorListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'username']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin': return self.queryset
        if user.role == 'admin':
            allowed = [user.branch_id] if user.branch_id else []
            allowed.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return self.queryset.filter(Q(branch_id__in=allowed) | Q(branch_accesses__branch_id__in=allowed)).distinct()
        return self.queryset.filter(id=user.id)
