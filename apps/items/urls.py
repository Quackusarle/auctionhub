from django.urls import path
from .views import ItemList, ItemDetail, ItemCreate, ItemSearchAPI, ItemListAPI
from . import views
from django.views.generic import TemplateView

app_name = 'items'

urlpatterns = [
    path('items/', ItemListAPI.as_view(), name='item-list'),
    path('items/create-auction/', ItemCreate.as_view(), name='create-auction'),
    path('items/<int:pk>/', ItemDetail.as_view(), name='item-detail'),
    path('items/search/', ItemSearchAPI.as_view(), name='item_search_api'),
    path('get-upload-url/', views.get_upload_url, name='get_upload_url'),
]