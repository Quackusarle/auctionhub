from django.urls import path
from .views import place_bid, get_bids_for_item, get_highest_bid, cancel_my_bid_view

app_name = "bidding"

urlpatterns = [
    path('place_bid/', place_bid, name='place_bid'),
    path('get_bids/', get_bids_for_item, name='get_bids_for_item'),
    path('highest_bid/',get_highest_bid, name='get_highest_bid'),
    path('cancel-my-bid/',cancel_my_bid_view, name='cancel_my_bid_api'),
]
