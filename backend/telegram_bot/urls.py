from django.urls import path
from .views import BroadcastMessageView, BotStatisticsView

urlpatterns = [
    path('broadcast/', BroadcastMessageView.as_view(), name='broadcast-message'),
    path('statistics/', BotStatisticsView.as_view(), name='bot-statistics'),
]
