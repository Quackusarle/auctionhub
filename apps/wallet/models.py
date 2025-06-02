from django.conf import settings
from django.db import models
import uuid # Có thể dùng cho ID nếu muốn

class WalletTransaction(models.Model):

    TRANSACTION_TYPES = [
        ('DEPOSIT', 'Nạp tiền'),
        ('WITHDRAWAL', 'Rút tiền'),
        ('PURCHASE_PAYMENT', 'Thanh toán mua hàng'),
        ('SALE_RECEIVED', 'Nhận tiền bán hàng'),
        # Thêm các loại khác nếu cần
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Đang chờ xử lý'),
        ('PROCESSING', 'Đang xử lý'),
        ('COMPLETED', 'Hoàn thành'),
        ('FAILED', 'Thất bại'),
        ('CANCELLED', 'Đã hủy'),
    ]

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='wallet_transactions_history')

    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES,
        default='DEPOSIT', # Hoặc một giá trị mặc định phù hợp
        help_text="Loại giao dịch"
    )

    amount = models.DecimalField(max_digits=12, decimal_places=0) # Số tiền nguyên

    # THÊM TRƯỜNG status VÀO ĐÂY
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='PENDING', # Giá trị mặc định
        help_text="Trạng thái giao dịch"
    )

    balance_before = models.DecimalField(max_digits=12, decimal_places=0, help_text="Số dư trước khi thực hiện giao dịch này")
    balance_after = models.DecimalField(max_digits=12, decimal_places=0, help_text="Số dư sau khi giao dịch này hoàn thành")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    description = models.TextField(blank=True, null=True, help_text="Mô tả giao dịch, ví dụ: mã giao dịch nội bộ, lý do...")
    gateway_transaction_id = models.CharField(max_length=255, blank=True, null=True, db_index=True, help_text="ID giao dịch từ cổng thanh toán bên ngoài (nếu có)")
    # related_order_id = models.PositiveIntegerField(null=True, blank=True, help_text="ID của đơn hàng/phiên đấu giá liên quan (nếu có)")


    def __str__(self):
        # Đảm bảo hàm __str__ vẫn hoạt động sau khi thêm trường
        # Bạn có thể cần get_transaction_type_display() và get_status_display() nếu các trường này là CharField với choices
        return f"Ví-{self.id}: {self.user.email} - {self.get_transaction_type_display()} - {self.amount:,.0f} VNĐ - {self.get_status_display()}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Giao dịch Ví'
        verbose_name_plural = 'Lịch sử Giao dịch Ví'