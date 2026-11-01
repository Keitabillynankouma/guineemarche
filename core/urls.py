from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'project/tasks',       views.ProjectTaskViewSet,      basename='project-tasks')
router.register(r'project/notes',       views.ProjectNoteViewSet,      basename='project-notes')
router.register(r'project/milestones',  views.ProjectMilestoneViewSet, basename='project-milestones')
router.register(r'project/team',        views.TeamMemberViewSet,       basename='project-team')

urlpatterns = [
    path('settings/',                   views.SiteSettingsView.as_view(),    name='site-settings'),
    path('support-chat/',               views.SupportChatView.as_view(),     name='support-chat'),
    path('documents/',                  views.DocumentsListView.as_view(),   name='documents-list'),
    path('documents/<str:slug>/',       views.DocumentDetailView.as_view(),  name='document-detail'),
    path('',                            include(router.urls)),
]
