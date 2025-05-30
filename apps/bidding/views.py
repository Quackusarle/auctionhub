from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .serializers import Bidserializers
from apps.auth_users.models import User # HOẶC from django.conf import settings rồi dùng settings.AUTH_USER_MODEL
from .models import Bid
from apps.items.models import Item
from apps.payments.models import Transaction
from django.utils.timezone import now # Có thể dùng timezone.now()
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal, InvalidOperation
from django.db import transaction as django_db_transaction
from django.db.models import Max # Max được sử dụng trong code của bạn
from django.urls import reverse
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import json
from urllib.parse import urlencode
from django.db.models import Case, When, Value 

# Imports cho Django Channels
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

# import logging # Nếu bạn muốn ghi log chi tiết
# logger = logging.getLogger(__name__)

# --- HÀM HELPER ĐỂ CHUẨN BỊ DỮ LIỆU CHO WEBSOCKET ---
# QUAN TRỌNG: Bạn cần tùy chỉnh các hàm này để phù hợp với cấu trúc dữ liệu
# mà JavaScript (bidding_detail.js) của bạn cần.
def get_item_details_for_socket(item_obj):
    """
    Chuẩn bị dữ liệu chi tiết item dưới dạng dictionary để gửi qua WebSocket.
    TÙY CHỈNH HÀM NÀY CHO PHÙ HỢP VỚI SERIALIZER HOẶC CẤU TRÚC DỮ LIỆU CỦA BẠN.
    """
    return {
        'item_id': item_obj.pk,
        'name': item_obj.name,
        'image_url': item_obj.image_url.url if item_obj.image_url else '/static/images/placeholder_item_large.png', # Ví dụ
        'seller': {'email': item_obj.seller.email} if item_obj.seller else {'email': 'Người bán ẩn danh'}, # Ví dụ
        'current_price': str(item_obj.current_price), # Đảm bảo là string
        'starting_price': str(item_obj.starting_price), # Đảm bảo là string
        'end_time': item_obj.end_time.isoformat() if item_obj.end_time else None,
        'status': item_obj.status,
        # Thêm các trường khác mà updateItemUI trong bidding_detail.js cần
    }

def get_bid_history_for_socket(item_obj, limit=10):
    """
    Chuẩn bị lịch sử đấu giá dưới dạng list của dictionaries để gửi qua WebSocket.
    TÙY CHỈNH HÀM NÀY CHO PHÙ HỢP VỚI SERIALIZER HOẶC CẤU TRÚC DỮ LIỆU CỦA BẠN.
    """
    bids_query = Bid.objects.filter(item_id=item_obj).select_related('user_id').order_by('-bid_time')[:limit]
    # Nếu Bidserializers đã có user_detail (email) thì có thể dùng:
    # return Bidserializers(bids_query, many=True).data
    # Nếu không, tạo thủ công:
    bid_history = []
    for bid in bids_query:
        bid_history.append({
            'bid_amount': str(bid.bid_amount), # Đảm bảo là string
            'user_detail': {'email': bid.user_id.email if bid.user_id else 'Người dùng ẩn danh'},
            'bid_time': bid.bid_time.isoformat(),
        })
    return bid_history

# --- HÀM TIỆN ÍCH XỬ LÝ PHIÊN ĐẤU GIÁ KẾT THÚC ---
def xu_ly_phien_dau_gia_ket_thuc(item_id):
    try:
        # Thêm select_related để tối ưu query nếu bạn truy cập seller nhiều lần
        san_pham_ket_thuc = Item.objects.select_related('seller').get(pk=item_id)
        thoi_gian_hien_tai_utc = timezone.now()

        if san_pham_ket_thuc.status == 'ongoing' and san_pham_ket_thuc.end_time <= thoi_gian_hien_tai_utc:
            # Lấy bid thắng cuộc trước khi vào transaction để tránh vấn đề nếu có race condition nhỏ
            # (dù trong trường hợp này có thể không quá nghiêm trọng)
            bid_thang_cuoc_obj = Bid.objects.filter(item_id=san_pham_ket_thuc).select_related('user_id').order_by('-bid_amount', '-bid_time').first()

            with django_db_transaction.atomic():
                san_pham_ket_thuc.status = 'completed'
                san_pham_ket_thuc.save(update_fields=['status'])

                if bid_thang_cuoc_obj:
                    giao_dich_da_ton_tai = Transaction.objects.filter(
                        item_id=san_pham_ket_thuc,
                        buyer_id=bid_thang_cuoc_obj.user_id
                    ).exists()

                    if not giao_dich_da_ton_tai:
                        nguoi_ban = san_pham_ket_thuc.seller
                        if not nguoi_ban:
                            print(f"Loi: Khong tim thay nguoi ban cho item {san_pham_ket_thuc.pk} khi tao giao dich.")
                            raise ValueError(f"Thieu nguoi ban cho san pham {san_pham_ket_thuc.pk}")

                        Transaction.objects.create(
                            item_id=san_pham_ket_thuc,
                            buyer_id=bid_thang_cuoc_obj.user_id,
                            seller_id=nguoi_ban,
                            final_price=bid_thang_cuoc_obj.bid_amount,
                            status='pending'
                        )
                        print(f"Auction for item {san_pham_ket_thuc.name} completed. Winner: {bid_thang_cuoc_obj.user_id.email}. Price: {bid_thang_cuoc_obj.bid_amount}")
                else:
                    print(f"Auction for item {san_pham_ket_thuc.name} completed. No bids placed.")

            # --- GỬI THÔNG BÁO REAL-TIME KHI PHIÊN KẾT THÚC ---
            channel_layer = get_channel_layer()
            item_group_name = f'item_bid_{san_pham_ket_thuc.pk}'
            
            winner_info = None
            if bid_thang_cuoc_obj:
                winner_info = {
                    'email': bid_thang_cuoc_obj.user_id.email,
                    'bid_amount': str(bid_thang_cuoc_obj.bid_amount)
                }
            
            # Dữ liệu item chi tiết sau khi cập nhật status
            item_details_data = get_item_details_for_socket(san_pham_ket_thuc)

            async_to_sync(channel_layer.group_send)(
                item_group_name,
                {
                    'type': 'auction_ended_update', # Consumer cần xử lý type này
                    'item_details': item_details_data, # Gửi lại toàn bộ chi tiết item đã cập nhật
                    'winner_info': winner_info,
                    'message': f"Phiên đấu giá cho '{san_pham_ket_thuc.name}' đã kết thúc."
                }
            )
            # ----------------------------------
            return True
    except Item.DoesNotExist:
        print(f"Item with ID {item_id} does not exist for processing ended auction.")
    except Exception as e:
        # Thêm log chi tiết hơn nếu cần
        print(f"Error processing ended auction for item ID {item_id}: {e}")
    return False

# Hàm làm tròn tiền
def Lamtrontien (amount):
    if not isinstance(amount, Decimal):
        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, TypeError):
            return Decimal('0')
    nghin = amount // 1000
    tram  = amount % 1000
    if tram >= 500 :
        return (nghin + 1) * 1000
    else:
        return nghin * 1000

# API 1: Xử lý đặt giá thầu
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def place_bid(request):
    user = request.user
    item_id_str = request.data.get('item_id')
    bid_amount_str = request.data.get('bid_amount')

    if not item_id_str or not bid_amount_str:
        return Response({"error": "Thiếu dữ liệu đầu vào."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        item_id = int(item_id_str)
        bid_amount_decimal = Decimal(bid_amount_str)
        if bid_amount_decimal <= 0:
            raise ValueError("Giá đặt phải là số dương.")
    except (ValueError, TypeError, InvalidOperation) as e:
        print(f"Validation Error (Type Conversion): {e}")
        return Response({"error": "Dữ liệu không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        item = Item.objects.select_related('seller').get(pk=item_id) # Thêm select_related
    except Item.DoesNotExist:
        return Response({"error": f"Sản phẩm với ID {item_id} không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

    if item.status != 'ongoing': # Kiểm tra trạng thái trước
         return Response({"error": "Phiên đấu giá không còn hoạt động."}, status=status.HTTP_400_BAD_REQUEST)
    if item.end_time is None or timezone.now() > item.end_time:
        # Gọi xử lý kết thúc nếu chưa xử lý (mặc dù lý tưởng là task nền làm)
        if item.status == 'ongoing': # Chỉ gọi nếu vẫn đang ongoing
            xu_ly_phien_dau_gia_ket_thuc(item.pk) # Hàm này sẽ gửi update nếu có thay đổi
            item.refresh_from_db() # Lấy lại trạng thái mới nhất
        return Response({"error": "Phiên đấu giá đã kết thúc hoặc không hợp lệ!"}, status=status.HTTP_400_BAD_REQUEST)
    
    if item.seller == user: # Người bán không được tự đặt giá
        return Response({"error": "Người bán không được đặt giá cho sản phẩm của chính mình."}, status=status.HTTP_403_FORBIDDEN)

    current_effective_price = item.current_price if item.current_price > Decimal('0') else item.starting_price
    min_increment_percentage = Decimal('0.01')
    max_increment_percentage = Decimal('0.10')
    min_absolute_increment = Decimal('1000')

    calculated_min_bid = current_effective_price + max(current_effective_price * min_increment_percentage, min_absolute_increment)
    calculated_min_bid = Lamtrontien(calculated_min_bid)
    calculated_min_bid = max(calculated_min_bid, item.starting_price + min_absolute_increment)

    calculated_max_bid = current_effective_price + max(current_effective_price * max_increment_percentage, min_absolute_increment * 10)
    calculated_max_bid = Lamtrontien(calculated_max_bid)
    calculated_max_bid = max(calculated_max_bid, calculated_min_bid)

    if bid_amount_decimal < calculated_min_bid:
        min_bid_display = Lamtrontien(calculated_min_bid.quantize(Decimal('1')))
        # ... (error message của bạn) ...
        return Response({"error": f"Giá đặt phải ít nhất là {min_bid_display:,.0f} VNĐ."}, status=status.HTTP_400_BAD_REQUEST)

    if bid_amount_decimal > calculated_max_bid:
        max_bid_display = Lamtrontien(calculated_max_bid.quantize(Decimal('1')))
        # ... (error message của bạn) ...
        return Response({"error": f"Giá đặt không được vượt quá giá tối đa {max_bid_display:,.0f} VNĐ."}, status=status.HTTP_400_BAD_REQUEST)

    rounded_bid_amount = Lamtrontien(bid_amount_decimal)
    bid_data = {
        "item_id": item.pk,
        "user_id": user.pk,
        "bid_amount": rounded_bid_amount,
    }
    serializer = Bidserializers(data=bid_data)

    if serializer.is_valid():
        try:
            with django_db_transaction.atomic():
                bid_instance = serializer.save()
                item.current_price = rounded_bid_amount
                item.save(update_fields=['current_price'])

            # --- GỬI THÔNG BÁO REAL-TIME SAU KHI ĐẶT GIÁ ---
            channel_layer = get_channel_layer()
            item_group_name = f'item_bid_{item.pk}'

            item_details_data = get_item_details_for_socket(item) # item đã được cập nhật current_price
            bid_history_data = get_bid_history_for_socket(item)

            async_to_sync(channel_layer.group_send)(
                item_group_name,
                {
                    'type': 'bid_update', # Consumer sẽ gọi hàm bid_update
                    'item_details': item_details_data,
                    'bid_history': bid_history_data,
                    'new_highest_bid': str(item.current_price),
                    'bidder_info': {
                        'user_id': user.pk,
                        'email': user.email
                    }
                }
            )

            async_to_sync(channel_layer.group_send)(
                'homepage_items',
                {
                    'type': 'bid_update',
                    'item_details': item_details_data
                }
            )
            # ----------------------------------

            response_data = serializer.data.copy()
            response_data['user_email'] = user.email
            response_data['bid_time'] = bid_instance.bid_time.isoformat()
            response_data['bid_amount'] = str(Lamtrontien(bid_instance.bid_amount)) # Đã làm tròn

            new_current_price_for_next_bid = rounded_bid_amount
            new_min_increment_for_next_bid = max(new_current_price_for_next_bid * min_increment_percentage, min_absolute_increment)
            next_min_bid_value = new_current_price_for_next_bid + new_min_increment_for_next_bid
            response_data['next_min_bid'] = str(Lamtrontien(next_min_bid_value).quantize(Decimal('1')))

            return Response(response_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"ERROR saving bid/item: {e}")
            return Response({"error": "Lỗi máy chủ nội bộ khi lưu đặt giá."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    else:
        print(f"Serializer Errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# API 2: Lấy danh sách giá thầu của một sản phẩm
@api_view(['POST'])
@permission_classes([IsAuthenticated]) # Hoặc AllowAny nếu muốn ai cũng xem được
def get_bids_for_item(request):
    item_id_str = request.data.get('item_id')
    if not item_id_str:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        item_id = int(item_id_str)
    except ValueError:
        return Response({"error": "Item ID không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

    item = get_object_or_404(Item, pk=item_id)
    # Sử dụng hàm helper để đảm bảo dữ liệu nhất quán với WebSocket nếu cần
    # Hoặc dùng serializer như cũ nếu JS gọi API này riêng và tự xử lý
    bids_data = get_bid_history_for_socket(item, limit=None) # Lấy toàn bộ nếu limit=None
    return Response(bids_data, status=status.HTTP_200_OK)
    # Hoặc giữ nguyên nếu serializer của bạn đã đủ tốt:
    # bids = Bid.objects.filter(item_id=item).order_by('-bid_time').select_related('user_id')
    # serializer = Bidserializers(bids, many=True)
    # return Response(serializer.data, status=status.HTTP_200_OK)


# API 3: Lấy giá thầu cao nhất của một sản phẩm (Ít dùng nếu đã có real-time)
@api_view(['POST'])
@permission_classes([IsAuthenticated]) # Hoặc AllowAny
def get_highest_bid(request):
    # API này có thể không cần thiết nếu client luôn có giá cao nhất qua WebSocket
    # hoặc qua get_item_details_for_socket
    item_id_str = request.data.get('item_id')
    if not item_id_str:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        item_id = int(item_id_str)
    except ValueError:
        return Response({"error": "Item ID không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

    item = get_object_or_404(Item, pk=item_id)
    highest_bid = Bid.objects.filter(item_id=item).order_by('-bid_amount', '-bid_time').first()

    if highest_bid:
        serializer = Bidserializers(highest_bid) # Đảm bảo serializer này có user_detail
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response({"message": "Chưa có giá thầu nào cho sản phẩm này."}, status=status.HTTP_200_OK)

# View cho trang chi tiết đấu giá (HTML)
def bidding_detail_view(request, pk):
    item = get_object_or_404(Item, pk=pk)
    # Logic xử lý kết thúc phiên được loại bỏ, giả định tác vụ nền và WebSocket xử lý
    bids = Bid.objects.filter(item_id=item).order_by('-bid_time')[:10]
    context = {
        'item': item,
        'bids': bids,
    }
    return render(request, 'bidding/bidding_detail.html', context)

@login_required
@require_POST
def cancel_my_bid_view(request):
    try:
        data = json.loads(request.body)
        item_id_str = data.get('item_id')
        nguoi_dung_hien_tai = request.user

        if not item_id_str:
            return JsonResponse({'success': False, 'error': 'Thiếu item_id.'}, status=400)
        try:
            item_id = int(item_id_str)
        except ValueError:
            return JsonResponse({'success': False, 'error': 'Item ID không hợp lệ.'}, status=400)

        san_pham = get_object_or_404(Item, pk=item_id) # Nên là item, không phải san_pham
                                                       # để nhất quán, nhưng giữ theo code gốc của bạn
        thoi_gian_hien_tai_utc = timezone.now()

        if san_pham.status != 'ongoing' or not (san_pham.end_time and san_pham.end_time > thoi_gian_hien_tai_utc):
            return JsonResponse({'success': False, 'error': 'Không thể hủy bid cho phiên đấu giá đã kết thúc, bị hủy hoặc không hợp lệ.'}, status=400)

        bid_cao_nhat_cua_nguoi_dung = Bid.objects.filter(
            item_id=san_pham,
            user_id=nguoi_dung_hien_tai
        ).order_by('-bid_amount', '-bid_time').first()

        if not bid_cao_nhat_cua_nguoi_dung:
            return JsonResponse({'success': False, 'error': 'Bạn không có bid nào để hủy cho sản phẩm này.'}, status=400)

        gia_bid_can_xoa = bid_cao_nhat_cua_nguoi_dung.bid_amount
        
        with django_db_transaction.atomic():
            bid_cao_nhat_cua_nguoi_dung.delete()
            bid_cao_nhat_con_lai = Bid.objects.filter(item_id=san_pham).order_by('-bid_amount', '-bid_time').first()

            if bid_cao_nhat_con_lai:
                san_pham.current_price = bid_cao_nhat_con_lai.bid_amount
            else:
                san_pham.current_price = san_pham.starting_price if san_pham.starting_price > 0 else Decimal('0')
            san_pham.save(update_fields=['current_price'])

        # --- GỬI THÔNG BÁO REAL-TIME SAU KHI HỦY BID ---
        channel_layer = get_channel_layer()
        item_group_name = f'item_bid_{san_pham.pk}'

        item_details_data = get_item_details_for_socket(san_pham) # san_pham đã cập nhật current_price
        bid_history_data = get_bid_history_for_socket(san_pham)   # Lịch sử bid đã thay đổi

        async_to_sync(channel_layer.group_send)(
            item_group_name,
            {
                'type': 'bid_update', # Dùng lại type này, JS sẽ cập nhật UI
                'item_details': item_details_data,
                'bid_history': bid_history_data,
                'new_highest_bid': str(san_pham.current_price),
                'action_info': { # Thêm thông tin về hành động nếu JS cần
                    'action_type': 'bid_canceled',
                    'canceled_by_user_email': nguoi_dung_hien_tai.email,
                    'canceled_bid_amount': str(gia_bid_can_xoa)
                }
            }
        )

        async_to_sync(channel_layer.group_send)(
            'homepage_items',
            {
                'type': 'bid_update',
                'item_details': item_details_data
            }
        )
        # ----------------------------------

        return JsonResponse({
            'success': True,
            'message': f'Đã hủy lượt đặt giá {gia_bid_can_xoa:,.0f} VNĐ thành công.',
            'new_current_price_formatted': f"{san_pham.current_price:,.0f} VNĐ",
            'itemId': san_pham.pk
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Dữ liệu gửi lên không hợp lệ.'}, status=400)
    except Item.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Sản phẩm không tồn tại.'}, status=404)
    except Exception as e:
        print(f"Cancel bid API error: {e}")
        return JsonResponse({'success': False, 'error': 'Đã xảy ra lỗi không mong muốn khi hủy bid.'}, status=500)

@login_required
def my_active_bids_view(request):
    nguoi_dung_hien_tai = request.user  
    thoi_gian_hien_tai_utc = timezone.now()

    id_cac_san_pham_da_dau_gia = Bid.objects.filter(user_id=nguoi_dung_hien_tai).values_list('item_id', flat=True).distinct()
    
    danh_sach_san_pham_da_dau_gia = Item.objects.filter(pk__in=id_cac_san_pham_da_dau_gia)\
                                        .select_related('seller')\
                                        .order_by(Case(When(status='ongoing', end_time__gt=thoi_gian_hien_tai_utc, then=Value(0)), default=Value(1)), '-end_time')

    thong_tin_san_pham_kem_trang_thai = []
    
    for san_pham_item in danh_sach_san_pham_da_dau_gia: # Đổi tên biến để không trùng với 'san_pham' trong vòng lặp
        # Kiểm tra và xử lý nếu item đã hết hạn nhưng status chưa cập nhật
        # LƯU Ý: Lý tưởng nhất là việc này được xử lý bởi tác vụ nền (Celery)
        if san_pham_item.status == 'ongoing' and san_pham_item.end_time and san_pham_item.end_time <= thoi_gian_hien_tai_utc:
            print(f"Item {san_pham_item.pk} ({san_pham_item.name}) in my_active_bids_view appears to have ended. Processing now.")
            if xu_ly_phien_dau_gia_ket_thuc(san_pham_item.pk): # Hàm này đã được sửa để gửi thông báo real-time
                san_pham_item.refresh_from_db() # Lấy trạng thái mới nhất
                print(f"Processed item {san_pham_item.pk} in my_active_bids_view, new status: {san_pham_item.status}")
            else:
                print(f"Failed to process ended auction for item {san_pham_item.pk} in my_active_bids_view.")

        bid_cao_nhat_hien_tai_cua_toi = Bid.objects.filter(
            item_id=san_pham_item,
            user_id=nguoi_dung_hien_tai
        ).order_by('-bid_amount', '-bid_time').first()

        gia_thau_cao_nhat_cua_nguoi_dung = bid_cao_nhat_hien_tai_cua_toi.bid_amount if bid_cao_nhat_hien_tai_cua_toi else Decimal('0')
        bid_id_cao_nhat_cua_toi = bid_cao_nhat_hien_tai_cua_toi.bid_id if bid_cao_nhat_hien_tai_cua_toi else None
        
        trang_thai_san_pham_cho_nguoi_dung = "Mac dinh"
        ten_nut_hanh_dong_chinh = ""
        url_nut_hanh_dong_chinh = ""
        class_css_nut_hanh_dong_chinh = "btn-secondary"
        hien_thi_nut_huy = False
        id_giao_dich_cho_thanh_toan = None
        so_tien_can_thanh_toan = Decimal('0')

        if san_pham_item.status == 'ongoing': # Bỏ điều kiện end_time vì đã xử lý ở trên hoặc tác vụ nền sẽ xử lý
            trang_thai_san_pham_cho_nguoi_dung = "Dang dau gia"
            ten_nut_hanh_dong_chinh = "Dat gia lai"
            if bid_cao_nhat_hien_tai_cua_toi:
                hien_thi_nut_huy = True
            try:
                url_nut_hanh_dong_chinh = reverse('bidding-detail-page', kwargs={'pk': san_pham_item.pk})
            except Exception:
                url_nut_hanh_dong_chinh = "#"
            class_css_nut_hanh_dong_chinh = "btn-primary"

        elif san_pham_item.status == 'completed':
            giao_dich_thang_cuoc_cua_toi = Transaction.objects.filter(item_id=san_pham_item, buyer_id=nguoi_dung_hien_tai).first()
            
            if giao_dich_thang_cuoc_cua_toi:
                id_giao_dich_cho_thanh_toan = giao_dich_thang_cuoc_cua_toi.transaction_id
                so_tien_can_thanh_toan = giao_dich_thang_cuoc_cua_toi.final_price

                if giao_dich_thang_cuoc_cua_toi.status == 'completed':
                    trang_thai_san_pham_cho_nguoi_dung = "Đã thanh toán"
                    # ... (logic nút của bạn)
                elif giao_dich_thang_cuoc_cua_toi.status == 'pending':
                    trang_thai_san_pham_cho_nguoi_dung = "Dau gia thanh cong"
                    # ... (logic nút của bạn)
                else: # Giao dịch lỗi
                    trang_thai_san_pham_cho_nguoi_dung = "GD thanh toan loi"
                    # ... (logic nút của bạn)
            else:
                trang_thai_san_pham_cho_nguoi_dung = "Dau gia that bai"
                # ... (logic nút của bạn)
        elif san_pham_item.status == 'canceled':
            trang_thai_san_pham_cho_nguoi_dung = "Phien bi huy"
            # ... (logic nút của bạn)
        else:
            trang_thai_san_pham_cho_nguoi_dung = "Khong xac dinh"
            # ... (logic nút của bạn)

        # Đảm bảo giữ logic tạo URL và nút cho từng trường hợp trạng thái như code gốc của bạn
        # (Tôi đã rút gọn phần này để tập trung vào logic chính)
        # Ví dụ cho trường hợp "Da thanh toan":
        if trang_thai_san_pham_cho_nguoi_dung == "Da thanh toan":
             ten_nut_hanh_dong_chinh = "Xem chi tiet"
             try: url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham_item.pk})
             except Exception: url_nut_hanh_dong_chinh = "#"
             class_css_nut_hanh_dong_chinh = "btn-info"
        # Tương tự cho các trường hợp khác...
        elif trang_thai_san_pham_cho_nguoi_dung == "Dau gia thanh cong":
            ten_nut_hanh_dong_chinh = "Thanh Toan"
            query_params_cho_vi = {
                'mucDich': 'thanhToanSanPham',
                'soTienCanNap': str(so_tien_can_thanh_toan.quantize(Decimal('0'))),
                'maGiaoDichGoc': str(id_giao_dich_cho_thanh_toan)
            }
            try:
                url_vi = reverse('wallet:bang_dieu_khien')
                url_nut_hanh_dong_chinh = f"{url_vi}?{urlencode(query_params_cho_vi)}"
            except Exception as e:
                print(f"Loi khi tao URL cho vi tu my_active_bids_view (pending): {e}")
                url_nut_hanh_dong_chinh = "#"
            class_css_nut_hanh_dong_chinh = "btn-success"
        # (Thêm các else if khác cho các trạng thái bạn đã định nghĩa)
        elif trang_thai_san_pham_cho_nguoi_dung in ["GD thanh toan loi", "Dau gia that bai", "Phien bi huy", "Khong xac dinh"]:
            ten_nut_hanh_dong_chinh = "Xem san pham"
            try: url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham_item.pk})
            except Exception: url_nut_hanh_dong_chinh = "#"
            if trang_thai_san_pham_cho_nguoi_dung == "Phien bi huy":
                 class_css_nut_hanh_dong_chinh = "btn-warning"
            else:
                 class_css_nut_hanh_dong_chinh = "btn-secondary"


        thong_tin_san_pham_kem_trang_thai.append({
            'item': san_pham_item,
            'gia_cao_nhat_cua_toi': gia_thau_cao_nhat_cua_nguoi_dung,
            'bid_id_cao_nhat_cua_toi': bid_id_cao_nhat_cua_toi,
            'trang_thai_cho_toi': trang_thai_san_pham_cho_nguoi_dung,
            'chu_tren_nut_hanh_dong': ten_nut_hanh_dong_chinh,
            'url_cho_nut_hanh_dong': url_nut_hanh_dong_chinh,
            'class_css_cho_nut_hanh_dong': class_css_nut_hanh_dong_chinh,
            'hien_thi_nut_huy_dau_gia': hien_thi_nut_huy,
            'transaction_id_for_payment': id_giao_dich_cho_thanh_toan,
            'final_price_for_payment': so_tien_can_thanh_toan
        })

    context = {
        'page_title': 'San pham dang theo doi & Ket qua',
        'active_bids_info': thong_tin_san_pham_kem_trang_thai,
        'now': thoi_gian_hien_tai_utc,
        'csrf_token_value': request.COOKIES.get('csrftoken') # Nên dùng thẻ {% csrf_token %} trong template
    }
    return render(request, 'bidding/my_active_bids.html', context)