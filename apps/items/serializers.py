from rest_framework import serializers
from .models import Item # Đảm bảo model Item được import đúng

class ItemSerializer(serializers.ModelSerializer):
    image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Item
        # 'seller' vẫn là read_only và được gán trong view
        # 'current_price' và 'status' có giá trị default trong model
        # 'item_id' là AutoField
        fields = ['item_id', 'name', 'description', 'starting_price', 'end_time', 'seller', 'current_price', 'status', 'image_url']
        read_only_fields = ['seller', 'item_id', 'current_price', 'status']