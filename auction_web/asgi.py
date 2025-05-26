import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import apps.bidding.routing # Đảm bảo import này ở đây

print("DEBUG ASGI: Top of asgi.py - This file is being loaded.") # DÒNG DEBUG
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auction_web.settings')
http_application = get_asgi_application()

print("DEBUG ASGI: Loading bidding websocket_urlpatterns...") # DÒNG DEBUG
try:
    # In ra để xem nó có được load không và có nội dung gì
    print(f"DEBUG ASGI: apps.bidding.routing.websocket_urlpatterns = {apps.bidding.routing.websocket_urlpatterns}") # DÒNG DEBUG
except Exception as e:
    print(f"DEBUG ASGI: ERROR accessing websocket_urlpatterns - {e}") # DÒNG DEBUG

application = ProtocolTypeRouter({
    "http": http_application,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            apps.bidding.routing.websocket_urlpatterns
        )
    ),
})
print("DEBUG ASGI: ProtocolTypeRouter configured.") # DÒNG DEBUG