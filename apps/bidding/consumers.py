# bidding/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class BidConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.item_id = self.scope['url_route']['kwargs']['item_id']
        self.item_group_name = f'item_bid_{self.item_id}'

        await self.channel_layer.group_add(
            self.item_group_name,
            self.channel_name
        )
        await self.accept()
        print(f"WebSocket connected for item {self.item_id}, group {self.item_group_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_remove(
            self.item_group_name,
            self.channel_name
        )
        print(f"WebSocket disconnected for item {self.item_id}")

    # Xử lý message 'bid_update' từ group
    async def bid_update(self, event):
        # Dữ liệu này được gửi từ place_bid hoặc cancel_my_bid_view
        data_to_send = {
            'type': 'bid_update', # Để JS biết loại cập nhật
            'item_details': event.get('item_details'),
            'bid_history': event.get('bid_history'),
            'new_highest_bid': event.get('new_highest_bid'),
            'bidder_info': event.get('bidder_info'), # Có thể có hoặc không
            'action_info': event.get('action_info') # Có thể có hoặc không (từ cancel_bid)
        }
        await self.send(text_data=json.dumps(data_to_send))
        print(f"Sent bid_update to client for item {self.item_id}")

    # Xử lý message 'auction_ended_update' từ group
    async def auction_ended_update(self, event):
        # Dữ liệu này được gửi từ xu_ly_phien_dau_gia_ket_thuc
        data_to_send = {
            'type': 'auction_ended_update', # Để JS biết loại cập nhật
            'item_details': event.get('item_details'), # Chi tiết item với status mới
            'winner_info': event.get('winner_info'),
            'message': event.get('message')
        }
        await self.send(text_data=json.dumps(data_to_send))
        print(f"Sent auction_ended_update to client for item {self.item_id}")