from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.payments.services import TransactionService
from apps.payments.models import Transaction
from apps.items.models import Item
from apps.auth_users.models import User
from django.db import transaction as db_transaction
from django.shortcuts import get_object_or_404
from decimal import Decimal, InvalidOperation
from django.urls import reverse
from urllib.parse import urlencode

class CreateTransactionView(APIView):       
    """
    API để thực hiện giao dịch MUA BÁN.
    1. Kiểm tra số dư người mua.
    2. Nếu đủ: Trừ tiền người mua, cộng tiền người bán, tạo GiaoDichThanhToan 'completed'.
    3. Nếu không đủ: Trả về thông tin để frontend chuyển hướng đến trang ví và gợi ý nạp tiền.
    """
    def post(self, request, *args, **kwargs):
        buyer_id_str = request.data.get("buyer_id")
        seller_id_str = request.data.get("seller_id")
        item_id_str = request.data.get("item_id")
        final_price_str = request.data.get("final_price")

        if not all([buyer_id_str, seller_id_str, item_id_str, final_price_str]):
            return Response(
                {"error_code": "MISSING_DATA", "message": "Thiếu dữ liệu (buyer_id, seller_id, item_id, final_price)."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            buyer_id = int(buyer_id_str)
            seller_id = int(seller_id_str)
            item_id = int(item_id_str)
            final_price = Decimal(str(final_price_str)) # Đảm bảo final_price là Decimal

            if final_price <= Decimal('0'):
                return Response({"error_code": "INVALID_PRICE", "message": "Giá cuối cùng phải là một số dương."}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, InvalidOperation):
            return Response({"error_code": "INVALID_INPUT_FORMAT", "message": "Dữ liệu ID hoặc giá không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Bọc toàn bộ logic nghiệp vụ trong một atomic transaction
            with db_transaction.atomic():
                buyer = get_object_or_404(User, pk=buyer_id)
                seller = get_object_or_404(User, pk=seller_id)
                item = get_object_or_404(Item, pk=item_id)

                # Lấy User objects và khóa lại để cập nhật balance một cách an toàn
                # (Vì balance nằm trực tiếp trên User model)
                buyer_for_update = User.objects.select_for_update().get(pk=buyer.pk)
                
                # 1. Kiểm tra số dư người mua
                if buyer_for_update.balance < final_price:
                    
                    amount_needed = final_price - buyer_for_update.balance
                    wallet_page_url = "" 
                    ma_giao_dich_goc_cho_url = item_id
                    query_params = {
                            'mucDich': 'thanhToanSanPham',
                            'soTienCanNap': str(amount_needed.quantize(Decimal('0'))), 
                            'maGiaoDichGoc': str(ma_giao_dich_goc_cho_url)
                        }

                    try:
                        base_wallet_url = reverse('wallet:ten_url_trang_vi_cua_ban')
                    except Exception as e:
                        print(f"Lỗi khi reverse URL cho trang ví với params: {e}")
                        wallet_page_url_with_params = f"/api/wallet/?{urlencode(query_params)}" 

                    return Response(
                    {
                        "error_code": "INSUFFICIENT_FUNDS",
                        "message": f"Số dư không đủ. Cần nạp thêm {amount_needed:,.0f} VNĐ.",
                        "amount_needed": str(amount_needed), # Chuyển sang string cho JSON
                        "wallet_page_url": wallet_page_url_with_params, # URL đã bao gồm các tham số
                    },
                    status=status.HTTP_402_PAYMENT_REQUIRED
                )
                # 2. Nếu đủ tiền, thực hiện chuyển tiền
                seller_for_update = User.objects.select_for_update().get(pk=seller.pk)

                buyer_for_update.balance -= final_price
                seller_for_update.balance += final_price
                
                buyer_for_update.save(update_fields=['balance'])
                seller_for_update.save(update_fields=['balance'])
                
                # 3. Tạo GiaoDichThanhToan với status 'completed'
                txn = TransactionService.create_transaction(
                    buyer_id=buyer_id, 
                    seller_id=seller_id, 
                    item_id=item_id, 
                    final_price=final_price,
                    status="completed" # << GIAO DỊCH HOÀN TẤT NGAY
                )

                # 4. (Tùy chọn) Cập nhật trạng thái item thành đã bán/hoàn thành
                if hasattr(item, 'status'): # Kiểm tra item có trường status không
                    item.status = 'completed' # Hoặc 'sold', tùy theo model Item của bạn
                    item.save(update_fields=['status'])

            # Trả về response thành công (nằm ngoài khối atomic)
            return Response({
                "message": "Thanh toán thành công! Giao dịch đã hoàn tất.", 
                "transaction_id": txn.transaction_id,
                "status": txn.status
            }, status=status.HTTP_201_CREATED)

        except (User.DoesNotExist, Item.DoesNotExist) as e:
             # get_object_or_404 sẽ tự động raise Http404, DRF sẽ chuyển thành 404 response JSON
             # Khối này để bắt nếu bạn không dùng get_object_or_404 mà dùng User.objects.get() và nó raise DoesNotExist
            return Response({"error_code": "OBJECT_NOT_FOUND", "message": f"Không tìm thấy đối tượng cần thiết: {str(e)}"}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e: # Bắt lỗi từ TransactionService.create_transaction hoặc Decimal conversion
             return Response({"error_code": "VALIDATION_ERROR_SERVICE", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Lỗi không xác định trong CreateTransactionView: {type(e).__name__} - {str(e)}")
            return Response(
                {"error_code": "UNEXPECTED_SERVER_ERROR", "message": "Đã có lỗi không mong muốn xảy ra. Vui lòng thử lại sau."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ProcessPaymentView(APIView):
    """API để xử lý thanh toán"""

    def post(self, request):  # Không nhận transaction_id từ URL
        transaction_id = request.data.get("transaction_id")
        if not transaction_id:
            return Response({"message": "Thiếu transaction_id"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            txn = Transaction.objects.get(transaction_id=transaction_id)
        except Transaction.DoesNotExist:
            return Response({"message": "Giao dịch không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

        result = TransactionService.process_payment(transaction_id)
        return Response(result, status=status.HTTP_200_OK if result["success"] else status.HTTP_400_BAD_REQUEST)