from django.urls import path
from .views import UserList, UserDetail, RegisterView, LoginView, VerifyOTPView, ResendOTPView
from rest_framework.routers import DefaultRouter

urlpatterns = [
     path('users/', UserList.as_view()),
     path('users/<str:pk>/', UserDetail.as_view()),
     path('register/', RegisterView.as_view(), name='register'),
     path('login/', LoginView.as_view(), name='login'),
     path('verified-otp/', VerifyOTPView.as_view(), name='verify-otp'),
     path('resend-otp/', ResendOTPView.as_view(), name='resend-otp'),
]




