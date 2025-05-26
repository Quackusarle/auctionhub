from django.contrib import admin
from .models import Transaction

# Register your models here.
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('transaction_id', 'item_id', 'buyer_id', 'seller_id', 'final_price', 'status', 'created_date', 'expires_date')
    list_filter = ('status', 'created_date', 'expires_date')
    search_fields = ('item_id__name', 'buyer_id__email', 'seller_id__email')
    ordering = ('-created_date',)
    readonly_fields = ('created_date', 'transaction_id')

admin.site.register(Transaction, TransactionAdmin)
