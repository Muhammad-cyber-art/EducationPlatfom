from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import( BranchFinanceDetailView, 
StudentPaymentViewSet, EmployeePaymentViewSet,StaffProfileViewSet ,
FinanceDashboardView,trigger_monthly_payments, FinanceTransactionViewSet,
trigger_absence_refunds, EmployeeAdvanceViewSet, AbsentTodayStudentsView)

router = DefaultRouter()
router.register(r'student-payments', StudentPaymentViewSet, basename='student-payment')
router.register(r'employee-payments', EmployeePaymentViewSet, basename='employee-payment')
router.register(r'staff-profiles', StaffProfileViewSet, basename='staff-profile')
router.register(r'transactions', FinanceTransactionViewSet, basename='finance-transaction')
router.register(r'employee-advances', EmployeeAdvanceViewSet, basename='employee-advance')
urlpatterns = [
    path('', include(router.urls)),
    path('statistics/', FinanceDashboardView.as_view(), name='finance-stats'),
    path('generate/',trigger_monthly_payments, name='trigger-monthly-payments'),
    path('statistics/branch-finance/<int:branch_id>/', BranchFinanceDetailView.as_view(), name='branch-finance-detail'),
    path('statistics/absent-students/<int:branch_id>/', AbsentTodayStudentsView.as_view(), name='absent-students-list'),
    path('absence-refunds/', trigger_absence_refunds, name='trigger-absence-refunds'),
]