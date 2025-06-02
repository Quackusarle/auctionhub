# auction_web/apps/payments/services.py
from django.db import transaction as db_transaction
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from django.shortcuts import get_object_or_404 # Nên dùng để lấy object hoặc báo lỗi 404

# Import các model với alias bạn đã định nghĩa hoặc tên chuẩn
from apps.payments.models import Transaction as GiaoDichThanhToan
# Giả định WalletTransaction (GiaoDichVi) được import từ apps.wallet.models
# Nếu chưa có, bạn cần tạo model này để lưu các giao dịch nạp/rút của ví
# Ví dụ: from apps.wallet.models import WalletTransaction as GiaoDichVi
# Tạm thời, tôi sẽ giả định bạn đã có model GiaoDichVi với các trường cần thiết
# Nếu GiaoDichVi của bạn có tên khác hoặc ở chỗ khác, hãy điều chỉnh import
try:
    from apps.wallet.models import WalletTransaction as GiaoDichVi
except ImportError:
    # Fallback hoặc xử lý nếu model GiaoDichVi chưa tồn tại / chưa được cung cấp
    # Điều này sẽ gây lỗi nếu hàm confirm_user_deposit được gọi mà GiaoDichVi không tồn tại.
    # Trong thực tế, bạn cần đảm bảo model này tồn tại.
    print("CẢNH BÁO: Model WalletTransaction (GiaoDichVi) không tìm thấy trong apps.wallet.models. Chức năng nạp tiền sẽ không hoạt động đúng.")
    GiaoDichVi = None # Để code không bị lỗi import ngay, nhưng sẽ lỗi khi dùng

from apps.items.models import Item
from django.contrib.auth import get_user_model

User = get_user_model()

class TransactionService:
    @staticmethod
    def create_transaction(buyer_id, seller_id, item_id, final_price, status="pending"):
        """
        Tạo một GIAO DỊCH MUA BÁN (GiaoDichThanhToan) với trạng thái được chỉ định.
        Hàm này được gọi bởi CreateTransactionView (cho mua bán).
        """
        try:
            buyer = get_object_or_404(User, pk=buyer_id)
            seller = get_object_or_404(User, pk=seller_id)
            item = get_object_or_404(Item, pk=item_id)
            
            try:
                price = Decimal(str(final_price)) # Chuyển đổi an toàn sang Decimal
                if price <= Decimal('0'):
                    raise ValueError("Giá tiền phải lớn hơn 0.")
            except InvalidOperation:
                raise ValueError("Định dạng giá tiền không hợp lệ.")

            # Model GiaoDichThanhToan của bạn hiện không có trường transaction_type
            # Nếu có, bạn có thể thêm: transaction_type="sale"
            return GiaoDichThanhToan.objects.create(
                buyer_id=buyer,
                seller_id=seller,
                item_id=item,
                final_price=price,
                status=status
            )
        # get_object_or_404 sẽ raise Http404 nếu không tìm thấy, 
        # nhưng nếu bạn muốn raise ValueError để view bắt cụ thể thì có thể dùng try-except User.DoesNotExist
        except User.DoesNotExist: # Bắt lỗi nếu get_object_or_404 không được dùng và bạn dùng User.objects.get
            raise ValueError(f"Không tìm thấy người dùng (ID: {buyer_id} hoặc {seller_id}).")
        except Item.DoesNotExist:
            raise ValueError(f"Không tìm thấy sản phẩm (ID: {item_id}).")
        except ValueError as e: # Bắt lại các ValueError đã raise ở trên (giá, định dạng giá)
            raise e
        except Exception as e:
            print(f"Lỗi không mong muốn khi tạo giao dịch mua bán: {type(e).__name__} - {str(e)}")
            raise Exception("Lỗi không mong muốn khi tạo giao dịch mua bán.")

    @staticmethod
    def process_payment(giao_dich_thanh_toan_id):
        """
        Xử lý thanh toán cho một GIAO DỊCH MUA BÁN (GiaoDichThanhToan) đang ở trạng thái 'pending'.
        Trừ tiền người mua, cộng tiền người bán, và cập nhật trạng thái giao dịch.
        Hàm này được gọi nếu CreateTransactionView không xử lý thanh toán ngay lập tức.
        """
        try:
            with db_transaction.atomic():
                sale_txn = get_object_or_404(GiaoDichThanhToan, pk=giao_dich_thanh_toan_id)

                if sale_txn.status != "pending":
                    return {"success": False, "message": "Giao dịch mua bán này đã được xử lý hoặc không ở trạng thái chờ."}

                # Lấy User objects và khóa lại để cập nhật balance
                buyer = User.objects.select_for_update().get(pk=sale_txn.buyer_id_id)
                seller = User.objects.select_for_update().get(pk=sale_txn.seller_id_id)
                
                amount_to_transfer = sale_txn.final_price # Đây là Decimal

                if buyer.balance < amount_to_transfer:
                    sale_txn.status = "failed" # Cập nhật trạng thái giao dịch thất bại
                    sale_txn.save(update_fields=['status'])
                    return {"success": False, "message": "Số dư người mua không đủ để thực hiện thanh toán."}

                # Thực hiện chuyển tiền
                buyer.balance -= amount_to_transfer
                seller.balance += amount_to_transfer
                
                buyer.save(update_fields=['balance'])
                seller.save(update_fields=['balance'])
                
                # Cập nhật trạng thái giao dịch mua bán
                sale_txn.status = "completed"
                sale_txn.save(update_fields=['status'])

                if sale_txn.item_id:
                    item_to_update = sale_txn.item_id
                    if hasattr(item_to_update, 'status'): # Kiểm tra item có trường status không
                        item_to_update.status = 'completed' # Hoặc 'sold'
                        item_to_update.save(update_fields=['status'])

                return {"success": True, "message": "Thanh toán cho giao dịch mua bán thành công."}
        
        except GiaoDichThanhToan.DoesNotExist: # Xử lý nếu get_object_or_404 không dùng
             return {"success": False, "message": f"Không tìm thấy giao dịch mua bán với ID {giao_dich_thanh_toan_id}."}
        except User.DoesNotExist:
             return {"success": False, "message": "Không tìm thấy người mua hoặc người bán của giao dịch."}
        except Exception as e:
            print(f"Lỗi khi xử lý thanh toán cho giao dịch mua bán (ID: {giao_dich_thanh_toan_id}): {type(e).__name__} - {str(e)}")
            return {"success": False, "message": f"Lỗi không mong muốn: {str(e)}"}

    @staticmethod
    def confirm_deposit_transaction(giao_dich_vi_id, admin_user): # HÀM MỚI
        """
        Xác nhận một GIAO DỊCH NẠP TIỀN (GiaoDichVi) bởi admin.
        Cộng tiền vào số dư của người dùng và cập nhật trạng thái GiaoDichVi.
        """
        if GiaoDichVi is None: # Kiểm tra nếu import GiaoDichVi thất bại
            raise ImportError("Model GiaoDichVi (WalletTransaction) chưa được định nghĩa hoặc import.")
            
        try:
            with db_transaction.atomic():
                deposit_request = get_object_or_404(
                    GiaoDichVi, 
                    pk=giao_dich_vi_id
                    # Thêm các điều kiện kiểm tra nghiêm ngặt hơn ở đây nếu cần, ví dụ:
                    # transaction_type='DEPOSIT', status='PENDING'
                    # Tuy nhiên, KhoiTaoGiaoDichNapTienAPIView đã tạo với các giá trị này
                )

                # Kiểm tra lại trạng thái và loại giao dịch trước khi xử lý
                if not hasattr(deposit_request, 'transaction_type') or deposit_request.transaction_type != 'DEPOSIT':
                    raise ValueError(f"Giao dịch ID {giao_dich_vi_id} không phải là giao dịch nạp tiền.")
                if not hasattr(deposit_request, 'status') or deposit_request.status != 'PENDING':
                    raise ValueError(f"Giao dịch ID {giao_dich_vi_id} không ở trạng thái chờ xác nhận (PENDING).")

                user_to_credit = User.objects.select_for_update().get(pk=deposit_request.user_id)
                amount_to_deposit = deposit_request.amount # Số tiền nạp từ GiaoDichVi (Decimal)

                # Cập nhật balance_before nếu cần (nếu nó chưa được set đúng khi tạo)
                if hasattr(deposit_request, 'balance_before') and (deposit_request.balance_before is None or deposit_request.balance_before != user_to_credit.balance):
                    deposit_request.balance_before = user_to_credit.balance
                
                user_to_credit.balance += amount_to_deposit
                user_to_credit.save(update_fields=['balance'])

                deposit_request.status = 'COMPLETED'
                if hasattr(deposit_request, 'balance_after'):
                    deposit_request.balance_after = user_to_credit.balance
                
                # Tùy chọn: Ghi nhận admin đã xác nhận và thời gian
                # if hasattr(deposit_request, 'confirmed_by_admin_field'):
                # deposit_request.confirmed_by_admin_field = admin_user
                # if hasattr(deposit_request, 'confirmation_date_field'):
                # deposit_request.confirmation_date_field = timezone.now()
                deposit_request.save() # Lưu tất cả các thay đổi trên deposit_request
                
                return {"success": True, "message": f"Đã xác nhận nạp {amount_to_deposit:,.0f} VNĐ cho người dùng {user_to_credit.email}."}

        except GiaoDichVi.DoesNotExist:
            raise ValueError(f"Không tìm thấy yêu cầu nạp tiền ID {giao_dich_vi_id} để xác nhận.")
        except User.DoesNotExist:
             raise ValueError(f"Không tìm thấy người dùng (ID: {deposit_request.user_id if 'deposit_request' in locals() else 'không xác định'}) của yêu cầu nạp tiền.")
        except ValueError as e: # Bắt các ValueError cụ thể từ các kiểm tra ở trên
            raise e
        except Exception as e:
            print(f"Lỗi Service - confirm_user_deposit (ID GiaoDichVi: {giao_dich_vi_id}): {type(e).__name__} - {str(e)}")
            raise Exception(f"Lỗi hệ thống khi xác nhận giao dịch nạp tiền ID {giao_dich_vi_id}.")

    @staticmethod
    def check_expired_transactions(): # Giữ nguyên tên
        """Kiểm tra và cập nhật giao dịch MUA BÁN (GiaoDichThanhToan) hết hạn"""
        try:
            # Model GiaoDichThanhToan của bạn không có transaction_type,
            # nên hàm này sẽ áp dụng cho tất cả GiaoDichThanhToan đang pending.
            expired_sale_transactions = GiaoDichThanhToan.objects.filter(
                status="pending", 
                expires_date__lt=timezone.now() 
            )

            count = 0
            updated_ids = []
            for txn in expired_sale_transactions:
                txn.status = "failed" 
                txn.save(update_fields=['status'])
                updated_ids.append(txn.transaction_id)
                count += 1
            
            if count > 0:
                print(f"Đã cập nhật {count} giao dịch mua bán hết hạn thành 'failed'. IDs: {updated_ids}")
            return count
        except Exception as e:
            print(f"Lỗi khi kiểm tra giao dịch mua bán hết hạn: {str(e)}")
            return 0