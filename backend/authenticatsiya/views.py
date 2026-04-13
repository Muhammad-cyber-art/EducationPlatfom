from rest_framework import status, viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied ,ValidationError

from .serializers import (
    RegisterSerializer, LoginSerializer, UsersListSerializer, 
    CurrentUserSerializer, BranchAccessSerializer
)
from .models import UserModel, BranchAccess
from rest_framework_simplejwt.views import TokenObtainPairView
User = get_user_model()


# Custom permission logic (keyin permission class sifatida ishlatamiz)
def get_user_role(user):
    return user.role if hasattr(user, 'role') else None



class RegisterViewSet(ModelViewSet):
    queryset = UserModel.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['role', 'branch']
    search_fields = ['username', 'first_name', 'last_name']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin': 
            return UserModel.objects.all()
        
        # Admin ko'ra oladigan filiallar
        allowed = list(user.branch_accesses.values_list('branch_id', flat=True))
        if user.branch_id: 
            allowed.append(user.branch_id)
        
        if user.role == 'admin':
            return UserModel.objects.filter(branch_id__in=allowed).exclude(role='super_admin')
        return UserModel.objects.filter(id=user.id)

    def create(self, request, *args, **kwargs):
        """Ruxsatlarni tekshirish logikasi"""
        current_user = request.user
        target_role = request.data.get('role', 'mentor')

        if current_user.role == 'super_admin':
            pass 
        elif current_user.role == 'admin':
            # Admin faqat mentor yarata olishi haqidagi cheklov
            if target_role != 'mentor':
                return Response(
                    {"detail": "Admin faqat mentor qo'sha oladi."},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            return Response(
                {"detail": "Sizda foydalanuvchi yaratish huquqi yo'q."},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """branch_id ni saqlash logikasi (Tuzatilgan)"""
        user = self.request.user
        requested_branch_id = self.request.data.get('branch_id')

        # 1. Super Admin uchun logika
        if user.role == 'super_admin':
            if requested_branch_id:
                serializer.save(branch_id=requested_branch_id)
            else:
                serializer.save() # Agar super_admin branch_id yubormasa null ketaveradi
            return

        # 2. Admin uchun ruxsat berilgan filialni tekshirish
        allowed = list(user.branch_accesses.values_list('branch_id', flat=True))
        if user.branch_id: 
            allowed.append(user.branch_id)

        # ID ni integerga o'girib tekshiramiz (xavfsizlik uchun)
        try:
            valid_requested_id = int(requested_branch_id) if requested_branch_id else None
        except (ValueError, TypeError):
            valid_requested_id = None

        if valid_requested_id and valid_requested_id in allowed:
            serializer.save(branch_id=valid_requested_id)
        else:
            # Agar ruxsati yo'q filialni yuborgan bo'lsa yoki yubormagan bo'lsa
            # o'zining asosiy filialiga biriktiriladi
            serializer.save(branch_id=user.branch_id)

    @action(detail=False, methods=['get'], url_path='admins')
    def list_admins(self, request):
        if request.user.role != 'super_admin':
            return Response({"detail": "Faqat Super Admin ko'ra oladi."}, status=403)
        admins = UserModel.objects.filter(role='admin')
        serializer = UsersListSerializer(admins, many=True)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        reason = self.request.query_params.get('reason', "Admin tomonidan o'chirildi")
        from archivebase.services import send_to_archive
        send_to_archive(instance, request_user=self.request.user, reason=reason)
class UsersListView(ListAPIView):
    """Mentorlar ro'yxatini olish uchun (BranchAccess inobatga olingan)"""
    serializer_class = UsersListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'super_admin':
            return UserModel.objects.all()

        allowed_branches = []
        if user.branch_id: allowed_branches.append(user.branch_id)
        allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))

        return UserModel.objects.filter(
            role='mentor',
            branch_id__in=allowed_branches
        )

class CurrentUserView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user
from .permissions import  IsSuperAdmin

class BranchAccessViewSet(ModelViewSet):
    queryset = BranchAccess.objects.all().select_related('user', 'branch', 'granted_by')
    serializer_class = BranchAccessSerializer
    permission_classes = [IsAuthenticated,IsSuperAdmin]

    def get_queryset(self):
        """
        Agar user_id parametri berilgan bo'lsa, shu xodimning barcha filiallarini qaytaradi.
        Bu profilda xodimning qaysi filiallarda ishlashini ko'rsatish uchun kerak.
        """
        queryset = super().get_queryset()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset

    def perform_create(self, serializer):
        # Oldingi super_admin tekshiruvi (o'zgartirilmagan)
        if self.request.user.role != 'super_admin':
            raise PermissionDenied("Faqat super_admin ruxsat bera oladi.")
        
        # Yangi mantiq: Biriktirilayotgan user 'mentor' yoki 'admin' ekanligini tekshirish
        # (Bu qism mentorlarga branch biriktirishni ta'minlaydi)
        target_user = serializer.validated_data.get('user')
        if target_user and target_user.role not in ['mentor', 'admin']:
            raise ValidationError("Branch faqat mentor yoki adminlarga biriktirilishi mumkin.")

        serializer.save(granted_by=self.request.user)

    # Qolgan metodlar (o'zgartirilmagan, keraksiz bo'lsa ham saqlab qolindi)
    def check_super_admin(self):
        if self.request.user.role != 'super_admin':
            raise PermissionDenied("Faqat super_admin uchun ruxsat etilgan.")

    def perform_update(self, serializer):
        self.check_super_admin()
        
        # Update jarayonida ham target user mentor ekanligini tekshirish (ixtiyoriy lekin xavfsiz)
        target_user = serializer.validated_data.get('user')
        if target_user and target_user.role not in ['mentor', 'admin']:
            raise ValidationError("Faqat mentor yoki adminlarga branch biriktirish mumkin.")
            
        serializer.save()

    def perform_destroy(self, instance):
        """
        Xodimni filialdan olib tashlash.
        Muhim: Asosiy filialdan (user.branch) olib tashlashga ruxsat bermaymiz.
        """
        self.check_super_admin()
        
        # Xavfsizlik: Asosiy filialdan olib tashlashni oldini olish
        if instance.user.branch and instance.branch.id == instance.user.branch.id:
            raise ValidationError({
                "detail": "Xodimni asosiy filialidan olib tashlash mumkin emas. Avval boshqa filialga asosiy filial sifatida transfer qiling."
            })
        
        instance.delete()

    
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
