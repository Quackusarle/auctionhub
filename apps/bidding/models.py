from django.db import models
from django.contrib.auth.models import User
from apps.auth_users.models import User
from apps.items.models import Item
from django.conf import settings

class Bid(models.Model):
    bid_id = models.AutoField(primary_key=True)
    item_id = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='bids')  # Sản phẩm được đấu giá
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # Người đặt giá
    bid_amount = models.DecimalField(max_digits=15, decimal_places=0)  # Giá đấu thầu
    bid_time = models.DateTimeField(auto_now_add=True)  # Thời gian đặt giá

    def __str__(self):
        return f"Bid {self.bid_id} - {self.user_id.username} - {self.bid_amount}"
    
    class Meta:
        db_table = "bids"  # Trùng khớp với bảng trong MySQL
