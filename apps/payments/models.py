from django.db import models
from django.utils.timezone import now
from datetime import timedelta

class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @classmethod
    def get_user_by_id(cls, user_id):
        try:
            return cls.objects.get(user=user_id)
        except cls.DoesNotExist:
            return None

    @classmethod
    def update_balance(cls, user, amount):
        user.balance += amount
        user.save()
        return user
    
    class Meta:
        db_table = 'users'  # Tên bảng trong database
        managed = False  # Không để Django tự động tạo bảng này

class Item(models.Model):
    item_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    seller_id = models.ForeignKey(User, on_delete=models.CASCADE, related_name="item_seller_id")

    class Meta:
        db_table = 'items'  # Tên bảng trong database
        managed = False  # Không để Django tự động tạo bảng này


def get_expired_date():
    return now() + timedelta(days=3)

class Transaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    transaction_id = models.AutoField(primary_key=True)
    buyer_id = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transaction_buyer_id")
    seller_id = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transaction_seller_id")
    item_id = models.ForeignKey(Item, on_delete=models.CASCADE)
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_date = models.DateTimeField(auto_now_add=True)
    expires_date = models.DateTimeField(default=get_expired_date)  # Hết hạn sau 3 ngày

    def is_expired(self):
        return now() > self.expires_date
    
    class Meta:
        db_table = 'transactions'  # Tên bảng trong database
        managed = False  # Không để Django tự động tạo bảng này