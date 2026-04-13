from rest_framework import permissions
from .models import MentorGroupAssignment
from authenticatsiya.models import BranchAccess

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'super_admin'

class IsAdminOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'super_admin']

class IsGroupOwnerOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        
        if user.role == 'super_admin':
            return True

        if user.role == 'admin':
            # 1. Asosiy filiali tekshiramiz
            if user.branch == obj.branch:
                return True
            
            # 2. BranchAccess orqali qo'shimcha ruxsatlarni tekshiramiz
            return user.branch_accesses.filter(branch=obj.branch).exists()

        if user.role == 'mentor':
            if request.method in permissions.SAFE_METHODS:
                return (
                    obj.mentor == user or
                    obj.additional_mentors.filter(mentor=user).exists()
                )
        
        return False

class IsStudentGroupOwnerOrSuperAdmin(permissions.BasePermission):
    """
    STUDENT uchun:
    - super_admin → faqat READ
    - admin → o‘z branch'idagi studentlar
    - mentor → asosiy mentor YOKI qo‘shimcha mentor
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        group = obj.group
        # Student modelida branch bor, shundan foydalanamiz
        student_branch = obj.branch or (group.branch if group else None)

        if user.role == 'super_admin':
            return True

        if user.role == 'admin':
            if not student_branch: return False
            if student_branch == user.branch:
                return True
            return user.branch_accesses.filter(branch=student_branch).exists()

        if user.role == 'mentor':
            if not group: return False
            if request.method in permissions.SAFE_METHODS:
                return (
                    group.mentor == user or
                    MentorGroupAssignment.objects.filter(mentor=user, group=group).exists()
                )
            return False

        return False
    
class IsAdminOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'admin' and
            request.user.branch is not None
        )


class IsMentorBranchAccessible(permissions.BasePermission):
    """
    Mentor o'zining asosiy filialiga va unga ruxsat berilgan (BranchAccess) 
    filiallarga kirishi uchun ruxsat beruvchi permission.
    """

    def has_permission(self, request, view):
        # 1. Foydalanuvchi tizimga kirgan va roli mentor ekanligini tekshiramiz
        if not request.user.is_authenticated or request.user.role != 'mentor':
            # Agar foydalanuvchi admin bo'lsa, bu permission unga tegishli emas (boshqa klass tekshiradi)
            return False
        return True

    def has_object_permission(self, request, obj, view):
        # 2. Obyekt (masalan, Group yoki Student) qaysi filialga tegishli ekanini aniqlaymiz
        # Odatda obyektlarda 'branch' yoki 'branch_id' maydoni bo'ladi
        target_branch_id = getattr(obj, 'branch_id', None)
        
        if target_branch_id is None and hasattr(obj, 'branch'):
            target_branch_id = obj.branch.id

        # 3. Mantiqiy tekshiruv:
        
        # a) Agar obyekt mentorning asosiy filialiga tegishli bo'lsa
        if request.user.branch_id == target_branch_id:
            return True
        
        # b) Agar obyekt mentorga ruxsat berilgan (BranchAccess) filiallardan biriga tegishli bo'lsa
        is_accessible = BranchAccess.objects.filter(
            user=request.user, 
            branch_id=target_branch_id
        ).exists()
        
        return is_accessible