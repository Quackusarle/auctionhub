from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .serializers import Bidserializers
# Giả sử User model của bạn được import từ apps.auth_users.models
from apps.auth_users.models import User # HOẶC from django.conf import settings rồi dùng settings.AUTH_USER_MODEL
from .models import Bid # Item được import từ apps.items.models
from apps.items.models import Item
from apps.payments.models import Transaction # Đảm bảo import này đúng
from django.utils.timezone import now # Có thể dùng timezone.now() thay thế
from rest_framework.permissions import IsAuthenticated, AllowAny
from decimal import Decimal, InvalidOperation
# Bỏ dòng import Decimal thừa
from django.db import transaction as django_db_transaction # Đổi tên để không bị nhầm với model Transaction
from django.db.models import Max, Q, Case, When, Value, CharField, OuterRef, Subquery, BooleanField, F
from django.urls import reverse
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import json
# import logging # Nếu bạn muốn ghi log chi tiết
# logger = logging.getLogger(__name__)

# --- HÀM TIỆN ÍCH XỬ LÝ PHIÊN ĐẤU GIÁ KẾT THÚC ---
# Hàm này nên được gọi bởi một tác vụ nền (Celery) hoặc một cơ chế khác
# khi một phiên đấu giá thực sự kết thúc.
# Đặt ở đây để tham khảo, bạn có thể chuyển nó vào tasks.py hoặc utils.py
def xu_ly_phien_dau_gia_ket_thuc(item_id):
    try:
        san_pham_ket_thuc = Item.objects.get(pk=item_id)
        thoi_gian_hien_tai_utc = timezone.now()

        # Chỉ xử lý nếu trạng thái đang là 'ongoing' và thời gian đã qua
        if san_pham_ket_thuc.status == 'ongoing' and san_pham_ket_thuc.end_time <= thoi_gian_hien_tai_utc:
            with django_db_transaction.atomic():
                san_pham_ket_thuc.status = 'completed'
                san_pham_ket_thuc.save(update_fields=['status'])

                bid_thang_cuoc = Bid.objects.filter(item_id=san_pham_ket_thuc).order_by('-bid_amount', '-bid_time').first()

                if bid_thang_cuoc:
                    # Kiểm tra xem giao dịch đã tồn tại chưa để tránh tạo trùng
                    giao_dich_da_ton_tai = Transaction.objects.filter(
                        item_id=san_pham_ket_thuc,
                        buyer_id=bid_thang_cuoc.user_id
                    ).exists()

                    if not giao_dich_da_ton_tai:
                        Transaction.objects.create(
                            item_id=san_pham_ket_thuc,
                            seller_id=san_pham_ket_thuc.seller,
                            buyer_id=bid_thang_cuoc.user_id,
                            final_price=bid_thang_cuoc.bid_amount, # Hoặc san_pham_ket_thuc.current_price
                            status='pending' # Chờ thanh toán
                        )
                        # logger.info(f"Auction for item {san_pham_ket_thuc.name} completed. Winner: {bid_thang_cuoc.user_id.email}. Price: {bid_thang_cuoc.bid_amount}")
                        print(f"Auction for item {san_pham_ket_thuc.name} completed. Winner: {bid_thang_cuoc.user_id.email}. Price: {bid_thang_cuoc.bid_amount}")

                else:
                    # logger.info(f"Auction for item {san_pham_ket_thuc.name} completed. No bids placed.")
                    print(f"Auction for item {san_pham_ket_thuc.name} completed. No bids placed.")
            return True
    except Item.DoesNotExist:
        # logger.warning(f"Item with ID {item_id} does not exist for processing ended auction.")
        print(f"Item with ID {item_id} does not exist for processing ended auction.")
    except Exception as e:
        # logger.error(f"Error processing ended auction for item ID {item_id}: {e}", exc_info=True)
        print(f"Error processing ended auction for item ID {item_id}: {e}")
    return False


# Hàm làm tròn tiền (giữ nguyên)
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
        item = Item.objects.get(pk=item_id)
    except Item.DoesNotExist:
        return Response({"error": f"Sản phẩm với ID {item_id} không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

    # SỬA LỖI NHỎ: if item.seller == user (nếu người bán không được tự bid)
    # Hiện tại là item.seller != user (nếu chỉ người khác mới được bid)
    # Giả sử logic hiện tại là đúng: không cho người bán tự bid
   # if item.seller == user:
   #     return Response({"error": "Bạn không thể đặt giá cho sản phẩm của chính mình."}, status=status.HTTP_400_BAD_REQUEST)

    if item.end_time is None or timezone.now() > item.end_time: # Sử dụng timezone.now()
        return Response({"error": "Phiên đấu giá đã kết thúc hoặc không hợp lệ!"}, status=status.HTTP_400_BAD_REQUEST)

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
        current_display = Lamtrontien(current_effective_price.quantize(Decimal('1')))
        actual_increment_value = max(current_effective_price * min_increment_percentage, min_absolute_increment) # Sửa lỗi min_increment_value
        increment_display = Lamtrontien(actual_increment_value.quantize(Decimal('1')))
        error_message = (f"Giá đặt phải ít nhất là {min_bid_display:,.0f} VNĐ "
                         f"(cao hơn giá hiện tại {current_display:,.0f} VNĐ "
                         f"ít nhất 1% hoặc {increment_display:,.0f} VNĐ).")
        print(f"Bid Amount Check Failed: Bid={bid_amount_decimal}, Min Valid={calculated_min_bid}, Increment Value Used for Display={increment_display}")
        return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)

    if bid_amount_decimal > calculated_max_bid:
        max_bid_display = Lamtrontien(calculated_max_bid.quantize(Decimal('1')))
        error_message = (f"Giá đặt không được vượt quá giá tối đa {max_bid_display:,.0f} VNĐ "
                         f"(giá hiện tại + 10%).")
        print(f"Bid Amount Check Failed: Bid={bid_amount_decimal}, Max Valid={calculated_max_bid}")
        return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)

    rounded_bid_amount = Lamtrontien(bid_amount_decimal)
    bid_data = {
        "item_id": item.pk,
        "user_id": user.pk,
        "bid_amount": rounded_bid_amount,
    }
    serializer = Bidserializers(data=bid_data)

    if serializer.is_valid():
        try:
            with django_db_transaction.atomic(): # Sử dụng alias
                bid_instance = serializer.save()
                item.current_price = rounded_bid_amount
                item.save(update_fields=['current_price'])

            response_data = serializer.data.copy() # Tạo bản sao để tránh thay đổi dữ liệu gốc của serializer
            response_data['user_email'] = user.email
            response_data['bid_time'] = bid_instance.bid_time.isoformat()
            response_data['bid_amount'] = str(Lamtrontien(bid_instance.bid_amount))

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
@api_view(['POST']) # Nên là GET nếu chỉ lấy dữ liệu và item_id qua URL params
@permission_classes([IsAuthenticated]) # Nên là AllowAny nếu ai cũng xem được bids
def get_bids_for_item(request):
    # Nếu là GET, item_id nên lấy từ request.query_params.get('item_id')
    item_id_str = request.data.get('item_id') # Giữ nguyên nếu vẫn muốn POST

    if not item_id_str:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        item_id = int(item_id_str)
    except ValueError:
        return Response({"error": "Item ID không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)


    item = get_object_or_404(Item, pk=item_id)
    bids = Bid.objects.filter(item_id=item).order_by('-bid_time').select_related('user_id') # Thêm select_related
    serializer = Bidserializers(bids, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

# API 3: Lấy giá thầu cao nhất của một sản phẩm
@api_view(['POST']) # Tương tự, nên là GET
@permission_classes([IsAuthenticated]) # Tương tự, có thể là AllowAny
def get_highest_bid(request):
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
        serializer = Bidserializers(highest_bid)
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response({"message": "Chưa có giá thầu nào cho sản phẩm này."}, status=status.HTTP_200_OK)

# View cho trang chi tiết đấu giá (HTML)
def bidding_detail_view(request, pk):
    # permission_classes nên được xử lý bởi @login_required nếu cần
    item = get_object_or_404(Item, pk=pk)
    # Có thể gọi hàm xử lý kết thúc đấu giá ở đây nếu item đã hết hạn mà chưa xử lý
    if item.status == 'ongoing' and item.end_time <= timezone.now():
         xu_ly_phien_dau_gia_ket_thuc(item.pk)
         item.refresh_from_db() # Tải lại item sau khi có thể đã thay đổi status

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
        item_id_str = data.get('item_id') # Nhận item_id dưới dạng string
        nguoi_dung_hien_tai = request.user

        if not item_id_str:
            return JsonResponse({'success': False, 'error': 'Thiếu item_id.'}, status=400)
        try:
            item_id = int(item_id_str) # Chuyển sang int
        except ValueError:
            return JsonResponse({'success': False, 'error': 'Item ID không hợp lệ.'}, status=400)


        san_pham = get_object_or_404(Item, pk=item_id)
        thoi_gian_hien_tai_utc = timezone.now()

        if not (san_pham.status == 'ongoing' and san_pham.end_time > thoi_gian_hien_tai_utc):
            return JsonResponse({'success': False, 'error': 'Không thể hủy bid cho phiên đấu giá đã kết thúc hoặc bị hủy.'}, status=400)

        bid_cao_nhat_cua_nguoi_dung = Bid.objects.filter(
            item_id=san_pham,
            user_id=nguoi_dung_hien_tai
        ).order_by('-bid_amount', '-bid_time').first()

        if not bid_cao_nhat_cua_nguoi_dung:
            return JsonResponse({'success': False, 'error': 'Bạn không có bid nào để hủy cho sản phẩm này.'}, status=400)

        bid_id_can_xoa = bid_cao_nhat_cua_nguoi_dung.bid_id
        gia_bid_can_xoa = bid_cao_nhat_cua_nguoi_dung.bid_amount
        
        with django_db_transaction.atomic(): # Sử dụng alias
            bid_cao_nhat_cua_nguoi_dung.delete()
            bid_cao_nhat_con_lai = Bid.objects.filter(item_id=san_pham).order_by('-bid_amount', '-bid_time').first()

            if bid_cao_nhat_con_lai:
                san_pham.current_price = bid_cao_nhat_con_lai.bid_amount
            else:
                san_pham.current_price = Decimal('0')
            san_pham.save(update_fields=['current_price'])

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
        # logger.error(f"Cancel bid API error: {e}", exc_info=True)
        print(f"Cancel bid API error: {e}")
        return JsonResponse({'success': False, 'error': 'Đã xảy ra lỗi không mong muốn khi hủy bid.'}, status=500)

@login_required
def my_active_bids_view(request):
    nguoi_dung_hien_tai = request.user
    thoi_gian_hien_tai_utc = timezone.now()

    # Tùy chọn: Xử lý các phiên đấu giá hết hạn mà người dùng này tham gia trước khi hiển thị
    # ended_item_ids_user_bid_on = Bid.objects.filter(
    #     user_id=nguoi_dung_hien_tai,
    #     item_id__status='ongoing',
    #     item_id__end_time__lte=thoi_gian_hien_tai_utc
    # ).values_list('item_id', flat=True).distinct()
    # for item_pk in ended_item_ids_user_bid_on:
    #     xu_ly_phien_dau_gia_ket_thuc(item_pk)


    id_cac_san_pham_da_dau_gia = Bid.objects.filter(user_id=nguoi_dung_hien_tai).values_list('item_id', flat=True).distinct()
    
    danh_sach_san_pham_da_dau_gia = Item.objects.filter(pk__in=id_cac_san_pham_da_dau_gia)\
                                        .select_related('seller')\
                                        .order_by(Case(When(status='ongoing', end_time__gt=thoi_gian_hien_tai_utc, then=0), default=1), '-end_time')

    thong_tin_san_pham_kem_trang_thai = []
    
    for san_pham in danh_sach_san_pham_da_dau_gia:
        bid_cao_nhat_hien_tai_cua_toi = Bid.objects.filter(
            item_id=san_pham,
            user_id=nguoi_dung_hien_tai
        ).order_by('-bid_amount', '-bid_time').first()

        gia_thau_cao_nhat_cua_nguoi_dung = bid_cao_nhat_hien_tai_cua_toi.bid_amount if bid_cao_nhat_hien_tai_cua_toi else Decimal('0')
        bid_id_cao_nhat_cua_toi = bid_cao_nhat_hien_tai_cua_toi.bid_id if bid_cao_nhat_hien_tai_cua_toi else None
        giao_dich_thang_cuoc_cua_toi = None # Reset cho mỗi sản phẩm

        trang_thai_san_pham_cho_nguoi_dung = "Mặc định"
        ten_nut_hanh_dong_chinh = ""
        url_nut_hanh_dong_chinh = ""
        class_css_nut_hanh_dong_chinh = ""
        hien_thi_nut_huy = False
        id_giao_dich_cho_thanh_toan = None

        # Nếu phiên đấu giá thực sự đã kết thúc nhưng status chưa cập nhật, hãy gọi hàm xử lý
        # Điều này giúp dữ liệu gần với thời gian thực hơn, nhưng lý tưởng nhất là Celery task
        if san_pham.status == 'ongoing' and san_pham.end_time <= thoi_gian_hien_tai_utc:
            print(f"Item {san_pham.pk} appears to have ended but status is ongoing. Processing now.")
            xu_ly_phien_dau_gia_ket_thuc(san_pham.pk)
            san_pham.refresh_from_db() # Tải lại thông tin sản phẩm sau khi xử lý

        if san_pham.status == 'ongoing' and san_pham.end_time > thoi_gian_hien_tai_utc:
            trang_thai_san_pham_cho_nguoi_dung = "Đang đấu giá"
            if bid_cao_nhat_hien_tai_cua_toi:
                hien_thi_nut_huy = True
            try:
                url_nut_hanh_dong_chinh = reverse('bidding-detail-page', kwargs={'pk': san_pham.pk})
            except Exception:
                url_nut_hanh_dong_chinh = "#"

        elif san_pham.status == 'completed': # Chỉ kiểm tra 'completed' sau khi đã cố gắng xử lý ở trên
            giao_dich_thang_cuoc_cua_toi = Transaction.objects.filter(item_id=san_pham, buyer_id=nguoi_dung_hien_tai).first()
            
            if giao_dich_thang_cuoc_cua_toi:
                id_giao_dich_cho_thanh_toan = giao_dich_thang_cuoc_cua_toi.transaction_id if giao_dich_thang_cuoc_cua_toi.status == 'pending' else None
                if giao_dich_thang_cuoc_cua_toi.status == 'completed':
                    trang_thai_san_pham_cho_nguoi_dung = "Đã thanh toán"
                    ten_nut_hanh_dong_chinh = "Xem chi tiết"
                    try:
                        url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
                    except Exception:
                        url_nut_hanh_dong_chinh = "#"
                    class_css_nut_hanh_dong_chinh = "btn-info"
                elif giao_dich_thang_cuoc_cua_toi.status == 'pending':
                    trang_thai_san_pham_cho_nguoi_dung = "Đấu giá thành công"
                    ten_nut_hanh_dong_chinh = "Thanh Toán"
                    try:
                        url_nut_hanh_dong_chinh = reverse('payments:process_payment')
                    except Exception:
                        url_nut_hanh_dong_chinh = "#" 
                    class_css_nut_hanh_dong_chinh = "btn-success"
                else: # Transaction status là 'failed'
                    trang_thai_san_pham_cho_nguoi_dung = "Đấu giá thất bại (GD lỗi)"
                    ten_nut_hanh_dong_chinh = "Xem sản phẩm"
                    try:
                        url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
                    except Exception:
                        url_nut_hanh_dong_chinh = "#"
                    class_css_nut_hanh_dong_chinh = "btn-secondary"
            else: # Item completed, nhưng không có transaction nào cho user này -> user này đã thua
                trang_thai_san_pham_cho_nguoi_dung = "Đấu giá thất bại"
                ten_nut_hanh_dong_chinh = "Xem sản phẩm"
                try:
                    url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
                except Exception:
                     url_nut_hanh_dong_chinh = "#"
                class_css_nut_hanh_dong_chinh = "btn-secondary"
        elif san_pham.status == 'canceled':
            trang_thai_san_pham_cho_nguoi_dung = "Phiên bị hủy"
            ten_nut_hanh_dong_chinh = "Xem sản phẩm"
            try:
                url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
            except Exception:
                 url_nut_hanh_dong_chinh = "#"
            class_css_nut_hanh_dong_chinh = "btn-warning"
        else: # Trường hợp không xác định (ví dụ: item đã hết hạn nhưng status vẫn là ongoing và hàm xử lý trên không chạy/lỗi)
            trang_thai_san_pham_cho_nguoi_dung = "Không xác định" # Hoặc "Đã kết thúc"
            ten_nut_hanh_dong_chinh = "Xem sản phẩm"
            try:
                url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
            except:
                url_nut_hanh_dong_chinh = "#"
            class_css_nut_hanh_dong_chinh = "btn-secondary"


        thong_tin_san_pham_kem_trang_thai.append({
            'item': san_pham,
            'gia_cao_nhat_cua_toi': gia_thau_cao_nhat_cua_nguoi_dung,
            'bid_id_cao_nhat_cua_toi': bid_id_cao_nhat_cua_toi,
            'trang_thai_cho_toi': trang_thai_san_pham_cho_nguoi_dung,
            'chu_tren_nut_hanh_dong': ten_nut_hanh_dong_chinh,
            'url_cho_nut_hanh_dong': url_nut_hanh_dong_chinh,
            'class_css_cho_nut_hanh_dong': class_css_nut_hanh_dong_chinh,
            'hien_thi_nut_huy_dau_gia': hien_thi_nut_huy,
            'transaction_id_for_payment': id_giao_dich_cho_thanh_toan
        })

    context = {
        'page_title': 'Sản phẩm đang theo dõi & Kết quả',
        'active_bids_info': thong_tin_san_pham_kem_trang_thai,
        'now': thoi_gian_hien_tai_utc,
        'csrf_token_value': request.COOKIES.get('csrftoken')
    }
    return render(request, 'bidding/my_active_bids.html', context)