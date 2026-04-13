# permissions/permissions.py
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

class IsSuperAdmin(permissions.BasePermission):
    """
    Faqat 'super_admin' rolidagi foydalanuvchilarga to'liq ruxsat.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', None) == 'super_admin'
        )

class IsAdmin(permissions.BasePermission):
    """
    Faqat 'admin' rolidagi foydalanuvchilarga ruxsat.
    Aniqroq ruxsatlar uchun HasModulePermission bilan birga ishlatilishi kerak.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', None) == 'admin'
        )

class HasModulePermission(permissions.BasePermission):
    """
    View darajasida modul nomini aniqlab, foydalanuvchida 
    shu modul uchun kerakli amal (action) ga ruxsat borligini tekshiradi.
    
    Viewda ishlatish:
    class MyView(APIView):
        permission_classes = [HasModulePermission]
        module_name = 'finance'  # Modul nomi shu yerda ko'rsatiladi
    """
    
    def has_permission(self, request, view):
        # 1. Avtorizatsiyadan o'tmagan bo'lsa darhol rad etamiz
        if not request.user or not request.user.is_authenticated:
            return False

        # 2. Super adminlarga doimiy ruxsat (barcha to'siqlardan o'tadi)
        user_role = getattr(request.user, 'role', None)
        if user_role == 'super_admin':
            return True

        # 3. Adminlar uchun modul mavjud bo'lsa barcha metodlarga ruxsat
        if user_role == 'admin':
            # Viewda modul nomi bo'lishi shart
            module_name = getattr(view, 'module_name', None)
            return bool(module_name)

        # 4. Mentorlar uchun qoida
        if user_role == 'mentor':
            module_name = getattr(view, 'module_name', None)
            # Mentorlar 'homework' modulida to'liq amallarni bajarishi mumkin
            if module_name == 'homework':
                return True
            # Boshqa modullarda faqat SAFE_METHODS
            return request.method in permissions.SAFE_METHODS

        # 5. Boshqa rollar – ruxsat yo'q
        return False
