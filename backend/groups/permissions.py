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
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.role == 'super_admin':
            return True
            
        # Admin va Mentor uchun StaffPermission orqali modul ruxsatini tekshiramiz
        try:
            perms = user.staff_permissions.permissions or {}
        except:
            perms = {}
            
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Yozish amallari (POST, PUT, PATCH, DELETE) uchun 'students' ruxsati kerak
        if user.role == 'mentor':
            return perms.get('students', False)
            
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        group = obj.group
        student_branch = obj.branch or (group.branch if group else None)

        if user.role == 'super_admin':
            return True

        # Admin o'z filialidagi talabalarni boshqara oladi
        if user.role == 'admin':
            if not student_branch: return False
            if student_branch == user.branch:
                return True
            return user.branch_accesses.filter(branch=student_branch).exists()

        if user.role == 'mentor':
            # 1. Mentorning StaffPermission'i bormi?
            try:
                perms = user.staff_permissions.permissions or {}
            except:
                perms = {}
            
            if not perms.get('students', False):
                # Agar ruxsati bo'lmasa, faqat ko'rish (o'z guruhidagilarni)
                if request.method in permissions.SAFE_METHODS:
                    if not group: return False
                    return (
                        group.mentor == user or
                        group.additional_mentors.filter(mentor=user).exists()
                    )
                return False
            
            # 2. Ruxsati bo'lsa, o'z guruhidagi talabalarni boshqara oladi
            if not group: return False
            return (
                group.mentor == user or
                group.additional_mentors.filter(mentor=user).exists()
            )

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
    Shuningdek super_admin va adminlarga ham ruxsat beradi.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin, Admin va Mentorlar bu view'dan foydalanishi mumkin
        return request.user.role in ['super_admin', 'admin', 'mentor']

    def has_object_permission(self, request, view, obj):
        # DRF calls this with request, view, obj (in BasePermission)
        # So we swap the variable names if the old code had request, obj, view
        # Wait, the old code used request, obj, view which is not standard.
        # Let's use request, view, obj.
        user = request.user
        
        if user.role == 'super_admin':
            return True

        target_branch_id = getattr(obj, 'branch_id', None)
        
        if target_branch_id is None and hasattr(obj, 'branch'):
            target_branch_id = obj.branch.id

        if user.role == 'admin':
            if user.branch_id == target_branch_id:
                return True
            return user.branch_accesses.filter(branch_id=target_branch_id).exists()

        if user.role == 'mentor':
            if user.branch_id == target_branch_id:
                return True
            return BranchAccess.objects.filter(user=user, branch_id=target_branch_id).exists()
            
        return False