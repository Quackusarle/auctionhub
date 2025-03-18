from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import Bidserializers
from .models import Bid, Item
from django.utils.timezone import now

@api_view (['POST'])
def place_bid (request):
    """
    Xử lý đặt giá thầu:
    - Kiểm tra sản phẩm có tồn tại không
    - Kiểm tra giá thầu hợp lệ (phải cao hơn current_price)
    - Cập nhật current_price của sản phẩm nếu hợp lệ
    - Lưu giá thầu vào lịch sử
    """
    serializer = Bidserializers(data=request.data)

    if serializer.is_valid():
        item_id = request.data.get('item')  # ID của sản phẩm
        bid_amount = request.data.get('bid_amount')  # Giá đặt thầu

        try:
            item = Item.objects.get(pk=item_id)
        except Item.DoesNotExist:
            return Response({"error": "Sản phẩm không tồn tại!"}, status=status.HTTP_404_NOT_FOUND)

        if now() > item.end_time:
            return Response({"error": "Phiên đấu giá đã kết thúc!"}, status=status.HTTP_400_BAD_REQUEST)

        if bid_amount <= item.current_price:
            return Response({"error": "Giá thầu phải cao hơn giá hiện tại!"}, status=status.HTTP_400_BAD_REQUEST)

        # Lưu giá thầu mới
        bid = serializer.save()

        # Cập nhật current_price của sản phẩm
        item.current_price = bid.bid_amount
        item.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# API: Lấy danh sách giá thầu của một sản phẩm
@api_view(['GET'])
def get_bids_for_item(request, item_id) :
    try:
        item = Item.objects.get(pk=item_id)
    except Item.DoesNotExist :
        return Response ({"Error" : "Sản Phẩm Không Tồn Tại"}, status = status.HTTP_404_NOT_FOUND)
    bids = Bid.objects.filter(item_id=item).order_by('-bid_time')
    serializer = Bidserializers(bids, many=True)

    return Response(serializer.data, status = status.HTTP_200_OK )

#API: Lấy giá thầu cao nhất của một sản phẩm nhất định
@api_view(['GET'])
def get_highest_bid(request, item_id) :
    try:
        item = Item.objects.get(pk=item_id)
    except Item.DoesNotExist :
        return Response({"Error" : "Sản Phẩm Không Tồn Tại"}, status = status.HTTP_404_NOT_FOUND)
    highest_bid = Bid.objects.filter(item_id=item).order_by('-big_amount').first()

    if highest_bid:
        serializer = Bidserializers(highest_bid)
        return Response(serializer.data)
    else:
        return Response({"message": "Chưa có giá thầu nào cho sản phẩm này."}, status=status.HTTP_200_OK)
    





