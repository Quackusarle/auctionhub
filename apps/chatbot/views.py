from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import logging
import requests
from datetime import datetime
import pytz

# Cấu hình logging để gỡ lỗi
logger = logging.getLogger(__name__)

# URL của API items
ITEMS_API_URL = "http://www.auctionhub.uk/api/items/"

# Hàm lấy dữ liệu từ API
def fetch_items_from_api():
    """Lấy danh sách items từ API."""
    try:
        response = requests.get(ITEMS_API_URL, timeout=5)
        response.raise_for_status()
        data = response.json()
        logger.info(f"Fetched items from API: {data}")
        return data.get('results', [])
    except requests.RequestException as e:
        logger.error(f"Error fetching items from API: {str(e)}")
        return []

# Hàm kiểm tra trạng thái phiên đấu giá dựa trên end_time
def get_auction_status(item):
    """Kiểm tra trạng thái phiên đấu giá dựa trên end_time."""
    current_time = datetime.now(pytz.timezone('Asia/Ho_Chi_Minh'))
    end_time_str = item.get('end_time')
    try:
        end_time = datetime.fromisoformat(end_time_str.replace('+07:00', '+0700'))
        if current_time > end_time:
            return "ended"
        return item.get('status', 'ongoing')
    except ValueError as e:
        logger.error(f"Error parsing end_time: {str(e)}")
        return item.get('status', 'ongoing')

# Hàm xử lý intent SearchProduct
def handle_search_product(data):
    """Xử lý intent SearchProduct: Tìm kiếm sản phẩm dựa trên tên."""
    parameters = data['queryResult'].get('parameters', {})
    query = parameters.get('product_name', '').lower()
    logger.info(f"SearchProduct intent - Extracted product_name: '{query}'")

    if not query:
        return "Vui lòng cung cấp tên sản phẩm để tìm kiếm! Ví dụ: 'Tìm iPhone'."

    items = fetch_items_from_api()
    if not items:
        return "Không thể truy cập danh sách sản phẩm ngay bây giờ. Vui lòng thử lại sau!"

    # Tìm sản phẩm khớp với query
    matching_items = [item for item in items if query in item['name'].lower()]
    logger.info(f"Matching items for '{query}': {matching_items}")
    if not matching_items:
        return f"Không tìm thấy sản phẩm nào liên quan đến {query}. Vui lòng thử lại với tên khác!"

    # Lấy sản phẩm đầu tiên khớp
    item = matching_items[0]
    item_id = item['item_id']
    name = item['name']
    description = item['description']
    status = get_auction_status(item)

    response_text = f"Đã tìm thấy sản phẩm: {name}.\nMô tả: {description}.\nTrạng thái: {status}.\n"
    response_text += f"Vui lòng truy cập https://auctionhub.uk/items/{item_id}/ để xem chi tiết!"
    return response_text

# Hàm xử lý intent CheckAuctionStatus
def handle_check_auction_status(data):
    """Xử lý intent CheckAuctionStatus: Kiểm tra trạng thái phiên đấu giá dựa trên product_name."""
    parameters = data['queryResult'].get('parameters', {})
    product_name = parameters.get('product_name', '').lower()
    logger.info(f"CheckAuctionStatus intent - Extracted product_name: '{product_name}'")

    if not product_name:
        return "Vui lòng cung cấp tên sản phẩm để kiểm tra trạng thái đấu giá. Ví dụ: 'Kiểm tra trạng thái đấu giá của J97'."

    items = fetch_items_from_api()
    if not items:
        return "Không thể truy cập danh sách sản phẩm ngay bây giờ. Vui lòng thử lại sau!"

    # Tìm sản phẩm khớp với product_name
    matching_items = [item for item in items if product_name in item['name'].lower()]
    if not matching_items:
        return f"Không tìm thấy sản phẩm nào liên quan đến {product_name}. Vui lòng thử lại với tên khác!"
    if len(matching_items) > 1:
        return f"Có nhiều sản phẩm khớp với {product_name}. Vui lòng cung cấp tên chính xác hơn."

    # Lấy sản phẩm đầu tiên khớp
    item = matching_items[0]
    item_id = item['item_id']
    name = item['name']
    status = get_auction_status(item)

    response_text = f"Phiên đấu giá cho sản phẩm {name} hiện đang {status}.\n"
    if status == "ongoing":
        response_text += f"Vui lòng truy cập https://auctionhub.uk/items/{item_id}/ để xem chi tiết và tham gia!"
    else:
        response_text += "Phiên đấu giá đã kết thúc."
    return response_text

# Hàm xử lý từng intent
def handle_greeting():
    return "Xin chào! Tôi là chatbot của AuctionHub. Bạn cần tìm kiếm sản phẩm, thông tin đấu giá, hay hỗ trợ gì khác? Vui lòng nói rõ nhé!"

def handle_get_help():
    return "Bạn cần hỗ trợ? Vui lòng liên hệ support@auctionhub.com hoặc gọi 09.1432.1432. Chúng tôi luôn sẵn sàng giúp bạn!"

def handle_auction_info():
    return "AuctionHub là nền tảng đấu giá trực tuyến. Bạn có thể tham gia đấu giá các sản phẩm từ điện thoại, laptop đến đồ cổ. Truy cập https://auctionhub.uk/items/ để xem các phiên đấu giá đang diễn ra!"

def handle_signup_guide():
    return "Để đăng ký tài khoản trên AuctionHub, bạn hãy truy cập https://auctionhub.uk/login-signup/, điền thông tin cá nhân và làm theo hướng dẫn. Sau khi đăng ký, bạn có thể tham gia đấu giá ngay!"

def handle_contact_info():
    return "Bạn có thể liên hệ với chúng tôi qua email: support@auctionhub.com hoặc số điện thoại: 09.1432.1432."

def handle_product_categories():
    return "AuctionHub có nhiều danh mục sản phẩm như: Điện tử (điện thoại, laptop), Đồ gia dụng, Đồ cổ, và Thời trang. Bạn có thể xem tất cả tại https://auctionhub.uk/items/!"

def handle_default_fallback():
    return "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Bạn có thể hỏi về sản phẩm, đấu giá, hoặc hỗ trợ. Ví dụ: 'Tìm iPhone', 'Cách đăng ký', hoặc 'Liên hệ hỗ trợ'. Nếu vẫn cần giúp, hãy thử lại hoặc liên hệ support@auctionhub.com!"

@csrf_exempt
def dialogflow_webhook(request):
    if request.method != 'POST':
        logger.info(f"Non-POST request received: {request.method} {request.path}")
        return JsonResponse({"error": "Only POST requests are allowed"}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        logger.info(f"Received webhook data: {data}")

        if 'queryResult' not in data:
            logger.error("Invalid request format: Missing 'queryResult'")
            return JsonResponse({"error": "Missing 'queryResult' in request"}, status=400)
        
        if 'intent' not in data['queryResult']:
            logger.error("Invalid request format: Missing 'intent' in queryResult")
            return JsonResponse({"error": "Missing 'intent' in queryResult"}, status=400)

        intent_name = data['queryResult']['intent'].get('displayName', 'UnknownIntent')
        logger.info(f"Processing intent: {intent_name}")

        if intent_name == 'Greeting':
            response_text = handle_greeting()
        elif intent_name == 'SearchProduct':
            response_text = handle_search_product(data)
        elif intent_name in ['GetHelp', 'webhookTest']:
            response_text = handle_get_help()
        elif intent_name == 'AuctionInfo':
            response_text = handle_auction_info()
        elif intent_name == 'SignUpGuide':
            response_text = handle_signup_guide()
        elif intent_name == 'ContactInfo':
            response_text = handle_contact_info()
        elif intent_name == 'CheckAuctionStatus':
            response_text = handle_check_auction_status(data)
        elif intent_name == 'ProductCategories':
            response_text = handle_product_categories()
        elif intent_name == 'Default Fallback Intent':
            response_text = handle_default_fallback()
        else:
            response_text = handle_default_fallback()

        response = {
            "fulfillmentText": response_text,
            "source": "auction_web_chatbot"
        }
        logger.info(f"Sending response: {response}")
        return JsonResponse(response)

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return JsonResponse({"error": "Invalid JSON data"}, status=400)

    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)