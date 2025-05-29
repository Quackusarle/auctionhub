# auction_web/views.py
from django.shortcuts import render # Bỏ get_object_or_404 và HttpResponse nếu không dùng nữa
from django.http import HttpResponse
from django.conf import settings
import os
# from apps.items.models import Item # Giữ lại nếu bạn dùng ở đâu đó trong file này

# --- KHÔNG CÒN DỮ LIỆU MẪU Ở ĐÂY ---
# SAMPLE_BLOG_POSTS = { ... } # ĐÃ XÓA

# Hàm này sẽ xử lý việc hiển thị trang chủ
def home_view(request):
    context = {}
    return render(request, 'home/home.html', context)

def register_view(request):
    context = {}
    return render(request, 'account/signup.html', context)

def profile_view(request):
    context = {}
    return render(request, 'account/profile.html', context)

def about(request):
    return render(request, 'about/about.html')

def robots_txt(request):
    """Serve robots.txt file"""
    robots_path = os.path.join(settings.BASE_DIR, 'auction_web', 'static', 'robots.txt')
    try:
        with open(robots_path, 'r') as f:
            robots_content = f.read()
        return HttpResponse(robots_content, content_type='text/plain')
    except FileNotFoundError:
        # Fallback robots.txt nếu file không tồn tại
        robots_content = """User-agent: *
Allow: /
Sitemap: https://auctionhub.uk/sitemap.xml
"""
        return HttpResponse(robots_content, content_type='text/plain')

def sitemap_xml(request):
    """Serve sitemap.xml file"""
    sitemap_path = os.path.join(settings.BASE_DIR, 'auction_web', 'static', 'sitemap.xml')
    try:
        with open(sitemap_path, 'r') as f:
            sitemap_content = f.read()
        return HttpResponse(sitemap_content, content_type='application/xml')
    except FileNotFoundError:
        # Fallback sitemap nếu file không tồn tại
        sitemap_content = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://auctionhub.uk/</loc>
        <lastmod>2025-05-28</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
</urlset>'''
        return HttpResponse(sitemap_content, content_type='application/xml')

# --- CÁC VIEW CHO BLOG ---
def blog_post_list_view(request):
    """
    Hiển thị trang danh sách blog, nội dung bài viết được code hard-coded trong template.
    """
    context = {
        # Không còn 'posts': posts_data_for_template nữa
        'is_paginated': False,
    }
    return render(request, 'blog/post_list.html', context)

def blog_post_detail_view(request, post_slug=None):
    context = {
        'requested_slug': post_slug
    }
    return render(request, 'blog/post_detail.html', context)


# View cho trang contact (nếu bạn vẫn muốn có)
def contact_page_view(request):
    return render(request, 'contact_page.html')