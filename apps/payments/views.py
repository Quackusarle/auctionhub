from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.payments.services import TransactionService
from apps.payments.models import Transaction

class CreateTransactionView(APIView):
    """API để tạo giao dịch"""

    def post(self, request):
        buyer_id = request.data.get("buyer_id")
        seller_id = request.data.get("seller_id")
        item_id = request.data.get("item_id")
        final_price = request.data.get("final_price")

        if not all([buyer_id, seller_id, item_id, final_price]):
            return Response({"message": "Thiếu dữ liệu"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            txn = TransactionService.create_transaction(buyer_id, seller_id, item_id, final_price)
            return Response(
                {"message": "Giao dịch đã tạo", "transaction_id": txn.transaction_id},
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"message": f"Lỗi khi tạo giao dịch: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ProcessPaymentView(APIView):
    """API để xử lý thanh toán"""

    def post(self, request, transaction_id):
        try:
            Transaction.objects.get(transaction_id=transaction_id)
        except Transaction.DoesNotExist:
            return Response({"message": "Giao dịch không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

        result = TransactionService.process_payment(transaction_id)

        return Response(result, status=status.HTTP_200_OK if result["success"] else status.HTTP_400_BAD_REQUEST)