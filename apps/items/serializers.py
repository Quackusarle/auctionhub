from rest_framework import serializers
from .models import Item

class ItemSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='seller_id.username', read_only=True)
    class Meta:
        model = Item
        fields = '__all__'
        read_only_fields = ['item_id', 'seller_id', 'seller_username', 'current_price']