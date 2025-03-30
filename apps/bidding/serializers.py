from rest_framework import serializers
from .models import Bid
from .models import Item
from .models import User


class Bidserializers(serializers.ModelSerializer):
    item_id = serializers.PrimaryKeyRelatedField(queryset=Item.objects.all())
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    class Meta:
        model = Bid
        fields = "__all__"
    