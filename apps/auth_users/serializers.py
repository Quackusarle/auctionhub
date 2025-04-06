# serializers.py
from rest_framework import serializers
from .models import User  # Hoặc from django.contrib.auth import get_user_model nếu dùng user mặc định đã custom

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer cho User model, chỉ lấy các trường cần thiết cho profile.
    """
    class Meta:
        model = User
        # Liệt kê các trường anh muốn hiển thị trong API
        fields = ['id', 'email', 'balance', 'created_at', 'profile_picture', 'is_active'] 
        # Thêm 'is_staff', 'is_superuser' nếu cần cho admin
        
        # Đặt một số trường là read-only nếu không muốn cho phép cập nhật qua API này
        read_only_fields = ['email', 'balance', 'created_at', 'is_active', 'id'] 
        # Email là username field, thường không đổi. Balance có thể cần logic riêng để cập nhật.