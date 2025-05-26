// Chờ cho toàn bộ nội dung trang được tải xong rồi mới thực thi mã
document.addEventListener('DOMContentLoaded', function() {
    // === KHAI BÁO BIẾN VÀ CÁC HÀM TIỆN ÍCH ===

    // Lấy CSRF token từ cookie (cách phổ biến)
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrfToken = getCookie('csrftoken'); // Đảm bảo Django server gửi cookie csrftoken

    // URLs API (nên lấy từ data attributes của HTML hoặc một config object để dễ thay đổi)
    // Giả sử các URL này được đặt trong thẻ script của HTML hoặc là các hằng số
    // Ví dụ: <script id="api-urls" data-profile-me="/api/profile/me/" ...></script>
    // Hoặc nếu các URL này cố định và đúng như trong urls.py của cậu:
    const API_URLS = {
        profileMe: '/api/profile/me/',
        getAvatar: '/api/profile/get_avatar/', // Thực tế có thể không cần nếu profileMe đã trả avatar
        uploadAvatar: '/api/profile/upload_avatar/',
        deleteAccount: '/api/profile/delete/'
    };

    // DOM Elements (Lấy các phần tử HTML mà chúng ta sẽ tương tác)
    const profileAvatarDisplay = document.getElementById('profileAvatarDisplay');
    const userEmailDisplay = document.querySelector('.profile-sidebar .user-email'); // Cần class cụ thể hơn nếu có nhiều .user-email
    const userStatusDisplay = document.querySelector('.profile-sidebar .user-status');
    const userIdDisplay = document.querySelector('.profile-main-info .info-item span.value:nth-of-type(1)'); // Cách lấy này hơi mong manh, nên có ID
    const userEmailDetailDisplay = document.querySelectorAll('.profile-main-info .info-item span.value')[1]; // Tương tự, nên có ID
    const userBalanceDisplay = document.querySelector('.profile-main-info .info-item span.balance');
    const userJoinDateDisplay = document.querySelectorAll('.profile-main-info .info-item span.value')[3]; // Tương tự, nên có ID

    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarUploadInput = document.getElementById('avatarUploadInput');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');

    // === CÁC HÀM XỬ LÝ LOGIC ===

    /**
     * Hàm gọi API chung
     * @param {string} url - URL của API
     * @param {object} options - Các tùy chọn cho fetch (method, headers, body)
     * @returns {Promise<object>} - Promise chứa dữ liệu JSON từ API
     */
    async function fetchAPI(url, options = {}) {
        // Thêm CSRF token vào header cho các method không phải GET
        if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
            options.headers = {
                ...options.headers,
                'X-CSRFToken': csrfToken,
            };
        }

        try {
            const response = await fetch(url, options);
            if (response.status === 204) { // No Content (thường cho DELETE thành công)
                return { success: true, status: 204 };
            }
            const data = await response.json();
            if (!response.ok) {
                // Ném lỗi với thông tin từ server nếu có (ví dụ: data.detail)
                const error = new Error(data.detail || `Lỗi HTTP: ${response.status}`);
                error.data = data; // Đính kèm thêm dữ liệu lỗi
                throw error;
            }
            return data;
        } catch (error) {
            console.error(`Lỗi khi gọi API ${url}:`, error.message);
            // Hiển thị thông báo lỗi cho người dùng một cách thân thiện hơn ở đây
            // alert(`Đã xảy ra lỗi: ${error.message}`); // Ví dụ đơn giản
            throw error; // Ném lại lỗi để hàm gọi có thể xử lý
        }
    }

    /**
     * Cập nhật ảnh đại diện trên giao diện
     * @param {string|null} avatarUrl - URL của ảnh đại diện, hoặc null
     * @param {string|null} emailForPlaceholder - Email để tạo placeholder nếu không có ảnh
     */
    function updateAvatarDisplay(avatarUrl, emailForPlaceholder = null) {
        let currentDisplay = document.getElementById('profileAvatarDisplay'); // Lấy lại element phòng trường hợp nó bị thay thế
        if (!currentDisplay) return;

        if (avatarUrl) {
            if (currentDisplay.tagName === 'IMG') {
                currentDisplay.src = avatarUrl + '?t=' + new Date().getTime(); // Thêm timestamp để tránh cache
            } else { // Nếu đang là div placeholder, thay thế bằng img
                const img = document.createElement('img');
                img.src = avatarUrl + '?t=' + new Date().getTime();
                img.alt = "Ảnh đại diện"; // {% trans 'Ảnh đại diện' %}
                img.id = "profileAvatarDisplay";
                currentDisplay.parentNode.replaceChild(img, currentDisplay);
            }
        } else if (emailForPlaceholder) {
            const placeholderText = emailForPlaceholder.charAt(0).toUpperCase();
            if (currentDisplay.tagName === 'DIV') {
                currentDisplay.textContent = placeholderText;
            } else { // Nếu đang là img, thay thế bằng div placeholder
                const div = document.createElement('div');
                div.className = 'profile-avatar-placeholder'; // Giữ class cũ
                div.id = 'profileAvatarDisplay';
                div.textContent = placeholderText;
                currentDisplay.parentNode.replaceChild(div, currentDisplay);
            }
        } else {
            // Trường hợp không có cả avatarUrl và email (hiển thị placeholder trống)
             if (currentDisplay.tagName === 'DIV') {
                currentDisplay.textContent = ''; // Hoặc một ký tự mặc định nào đó
            } else {
                const div = document.createElement('div');
                div.className = 'profile-avatar-placeholder';
                div.id = 'profileAvatarDisplay';
                div.textContent = '';
                currentDisplay.parentNode.replaceChild(div, currentDisplay);
            }
        }
    }


    /**
     * Lấy và hiển thị thông tin hồ sơ người dùng
     */
    async function loadUserProfile() {
        try {
            const userData = await fetchAPI(API_URLS.profileMe);
            console.log("Dữ liệu người dùng:", userData);

            // Cập nhật ảnh đại diện (ưu tiên ảnh từ UserSerializer nếu có)
            // Nếu UserSerializer của cậu trả về profile_picture là URL đầy đủ:
            if (userData.profile_picture) {
                 updateAvatarDisplay(userData.profile_picture, userData.email);
            } else {
                // Nếu không, có thể gọi API getAvatar riêng hoặc dùng email cho placeholder
                // Tuy nhiên, để đơn giản, nếu UserSerializer không trả ảnh, ta vẫn dùng email
                updateAvatarDisplay(null, userData.email);
            }


            // Cập nhật thông tin hiển thị trên sidebar
            if (userEmailDisplay) userEmailDisplay.textContent = userData.email || 'N/A';
            if (userStatusDisplay) {
                userStatusDisplay.textContent = userData.is_active ? 'Đang hoạt động' : 'Tạm khóa';
                userStatusDisplay.className = `user-status ${userData.is_active ? 'active' : 'inactive'}`;
            }

            // Cập nhật thông tin chi tiết
            // Cần đảm bảo các selector này chính xác hoặc dùng ID cho các thẻ span.value
            const detailSpans = document.querySelectorAll('.profile-main-info .info-item .value');
            if (detailSpans.length >= 4) {
                detailSpans[0].textContent = userData.id || 'N/A'; // Mã người dùng
                detailSpans[1].textContent = userData.email || 'N/A'; // Email chi tiết
                // Số dư: Giả sử UserSerializer trả về 'balance' là số
                if (userBalanceDisplay && typeof userData.balance !== 'undefined') {
                     userBalanceDisplay.textContent = `${parseFloat(userData.balance).toLocaleString('vi-VN')} VND`;
                } else if (userBalanceDisplay) {
                    userBalanceDisplay.textContent = '0 VND';
                }
                // Ngày tham gia: Giả sử UserSerializer trả về 'created_at_display' đã định dạng hoặc 'date_joined'
                // Cần định dạng lại ngày tháng nếu server trả về dạng ISO string
                let joinDate = userData.created_at_display || userData.date_joined || 'Chưa có thông tin';
                if (joinDate && !(joinDate.includes('/') || joinDate.includes(':')) && new Date(joinDate) instanceof Date && !isNaN(new Date(joinDate))) {
                    // Nếu là ISO string, định dạng lại
                    const dateObj = new Date(joinDate);
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
                    const year = dateObj.getFullYear();
                    const hours = String(dateObj.getHours()).padStart(2, '0');
                    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                    joinDate = `${day}/${month}/${year} ${hours}:${minutes}`;
                }
                detailSpans[3].textContent = joinDate;
            }


        } catch (error) {
            // Đã console.error trong fetchAPI, có thể thêm xử lý UI ở đây
            alert("Không thể tải thông tin hồ sơ. Vui lòng thử lại sau.");
        }
    }


    /**
     * Xử lý upload ảnh đại diện
     * @param {Event} event - Sự kiện change của input file
     */
    async function handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Kiểm tra kích thước và loại file (có thể làm thêm ở đây nếu cần, dù backend đã có)
        if (file.size > 5 * 1024 * 1024) { // 5MB
            alert("Kích thước file quá lớn (tối đa 5MB).");
            avatarUploadInput.value = ''; // Reset input file
            return;
        }
        if (!file.type.startsWith('image/')) {
            alert("Định dạng file không hợp lệ. Chỉ chấp nhận file ảnh.");
            avatarUploadInput.value = ''; // Reset input file
            return;
        }

        const formData = new FormData();
        formData.append('profile_picture', file); // 'profile_picture' là key backend mong đợi

        // Hiển thị preview tạm thời (như code HTML đã có)
        const reader = new FileReader();
        reader.onload = function(e) {
            let currentDisplay = document.getElementById('profileAvatarDisplay');
            if (currentDisplay.tagName === 'IMG') {
               currentDisplay.src = e.target.result;
            } else {
               const img = document.createElement('img');
               img.src = e.target.result;
               img.alt = "Ảnh đại diện mới";
               img.id = "profileAvatarDisplay";
               currentDisplay.parentNode.replaceChild(img, currentDisplay);
            }
        }
        reader.readAsDataURL(file);


        try {
            const data = await fetchAPI(API_URLS.uploadAvatar, {
                method: 'POST',
                body: formData,
                // fetch tự động đặt Content-Type cho FormData
            });
            alert(data.detail || "Upload ảnh đại diện thành công!");
            if (data.profile_picture_url) {
                updateAvatarDisplay(data.profile_picture_url); // Cập nhật lại ảnh từ server
            }
            avatarUploadInput.value = ''; // Reset input file sau khi upload thành công
        } catch (error) {
            alert(`Lỗi upload ảnh: ${error.data?.detail || error.message}`);
            // Có thể khôi phục ảnh cũ nếu cần
            loadUserProfile(); // Tải lại thông tin để đảm bảo ảnh đúng
            avatarUploadInput.value = '';
        }
    }

    /**
     * Xử lý xóa tài khoản
     */
    async function handleDeleteAccount() {
        if (!confirm("Bạn có chắc chắn muốn xóa tài khoản của mình không? Hành động này không thể hoàn tác.")) {
            return;
        }
        // Tiểu thư đây đã cảnh báo rồi đấy, phải có thêm bước nhập mật khẩu ở đây cho an toàn!
        // Ví dụ:
        // const password = prompt("Vui lòng nhập mật khẩu của bạn để xác nhận xóa tài khoản:");
        // if (password === null) return; // Người dùng nhấn Cancel
        // if (password.trim() === "") {
        //     alert("Mật khẩu không được để trống.");
        //     return;
        // }

        if (!confirm("NGHIÊM TÚC ĐẤY NHÉ? Một khi đã xóa là không lấy lại được đâu!")) {
            return;
        }

        try {
            // Nếu cần gửi mật khẩu, options sẽ là:
            // { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ password: password }) }
            const result = await fetchAPI(API_URLS.deleteAccount, { method: 'DELETE' });

            if (result.status === 204 || result.success) {
                 alert("Tài khoản đã được xóa thành công. Bạn sẽ được chuyển hướng.");
                // Chuyển hướng người dùng, ví dụ về trang đăng xuất hoặc trang chủ
                // Cần có URL đăng xuất từ Django
                window.location.href = '/accounts/logout/'; // Hoặc một URL thích hợp
            } else {
                // Trường hợp API trả về 200 OK với message (ít phổ biến cho DELETE)
                alert(result.detail || "Xóa tài khoản thành công nhưng có phản hồi lạ.");
            }

        } catch (error) {
            alert(`Lỗi xóa tài khoản: ${error.data?.detail || error.message}`);
        }
    }


    // === GÁN SỰ KIỆN ===
    if (changeAvatarBtn && avatarUploadInput) {
        changeAvatarBtn.addEventListener('click', () => avatarUploadInput.click());
        avatarUploadInput.addEventListener('change', handleAvatarUpload);
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDeleteAccount);
    }

    // === KHỞI TẠO KHI TRANG TẢI ===
    loadUserProfile(); // Tải thông tin hồ sơ khi trang được mở

});
