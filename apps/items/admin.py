from django.contrib import admin
from .models import Item

# Register your models here.
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'seller', 'starting_price', 'current_price', 'end_time', 'status')
    list_filter = ('status', 'end_time')
    search_fields = ('name', 'description', 'seller__email')
    ordering = ('-end_time',)
    readonly_fields = ('current_price',)

admin.site.register(Item, ItemAdmin)
