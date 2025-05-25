# auction_web/urls.py
from django.contrib import admin
from django.urls import path, include
from . import views # views của project auction_web
from apps.items.views import item_detail_view
from apps.items.views import item_search_view
from apps.bidding.views import bidding_detail_view
from apps.bidding.views import my_active_bids_view

urlpatterns = [
    path('', views.home_view, name='home-template'),
    path('about/', views.about, name='about'),

    # --- URLS CHO BLOG ---
    # URL chi tiết bài viết (sử dụng slug) - PHẢI ĐẶT TRƯỚC URL danh sách
    path('blog/<slug:post_slug>/', views.blog_post_detail_view, name='blog_post_detail'),

    # URL danh sách bài viết
    path('blog/', views.blog_post_list_view, name='blog_post_list'),

    # Bạn có thể xóa dòng này nếu chỉ muốn dùng slug cho chi tiết bài viết
    # path('blog/post/<int:post_id>/', views.blog_post_detail_view, name='blog_post_detail_by_id'),

    path('contact/', views.contact_page_view, name='contact_us_page'),

    path('admin/', admin.site.urls),
    path('api/', include('apps.items.urls')),
    path('api/', include('apps.auth_users.urls')),
    path('api/bidding/', include('apps.bidding.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/wallet/', include('apps.wallet.urls', namespace='wallet')),
    path('accounts/', include('allauth.urls')),
    path('items/<int:pk>/', item_detail_view, name='item-detail-template'),
    path('items/<int:pk>/bidding/', bidding_detail_view, name='bidding-detail-page'),
    path('login-signup/', views.register_view, name='login-signup'),
    path('search/', item_search_view, name='search_results'),
    path('my-purchasing-items/', my_active_bids_view, name='my_purchasing_items_page'),
    path('user/profile/', views.profile_view, name='profile'),
]