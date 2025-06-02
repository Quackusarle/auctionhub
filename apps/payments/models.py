# auction_web/apps/payments/models.py
from django.db import models
from django.utils import timezone # Sửa thành django.utils.timezone
from datetime import timedelta
from django.conf import settings
from apps.items.models import Item #
from decimal import Decimal

def get_default_expires_date(): # Đổi tên hàm cho rõ ràng
    return timezone.now() + timedelta(days=3)

class Transaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Sale'), # Giao dịch mua bán đang chờ xử lý (nếu có bước nào đó) hoặc chờ admin xác nhận NẠP TIỀN
        ('pending_admin_confirmation', 'Pending Admin Confirmation'), # Cho giao dịch NẠP TIỀN
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]
    TRANSACTION_TYPE_CHOICES = [
        ('sale', 'Sale'),           # Giao dịch mua bán
        ('deposit', 'Deposit'),       # Giao dịch nạp tiền
        ('withdrawal', 'Withdrawal'), # Giao dịch rút tiền (nếu có)
    ]
    
    transaction_id = models.AutoField(primary_key=True)
    # Trong giao dịch 'deposit', buyer_id là người nạp tiền, seller_id có thể là null hoặc là admin/hệ thống
    buyer_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="initiated_transactions")
    seller_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="received_transactions", null=True, blank=True)
    item_id = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True) # Có thể null cho deposit/withdrawal
    
    final_price = models.DecimalField(max_digits=15, decimal_places=2) # Số tiền giao dịch hoặc số tiền nạp/rút
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    transaction_type = models.CharField(max_length=15, choices=TRANSACTION_TYPE_CHOICES, default='sale')
    
    created_date = models.DateTimeField(auto_now_add=True)
    # expires_date chủ yếu liên quan đến giao dịch mua bán chờ xử lý (nếu có)
    expires_date = models.DateTimeField(default=get_default_expires_date, null=True, blank=True) 

    # Các trường tùy chọn cho việc admin xác nhận (nếu cần theo dõi)
    # confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="confirmed_transactions", null=True, blank=True)
    # confirmation_date = models.DateTimeField(null=True, blank=True)

    def is_expired(self):
        if self.transaction_type == 'sale' and self.status == 'pending' and self.expires_date:
            return timezone.now() > self.expires_date
        return False
    
    class Meta:
        db_table = 'transactions'
        ordering = ['-created_date']

    def __str__(self):
        return f"{self.get_transaction_type_display()} #{self.transaction_id} - {self.get_status_display()}"