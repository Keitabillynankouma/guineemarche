from django.urls import path
from . import views

urlpatterns = [
    path('',
        views.ConversationListView.as_view(),
        name='conversation-list'),
    path('start/',
        views.StartConversationView.as_view(),
        name='start-conversation'),
    path('<uuid:conversation_id>/messages/',
        views.MessageListView.as_view(),
        name='message-list'),
    path('<uuid:conversation_id>/send/',
        views.SendMessageView.as_view(),
        name='send-message'),
]