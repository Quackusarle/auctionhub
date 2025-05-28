from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_item, name='create_item'),
    path('get-upload-url/', views.get_upload_url, name='get_upload_url'),
]