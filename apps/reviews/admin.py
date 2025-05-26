from django.contrib import admin
from .models import Reviews

# Register your models here.
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('review_id', 'reviewer', 'reviewee', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('reviewer__email', 'reviewee__email', 'review_text')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'review_id')

admin.site.register(Reviews, ReviewAdmin)
