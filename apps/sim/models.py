from django.db import models
from django.contrib.auth.models import User
from apps.auth_users.models import User

class Item(models.Model):
    name = models.CharField(max_length=200, help_text="Name of the auction item")
    description = models.TextField(help_text="Detailed description of the item")
    starting_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Starting bid price in VND")
    current_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Current highest bid")
    end_time = models.DateTimeField(help_text="Auction end time")
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="items")
    
    def __str__(self):
        return self.name

# sim/models.py
class Image(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="images", help_text="Associated auction item", null=True, blank=True)
    key = models.CharField(help_text="The public id of the uploaded file", max_length=100)
    url = models.CharField(max_length=100)
    name = models.CharField(max_length=100, help_text="The original name of the uploaded image")
    width = models.IntegerField(help_text="Width in pixels")
    height = models.IntegerField(help_text="Height in pixels")
    format = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.item.name if self.item else 'No Item'}: {self.name}"