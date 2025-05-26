from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction as db_transaction  # Đổi tên để tránh trùng với model Transaction
from django.utils.timezone import now
from apps.payments.models import Transaction
from apps.auth_users.models import User
from apps.items.models import Item

class TransactionService:
    @staticmethod
    def create_transaction(buyer_id, seller_id, item_id, final_price):
        """Tạo transaction với trạng thái pending"""
        try:
            # Kiểm tra và lấy đối tượng
            buyer = User.objects.get(pk=buyer_id)
            seller = User.objects.get(pk=seller_id)
            item = Item.objects.get(pk=item_id)
            
            # Kiểm tra giá hợp lệ
            if float(final_price) <= 0:
                raise ValueError("Giá tiền phải lớn hơn 0")

            return Transaction.objects.create(
                buyer_id=buyer,  # Sử dụng buyer_id thay vì buyer
                seller_id=seller, # Sử dụng seller_id thay vì seller
                item_id=item,    # Sử dụng item_id thay vì item
                final_price=final_price,
                status="pending"
            )
            
        except User.DoesNotExist:
            raise ValueError(f"Không tìm thấy người dùng với ID {buyer_id} hoặc {seller_id}")
        except Item.DoesNotExist:
            raise ValueError(f"Không tìm thấy sản phẩm với ID {item_id}")
        except ValueError as e:
            raise ValueError(str(e))
        except Exception as e:
            raise Exception(f"Lỗi khi tạo giao dịch: {str(e)}")

    @staticmethod
    def process_payment(transaction_id):
        """Xử lý thanh toán"""
        try:
            txn = Transaction.objects.get(pk=transaction_id)
            
            if txn.status != "pending":
                return {"success": False, "message": "Giao dịch đã được xử lý trước đó."}

            # Kiểm tra người dùng
            if not hasattr(txn, 'buyer_id') or not hasattr(txn, 'seller_id'):
                txn.status = "failed"
                txn.save()
                return {"success": False, "message": "Thông tin người mua/người bán không hợp lệ."}

            # Kiểm tra số dư
            if txn.buyer_id.balance < txn.final_price:
                txn.status = "failed"
                txn.save()
                return {"success": False, "message": "Số dư không đủ."}

            # Xử lý thanh toán
            with db_transaction.atomic():
                # Cập nhật số dư
                txn.buyer_id.balance -= txn.final_price
                txn.seller_id.balance += txn.final_price
                
                txn.buyer_id.save()
                txn.seller_id.save()
                
                # Cập nhật trạng thái giao dịch
                txn.status = "completed"
                txn.save()

            return {"success": True, "message": "Thanh toán thành công."}
            
        except Transaction.DoesNotExist:
            return {"success": False, "message": "Không tìm thấy giao dịch."}
        except Exception as e:
            return {"success": False, "message": f"Lỗi xử lý giao dịch: {str(e)}"}

    @staticmethod
    def check_expired_transactions():
        """Kiểm tra và cập nhật giao dịch hết hạn"""
        try:
            expired_transactions = Transaction.objects.filter(
                status="pending", 
                expires_date__lt=now()
            ).select_related('buyer_id', 'seller_id')

            count = 0
            for txn in expired_transactions:
                txn.status = "failed"
                txn.save()
                count += 1
            
            return count
            
        except Exception as e:
            print(f"Lỗi khi kiểm tra giao dịch hết hạn: {str(e)}")
            return 0