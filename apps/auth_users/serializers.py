# serializers.py (trong app của cậu, ví dụ: accounts/serializers.py)
from rest_framework import serializers
# from django.contrib.auth.models import User # Không dùng User mặc định nữa
from .models import User # Import model User tùy chỉnh của cậu

class UserSerializer(serializers.ModelSerializer):
    # balance đã là DecimalField trong model, nhưng để đảm bảo output là string "0.00"
    # chúng ta có thể dùng CharField ở đây hoặc xử lý trong to_representation.
    # Nếu muốn nó trả về number thì dùng DecimalField.
    # Trong JSON mẫu của cậu là string "0.00", nên dùng CharField hoặc tùy chỉnh.
    balance = serializers.CharField(read_only=True) # Hoặc serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)

    # profile_picture là ImageField trong model, ImageField của serializer sẽ xử lý URL.
    profile_picture = serializers.ImageField(use_url=True, read_only=True)
    
    # created_at đã là DateTimeField trong model.
    # Định dạng lại cho giống yêu cầu JSON.
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S.%fZ", read_only=True)

    class Meta:
        model = User # Sử dụng model User tùy chỉnh của cậu
        fields = [
            'id', 
            'email', 
            'balance',         # Trực tiếp từ User model
            'created_at',      # Trực tiếp từ User model
            'profile_picture', # Trực tiếp từ User model
            'is_active'        # Trực tiếp từ User model
        ]
        # Các trường này thường không cho user tự sửa qua API profile/me/
        read_only_fields = ['id', 'email', 'created_at', 'is_active'] 

    def to_representation(self, instance):
        """
        Tùy chỉnh output, đặc biệt là cho balance để đảm bảo định dạng chuỗi "0.00".
        """
        representation = super().to_representation(instance)
        
        # Đảm bảo balance luôn là chuỗi "0.00"
        # instance.balance là một Decimal object.
        if instance.balance is not None:
            representation['balance'] = "{:.2f}".format(instance.balance)
        else:
            # Trường hợp này ít xảy ra nếu default=0 và không cho phép null
            representation['balance'] = "0.00"
            
        # ImageField với use_url=True đã trả về URL. 
        # Nếu profile_picture là None, nó sẽ trả về null, đúng như JSON mẫu.
        
        return representation

