// static/js/wallet_dashboard.js
document.addEventListener('DOMContentLoaded', function() {
    const nutHienThiFormNapTien = document.getElementById('nutHienThiFormNapTien');
    const khuVucNapTien = document.getElementById('khuVucNapTien');
    const inputSoTienNap = document.getElementById('soTienNap');
    const formNapTien = document.getElementById('formNapTien');
    const khuVucMaQR = document.getElementById('khuVucMaQR');
    const huongDanNapTien = document.getElementById('huongDanNapTien');
    const thongTinDonHangQR = document.getElementById('thongTinDonHangQR');
    const trangThaiNapTien = document.getElementById('trangThaiNapTien');
    
    const nutHienThiFormRutTien = document.getElementById('nutHienThiFormRutTien');
    const khuVucRutTien = document.getElementById('khuVucRutTien');

    // Hàm getCookie (nếu chưa có trong base.js hoặc cần dùng riêng ở đây)
    if (typeof getCookie !== 'function') {
        window.getCookie = function(name) {
            let cookieValue = null;
            if (document.cookie && document.cookie !== '') {
                const cookies = document.cookie.split(';');
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i].trim();
                    if (cookie.substring(0, name.length + 1) === (name + '=')) {
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        }
    }

    async function guiYeuCauTaoMaQR(soTien, maGiaoDichGoc = null) {
        if (!inputSoTienNap || !trangThaiNapTien || !khuVucMaQR || !huongDanNapTien || !thongTinDonHangQR) {
            console.error("Mot so element UI cho form nap tien khong tim thay.");
            return false;
        }

        const soTienFloat = parseFloat(soTien);
        if (isNaN(soTienFloat) || soTienFloat < 10000) {
            trangThaiNapTien.textContent = 'Số tiền nạp phải là số và tối thiểu 10,000 VNĐ.';
            trangThaiNapTien.className = 'status-message error';
            trangThaiNapTien.style.display = 'block';
            if(inputSoTienNap) inputSoTienNap.focus();
            return false;
        }

        trangThaiNapTien.style.display = 'block';
        trangThaiNapTien.className = 'status-message info';
        trangThaiNapTien.textContent = 'Đang xử lý, vui lòng chờ...';
        khuVucMaQR.innerHTML = ''; 
        huongDanNapTien.style.display = 'none';

        try {
            const urlApiKhoiTaoNapTien = formNapTien.dataset.apiUrl; 
            if (!urlApiKhoiTaoNapTien) {
                throw new Error("Khong tim thay URL API de khoi tao nap tien.");
            }
            
            // Ghi chu: API cua ban co the khong can `maGiaoDichGoc` khi tao QR,
            // no se duoc dung trong `description` cua `WalletTransaction` trong view.
            const phanHoi = await fetch(urlApiKhoiTaoNapTien, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken') 
                },
                body: JSON.stringify({ 
                    amount: soTienFloat.toString() // Gui amount duoi dang chuoi
                })
            });

            const duLieu = await phanHoi.json();

            if (!phanHoi.ok) {
                throw new Error(duLieu.loi || duLieu.error || `Lỗi ${phanHoi.status}: Không thể tạo yêu cầu nạp tiền.`);
            }

            if (duLieu.du_lieu_anh_qr) {
                khuVucMaQR.innerHTML = `<img src="${duLieu.du_lieu_anh_qr}" alt="Quét mã QR để nạp tiền">`;
                if (duLieu.thong_tin_don_hang_cho_qr) {
                   thongTinDonHangQR.textContent = duLieu.thong_tin_don_hang_cho_qr;
                   huongDanNapTien.style.display = 'block';
                }
                // Cap nhat thong tin don hang QR neu co maGiaoDichGoc
                if (maGiaoDichGoc && duLieu.thong_tin_don_hang_cho_qr) {
                    thongTinDonHangQR.textContent = `${duLieu.thong_tin_don_hang_cho_qr} (GD ${maGiaoDichGoc})`;
                }

                trangThaiNapTien.textContent = 'Vui lòng quét mã QR bằng ứng dụng ngân hàng của bạn.';
                trangThaiNapTien.className = 'status-message success';
                setTimeout(() => {
                    if (trangThaiNapTien.classList.contains('success')) {
                       trangThaiNapTien.textContent += ' Sau khi thanh toán, số dư sẽ được cập nhật. Bạn có thể cần tải lại trang sau vài phút.';
                    }
                }, 3000);
                return true;
            } else {
                throw new Error(duLieu.loi || duLieu.error || 'Không nhận được dữ liệu mã QR từ server.');
            }

        } catch (error) {
            console.error('Lỗi khi yêu cầu nạp tiền:', error);
            trangThaiNapTien.textContent = error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
            trangThaiNapTien.className = 'status-message error';
            return false;
        }
    }

    function hienThiFormNapTienVaReset() {
        if (!khuVucNapTien) return;
        
        khuVucNapTien.style.display = 'block';
        if (khuVucRutTien) khuVucRutTien.style.display = 'none';
        
        if(formNapTien) formNapTien.reset();
        if(inputSoTienNap) inputSoTienNap.value = ''; // Dam bao input so tien trong
        if(khuVucMaQR) khuVucMaQR.innerHTML = '';
        if(huongDanNapTien) huongDanNapTien.style.display = 'none';
        if(trangThaiNapTien) {
            trangThaiNapTien.style.display = 'none';
            trangThaiNapTien.textContent = '';
            trangThaiNapTien.className = 'status-message';
        }
    }

    if (nutHienThiFormNapTien) {
        nutHienThiFormNapTien.addEventListener('click', function(e) {
            e.preventDefault();
            hienThiFormNapTienVaReset();
            if(inputSoTienNap) inputSoTienNap.focus();
        });
    }

    if (nutHienThiFormRutTien) {
        nutHienThiFormRutTien.addEventListener('click', function(e) {
            e.preventDefault();
            if (khuVucRutTien) {
                if (khuVucRutTien.style.display === 'none' || khuVucRutTien.style.display === '') {
                    khuVucRutTien.style.display = 'block';
                    if (khuVucNapTien) khuVucNapTien.style.display = 'none'; 
                } else {
                    khuVucRutTien.style.display = 'none';
                }
            }
        });
    }
    
    if (formNapTien) {
        formNapTien.addEventListener('submit', async function(event) {
            event.preventDefault();
            const soTienHienTai = inputSoTienNap ? inputSoTienNap.value : "0";
            await guiYeuCauTaoMaQR(soTienHienTai); 
        });
    }

    async function khoiTaoNapTienTuDong() {
        const paramsUrl = new URLSearchParams(window.location.search);
        const mucDich = paramsUrl.get('mucDich');
        const soTienCanNap = paramsUrl.get('soTienCanNap');
        const maGiaoDichGoc = paramsUrl.get('maGiaoDichGoc');

        if (mucDich === 'thanhToanSanPham' && soTienCanNap) {
            hienThiFormNapTienVaReset();

            if (inputSoTienNap) {
                // Dinh dang so tien nap (VD: 200000 thay vi 200,000)
                inputSoTienNap.value = parseFloat(soTienCanNap.replace(/,/g, '')); 
            }

            // Goi ham tao QR sau khi input da duoc set gia tri
            // Su dung setTimeout de dam bao DOM co thoi gian cap nhat gia tri input
            setTimeout(async () => {
                const soTienDaDien = inputSoTienNap ? inputSoTienNap.value : "0";
                await guiYeuCauTaoMaQR(soTienDaDien, maGiaoDichGoc);
            }, 100); 

            if (history.replaceState) {
                const urlSach = window.location.pathname;
                history.replaceState({ path: urlSach }, '', urlSach);
            }
        }
    }

    khoiTaoNapTienTuDong();

    console.log("wallet_dashboard.js loaded and ready.");
});