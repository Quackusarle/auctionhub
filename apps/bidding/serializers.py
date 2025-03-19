from rest_framework import serializers
from .models import Bid

class Bidserializers(serializers.ModelSerializer):
    class Meta:
        models = Bid
        fields = '__all__'
    