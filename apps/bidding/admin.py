from django.contrib import admin
from .models import Bid

# Register your models here.
class BidAdmin(admin.ModelAdmin):
    list_display = ('item_id', 'user_id', 'bid_amount', 'bid_time')
    search_fields = ('item_id__name', 'user_id__email')
    ordering = ('-bid_time',)
    readonly_fields = ('bid_time',)

admin.site.register(Bid, BidAdmin)
