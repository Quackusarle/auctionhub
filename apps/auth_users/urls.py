from django.urls import path
from .views import UserList, UserDetail

urlpatterns = [
    path('users/', UserList.as_view()),
    path('users/<str:pk>/', UserDetail.as_view()),
]