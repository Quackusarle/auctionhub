from django.urls import path
from .views import UserList, UserDetail, RegisterView, LoginView, VerifyOTPView, ResendOTPView, ChangePasswordView, ResetPasswordView, LogoutView
from rest_framework.routers import DefaultRouter

urlpatterns = [
     path('users/', UserList.as_view()),
     path('users/<str:pk>/', UserDetail.as_view()),
     path('register/', RegisterView.as_view(), name='register'),
     path('login/', LoginView.as_view(), name='login'),
     path('verified-otp/', VerifyOTPView.as_view(), name='verify-otp'),
     path('resend-otp/', ResendOTPView.as_view(), name='resend-otp'),
     path('change-password/', ChangePasswordView.as_view(), name='change-password'),
     path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
     path('logout/', LogoutView.as_view(), name='logout'),
]




