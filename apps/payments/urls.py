from django.urls import path
from .views import CreateTransactionView, ProcessPaymentView

urlpatterns = [
    path("transactions/", CreateTransactionView.as_view(), name="create_transaction"),
    path("transactions/<int:transaction_id>/pay/", ProcessPaymentView.as_view(), name="process_payment"),
]