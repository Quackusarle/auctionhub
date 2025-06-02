# auction_web/apps/dashboard_admin/views.py

from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
# Giả sử Transaction model nằm trong app 'payments'
from apps.payments.models import Transaction # Đảm bảo import đúng Transaction model
from apps.payments.services import TransactionService 
from django.utils import timezone # Để cập nhật thời gian nếu cần'
from apps.wallet.models import WalletTransaction as GiaoDichVi 

# Hàm kiểm tra user có phải là admin (superuser hoặc staff) không
def is_admin_user(user):
    """Kiểm tra xem user có phải là superuser hoặc staff user không."""
    if not user or not user.is_authenticated:
        return False
    return user.is_superuser or user.is_staff

@login_required
@user_passes_test(is_admin_user, login_url='/login/') # Chuyển hướng nếu không phải admin
def admin_dashboard_view(request):
    # Lấy các giao dịch nạp tiền đang chờ xác nhận (status='PENDING' và type='DEPOSIT')
    # Điều chỉnh filter cho đúng với giá trị status và transaction_type bạn dùng trong KhoiTaoGiaoDichNapTienAPIView
    pending_deposit_transactions = GiaoDichVi.objects.filter(
        transaction_type='DEPOSIT', # Dựa theo giá trị bạn dùng khi tạo GiaoDichVi
        status='PENDING'          # Dựa theo giá trị bạn dùng khi tạo GiaoDichVi
    ).order_by('-created_at') # Hoặc trường thời gian của GiaoDichVi
    
    context = {
        'page_title': "Xác nhận Giao dịch Nạp tiền",
        'deposit_transactions': pending_deposit_transactions, # Đổi tên context variable
        'csrf_token_value': request.COOKIES.get('csrftoken') 
    }
    return render(request, 'dashboard_admin/dashboard.html', context)


class ConfirmTransactionAPIView(APIView):
    """
    API để admin xác nhận một giao dịch NẠP TIỀN của người dùng.
    Khi admin xác nhận, trạng thái của giao dịch nạp tiền sẽ được cập nhật
    và số dư của người dùng sẽ được cộng thêm.
    """
    # permission_classes = [IsAuthenticated] # Đảm bảo chỉ người dùng đăng nhập mới gọi được
                                          # Việc kiểm tra is_admin_user cụ thể hơn

    def post(self, request, *args, **kwargs):
        # 1. Kiểm tra quyền admin
        if not is_admin_user(request.user):
            return Response(
                {"error_code": "PERMISSION_DENIED", "message": "Permission denied. Only admin users can perform this action."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Lấy transaction_id từ dữ liệu POST
        transaction_id_str = request.data.get('transaction_id')
        if not transaction_id_str:
            return Response(
                {"error_code": "MISSING_TRANSACTION_ID", "message": "Transaction ID is required in the request body."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            transaction_id = int(transaction_id_str)
            if transaction_id <= 0: # ID thường là số dương
                 raise ValueError("Transaction ID phải là số dương.")
        except ValueError:
            return Response(
                {"error_code": "INVALID_TRANSACTION_ID", "message": "Transaction ID không hợp lệ (phải là số nguyên dương)."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 3. Gọi service để xử lý logic xác nhận giao dịch nạp tiền
            # TransactionService.confirm_deposit_transaction sẽ xử lý việc:
            # - Lấy giao dịch nạp tiền (đảm bảo đúng type và status là pending_admin_confirmation)
            # - Lấy ví của người dùng (người nạp tiền)
            # - Cộng tiền vào ví người dùng
            # - Lưu lại ví
            # - Cập nhật trạng thái giao dịch nạp tiền thành 'completed'
            # - Tất cả trong một db_transaction.atomic() và có select_for_update()
            result = TransactionService.confirm_deposit_transaction(
                giao_dich_vi_id=transaction_id,
                admin_user=request.user # Truyền admin user nếu service cần ghi log ai đã xác nhận
            ) 
            
            # 4. Xử lý kết quả từ service
            if result.get("success", False): # Kiểm tra key "success" có tồn tại và là True không
                return Response({
                    "message": result.get("message", "Giao dịch nạp tiền đã được xác nhận thành công."),
                    "transaction_id": transaction_id,
                    "new_status": "completed" # Trạng thái mới sau khi xác nhận
                }, status=status.HTTP_200_OK)
            else:
                # Lỗi từ service (ví dụ: giao dịch không hợp lệ, ví không tìm thấy, lỗi logic nghiệp vụ)
                return Response(
                    {"error_code": result.get("error_code", "SERVICE_ERROR"), "message": result.get("message", "Có lỗi xảy ra từ dịch vụ xử lý.")}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        except ValueError as e: 
            # Bắt các lỗi ValueError cụ thể từ TransactionService (ví dụ: "Không tìm thấy giao dịch...")
            # Trả về 404 nếu lỗi là không tìm thấy, ngược lại là 400
            error_status = status.HTTP_404_NOT_FOUND if "không tồn tại" in str(e).lower() or "not found" in str(e).lower() else status.HTTP_400_BAD_REQUEST
            return Response(
                {"error_code": "VALIDATION_ERROR" if error_status == status.HTTP_400_BAD_REQUEST else "NOT_FOUND", "message": str(e)}, 
                status=error_status
            )
        except Exception as e: 
            # Các lỗi không mong muốn khác từ service hoặc trong quá trình gọi view
            print(f"Lỗi nghiêm trọng trong ConfirmTransactionAPIView khi gọi service: {type(e).__name__} - {str(e)}")
            # Không nên trả về chi tiết lỗi e cho client trong môi trường production
            return Response(
                {"error_code": "UNEXPECTED_SERVER_ERROR", "message": "Đã xảy ra lỗi không mong muốn trong quá trình xử lý. Vui lòng thử lại sau."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )