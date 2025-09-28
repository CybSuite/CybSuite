"""
WebSocket routing for scan and ingest status updates
"""
from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path("ws/scan-status/", consumers.ScanStatusConsumer.as_asgi()),
    path("ws/ingest-status/", consumers.IngestStatusConsumer.as_asgi()),
]
