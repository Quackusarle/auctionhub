# Generated by Django 5.1.6 on 2025-06-02 01:54

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletTransaction',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('transaction_type', models.CharField(choices=[('DEPOSIT', 'Nạp tiền'), ('WITHDRAWAL', 'Rút tiền'), ('PURCHASE_PAYMENT', 'Thanh toán mua hàng'), ('SALE_RECEIVED', 'Nhận tiền bán hàng')], default='DEPOSIT', help_text='Loại giao dịch', max_length=20)),
                ('amount', models.DecimalField(decimal_places=0, max_digits=12)),
                ('status', models.CharField(choices=[('PENDING', 'Đang chờ xử lý'), ('PROCESSING', 'Đang xử lý'), ('COMPLETED', 'Hoàn thành'), ('FAILED', 'Thất bại'), ('CANCELLED', 'Đã hủy')], default='PENDING', help_text='Trạng thái giao dịch', max_length=10)),
                ('balance_before', models.DecimalField(decimal_places=0, help_text='Số dư trước khi thực hiện giao dịch này', max_digits=12)),
                ('balance_after', models.DecimalField(decimal_places=0, help_text='Số dư sau khi giao dịch này hoàn thành', max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('description', models.TextField(blank=True, help_text='Mô tả giao dịch, ví dụ: mã giao dịch nội bộ, lý do...', null=True)),
                ('gateway_transaction_id', models.CharField(blank=True, db_index=True, help_text='ID giao dịch từ cổng thanh toán bên ngoài (nếu có)', max_length=255, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='wallet_transactions_history', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Giao dịch Ví',
                'verbose_name_plural': 'Lịch sử Giao dịch Ví',
                'ordering': ['-created_at'],
            },
        ),
    ]
