from django.urls import path
from .views import UserList, UserDetail
# urls.py (trong app của user)
from django.urls import path
from .views import (
    UserList, 
    UserDetail, 
    UserProfileView, 
    ProfilePictureUploadView,
    DeleteCurrentUserView 
)

# Đặt tên app để dùng trong reverse URL nếu cần
app_name = 'users' # Hoặc tên app của anh

urlpatterns = [
    # Các API cho Admin quản lý users
    path('users/', UserList.as_view(), name='user-list'), # api/users/
    path('users/<int:pk>/', UserDetail.as_view(), name='user-detail'), # api/users/1/ (Dùng <int:pk>)
    
    # API cho user hiện tại quản lý profile
    path('profile/me/', UserProfileView.as_view(), name='profile-me'), # api/profile/me/
    path('profile/avatar/', ProfilePictureUploadView.as_view(), name='profile-avatar-upload'), # api/profile/avatar/
    path('profile/delete/', DeleteCurrentUserView.as_view(), name='profile-delete'), # api/profile/delete/
]

# Lưu ý: Anh cần include file urls.py này vào file urls.py gốc của project
# Ví dụ trong project urls.py:
# path('api/', include('ten_app_cua_anh.urls')),