from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/home/$', consumers.HomeBidConsumer.as_asgi()),  # dành cho trang home
    re_path(r'ws/bidding/(?P<item_id>\d+)/$', consumers.BidConsumer.as_asgi()),  # dành cho từng trang đấu giá
]
