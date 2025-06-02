import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auction_web.settings')

# Initialize Django ASGI application early to ensure the AppRegistry is populated
# before importing consumers and routing.
django_asgi_app = get_asgi_application()

# Import routing after Django setup
from apps.bidding.routing import websocket_urlpatterns

app = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})