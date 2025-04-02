from django.shortcuts import render
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import ReviewsService
from .models import Reviews
from apps.auth_users.models import User

class CreateReviewView(APIView):
    """API để tạo đánh giá"""
    
    def post(self, request):
        reviewer_id = request.data.get("reviewer_id")
        reviewee_id = request.data.get("reviewee_id")
        rating = request.data.get("rating")
        review_text = request.data.get("review_text")
        
        if not all([reviewer_id, reviewee_id, rating, review_text]):
            return Response({"message": "Thiếu dữ liệu"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            review = ReviewsService.create_review(reviewer_id, reviewee_id, rating, review_text)
            return Response(
                {"message": "Đánh giá đã được tạo", "review_id": review.review_id},
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"message": f"Lỗi khi tạo đánh giá: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class GetReviewsByUserView(APIView):
    """API để lấy danh sách đánh giá của một người dùng (qua query param)"""

    def post(self, request):
        # Lấy user_id từ query parameter (?user_id=...)
        user_id_str = request.data.get('user_id') # query_params nhé!

        if not user_id_str:
            return Response({"message": "Thiếu tham số user_id trên URL (ví dụ: ?user_id=123)"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = int(user_id_str) # Ép kiểu sang số nguyên
            reviews = ReviewsService.get_reviews_by_user(user_id)

            # Nên dùng Serializer, nhưng tạm thời build thủ công và dùng đúng review_id
            review_list = [
                {
                    "review_id": review.review_id, # Dùng đúng tên khóa chính
                    "rating": review.rating,
                    "review_text": review.review_text,
                    # Có thể thêm các trường khác nếu muốn, ví dụ reviewer_id
                    # "reviewer_id": review.reviewer_id
                 }
                for review in reviews
            ]
            # Cân nhắc phân trang ở đây nếu danh sách quá dài
            return Response(review_list, status=status.HTTP_200_OK)

        except ValueError: # Lỗi khi ép kiểu int(user_id_str) hoặc lỗi ValueError("Không tìm thấy...") từ service
             # Phân biệt lỗi do user_id không hợp lệ hay do không tìm thấy user
             try:
                 # Thử kiểm tra xem lỗi có phải do không tìm thấy user không
                 User.objects.get(pk=int(user_id_str)) # Nếu dòng này lỗi ValueError khác -> user_id ko hợp lệ
                 # Nếu dòng trên không lỗi nhưng service vẫn lỗi -> Lỗi khác? Không nên xảy ra nếu service chỉ raise ValueError khi ko tìm thấy
                 # Giả định ValueError từ service chỉ là do User.DoesNotExist
                 return Response({"message": f"Không tìm thấy người dùng với ID {user_id_str}"}, status=status.HTTP_404_NOT_FOUND)
             except (ValueError, User.DoesNotExist): # Bắt cả lỗi ép kiểu hoặc User ko tồn tại từ check này
                 return Response({"message": f"User ID '{user_id_str}' không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            # Log lỗi ở đây logger.exception(e)
            print(f"Lỗi không xác định: {e}") # Tạm thời print ra để debug
            return Response(
                {"message": "Lỗi máy chủ nội bộ khi lấy danh sách đánh giá"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UpdateReviewView(APIView):
    """API để cập nhật một đánh giá"""
    
    def post(self, request):
        rating = request.data.get("rating")
        review_text = request.data.get("review_text")
        review_id = request.data.get("review_id")
        
        try:
            review = ReviewsService.update_review(review_id, rating, review_text)
            return Response(
                {"message": "Đánh giá đã được cập nhật", "review_id": review.review_id},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"message": f"Lỗi khi cập nhật đánh giá: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class DeleteReviewView(APIView):
    """API để xóa một đánh giá"""
    
    def post(self, request):
        review_id = request.data.get("review_id")
        try:
            ReviewsService.delete_review(review_id)
            return Response({"message": "Đánh giá đã được xóa"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"message": f"Lỗi khi xóa đánh giá: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )