# apps/wallet/urls.py
from django.urls import path
from . import views

app_name = 'wallet'  # Khai báo không gian tên cho ứng dụng này

urlpatterns = [
    path('', views.bang_dieu_khien_vi_view, name='bang_dieu_khien'),
    path('khoi-tao-nap-tien/', views.KhoiTaoGiaoDichNapTienAPIView.as_view(), name='api_khoi_tao_nap_tien'),
    path('ipn/vietqr-callback/', views.XuLyIPNTuVietQRAPIView.as_view(), name='api_xu_ly_ipn_vietqr'),
]
