from django.db import transaction
from django.utils.timezone import now
from apps.payments.models import Transaction, User, Item

class TransactionService:
    @staticmethod
    def create_transaction(buyer_id, seller_id, item_id, final_price):
        """Tạo transaction với trạng thái pending"""
        return Transaction.objects.create(
            buyer_id=buyer_id,
            seller_id=seller_id,
            item_id=item_id,
            final_price=final_price,
            status="pending"
        )

    @staticmethod
    def process_payment(transaction_id):
        """Xử lý thanh toán"""
        try:
            txn = Transaction.objects.get(transaction_id=transaction_id)
            
            if txn.status != "pending":
                return {"success": False, "message": "Giao dịch đã được xử lý trước đó."}

            buyer_id = User.get_user_by_id(txn.buyer_id)
            seller_id = User.get_user_by_id(txn.seller_id)

            if not buyer_id or not seller_id:
                txn.status = "failed"
                txn.save()
                return {"success": False, "message": "Người mua hoặc người bán không tồn tại."}

            if buyer_id.balance < txn.final_price:
                txn.status = "failed"
                txn.save()
                return {"success": False, "message": "Số dư không đủ."}

            # Sử dụng transaction.atomic để tránh lỗi khi xử lý database
            with transaction.atomic():
                User.update_balance(buyer_id, -txn.final_price)  # Trừ tiền người mua
                User.update_balance(seller_id, txn.final_price)  # Cộng tiền người bán
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
        expired_transactions = Transaction.objects.filter(status="pending", expires_date__lt=now())

        for txn in expired_transactions:
            txn.status = "failed"
            txn.save()
        
        return expired_transactions.count()