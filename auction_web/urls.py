"""
URL configuration for auction_web project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from apps.auth_users.views import register_template, login_template, verify_otp_template
from . import views

urlpatterns = [
    path('', views.home_view, name='home-template'),  # Trang chủ

    path('admin/', admin.site.urls),

    path('api/', include('apps.items.urls')),
    path('api/', include('apps.auth_users.urls')),
    path('register-page/', register_template, name='register-template'),
    path('login-page/', login_template, name='login-template'),
    path('verify-otp-page/', verify_otp_template, name='verify-otp-template'),

    path('api/bidding/', include('apps.bidding.urls')),

    path('api/payments/', include('apps.payments.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
]