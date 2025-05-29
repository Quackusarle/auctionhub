# consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class BidConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.item_id = self.scope['url_route']['kwargs']['item_id']
        self.item_group_name = f'item_bid_{self.item_id}'
        await self.channel_layer.group_add(self.item_group_name, self.channel_name)
        await self.accept()
        print(f"WebSocket connected for item {self.item_id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.item_group_name, self.channel_name)

    async def bid_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'bid_update',
            'item_details': event.get('item_details'),
            'bid_history': event.get('bid_history'),
            'new_highest_bid': event.get('new_highest_bid'),
            'bidder_info': event.get('bidder_info'),
            'action_info': event.get('action_info'),
        }))

    async def auction_ended_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'auction_ended_update',
            'item_details': event.get('item_details'),
            'winner_info': event.get('winner_info'),
            'message': event.get('message'),
        }))

class HomeBidConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "homepage_items"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print("WebSocket connected for home")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def bid_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'bid_update',
            'item_details': event.get('item_details'),
        }))
