from django.urls import path
from .views import UserList, UserDetail
# urls.py (trong app của user)
from django.urls import path
from .views import (
    UserList, 
    UserDetail, 
    UserProfileView, 
    ProfilePictureUploadView,
    GetProfilePictureView,
    DeleteCurrentUserView 
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView, # View có sẵn của simplejwt để lấy token
    TokenRefreshView,  # View có sẵn để làm mới token
)
from .views import (
    MyTokenObtainPairView, # View tùy chỉnh để lấy token với thông tin user
)

# Đặt tên app để dùng trong reverse URL nếu cần
app_name = 'users' # Hoặc tên app của anh

urlpatterns = [
    # API endpoint để đăng nhập:
    # Frontend sẽ gửi POST request với 'email' và 'password' tới URL này
    # Nếu thành công, nó trả về JSON chứa 'access' và 'refresh' token
    # path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # (Tùy chọn) Nếu muốn trả về thêm thông tin user khi login thành công:
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'), 

    # API endpoint để làm mới access token:
    # Frontend gửi POST request với 'refresh' token tới URL này
    # Nếu refresh token còn hạn, nó trả về 'access' token mới
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Các API cho Admin quản lý users
    path('users/', UserList.as_view(), name='user-list'), # api/users/
    path('users/<int:pk>/', UserDetail.as_view(), name='user-detail'), # api/users/1/ (Dùng <int:pk>)
    
    # API cho user hiện tại quản lý profile
    path('profile/me/', UserProfileView.as_view(), name='profile-me'), # api/profile/me/
    path('profile/upload_avatar/', ProfilePictureUploadView.as_view(), name='profile-avatar-upload'), # api/profile/avatar/
    path('profile/get_avatar/', GetProfilePictureView.as_view(), name='profile-avatar'), # api/profile/get_avatar/
    path('profile/delete/', DeleteCurrentUserView.as_view(), name='profile-delete'), # api/profile/delete/
]

# Lưu ý: Anh cần include file urls.py này vào file urls.py gốc của project
# Ví dụ trong project urls.py:
# path('api/', include('ten_app_cua_anh.urls')),