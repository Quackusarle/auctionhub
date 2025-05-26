from django.urls import path
from .views import CreateTransactionView, ProcessPaymentView

urlpatterns = [
    path("transactions/create/", CreateTransactionView.as_view(), name="create_transaction"),
    path("transactions/pay/", ProcessPaymentView.as_view(), name="process_payment"),
]