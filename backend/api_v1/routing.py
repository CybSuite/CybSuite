"""
WebSocket routing for scan status updates
"""
from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path("ws/scan-status/", consumers.ScanStatusConsumer.as_asgi()),
]
