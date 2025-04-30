from django.shortcuts import render,get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import Bidserializers
from .models import Bid, Item
from django.utils.timezone import now
from decimal import Decimal
from rest_framework.permissions import IsAuthenticated, AllowAny

# API 1: Xử lý đặt giá thầu
@api_view(['POST'])
def place_bid(request):
    permission_classes = [IsAuthenticated]
    """
    Xử lý đặt giá thầu:
    - Kiểm tra sản phẩm có tồn tại không
    - Kiểm tra giá thầu hợp lệ (phải cao hơn current_price)
    - Cập nhật current_price của sản phẩm nếu hợp lệ
    - Lưu giá thầu vào lịch sử
    """
    item_id = request.data.get('item_id')
    user_id = request.data.get('user_id')
    bid_amount = request.data.get('bid_amount')

    if not item_id or not user_id or not bid_amount:
        return Response({"error": "Thiếu dữ liệu đầu vào!"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        item = Item.objects.get(item_id=item_id)
    except Item.DoesNotExist:
        return Response({"error": "Không tìm thấy Item với id đã cho!"}, status=status.HTTP_404_NOT_FOUND)

    item = get_object_or_404(Item, pk=item_id)
    
    if now() > item.end_time:
        return Response({"error": "Phiên đấu giá đã kết thúc!"}, status=status.HTTP_400_BAD_REQUEST)
    
    if float(bid_amount) <= float(item.current_price):
        return Response({"error": "Giá thầu phải cao hơn giá hiện tại!"}, status=status.HTTP_400_BAD_REQUEST)
    
    bid_data = {
        "item_id": item_id,
        "bid_amount": bid_amount,
        user_id: request.user.user_id,  # Lấy user_id từ request.user
    }
    serializer = Bidserializers(data=bid_data)
    
    if serializer.is_valid():
        serializer.save()
        item.current_price = bid_amount
        item.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# API 2: Lấy danh sách giá thầu của một sản phẩm
@api_view(['POST'])
def get_bids_for_item(request):
    permission_classes = [IsAuthenticated]
    item_id = request.data.get('item_id')
    
    if not item_id:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)
    
    item = get_object_or_404(Item, pk=item_id)

    bids = Bid.objects.filter(item_id=item).order_by('-bid_time')
    
    serializer = Bidserializers(bids, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

# API 3: Lấy giá thầu cao nhất của một sản phẩm
@api_view(['POST'])
def get_highest_bid(request):
    permission_classes = [IsAuthenticated]
    item_id = request.data.get('item_id')
    
    if not item_id:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)
    
    item = get_object_or_404(Item, pk=item_id)
    highest_bid = Bid.objects.filter(item_id=item).order_by('-bid_amount').first()
    
    if highest_bid:
        serializer = Bidserializers(highest_bid)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    return Response({"message": "Chưa có giá thầu nào cho sản phẩm này."}, status=status.HTTP_200_OK)


def bidding_detail_view(request, pk):
    permission_classes = [IsAuthenticated]
    
    item = get_object_or_404(Item, pk=pk)
    bids = Bid.objects.filter(item_id=item).order_by('-bid_time')[:10] 

    # --- THÊM LOGIC TÍNH GIÁ GỢI Ý VÀ GIÁ MIN ---
    min_bid_increment = Decimal('10000') # Ví dụ bước giá tối thiểu là 10,000 VNĐ (hoặc lấy từ settings/item)
    current_effective_price = item.current_price if item.current_price > 0 else item.starting_price

    # Giá trị tối thiểu người dùng phải nhập (lớn hơn giá hiện tại)
    # Dùng max để đảm bảo min_bid luôn >= giá khởi điểm + increment nếu chưa ai bid
    min_bid_value = max(item.current_price, item.starting_price) + min_bid_increment

    # Giá trị gợi ý hiển thị mặc định trong ô input
    # Có thể đặt bằng min_bid_value luôn, hoặc chỉ là giá hiện tại + bước nhảy
    suggested_bid = min_bid_value 
    # Hoặc bạn có thể muốn nó là giá hiện tại + bước nhảy nhưng không thấp hơn giá khởi điểm + bước nhảy
    # suggested_bid = max(item.current_price + min_bid_increment, item.starting_price + min_bid_increment)
    # Hoặc đơn giản chỉ là min_bid_value
    
    # --- KẾT THÚC LOGIC TÍNH GIÁ ---

    context = {
        'item': item,
        'bids': bids,
        'min_bid_value': min_bid_value,       # Truyền giá trị min vào context
        'suggested_bid': suggested_bid,     # Truyền giá trị gợi ý vào context
    }
    return render(request, 'bidding/bidding_detail.html', context) 