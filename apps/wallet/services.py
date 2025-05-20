# auction_web/apps/wallet/services.py
import requests
import json
from django.conf import settings # Để lấy API keys và thông tin ngân hàng từ settings
import decimal # Để làm việc với kiểu Decimal cho so_tien

class DichVuVietQR:
    def __init__(self):
        # Lấy thông tin từ settings.py thay vì hardcode
        self.ma_khach_hang = getattr(settings, 'VIETQR_CLIENT_ID', None)
        self.khoa_api = getattr(settings, 'VIETQR_API_KEY', None)
        self.url_api_tao_qr = getattr(settings, 'VIETQR_GENERATE_API_URL', "https://api.vietqr.io/v2/generate")

        # Thông tin tài khoản ngân hàng của bạn (chủ website) để nhận tiền
        # Nên được định nghĩa trong settings.py
        self.thong_tin_ngan_hang_website = {
            "soTaiKhoan": getattr(settings, 'WEBSITE_BANK_ACCOUNT_NO', None),
            "tenChuTaiKhoan": getattr(settings, 'WEBSITE_BANK_ACCOUNT_NAME', None),
            "maNganHangNhan": getattr(settings, 'WEBSITE_BANK_ACQ_ID', None) # Mã BIN ngân hàng
        }

        if not all([self.ma_khach_hang, self.khoa_api,
                    self.thong_tin_ngan_hang_website["soTaiKhoan"],
                    self.thong_tin_ngan_hang_website["tenChuTaiKhoan"],
                    self.thong_tin_ngan_hang_website["maNganHangNhan"]]):
            # Ghi log lỗi nghiêm trọng ở đây vì thiếu cấu hình
            print("LỖI NGHIÊM TRỌNG: DichVuVietQR - Thiếu cấu hình VIETQR_CLIENT_ID, VIETQR_API_KEY hoặc thông tin ngân hàng của website trong settings.py")
            # from django.core.exceptions import ImproperlyConfigured
            # raise ImproperlyConfigured("Thiếu cấu hình VietQR hoặc thông tin ngân hàng của website.")


    def tao_ma_qr_nap_tien(self, so_tien_can_nap, ma_giao_dich_noi_bo_cho_thong_tin_them):
        """
        Tạo mã QR VietQR cho giao dịch nạp tiền vào tài khoản của website.

        Args:
            so_tien_can_nap (decimal.Decimal): Số tiền cần nạp.
            ma_giao_dich_noi_bo_cho_thong_tin_them (str): Mã giao dịch nội bộ (sẽ dùng làm addInfo/thongTinThem).

        Returns:
            dict: Phản hồi bao gồm 'thanhCong' (bool), 'duLieuAnhQRBase64' và 'thongBao'.
        """
        if not all([self.ma_khach_hang, self.khoa_api, self.thong_tin_ngan_hang_website["soTaiKhoan"]]):
            return {"thanhCong": False, "thongBao": "Hệ thống chưa được cấu hình đầy đủ để tạo mã QR. Vui lòng liên hệ quản trị viên."}

        dau_muc_http = {
            "x-client-id": self.ma_khach_hang,
            "x-api-key": self.khoa_api,
            "Content-Type": "application/json"
        }

        try:
            # API VietQR thường yêu cầu amount là số nguyên
            so_tien_cho_api = str(int(so_tien_can_nap.quantize(decimal.Decimal('0'))))
        except (TypeError, decimal.InvalidOperation):
             return {"thanhCong": False, "thongBao": "Số tiền cung cấp không hợp lệ để tạo mã QR."}

        du_lieu_gui_di = {
            "accountNo": self.thong_tin_ngan_hang_website["soTaiKhoan"],
            "accountName": self.thong_tin_ngan_hang_website["tenChuTaiKhoan"],
            "acqId": self.thong_tin_ngan_hang_website["maNganHangNhan"],
            "addInfo": ma_giao_dich_noi_bo_cho_thong_tin_them, # Nội dung chuyển khoản
            "amount": so_tien_cho_api,
            "template": "compact2", # Hoặc template bạn muốn
            "format": "data_url"    # Yêu cầu trả về ảnh QR dưới dạng Data URL (base64)
        }

        if not all(du_lieu_gui_di.values()):
            return {"thanhCong": False, "thongBao": "Thiếu thông tin bắt buộc trong payload để tạo mã QR."}

        try:
            phan_hoi_api = requests.post(self.url_api_tao_qr, headers=dau_muc_http, data=json.dumps(du_lieu_gui_di), timeout=15)
            phan_hoi_api.raise_for_status()
            du_lieu_phan_hoi = phan_hoi_api.json()

            if du_lieu_phan_hoi.get('code') == '00' and du_lieu_phan_hoi.get('data') and du_lieu_phan_hoi['data'].get('qrDataURL'):
                return {
                    "thanhCong": True,
                    "duLieuAnhQRBase64": du_lieu_phan_hoi['data']['qrDataURL'],
                    "chuoiMaQR": du_lieu_phan_hoi['data'].get('qrCode'),
                    "thongBao": du_lieu_phan_hoi.get('desc', "Tạo mã QR thành công.")
                }
            else:
                mo_ta_loi = du_lieu_phan_hoi.get('desc', "Lỗi không xác định từ API VietQR.")
                print(f"Lỗi API VietQR: Mã {du_lieu_phan_hoi.get('code')}, Mô tả: {mo_ta_loi}, Phản hồi đầy đủ: {du_lieu_phan_hoi}")
                return {
                    "thanhCong": False,
                    "thongBao": mo_ta_loi,
                    "chiTietLoi": du_lieu_phan_hoi
                }

        except requests.exceptions.HTTPError as loi_http:
            noi_dung_loi = phan_hoi_api.text
            try: noi_dung_loi = phan_hoi_api.json()
            except json.JSONDecodeError: pass
            print(f"Lỗi HTTP từ API VietQR: {loi_http}, Trạng thái: {phan_hoi_api.status_code}, Nội dung: {noi_dung_loi}")
            return {"thanhCong": False, "thongBao": f"Lỗi HTTP ({phan_hoi_api.status_code}) từ dịch vụ VietQR."}
        except requests.exceptions.RequestException as loi_ket_noi:
            print(f"Lỗi kết nối API VietQR: {loi_ket_noi}")
            return {"thanhCong": False, "thongBao": f"Lỗi kết nối đến dịch vụ VietQR: {loi_ket_noi}"}
        except Exception as loi_khac:
            print(f"Lỗi không mong muốn trong DichVuVietQR: {loi_khac}")
            return {"thanhCong": False, "thongBao": f"Lỗi không mong muốn khi tạo mã QR: {loi_khac}"}

    def xac_thuc_ipn_tu_casso_hoac_tuong_tu(self, dau_muc_yeu_cau, noi_dung_yeu_cau_bytes, khoa_bi_mat_dich_vu_ipn):
        """
        (VÍ DỤ - BẠN CẦN IMPLEMENT DỰA TRÊN CỔNG THANH TOÁN/DỊCH VỤ IPN CỦA BẠN)
        Xác thực chữ ký của Webhook từ Casso.vn hoặc dịch vụ tương tự.
        """
        # import hmac
        # import hashlib
        # chu_ky_nhan_duoc = dau_muc_yeu_cau.get('Securehash') # Hoặc tên header tương ứng
        # if not chu_ky_nhan_duoc or not khoa_bi_mat_dich_vu_ipn:
        #     return False
        #
        # chu_ky_tinh_toan = hmac.new(khoa_bi_mat_dich_vu_ipn.encode('utf-8'), noi_dung_yeu_cau_bytes, hashlib.sha256).hexdigest()
        # return hmac.compare_digest(chu_ky_tinh_toan, chu_ky_nhan_duoc)
        print("CẢNH BÁO: Hàm DichVuVietQR.xac_thuc_ipn_tu_casso_hoac_tuong_tu CHƯA ĐƯỢC IMPLEMENT ĐÚNG. IPN sẽ không an toàn.")
        return True # TẠM THỜI LUÔN TRUE ĐỂ TEST, BẠN PHẢI SỬA LẠI THEO TÀI LIỆU DỊCH VỤ
