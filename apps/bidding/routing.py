from django.urls import re_path
from . import consumers

print("DEBUG Bidding routing: Top of bidding/routing.py - This file is being loaded.") # DÒNG DEBUG
websocket_urlpatterns = [
    re_path(r'ws/bidding/(?P<item_id>\d+)/$', consumers.BidConsumer.as_asgi()),
]
print(f"DEBUG Bidding routing: websocket_urlpatterns defined as: {websocket_urlpatterns}") # DÒNG DEBUG