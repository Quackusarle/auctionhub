# auction_web/views.py
from django.shortcuts import render # Bỏ get_object_or_404 và HttpResponse nếu không dùng nữa
# from django.http import HttpResponse # Không cần nếu không dùng
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