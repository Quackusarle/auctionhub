from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from django.utils import timezone
from datetime import datetime
from apps.items.models import Item


class StaticViewSitemap(Sitemap):
    """Sitemap cho các trang tĩnh"""
    priority = 0.8
    changefreq = 'monthly'
    
    def items(self):
        return [
            'home-template',
            'about',
            'contact_us_page',
            'blog_post_list',
            'item-list-template',
            'login-signup',
        ]
    
    def location(self, item):
        return reverse(item)
    
    def lastmod(self, obj):
        return timezone.now()


class ItemSitemap(Sitemap):
    """Sitemap cho các sản phẩm đấu giá"""
    changefreq = 'daily'
    priority = 0.9
    
    def items(self):
        # Lấy các item đang ongoing (đang diễn ra)
        return Item.objects.filter(
            status='ongoing'
        ).order_by('-item_id')[:1000]  # Giới hạn 1000 items mới nhất
    
    def lastmod(self, obj):
        # Sử dụng end_time làm lastmod
        return obj.end_time
    
    def location(self, item):
        return reverse('item-detail-template', args=[item.pk])


class BlogPostSitemap(Sitemap):
    """Sitemap cho các trang blog (static)"""
    changefreq = 'weekly'
    priority = 0.7
    
    def items(self):
        # Vì blog posts là hard-coded, ta tạo list các slug có thể có
        return [
            'cach-tham-gia-dau-gia',
            'kinh-nghiem-dau-gia-thanh-cong',
            'tin-tuc-dau-gia-moi-nhat',
            'huong-dan-su-dung-website',
        ]
    
    def lastmod(self, obj):
        return timezone.now()
    
    def location(self, item):
        return reverse('blog_post_detail', args=[item])


# Dictionary chứa tất cả sitemaps
sitemaps = {
    'static': StaticViewSitemap,
    'items': ItemSitemap,
    'blog': BlogPostSitemap,
} 