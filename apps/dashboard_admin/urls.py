from django.urls import path
from .views import admin_dashboard_view, ConfirmTransactionAPIView # Và các view khác nếu có


app_name = 'dashboard_admin'

urlpatterns = [
    path('', admin_dashboard_view, name='admin_dashboard'),
    path('api/confirm-transaction/', ConfirmTransactionAPIView.as_view(), name='confirm_transaction_api'),
]