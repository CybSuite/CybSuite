"""
WebSocket consumers for real-time scan status updates
"""
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.layers import get_channel_layer
from django.core.cache import cache


class ScanStatusConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for scan status updates"""

    async def connect(self):
        # Join the scan status group
        self.group_name = "scan_status"

        await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()

        # Send current scan status when client connects
        current_status = await self.get_current_scan_status()
        await self.send(
            text_data=json.dumps({"type": "scan_status", "data": current_status})
        )

    async def disconnect(self, close_code):
        # Leave the scan status group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get("type")

            if message_type == "get_status":
                # Client requesting current status
                current_status = await self.get_current_scan_status()
                await self.send(
                    text_data=json.dumps(
                        {"type": "scan_status", "data": current_status}
                    )
                )
        except json.JSONDecodeError:
            pass

    async def scan_status_update(self, event):
        """Handle scan status updates from group broadcast"""
        await self.send(
            text_data=json.dumps({"type": "scan_status", "data": event["data"]})
        )

    async def log_message(self, event):
        """Handle log messages from scanner"""
        await self.send(text_data=json.dumps({"type": "log", "data": event["data"]}))

    @database_sync_to_async
    def get_current_scan_status(self):
        """Get current scan status from cache"""
        return cache.get(
            "current_scan_status",
            {
                "status": "idle",
                "scanner_name": None,
                "start_time": None,
                "end_time": None,
                "progress": 0,
                "progress_bar": 0,
                "display_mode": "single",
                "current_portion": 0,
                "total_portions": None,
                "current_step": 0,
                "total_steps": None,
                "message": "No scan running",
                "results": None,
                "error": None,
            },
        )


class ScanStatusBroadcaster:
    """Helper class to broadcast scan status updates"""

    @staticmethod
    async def broadcast_status(status_data):
        """Broadcast scan status to all connected clients"""
        channel_layer = get_channel_layer()
        if channel_layer:
            await channel_layer.group_send(
                "scan_status", {"type": "scan_status_update", "data": status_data}
            )

        # Also update cache
        cache.set("current_scan_status", status_data, timeout=3600)  # 1 hour


class IngestStatusConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for ingest status updates"""

    async def connect(self):
        # Join the ingest status group
        self.group_name = "ingest_status"

        await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()

        # Send current ingest status when client connects
        current_status = await self.get_current_ingest_status()
        await self.send(
            text_data=json.dumps({"type": "ingest_status", "status": current_status})
        )

    async def disconnect(self, close_code):
        # Leave the ingest status group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get("type")

            if message_type == "get_status":
                # Client requesting current status
                current_status = await self.get_current_ingest_status()
                await self.send(
                    text_data=json.dumps(
                        {"type": "ingest_status", "status": current_status}
                    )
                )
            elif message_type == "ping":
                # Respond to ping with pong
                await self.send(text_data=json.dumps({"type": "pong"}))
        except json.JSONDecodeError:
            pass

    async def ingest_status_update(self, event):
        """Handle ingest status updates from the group"""
        await self.send(
            text_data=json.dumps({"type": "ingest_status", "status": event["status"]})
        )

    async def ingest_log_message(self, event):
        """Handle ingest log messages from the group"""
        await self.send(text_data=json.dumps({"type": "ingest_log", "data": event}))

    @database_sync_to_async
    def get_current_ingest_status(self):
        """Get current ingest status from cache"""
        return cache.get(
            "current_ingest_status",
            {
                "status": "idle",
                "ingestor_name": None,
                "start_time": None,
                "end_time": None,
                "progress": 0,
                "progress_bar": 0,
                "progress_type": "indeterminate",
                "current_portion": 0,
                "total_portions": None,
                "current_step": 0,
                "total_steps": None,
                "message": "No ingest running",
                "results": None,
                "error": None,
            },
        )


class IngestStatusBroadcaster:
    """Utility class for broadcasting ingest status updates via WebSocket"""

    @staticmethod
    async def broadcast_status(status_data):
        """Broadcast ingest status update to all connected clients"""
        channel_layer = get_channel_layer()
        if channel_layer:
            await channel_layer.group_send(
                "ingest_status", {"type": "ingest_status_update", "status": status_data}
            )

        # Also update cache
        cache.set("current_ingest_status", status_data, timeout=3600)  # 1 hour

    @staticmethod
    async def broadcast_log(ingestor_name, level, message):
        """Broadcast ingest log message to all connected clients"""
        channel_layer = get_channel_layer()
        if channel_layer:
            await channel_layer.group_send(
                "ingest_status",
                {
                    "type": "ingest_log_message",
                    "ingestor_name": ingestor_name,
                    "level": level,
                    "message": message,
                },
            )
