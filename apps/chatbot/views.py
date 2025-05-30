from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import logging

# Cấu hình logging để gỡ lỗi
logger = logging.getLogger(__name__)

@csrf_exempt
def dialogflow_webhook(request):
    if request.method == 'POST':
        try:
            # Lấy dữ liệu JSON từ request
            data = json.loads(request.body)
            logger.info(f"Received webhook data: {data}")

            # Lấy tên intent từ Dialogflow
            intent_name = data['queryResult']['intent']['displayName']
            response_text = "Xin chào! Đây là phản hồi từ webhook của AuctionHub."

            # Xử lý logic dựa trên intent
            if intent_name == 'SearchProduct':
                query = data['queryResult']['parameters'].get('product_name', '')
                if query:
                    response_text = f"Tìm thấy sản phẩm liên quan đến '{query}'. Vui lòng truy cập https://auctionhub.uk/items/ để xem chi tiết!"
                else:
                    response_text = "Vui lòng cung cấp tên sản phẩm để tìm kiếm!"

            elif intent_name == 'GetHelp':
                response_text = "Bạn cần hỗ trợ? Vui lòng liên hệ support@auctionhub.com hoặc gọi 09.1432.1432."

            # Tạo phản hồi JSON cho Dialogflow
            response = {
                "fulfillmentText": response_text,
                "source": "auction_web_chatbot"
            }
            return JsonResponse(response)
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}")
            return JsonResponse({"error": "Internal server error"}, status=500)
    else:
        return JsonResponse({"error": "Only POST requests are allowed"}, status=405)