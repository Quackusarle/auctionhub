# consumers.py

class HomeBidConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "homepage_items"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print("✅ WebSocket kết nối với trang chủ")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        print("❌ WebSocket trang chủ bị ngắt")

    async def bid_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'bid_update',
            'item_details': event.get('item_details'),
        }))
