from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.

from django.db import models
from django.core.validators import MinValueValidator

class User(AbstractUser):

    otp_secret = models.CharField(max_length=32)  # Lưu secret key cho OTP
    is_verified = models.BooleanField(default=False) # Đánh dấu tài khoản đã được xác thực hay chưa
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]  # Đảm bảo balance không âm
    )
    created_at = models.DateTimeField(auto_now_add=True)  # Tự động thêm thời gian tạo
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)

    def __str__(self):
        return self.username
