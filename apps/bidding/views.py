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
from urllib.parse import urlencode # Import them

# import logging # Nếu bạn muốn ghi log chi tiết
# logger = logging.getLogger(__name__)

# --- HÀM TIỆN ÍCH XỬ LÝ PHIÊN ĐẤU GIÁ KẾT THÚC (Giữ tên gốc tiếng Việt bạn cung cấp) ---
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
                        # Lấy seller từ sản phẩm để đảm bảo tính đúng đắn
                        nguoi_ban = san_pham_ket_thuc.seller
                        if not nguoi_ban:
                            print(f"Loi: Khong tim thay nguoi ban cho item {san_pham_ket_thuc.pk} khi tao giao dich.")
                            # Quyết định xử lý lỗi ở đây, ví dụ raise Exception để rollback
                            raise ValueError(f"Thieu nguoi ban cho san pham {san_pham_ket_thuc.pk}")

                        Transaction.objects.create(
                            item_id=san_pham_ket_thuc,
                            buyer_id=bid_thang_cuoc.user_id,
                            seller_id=nguoi_ban, # Đảm bảo seller_id được cung cấp
                            final_price=bid_thang_cuoc.bid_amount, 
                            status='pending' 
                        )
                        print(f"Auction for item {san_pham_ket_thuc.name} completed. Winner: {bid_thang_cuoc.user_id.email}. Price: {bid_thang_cuoc.bid_amount}")
                else:
                    print(f"Auction for item {san_pham_ket_thuc.name} completed. No bids placed.")
            return True
    except Item.DoesNotExist:
        print(f"Item with ID {item_id} does not exist for processing ended auction.")
    except Exception as e:
        print(f"Error processing ended auction for item ID {item_id}: {e}")
    return False


# Hàm làm tròn tiền (giữ tên gốc tiếng Việt bạn cung cấp)
def Lamtrontien (amount): # Giữ tên hàm này theo file gốc bạn cung cấp
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

# API 1: Xử lý đặt giá thầu (Giữ tên gốc tiếng Anh)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def place_bid(request): # Giữ tên gốc
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

    if item.end_time is None or timezone.now() > item.end_time: 
        return Response({"error": "Phiên đấu giá đã kết thúc hoặc không hợp lệ!"}, status=status.HTTP_400_BAD_REQUEST)

    current_effective_price = item.current_price if item.current_price > Decimal('0') else item.starting_price
    min_increment_percentage = Decimal('0.01')
    max_increment_percentage = Decimal('0.10')
    min_absolute_increment = Decimal('1000')

    calculated_min_bid = current_effective_price + max(current_effective_price * min_increment_percentage, min_absolute_increment)
    calculated_min_bid = Lamtrontien(calculated_min_bid) # Sử dụng hàm đã Việt hóa tên
    calculated_min_bid = max(calculated_min_bid, item.starting_price + min_absolute_increment)

    calculated_max_bid = current_effective_price + max(current_effective_price * max_increment_percentage, min_absolute_increment * 10)
    calculated_max_bid = Lamtrontien(calculated_max_bid) # Sử dụng hàm đã Việt hóa tên
    calculated_max_bid = max(calculated_max_bid, calculated_min_bid)

    if bid_amount_decimal < calculated_min_bid:
        min_bid_display = Lamtrontien(calculated_min_bid.quantize(Decimal('1')))
        current_display = Lamtrontien(current_effective_price.quantize(Decimal('1')))
        actual_increment_value = max(current_effective_price * min_increment_percentage, min_absolute_increment) 
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
            with django_db_transaction.atomic(): 
                bid_instance = serializer.save()
                item.current_price = rounded_bid_amount
                item.save(update_fields=['current_price'])

            response_data = serializer.data.copy() 
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

# API 2: Lấy danh sách giá thầu của một sản phẩm (Giữ tên gốc tiếng Anh)
@api_view(['POST']) 
@permission_classes([IsAuthenticated]) 
def get_bids_for_item(request): # Giữ tên gốc
    item_id_str = request.data.get('item_id')

    if not item_id_str:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        item_id = int(item_id_str)
    except ValueError:
        return Response({"error": "Item ID không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

    item = get_object_or_404(Item, pk=item_id)
    bids = Bid.objects.filter(item_id=item).order_by('-bid_time').select_related('user_id') 
    serializer = Bidserializers(bids, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

# API 3: Lấy giá thầu cao nhất của một sản phẩm (Giữ tên gốc tiếng Anh)
@api_view(['POST']) 
@permission_classes([IsAuthenticated]) 
def get_highest_bid(request): # Giữ tên gốc
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

# View cho trang chi tiết đấu giá (HTML) - Đổi tên sang tiếng Việt (ngắn gọn)
def bidding_detail_view(request, pk): # Tên đã đổi trước đó
    item = get_object_or_404(Item, pk=pk)
    if item.status == 'ongoing' and item.end_time <= timezone.now():
         xu_ly_phien_dau_gia_ket_thuc(item.pk) # Gọi hàm tiện ích với tên đã Việt hóa
         item.refresh_from_db() 

    bids = Bid.objects.filter(item_id=item).order_by('-bid_time')[:10]
    context = {
        'item': item,
        'bids': bids,
    }
    return render(request, 'bidding/bidding_detail.html', context)

@login_required
@require_POST
def cancel_my_bid_view(request): # Giữ tên gốc tiếng Anh
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

        gia_bid_can_xoa = bid_cao_nhat_cua_nguoi_dung.bid_amount
        
        with django_db_transaction.atomic(): 
            bid_cao_nhat_cua_nguoi_dung.delete()
            bid_cao_nhat_con_lai = Bid.objects.filter(item_id=san_pham).order_by('-bid_amount', '-bid_time').first()

            if bid_cao_nhat_con_lai:
                san_pham.current_price = bid_cao_nhat_con_lai.bid_amount
            else:
                # Cân nhắc quay về giá khởi điểm nếu không còn bid nào
                san_pham.current_price = san_pham.starting_price if san_pham.starting_price > 0 else Decimal('0')
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
        print(f"Cancel bid API error: {e}")
        return JsonResponse({'success': False, 'error': 'Đã xảy ra lỗi không mong muốn khi hủy bid.'}, status=500)

@login_required
def my_active_bids_view(request): # Tên đã đổi trước đó
    nguoi_dung_hien_tai = request.user
    thoi_gian_hien_tai_utc = timezone.now()

    id_cac_san_pham_da_dau_gia = Bid.objects.filter(user_id=nguoi_dung_hien_tai).values_list('item_id', flat=True).distinct()
    
    danh_sach_san_pham_da_dau_gia = Item.objects.filter(pk__in=id_cac_san_pham_da_dau_gia)\
                                        .select_related('seller')\
                                        .order_by(Case(When(status='ongoing', end_time__gt=thoi_gian_hien_tai_utc, then=Value(0)), default=Value(1)), '-end_time')

    thong_tin_san_pham_kem_trang_thai = []
    
    for san_pham in danh_sach_san_pham_da_dau_gia:
        bid_cao_nhat_hien_tai_cua_toi = Bid.objects.filter(
            item_id=san_pham,
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

        if san_pham.status == 'ongoing' and san_pham.end_time <= thoi_gian_hien_tai_utc:
            print(f"Item {san_pham.pk} ({san_pham.name}) appears to have ended but status is ongoing. Processing now.")
            if xu_ly_phien_dau_gia_ket_thuc(san_pham.pk): # Gọi hàm tiện ích với tên đã Việt hóa
                 san_pham.refresh_from_db()
                 print(f"Processed item {san_pham.pk}, new status: {san_pham.status}")
            else:
                print(f"Failed to process ended auction for item {san_pham.pk}, status might be inaccurate.")

        if san_pham.status == 'ongoing' and san_pham.end_time > thoi_gian_hien_tai_utc:
            trang_thai_san_pham_cho_nguoi_dung = "Dang dau gia"
            ten_nut_hanh_dong_chinh = "Dat gia lai"
            if bid_cao_nhat_hien_tai_cua_toi:
                hien_thi_nut_huy = True
            try:
                url_nut_hanh_dong_chinh = reverse('bidding-detail-page', kwargs={'pk': san_pham.pk})
            except Exception:
                url_nut_hanh_dong_chinh = "#"
            class_css_nut_hanh_dong_chinh = "btn-primary"

        elif san_pham.status == 'completed':
            giao_dich_thang_cuoc_cua_toi = Transaction.objects.filter(item_id=san_pham, buyer_id=nguoi_dung_hien_tai).first()
            
            if giao_dich_thang_cuoc_cua_toi:
                id_giao_dich_cho_thanh_toan = giao_dich_thang_cuoc_cua_toi.transaction_id
                so_tien_can_thanh_toan = giao_dich_thang_cuoc_cua_toi.final_price

                if giao_dich_thang_cuoc_cua_toi.status == 'completed':
                    trang_thai_san_pham_cho_nguoi_dung = "Da thanh toan"
                    ten_nut_hanh_dong_chinh = "Xem chi tiet"
                    try: url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
                    except Exception: url_nut_hanh_dong_chinh = "#"
                    class_css_nut_hanh_dong_chinh = "btn-info"
                elif giao_dich_thang_cuoc_cua_toi.status == 'pending':
                    trang_thai_san_pham_cho_nguoi_dung = "Dau gia thanh cong"
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
                        print(f"Loi khi tao URL cho vi tu trang_theo_doi_view (pending): {e}")
                        url_nut_hanh_dong_chinh = "#" 
                    class_css_nut_hanh_dong_chinh = "btn-success"
                else: 
                    trang_thai_san_pham_cho_nguoi_dung = "GD thanh toan loi"
                    ten_nut_hanh_dong_chinh = "Xem san pham"
                    try: url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
                    except Exception: url_nut_hanh_dong_chinh = "#"
                    class_css_nut_hanh_dong_chinh = "btn-secondary"
            else: 
                trang_thai_san_pham_cho_nguoi_dung = "Dau gia that bai"
                ten_nut_hanh_dong_chinh = "Xem san pham"
                try: url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
                except Exception: url_nut_hanh_dong_chinh = "#"
                class_css_nut_hanh_dong_chinh = "btn-secondary"
        elif san_pham.status == 'canceled':
            trang_thai_san_pham_cho_nguoi_dung = "Phien bi huy"
            ten_nut_hanh_dong_chinh = "Xem san pham"
            try: url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
            except Exception: url_nut_hanh_dong_chinh = "#"
            class_css_nut_hanh_dong_chinh = "btn-warning"
        else: 
            trang_thai_san_pham_cho_nguoi_dung = "Khong xac dinh"
            ten_nut_hanh_dong_chinh = "Xem san pham"
            try: url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
            except: url_nut_hanh_dong_chinh = "#"
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
            'transaction_id_for_payment': id_giao_dich_cho_thanh_toan,
            'final_price_for_payment': so_tien_can_thanh_toan 
        })

    context = { 
        'page_title': 'San pham dang theo doi & Ket qua',
        'active_bids_info': thong_tin_san_pham_kem_trang_thai,
        'now': thoi_gian_hien_tai_utc,
        'csrf_token_value': request.COOKIES.get('csrftoken')
    }
    return render(request, 'bidding/my_active_bids.html', context)