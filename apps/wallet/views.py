# auction_web/apps/wallet/views.py
import decimal
import json
import uuid

from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.db import transaction as giao_dich_db # Đổi tên để tránh trùng lặp nếu có biến transaction
from django.http import HttpResponse
from django.conf import settings
from django.db import transaction as db_transaction 

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny

from django.contrib.auth import get_user_model
NguoiDung = get_user_model() # Đặt tên tiếng Việt cho model User
from .models import WalletTransaction as GiaoDichVi # Đặt tên tiếng Việt cho model
from .services import DichVuVietQR # Import service với tên tiếng Việt

@login_required
def bang_dieu_khien_vi_view(request): 
    nguoi_dung_hien_tai = request.user
    lich_su_giao_dich = GiaoDichVi.objects.filter(user=nguoi_dung_hien_tai).order_by('-created_at')[:20]
    ngu_canh = {
        'current_balance': nguoi_dung_hien_tai.balance,
        'transaction_history': lich_su_giao_dich,
        'page_title': 'Ví điện tử AuctionHub'
    }
    return render(request, 'wallet/wallet_dashboard.html', ngu_canh) 


class KhoiTaoGiaoDichNapTienAPIView(APIView):
    """
    API để người dùng khởi tạo một yêu cầu nạp tiền vào ví của họ.
    API này nhận số tiền cần nạp, tạo một bản ghi giao dịch ví (GiaoDichVi)
    với trạng thái PENDING, và trả về thông tin mã QR để người dùng thực hiện chuyển khoản.
    Số tiền nạp có thể do người dùng tự nhập, hoặc được tính toán từ một giao dịch mua hàng thiếu tiền.
    """
    permission_classes = [IsAuthenticated] # Chỉ người dùng đã đăng nhập mới được gọi API này

    def post(self, request, *args, **kwargs):
        chuoi_so_tien_nap = request.data.get('amount')

        if not chuoi_so_tien_nap:
            return Response(
                {'loi': 'Số tiền nạp không được để trống.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            so_tien_can_nap = decimal.Decimal(chuoi_so_tien_nap) # Sử dụng Decimal
            so_tien_nap_toi_thieu = decimal.Decimal('10000') # Số tiền nạp tối thiểu
            if so_tien_can_nap < so_tien_nap_toi_thieu:
                return Response(
                    {'loi': f'Số tiền nạp tối thiểu là {so_tien_nap_toi_thieu:,.0f} VNĐ.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except decimal.InvalidOperation: # Bắt lỗi nếu không chuyển được sang Decimal
            return Response(
                {'loi': 'Số tiền nạp không hợp lệ. Vui lòng chỉ nhập số.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        nguoi_dung = request.user
        # Tạo mã tham chiếu duy nhất cho giao dịch nạp tiền này trên QR
        ma_giao_dich_noi_bo_cho_qr = f"AUCHUB_NAP_{nguoi_dung.id}_{uuid.uuid4().hex[:8].upper()}"

        try:
            # Sử dụng transaction của Django để đảm bảo tính toàn vẹn
            # db_transaction là alias của django.db.transaction
            with db_transaction.atomic(): 
                # Giả định User model của bạn có trường balance.
                # Nếu không, bạn cần lấy từ Wallet model liên kết với user.
                # Vi du: current_user_balance = Wallet.objects.get(user=nguoi_dung).balance
                current_user_balance = nguoi_dung.balance 

                # Tạo một bản ghi GiaoDichVi (WalletTransaction)
                # Bạn cần đảm bảo model GiaoDichVi đã được import
                giao_dich_vi_moi = GiaoDichVi.objects.create(
                    user=nguoi_dung,
                    transaction_type='DEPOSIT', # Loại giao dịch là nạp tiền
                    amount=so_tien_can_nap,
                    status='PENDING',          # Trạng thái chờ admin xác nhận sau khi người dùng chuyển khoản
                    description=f"Yêu cầu nạp tiền {so_tien_can_nap:,.0f} VNĐ. Mã tham chiếu QR: {ma_giao_dich_noi_bo_cho_qr}",
                    balance_before=current_user_balance, # Số dư trước khi nạp (thực tế chưa thay đổi)
                    balance_after=current_user_balance   # Số dư sau khi nạp (sẽ được cập nhật khi admin xác nhận)
                    # Hoặc balance_after có thể là current_user_balance + so_tien_can_nap để hiển thị dự kiến
                    # Hoặc bạn có thể bỏ trường balance_after ở đây và chỉ cập nhật khi admin confirm
                )

            # Gọi service tạo mã QR sau khi bản ghi GiaoDichVi đã được tạo thành công (nằm ngoài atomic block)
            # Điều này tránh việc gọi API bên ngoài khi transaction CSDL chưa chắc chắn commit.
            # Tuy nhiên, nếu tạo QR thất bại, bạn có thể muốn rollback GiaoDichVi hoặc cập nhật lại status.
            # (Trong code gốc của bạn, bạn cập nhật status nếu tạo QR lỗi, điều đó cũng là một cách)

            # GIẢ ĐỊNH DichVuVietQR và GiaoDichVi đã được import đúng
            dich_vu_vietqr_instance = DichVuVietQR() 
            phan_hoi_tao_qr = dich_vu_vietqr_instance.tao_ma_qr_nap_tien(
                so_tien_can_nap=so_tien_can_nap,
                ma_giao_dich_noi_bo_cho_thong_tin_them=ma_giao_dich_noi_bo_cho_qr
            )

            if not phan_hoi_tao_qr or not phan_hoi_tao_qr.get('thanhCong'):
                # Nếu tạo QR lỗi, cập nhật trạng thái GiaoDichVi thành FAILED
                # Việc này nên nằm trong một try-except hoặc kiểm tra kỹ hơn
                giao_dich_vi_moi.status = 'FAILED' 
                giao_dich_vi_moi.description += f" | Lỗi tạo QR: {phan_hoi_tao_qr.get('thongBao', 'Không rõ')}"
                giao_dich_vi_moi.save()
                
                thong_bao_loi_cho_client = phan_hoi_tao_qr.get('thongBao', 'Lỗi khi tạo mã QR. Vui lòng thử lại sau.')
                return Response({'loi': thong_bao_loi_cho_client}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Nếu tạo QR thành công
            du_lieu_anh_qr_base64_tu_api = phan_hoi_tao_qr.get('duLieuAnhQRBase64')

            return Response({
                'du_lieu_anh_qr': du_lieu_anh_qr_base64_tu_api,
                'thong_tin_don_hang_cho_qr': ma_giao_dich_noi_bo_cho_qr, # Mã để người dùng đối chiếu
                'id_giao_dich_vi_noi_bo': giao_dich_vi_moi.id, # ID của bản ghi GiaoDichVi vừa tạo
                'so_tien_can_nap': so_tien_can_nap # Trả về số tiền để frontend hiển thị nếu cần
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Ghi log lỗi chi tiết ở đây
            print(f"Lỗi nghiêm trọng trong KhoiTaoGiaoDichNapTienAPIView khi xử lý cho user {nguoi_dung.id if nguoi_dung else 'unknown'}: {type(e).__name__} - {e}")
            return Response(
                {'loi': 'Đã xảy ra lỗi không mong muốn khi khởi tạo yêu cầu nạp tiền. Vui lòng thử lại sau.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



class XuLyIPNTuVietQRAPIView(APIView): # Đổi tên class
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        du_lieu_ipn = request.data
        # print(f"--- IPN Đã Nhận --- \nHeaders: {request.headers}\nBody: {du_lieu_ipn}\n--------------------")

        # ----- BƯỚC 1: XÁC THỰC IPN (CẦN IMPLEMENT THẬT) -----
        # khoa_bi_mat_ipn_casso = getattr(settings, 'CASSO_WEBHOOK_SECRET', None)
        # dich_vu_vietqr_instance = DichVuVietQR()
        # if not dich_vu_vietqr_instance.xac_thuc_ipn_tu_casso_hoac_tuong_tu(request.headers, request.body, khoa_bi_mat_ipn_casso):
        #     return Response({'ma_loi': '01', 'thong_bao': 'Chữ ký IPN không hợp lệ.'}, status=status.HTTP_403_FORBIDDEN)
        # print("Xác thực IPN thành công (giả định).")
        # ----- KẾT THÚC XÁC THỰC -----

        mo_ta_giao_dich_tu_ipn = du_lieu_ipn.get('description')
        chuoi_so_tien_nhan_duoc = du_lieu_ipn.get('creditAmount') if du_lieu_ipn.get('creditAmount') is not None else du_lieu_ipn.get('amount')
        ma_giao_dich_ngan_hang = du_lieu_ipn.get('tid') or du_lieu_ipn.get('transactionID') or du_lieu_ipn.get('virtualAccount')
        
        # Giả sử dịch vụ IPN gửi một mã trạng thái riêng, ví dụ '00' là thành công
        ma_trang_thai_ipn_tu_cong = du_lieu_ipn.get('resultCode') # Hoặc tên trường trạng thái tương ứng

        if mo_ta_giao_dich_tu_ipn is None or chuoi_so_tien_nhan_duoc is None or ma_trang_thai_ipn_tu_cong is None:
            return Response({'ma_loi': '02', 'thong_bao': 'Thiếu các trường dữ liệu bắt buộc trong IPN.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            so_tien_thuc_nhan = decimal.Decimal(str(chuoi_so_tien_nhan_duoc))
            if so_tien_thuc_nhan <= 0:
                 return Response({'ma_loi': '00', 'thong_bao': 'IPN bỏ qua: Số tiền không dương.'}, status=status.HTTP_200_OK)
        except decimal.InvalidOperation:
            return Response({'ma_loi': '03', 'thong_bao': 'Định dạng số tiền trong IPN không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

        ma_giao_dich_noi_bo_tu_ipn = None
        if isinstance(mo_ta_giao_dich_tu_ipn, str):
            cac_phan_mo_ta = mo_ta_giao_dich_tu_ipn.split(" ")
            for phan_tu in cac_phan_mo_ta:
                if phan_tu.startswith("AUCHUB_NAP_"): # Tiền tố bạn đã đặt
                    ma_giao_dich_noi_bo_tu_ipn = phan_tu
                    break
        
        if not ma_giao_dich_noi_bo_tu_ipn:
            return Response({'ma_loi': '04', 'thong_bao': 'IPN nhận được: Không tìm thấy mã giao dịch nội bộ trong mô tả.'}, status=status.HTTP_200_OK)

        # Giả sử mã '00' từ cổng IPN là thành công
        if str(ma_trang_thai_ipn_tu_cong) == "00": # So sánh chuỗi cho chắc chắn
            try:
                with giao_dich_db.atomic():
                    giao_dich_vi_can_xu_ly = GiaoDichVi.objects.select_for_update().get(
                        description__icontains=ma_giao_dich_noi_bo_tu_ipn,
                        status='PENDING',
                        transaction_type='DEPOSIT'
                    )

                    if giao_dich_vi_can_xu_ly.amount != so_tien_thuc_nhan:
                        giao_dich_vi_can_xu_ly.status = 'FAILED'
                        giao_dich_vi_can_xu_ly.description += f" | IPN Sai số tiền. Dự kiến: {giao_dich_vi_can_xu_ly.amount}, Nhận: {so_tien_thuc_nhan}. Mã GD NH: {ma_giao_dich_ngan_hang}"
                        giao_dich_vi_can_xu_ly.gateway_transaction_id = ma_giao_dich_ngan_hang
                        giao_dich_vi_can_xu_ly.save()
                        print(f"IPN Sai số tiền cho GiaoDichVi ID {giao_dich_vi_can_xu_ly.id}. Mã QR Ref: {ma_giao_dich_noi_bo_tu_ipn}")
                        return Response({'ma_loi': '05', 'thong_bao': 'IPN đã xử lý: Số tiền không khớp.'}, status=status.HTTP_200_OK)

                    tai_khoan_nguoi_dung_cap_nhat = NguoiDung.objects.select_for_update().get(pk=giao_dich_vi_can_xu_ly.user.pk)
                    
                    giao_dich_vi_can_xu_ly.balance_before = tai_khoan_nguoi_dung_cap_nhat.balance
                    so_du_moi = tai_khoan_nguoi_dung_cap_nhat.balance + giao_dich_vi_can_xu_ly.amount
                    tai_khoan_nguoi_dung_cap_nhat.balance = so_du_moi
                    tai_khoan_nguoi_dung_cap_nhat.save()

                    giao_dich_vi_can_xu_ly.status = 'COMPLETED'
                    giao_dich_vi_can_xu_ly.gateway_transaction_id = ma_giao_dich_ngan_hang
                    giao_dich_vi_can_xu_ly.balance_after = so_du_moi
                    giao_dich_vi_can_xu_ly.description += f" | Hoàn thành. Mã GD NH: {ma_giao_dich_ngan_hang}"
                    giao_dich_vi_can_xu_ly.save()
                
                print(f"Nạp tiền THÀNH CÔNG cho user {tai_khoan_nguoi_dung_cap_nhat.email}, mã QR Ref: {ma_giao_dich_noi_bo_tu_ipn}, số tiền: {giao_dich_vi_can_xu_ly.amount:,.0f} VNĐ. Số dư mới: {so_du_moi:,.0f} VNĐ.")
                # TODO: Gửi thông báo cho người dùng

                return Response({'ma_loi': '00', 'thong_bao': 'IPN đã xử lý thành công.'}, status=status.HTTP_200_OK)

            except GiaoDichVi.DoesNotExist:
                print(f"IPN Cảnh báo: GiaoDichVi PENDING với mã QR Ref '{ma_giao_dich_noi_bo_tu_ipn}' không tìm thấy hoặc đã xử lý.")
                return Response({'ma_loi': '06', 'thong_bao': 'IPN nhận được: Giao dịch không tìm thấy hoặc đã xử lý.'}, status=status.HTTP_200_OK)
            except NguoiDung.DoesNotExist:
                print(f"IPN Lỗi nghiêm trọng: NguoiDung cho GiaoDichVi với mã QR Ref '{ma_giao_dich_noi_bo_tu_ipn}' không tồn tại.")
                return Response({'ma_loi': '07', 'thong_bao': 'Người dùng cho giao dịch không tồn tại.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            except Exception as e:
                print(f"Lỗi không mong muốn khi xử lý IPN cho mã QR Ref '{ma_giao_dich_noi_bo_tu_ipn}': {e}")
                return Response({'ma_loi': '99', 'thong_bao': 'Lỗi không mong muốn khi xử lý IPN.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Xử lý IPN với trạng thái FAILED hoặc CANCELLED từ cổng
            try:
                with giao_dich_db.atomic():
                    giao_dich_vi_can_xu_ly = GiaoDichVi.objects.select_for_update().get(description__icontains=ma_giao_dich_noi_bo_tu_ipn, status='PENDING', transaction_type='DEPOSIT')
                    giao_dich_vi_can_xu_ly.status = 'FAILED' # Hoặc 'CANCELLED' tùy theo ma_trang_thai_ipn_tu_cong
                    giao_dich_vi_can_xu_ly.description += f" | Trạng thái IPN: {ma_trang_thai_ipn_tu_cong}. Mã GD NH: {ma_giao_dich_ngan_hang}"
                    giao_dich_vi_can_xu_ly.gateway_transaction_id = ma_giao_dich_ngan_hang
                    giao_dich_vi_can_xu_ly.save()
            except GiaoDichVi.DoesNotExist:
                pass # Bỏ qua nếu không tìm thấy giao dịch PENDING
            print(f"IPN nhận được cho mã QR Ref {ma_giao_dich_noi_bo_tu_ipn} với trạng thái không thành công: '{ma_trang_thai_ipn_tu_cong}'")
            return Response({'ma_loi': '08', 'thong_bao': f'IPN nhận được và đã xử lý với trạng thái: {ma_trang_thai_ipn_tu_cong}'}, status=status.HTTP_200_OK)
