from django.db import models
from django.contrib.auth.models import User
from apps.items.models import Item

class Bid(models.Model):
    bid_id = models.AutoField(primary_key=True)
    item_id = models.ForeignKey(Item, on_delete=models.CASCADE)  # Sản phẩm được đấu giá
    user_id = models.ForeignKey(User, on_delete=models.CASCADE)  # Người đặt giá
    bid_amount = models.DecimalField(max_digits=10, decimal_places=2)  # Giá đấu thầu
    bid_time = models.DateTimeField(auto_now_add=True)  # Thời gian đặt giá

    def __str__(self):
        return f"Bid {self.bid_id} - {self.user_id.username} - {self.bid_amount}"
    
    class Meta:
        db_table = "bids"  # Trùng khớp với bảng trong MySQL
