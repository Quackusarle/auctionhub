from django.urls import path
from .views import ItemList, ItemDetail, ItemCreate

urlpatterns = [
    path('items/', ItemList.as_view(), name='item-list'),
    path('items/create/', ItemCreate.as_view(), name='item-create'),
    path('items/<int:pk>/', ItemDetail.as_view(), name='item-detail'),
]