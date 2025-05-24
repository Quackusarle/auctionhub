from django.shortcuts import render,get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view,permission_classes
from rest_framework.response import Response
from .serializers import Bidserializers
from .models import User, Bid, Item
from django.utils.timezone import now
from rest_framework.permissions import IsAuthenticated, AllowAny
from decimal import Decimal, InvalidOperation
from decimal import Decimal
from django.db import transaction as db_transaction
from apps.payments.models import Transaction # Đường dẫn đúng đến model Transaction của bạn
from django.db.models import Max, Q, Case, When, Value, CharField, OuterRef, Subquery, BooleanField
from django.urls import reverse
from django.http import JsonResponse 
from django.views.decorators.http import require_POST 
import json

# Hàm làm tròn tiền
def Lamtrontien (amount):
    # Đảm bảo amount là Decimal
    if not isinstance(amount, Decimal):
        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, TypeError):
            return Decimal('0') # Trả về 0 nếu không hợp lệ

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

    if item.seller != user: # Đã sửa item.seller_id thành item.seller để khớp với Model User
         return Response({"error": "Bạn không thể đặt giá cho sản phẩm của chính mình."}, status=status.HTTP_400_BAD_REQUEST)

    if item.end_time is None or now() > item.end_time:
        return Response({"error": "Phiên đấu giá đã kết thúc hoặc không hợp lệ!"}, status=status.HTTP_400_BAD_REQUEST)

    # --- START: MINIMUM BID CALCULATION (1% RULE) ---
    current_effective_price = item.current_price if item.current_price > Decimal('0') else item.starting_price
    min_increment_percentage = Decimal('0.01') # 1%
    max_increment_percentage = Decimal('0.10') # 10%
    min_absolute_increment = Decimal('1000') # Tối thiểu 1000 VNĐ

    # Tính toán giá bid tối thiểu
    # Giá tối thiểu = BasePrice + max(BasePrice * 1%, 1000)
    calculated_min_bid = current_effective_price + max(current_effective_price * min_increment_percentage, min_absolute_increment)
    calculated_min_bid = Lamtrontien(calculated_min_bid)
    # Đảm bảo giá tối thiểu không thấp hơn giá khởi điểm cộng một bước tối thiểu
    calculated_min_bid = max(calculated_min_bid, item.starting_price + min_absolute_increment)


    # Tính toán giá bid tối đa
    # Giá tối đa = BasePrice + max(BasePrice * 10%, 10000)
    calculated_max_bid = current_effective_price + max(current_effective_price * max_increment_percentage, min_absolute_increment * 10)
    calculated_max_bid = Lamtrontien(calculated_max_bid)
    # Đảm bảo bid tối đa phải lớn hơn bid tối thiểu
    calculated_max_bid = max(calculated_max_bid, calculated_min_bid)


    if bid_amount_decimal < calculated_min_bid:
         # Làm tròn các giá trị để hiển thị cho người dùng thân thiện hơn
         min_bid_display = Lamtrontien(calculated_min_bid.quantize(Decimal('1')))
         current_display = Lamtrontien(current_effective_price.quantize(Decimal('1')))
         increment_display = Lamtrontien(max(current_effective_price * min_increment_percentage, min_absolute_increment).quantize(Decimal('1')))

         error_message = (f"Giá đặt phải ít nhất là {min_bid_display:,.0f} VNĐ "
                          f"(cao hơn giá hiện tại {current_display:,.0f} VNĐ "
                          f"ít nhất 1% hoặc {increment_display:,.0f} VNĐ).")
         print(f"Bid Amount Check Failed: Bid={bid_amount_decimal}, Min Valid={calculated_min_bid}, Increment={min_increment_value}") # Lỗi ở đây là min_increment_value chưa được định nghĩa
         return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)
    
    if bid_amount_decimal > calculated_max_bid:
        max_bid_display = Lamtrontien(calculated_max_bid.quantize(Decimal('1')))
        error_message = (f"Giá đặt không được vượt quá giá tối đa {max_bid_display:,.0f} VNĐ "
                         f"(giá hiện tại + 10%).")
        print(f"Bid Amount Check Failed: Bid={bid_amount_decimal}, Max Valid={calculated_max_bid}")
        return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)
    # --- END: MINIMUM BID CALCULATION (1% RULE) ---

    rounded_bid_amount = Lamtrontien(bid_amount_decimal)
    bid_data = {
        "item_id": item.pk,
        "user_id": user.pk,
        "bid_amount": rounded_bid_amount,
    }
    serializer = Bidserializers(data=bid_data)

    if serializer.is_valid():
        try:
            with db_transaction.atomic():
                bid_instance = serializer.save()
                item.current_price = rounded_bid_amount
                item.save(update_fields=['current_price'])

            response_data = serializer.data
            response_data['user_email'] = user.email
            response_data['bid_time'] = bid_instance.bid_time.isoformat()
            response_data['bid_amount'] = str(Lamtrontien(bid_instance.bid_amount)) # Lamtrontien đã được sửa cho Decimal

            # Tính toán next_min_bid cho frontend (dựa trên quy tắc mới)
            new_current_price = rounded_bid_amount
            new_min_increment = max(new_current_price * min_increment_percentage, min_absolute_increment)
            next_min_bid = new_current_price + new_min_increment
            response_data['next_min_bid'] = str(Lamtrontien(next_min_bid).quantize(Decimal('1')))

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"ERROR saving bid/item: {e}")
            return Response({"error": "Lỗi máy chủ nội bộ khi lưu đặt giá."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    else:
        print(f"Serializer Errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# API 2: Lấy danh sách giá thầu của một sản phẩm
@api_view(['POST'])
def get_bids_for_item(request):
    permission_classes = [IsAuthenticated]
    item_id = request.data.get('item_id')

    if not item_id:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)

    item = get_object_or_404(Item, pk=item_id)

    bids = Bid.objects.filter(item_id=item).order_by('-bid_time')

    serializer = Bidserializers(bids, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

# API 3: Lấy giá thầu cao nhất của một sản phẩm
@api_view(['POST'])
def get_highest_bid(request):
    permission_classes = [IsAuthenticated]
    item_id = request.data.get('item_id')

    if not item_id:
        return Response({"error": "Thiếu item_id!"}, status=status.HTTP_400_BAD_REQUEST)

    item = get_object_or_404(Item, pk=item_id)
    highest_bid = Bid.objects.filter(item_id=item).order_by('-bid_amount').first()

    if highest_bid:
        serializer = Bidserializers(highest_bid)
        return Response(serializer.data, status=status.HTTP_200_OK)

    return Response({"message": "Chưa có giá thầu nào cho sản phẩm này."}, status=status.HTTP_200_OK)


def bidding_detail_view(request, pk):
    permission_classes = [IsAuthenticated]

    item = get_object_or_404(Item, pk=pk)
    bids = Bid.objects.filter(item_id=item).order_by('-bid_time')[:10]
    context = {
        'item': item,
        'bids': bids,
    }
    return render(request, 'bidding/bidding_detail.html', context)

@login_required
@require_POST # Chỉ cho phép phương thức POST
def cancel_my_bid_view(request):
    try:
        data = json.loads(request.body)
        item_id = data.get('item_id')
        nguoi_dung_hien_tai = request.user

        if not item_id:
            return JsonResponse({'success': False, 'error': 'Thiếu item_id.'}, status=400)

        san_pham = get_object_or_404(Item, pk=item_id)
        thoi_gian_hien_tai = timezone.now()

        if not (san_pham.status == 'ongoing' and san_pham.end_time > thoi_gian_hien_tai):
            return JsonResponse({'success': False, 'error': 'Không thể hủy bid cho phiên đấu giá đã kết thúc hoặc bị hủy.'}, status=400)

        # Tìm bid cao nhất hiện tại của người dùng cho sản phẩm này
        bid_cao_nhat_cua_nguoi_dung = Bid.objects.filter(
            item_id=san_pham,
            user_id=nguoi_dung_hien_tai
        ).order_by('-bid_amount', '-bid_time').first()

        if not bid_cao_nhat_cua_nguoi_dung:
            return JsonResponse({'success': False, 'error': 'Bạn không có bid nào để hủy cho sản phẩm này.'}, status=400)

        # Kiểm tra xem bid này có phải là bid đang giữ giá cao nhất của sản phẩm không
        # Điều này quan trọng vì nếu xóa bid này, current_price của Item cần được cập nhật
        bid_id_can_xoa = bid_cao_nhat_cua_nguoi_dung.bid_id
        gia_bid_can_xoa = bid_cao_nhat_cua_nguoi_dung.bid_amount
        bid_cao_nhat_cua_nguoi_dung.delete()

        # Sau khi xóa, cập nhật lại current_price của Item
        # Tìm bid cao nhất còn lại cho sản phẩm này (từ bất kỳ người dùng nào)
        bid_cao_nhat_con_lai = Bid.objects.filter(item_id=san_pham).order_by('-bid_amount', '-bid_time').first()

        if bid_cao_nhat_con_lai:
            san_pham.current_price = bid_cao_nhat_con_lai.bid_amount
        else:
            # Nếu không còn bid nào, current_price có thể quay về 0 hoặc starting_price
            # Theo logic hiện tại, current_price chỉ cập nhật khi có bid mới cao hơn starting_price
            # Nếu xóa hết bid, có thể đặt current_price = 0 để logic bid tối thiểu hoạt động đúng
            san_pham.current_price = Decimal('0')
        san_pham.save(update_fields=['current_price'])

        return JsonResponse({
            'success': True,
            'message': f'Đã hủy lượt đặt giá {gia_bid_can_xoa:,.0f} VNĐ thành công.',
            'new_current_price': san_pham.current_price,
            'deleted_bid_id': bid_id_can_xoa
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Dữ liệu gửi lên không hợp lệ.'}, status=400)
    except Item.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Sản phẩm không tồn tại.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
def my_active_bids_view(request):
    nguoi_dung_hien_tai = request.user
    thoi_gian_hien_tai = timezone.now()

    id_cac_san_pham_da_dau_gia = Bid.objects.filter(user_id=nguoi_dung_hien_tai).values_list('item_id', flat=True).distinct()
    danh_sach_san_pham_da_dau_gia = Item.objects.filter(pk__in=id_cac_san_pham_da_dau_gia).select_related('seller')

    thong_tin_san_pham_kem_trang_thai = []

    for san_pham in danh_sach_san_pham_da_dau_gia:
        # Lấy bid cao nhất của người dùng hiện tại cho sản phẩm này
        bid_cao_nhat_hien_tai_cua_toi = Bid.objects.filter(
            item_id=san_pham,
            user_id=nguoi_dung_hien_tai
        ).order_by('-bid_amount', '-bid_time').first()

        gia_thau_cao_nhat_cua_nguoi_dung = bid_cao_nhat_hien_tai_cua_toi.bid_amount if bid_cao_nhat_hien_tai_cua_toi else Decimal('0')
        bid_id_cao_nhat_cua_toi = bid_cao_nhat_hien_tai_cua_toi.bid_id if bid_cao_nhat_hien_tai_cua_toi else None


        trang_thai_san_pham_cho_nguoi_dung = "Mặc định"
        ten_nut_hanh_dong_chinh = ""
        url_nut_hanh_dong_chinh = ""
        class_css_nut_hanh_dong_chinh = ""
        hien_thi_nut_huy = False

        if san_pham.status == 'ongoing' and san_pham.end_time > thoi_gian_hien_tai:
            trang_thai_san_pham_cho_nguoi_dung = "Đang đấu giá"
            if bid_cao_nhat_hien_tai_cua_toi: # Chỉ hiển thị nút hủy nếu người dùng có bid
                hien_thi_nut_huy = True
            try:
                url_nut_hanh_dong_chinh = san_pham.get_absolute_url()
            except AttributeError:
                 try:
                     url_nut_hanh_dong_chinh = reverse('bidding-detail-page', kwargs={'pk': san_pham.pk})
                 except Exception:
                     try:
                         url_nut_hanh_dong_chinh = reverse('item-detail-template', kwargs={'pk': san_pham.pk})
                     except Exception:
                        url_nut_hanh_dong_chinh = "#"

        elif san_pham.status == 'completed' or san_pham.end_time <= thoi_gian_hien_tai:
            giao_dich_thang_cuoc = Transaction.objects.filter(item_id=san_pham, buyer_id=nguoi_dung_hien_tai).first()
            if giao_dich_thang_cuoc:
                if giao_dich_thang_cuoc.status == 'completed':
                    trang_thai_san_pham_cho_nguoi_dung = "Đã thanh toán"
                    ten_nut_hanh_dong_chinh = "Xem chi tiết"
                    try:
                        url_nut_hanh_dong_chinh = san_pham.get_absolute_url()
                    except AttributeError:
                        url_nut_hanh_dong_chinh = "#"
                    class_css_nut_hanh_dong_chinh = "btn-info"
                elif giao_dich_thang_cuoc.status == 'pending':
                    trang_thai_san_pham_cho_nguoi_dung = "Đấu giá thành công"
                    ten_nut_hanh_dong_chinh = "Thanh Toán"
                    try:
                        url_nut_hanh_dong_chinh = reverse('payments:process_payment')
                        # Transaction ID sẽ được thêm vào URL trong template
                    except Exception as e:
                        url_nut_hanh_dong_chinh = f"/payments/pay/?transaction_id={giao_dich_thang_cuoc.transaction_id}"
                    class_css_nut_hanh_dong_chinh = "btn-success"
                else:
                    trang_thai_san_pham_cho_nguoi_dung = "Đấu giá thất bại"
                    ten_nut_hanh_dong_chinh = "Xem sản phẩm"
                    try:
                        url_nut_hanh_dong_chinh = san_pham.get_absolute_url()
                    except AttributeError:
                        url_nut_hanh_dong_chinh = "#"
                    class_css_nut_hanh_dong_chinh = "btn-secondary"
            else:
                trang_thai_san_pham_cho_nguoi_dung = "Đấu giá thất bại"
                ten_nut_hanh_dong_chinh = "Xem sản phẩm"
                try:
                    url_nut_hanh_dong_chinh = san_pham.get_absolute_url()
                except AttributeError:
                     url_nut_hanh_dong_chinh = "#"
                class_css_nut_hanh_dong_chinh = "btn-secondary"
        elif san_pham.status == 'canceled':
            trang_thai_san_pham_cho_nguoi_dung = "Phiên bị hủy"
            ten_nut_hanh_dong_chinh = "Xem sản phẩm"
            try:
                url_nut_hanh_dong_chinh = san_pham.get_absolute_url()
            except AttributeError:
                 url_nut_hanh_dong_chinh = "#"
            class_css_nut_hanh_dong_chinh = "btn-warning"

        thong_tin_san_pham_kem_trang_thai.append({
            'item': san_pham,
            'gia_cao_nhat_cua_toi': gia_thau_cao_nhat_cua_nguoi_dung,
            'bid_id_cao_nhat_cua_toi': bid_id_cao_nhat_cua_toi, # << TRUYỀN ID CỦA BID CAO NHẤT
            'trang_thai_cho_toi': trang_thai_san_pham_cho_nguoi_dung,
            'chu_tren_nut_hanh_dong': ten_nut_hanh_dong_chinh,
            'url_cho_nut_hanh_dong': url_nut_hanh_dong_chinh,
            'class_css_cho_nut_hanh_dong': class_css_nut_hanh_dong_chinh,
            'hien_thi_nut_huy_dau_gia': hien_thi_nut_huy,
            'transaction_id_for_payment': giao_dich_thang_cuoc.transaction_id if 'giao_dich_thang_cuoc' in locals() and giao_dich_thang_cuoc and giao_dich_thang_cuoc.status == 'pending' else None
        })

    context = {
        'page_title': 'Sản phẩm đang theo dõi & Kết quả',
        'active_bids_info': thong_tin_san_pham_kem_trang_thai,
        'now': thoi_gian_hien_tai,
        'csrf_token_value': request.COOKIES.get('csrftoken') # Truyền CSRF token cho JavaScript
    }
    return render(request, 'bidding/my_active_bids.html', context)