# apps/items/views.py
from django.shortcuts import render, get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Item
from .serializers import ItemSerializer
from rest_framework import permissions

class ItemList(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        items = Item.objects.all()
        serializer = ItemSerializer(items, many=True)
        return Response(serializer.data)

class ItemCreate(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        serializer = ItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ItemDetail(APIView):
    def get_object(self, pk):
        try:
            return Item.objects.get(pk=pk)
        except Item.DoesNotExist:
            return None

    def get(self, request, pk):
        item = self.get_object(pk)
        if item:
            serializer = ItemSerializer(item)
            return Response(serializer.data)
        return Response(status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        item = self.get_object(pk)
        if item:
            serializer = ItemSerializer(item, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        item = self.get_object(pk)
        if item:
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_404_NOT_FOUND)

# View cho trang chi tiết sản phẩm (item_details)
def item_detail_view(request, pk):
    item = get_object_or_404(Item, pk=pk)
    # Tính toán phần trăm giảm giá
    if item.starting_price and item.current_price and item.starting_price > 0:
        discount = ((item.starting_price - item.current_price) / item.starting_price) * 100
        discount = round(discount)  # Thực hiện làm tròn
    else:
        discount = 0
    return render(request, 'items/item_detail.html', {'item': item, 'discount': discount})