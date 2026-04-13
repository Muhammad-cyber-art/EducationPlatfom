# apps/groups/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    GroupViewSet, StudentViewSet, MentorViewSet, StudentNestedView,
    GroupSimpleViewSet, AdminViewSet, MentorListViewSet
)

router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'students', StudentViewSet, basename='student')
router.register(r'nested_mentors', MentorViewSet, basename='nested_mentor')
router.register(r'mentors', MentorListViewSet, basename='mentor')  # Yangi oddiy mentors list
router.register(r"nested_students",StudentNestedView,basename='nested_student')
router.register(r'nested_groups',GroupSimpleViewSet , basename='nested_group')
router.register(r'admins',AdminViewSet, basename='admins')

urlpatterns = [
    path('', include(router.urls)),
    # This gives:
    # GET  /api/groups/
    # POST /api/groups/
    # GET  /api/groups/{pk}/
    # PUT/PATCH/DELETE /api/groups/{pk}/
    # GET  /api/groups/{pk}/students/    -> GroupViewSet.students action
    # POST /api/groups/{pk}/add_student/ -> GroupViewSet.add_student action
    # GET/POST/PUT/PATCH/DELETE /api/students/ and /api/students/{pk}/
]
