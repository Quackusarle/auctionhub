from django.shortcuts import render,get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view,permission_classes
from rest_framework.response import Response
from .serializers import Bidserializers
from .models import User, Bid, Item
from django.utils.timezone import now
from rest_framework.permissions import IsAuthenticated, AllowAny
from decimal import Decimal, InvalidOperation
from django.db import transaction as db_transaction

# Hàm làm tròn tiền 
def Lamtrontien (amount):
    nghin = amount // 1000 
    tram  = amount % 1000
    if tram >= 500  :
        return (nghin + 1) * 1000
    else: 
        return nghin * 1000 

# API 1: Xử lý đặt giá thầu
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def place_bid(request):
    user = request.user
    item_id_str = request.data.get('item_id')
    bid_amount_str = request.data.get('bid_amount')

    if not item_id_str or not bid_amount_str:
        return Response({"error": "Thiếu dữ liệu đầu vào."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        item_id = int(item_id_str)
        bid_amount_decimal = Decimal(bid_amount_str)
        if bid_amount_decimal <= 0:
             raise ValueError("Giá đặt phải là số dương.")

    except (ValueError, TypeError, InvalidOperation) as e:
         print(f"Validation Error (Type Conversion): {e}")
         return Response({"error": "Dữ liệu không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        item = Item.objects.get(pk=item_id)
    except Item.DoesNotExist:
         return Response({"error": f"Sản phẩm với ID {item_id} không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

    if item.seller_id == user:
         return Response({"error": "Bạn không thể đặt giá cho sản phẩm của chính mình."}, status=status.HTTP_400_BAD_REQUEST)

    if item.end_time is None or now() > item.end_time:
        return Response({"error": "Phiên đấu giá đã kết thúc hoặc không hợp lệ!"}, status=status.HTTP_400_BAD_REQUEST)

    # --- START: MINIMUM BID CALCULATION (1% RULE) ---
    current_effective_price = item.current_price if item.current_price > Decimal('0') else item.starting_price
    min_increment_percentage = Decimal('0.01') # 1%
    min_increment_value = (current_effective_price * min_increment_percentage)
    min_valid_bid = current_effective_price + min_increment_value
    min_valid_bid = Lamtrontien(min_valid_bid)

    if bid_amount_decimal < min_valid_bid:
         min_bid_display = Lamtrontien(min_valid_bid.quantize(Decimal('1'))) 
         current_display = Lamtrontien(current_effective_price.quantize(Decimal('1')))
         increment_display = Lamtrontien(min_increment_value.quantize(Decimal('1'))) 

         error_message = (f"Giá đặt phải ít nhất là {min_bid_display:,.0f} VNĐ "
                          f"(cao hơn giá hiện tại {current_display:,.0f} VNĐ "
                          f"ít nhất 1% ≈ {increment_display:,.0f} VNĐ).") 
         print(f"Bid Amount Check Failed: Bid={bid_amount_decimal}, Min Valid={min_valid_bid}, Increment={min_increment_value}")
         return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)
    # --- END: MINIMUM BID CALCULATION (1% RULE) ---
    rounded_bid_amount = Lamtrontien(bid_amount_decimal)
    bid_data = {
        "item_id": item.pk,
        "user_id": user.pk,
        "bid_amount": rounded_bid_amount,
    }
    serializer = Bidserializers(data=bid_data)

    if serializer.is_valid():
        try:
            with db_transaction.atomic():
                bid_instance = serializer.save()
                item.current_price = bid_amount_decimal
                item.save(update_fields=['current_price'])

            response_data = serializer.data
            response_data['user_email'] = user.email
            response_data['bid_time'] = bid_instance.bid_time.isoformat()
            response_data['bid_amount'] = str(bid_instance.bid_amount) # Return new bid amount

            new_current_price = rounded_bid_amount
            new_min_increment = Lamtrontien(new_current_price * min_increment_percentage)
            
            next_min_bid = new_current_price + new_min_increment
            response_data['next_min_bid'] = str(next_min_bid.quantize(Decimal('1'))) 

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"ERROR saving bid/item: {e}")
            return Response({"error": "Lỗi máy chủ nội bộ khi lưu đặt giá."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    else:
        print(f"Serializer Errors: {serializer.errors}")
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
    context = {
        'item': item,
        'bids': bids,
    }
    return render(request, 'bidding/bidding_detail.html', context) 