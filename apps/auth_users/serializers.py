# serializers.py (trong app của cậu, ví dụ: accounts/serializers.py)
from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    balance = serializers.CharField(read_only=True)
    profile_picture = serializers.ImageField(use_url=True, read_only=True)
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S.%fZ", read_only=True)


    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'balance',
            'created_at',
            'profile_picture',
            'is_active'
        ]
        read_only_fields = ['id', 'email', 'created_at', 'is_active']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.balance is not None:
            representation['balance'] = "{:.2f}".format(instance.balance)
        else:
            representation['balance'] = "0.00"
        return representation
