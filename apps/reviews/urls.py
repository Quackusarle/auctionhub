from django.urls import path
from .views import CreateReviewView, GetReviewsByUserView, UpdateReviewView, DeleteReviewView

urlpatterns = [
    path("create_review/", CreateReviewView.as_view(), name="create_review"),
    path("get_user_review/", GetReviewsByUserView.as_view(), name="get_reviews_by_user"),
    path("update_review/", UpdateReviewView.as_view(), name="update_review"),
    path("delete_review/", DeleteReviewView.as_view(), name="delete_review"),
]
