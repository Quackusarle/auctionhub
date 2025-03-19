from django.db import models
from django.utils.timezone import now
from datetime import timedelta
from django.conf import settings
from apps.items.models import Item


def get_expired_date():
    return now() + timedelta(days=3)

class Transaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    transaction_id = models.AutoField(primary_key=True)
    buyer_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transaction_buyer_id")
    seller_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transaction_seller_id")
    item_id = models.ForeignKey(Item, on_delete=models.CASCADE)
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_date = models.DateTimeField(auto_now_add=True)
    expires_date = models.DateTimeField(default=get_expired_date)  # Hết hạn sau 3 ngày

    def is_expired(self):
        return now() > self.expires_date
    
    class Meta:
        db_table = 'transactions'