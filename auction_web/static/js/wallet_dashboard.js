// static/js/wallet_dashboard.js
document.addEventListener('DOMContentLoaded', function() {
    const nutHienThiFormNapTien = document.getElementById('nutHienThiFormNapTien');
    const nutHienThiFormRutTien = document.getElementById('nutHienThiFormRutTien');
    const khuVucNapTien = document.getElementById('khuVucNapTien');
    const khuVucRutTien = document.getElementById('khuVucRutTien');

    // Các element của form nạp tiền (đã có trong file HTML)
    // const formNapTien = document.getElementById('formNapTien');
    // const khuVucMaQR = document.getElementById('khuVucMaQR');
    // const huongDanNapTien = document.getElementById('huongDanNapTien');
    // const thongTinDonHangQR = document.getElementById('thongTinDonHangQR');
    // const trangThaiNapTien = document.getElementById('trangThaiNapTien');

    if (nutHienThiFormNapTien) {
        nutHienThiFormNapTien.addEventListener('click', function(e) {
            e.preventDefault();
            // Toggle hiển thị khu vực nạp tiền
            if (khuVucNapTien.style.display === 'none' || khuVucNapTien.style.display === '') {
                khuVucNapTien.style.display = 'block';
                if (khuVucRutTien) khuVucRutTien.style.display = 'none'; // Ẩn form rút tiền nếu đang mở
                // Reset form nạp tiền khi mở (nếu cần)
                const formNap = document.getElementById('formNapTien');
                if(formNap) formNap.reset();
                const qrContainer = document.getElementById('khuVucMaQR');
                if(qrContainer) qrContainer.innerHTML = '';
                const instructions = document.getElementById('huongDanNapTien');
                if(instructions) instructions.style.display = 'none';
                const statusMsg = document.getElementById('trangThaiNapTien');  
                if(statusMsg) {
                    statusMsg.style.display = 'none';
                    statusMsg.textContent = '';
                    statusMsg.className = 'status-message';
                }

            } else {
                khuVucNapTien.style.display = 'none';
            }
        });
    }

    if (nutHienThiFormRutTien) {
        nutHienThiFormRutTien.addEventListener('click', function(e) {
            e.preventDefault();
            // Toggle hiển thị khu vực rút tiền
            if (khuVucRutTien) {
                if (khuVucRutTien.style.display === 'none' || khuVucRutTien.style.display === '') {
                    khuVucRutTien.style.display = 'block';
                    if (khuVucNapTien) khuVucNapTien.style.display = 'none'; // Ẩn form nạp tiền nếu đang mở
                } else {
                    khuVucRutTien.style.display = 'none';
                }
            }
        });
    }

    // Logic gọi API nạp tiền và hiển thị QR code đã có trong block <script>
    // của file wallet_dashboard.html. Nếu bạn muốn chuyển nó vào đây,
    // bạn có thể di chuyển phần code đó vào trong sự kiện DOMContentLoaded này.
    // Ví dụ:
    // const formNapTien = document.getElementById('formNapTien');
    // if (formNapTien) {
    //     formNapTien.addEventListener('submit', async function(event) {
    //         event.preventDefault();
    //         // ... (toàn bộ logic gọi API và xử lý hiển thị QR như trong file HTML)
    //     });
    // }

    console.log("wallet_dashboard.js loaded and ready.");
});
