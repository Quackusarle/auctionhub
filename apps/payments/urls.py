from django.urls import path
from .views import CreateTransactionView, ProcessPaymentView
from . import views

app_name = 'payments'

urlpatterns = [
    path("transactions/create/", CreateTransactionView.as_view(), name="create_transaction"),
    path("transactions/pay/", ProcessPaymentView.as_view(), name="process_payment"),
    path("my-transactions/", views.MyTransactionsView.as_view(), name="my_transactions"),
]