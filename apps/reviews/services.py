from apps.reviews.models import Reviews
from apps.auth_users.models import User

class ReviewsService:
    @staticmethod
    def create_review(reviewer_id, reviewee_id, rating, review_text):
        """Tạo một đánh giá mới"""
        try:
            # Kiểm tra và lấy đối tượng người dùng
            reviewer = User.objects.get(pk=reviewer_id)
            reviewee = User.objects.get(pk=reviewee_id)
            
            # Tạo một đối tượng Reviews mới
            review = Reviews.objects.create(
                reviewer=reviewer,
                reviewee=reviewee,
                rating=rating,
                review_text=review_text
            )
            
            return review
        
        except User.DoesNotExist:
            raise ValueError(f"Không tìm thấy người dùng với ID {reviewer_id} hoặc {reviewee_id}")
        except Exception as e:
            raise Exception(f"Lỗi khi tạo đánh giá: {str(e)}")

    @staticmethod
    def get_reviews_by_user(user_id):
        """Lấy danh sách đánh giá của một người dùng"""
        try:
            user = User.objects.get(pk=user_id)
            reviews = Reviews.objects.filter(reviewee=user)
            return reviews
        
        except User.DoesNotExist:
            raise ValueError(f"Không tìm thấy người dùng với ID {user_id}")
        except Exception as e:
            raise Exception(f"Lỗi khi lấy danh sách đánh giá: {str(e)}")
        
    @staticmethod
    def update_review(review_id, rating=None, review_text=None):
        """Cập nhật một đánh giá"""
        try:
            review = Reviews.objects.get(pk=review_id)
            
            if rating is not None:
                review.rating = rating
            if review_text is not None:
                review.review_text = review_text
            
            review.save()
            return review
        
        except Reviews.DoesNotExist:
            raise ValueError(f"Không tìm thấy đánh giá với ID {review_id}")
        except Exception as e:
            raise Exception(f"Lỗi khi cập nhật đánh giá: {str(e)}")
        
    @staticmethod
    def delete_review(review_id):
        """Xóa một đánh giá"""
        try:
            review = Reviews.objects.get(pk=review_id)
            review.delete()
            return True
        
        except Reviews.DoesNotExist:
            raise ValueError(f"Không tìm thấy đánh giá với ID {review_id}")
        except Exception as e:
            raise Exception(f"Lỗi khi xóa đánh giá: {str(e)}")
