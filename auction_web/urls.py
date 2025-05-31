# auction_web/urls.py
from django.contrib import admin
from django.urls import path, include
from . import views # views của project auction_web
from apps.items.views import item_detail_view
from apps.items.views import item_search_view
from apps.items.views import item_list_view
from apps.bidding.views import bidding_detail_view
from apps.bidding.views import my_active_bids_view
from apps.bidding.views import my_created_items_view

urlpatterns = [
    path('', views.home_view, name='home-template'),
    path('about/', views.about, name='about'),

    # --- SITEMAP & SEO ---
    path('sitemap.xml', views.sitemap_xml, name='sitemap'),
    path('robots.txt', views.robots_txt, name='robots_txt'),

    # --- URLS CHO BLOG ---
    # URL chi tiết bài viết (sử dụng slug) - PHẢI ĐẶT TRƯỚC URL danh sách
    path('blog/<slug:post_slug>/', views.blog_post_detail_view, name='blog_post_detail'),

    # URL danh sách bài viết
    path('blog/', views.blog_post_list_view, name='blog_post_list'),

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
    path('my-auctions/', my_created_items_view, name='my_auctions_page'),

    path('user/profile/', views.profile_view, name='profile'),
    path('items/', item_list_view, name='item-list-template'),

    # --- URLS CHO IMAGE UPLOAD ---
    path('image-upload/', include('apps.sim.urls')),

    # ---- URLS CHO CHATBOT ----
    path('chatbot/', include('apps.chatbot.urls'))
]