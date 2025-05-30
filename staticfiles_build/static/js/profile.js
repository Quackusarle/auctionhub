document.addEventListener('DOMContentLoaded', function() {
    const csrfToken = getCookie('csrftoken');

    const API_URLS = {
        profileMe: '/api/profile/me/',
        getAvatar: '/api/profile/get_avatar/',
        uploadAvatar: '/api/profile/upload_avatar/',
        deleteAccount: '/api/profile/delete/'
    };

    const profileAvatarDisplay = document.getElementById('profileAvatarDisplay');
    const userEmailDisplay = document.querySelector('.profile-sidebar .user-email');
    const userStatusDisplay = document.querySelector('.profile-sidebar .user-status');
    const userBalanceDisplay = document.querySelector('.profile-main-info .info-item span.balance');

    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarUploadInput = document.getElementById('avatarUploadInput');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');

    function getCookie(name) {
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

    async function fetchAPI(url, options = {}) {
        if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
            options.headers = {
                ...options.headers,
                'X-CSRFToken': csrfToken,
            };
        }
        const response = await fetch(url, options);
        if (response.status === 204) return { success: true, status: 204 };
        const data = await response.json();
        if (!response.ok) {
            const error = new Error(data.detail || `HTTP Error: ${response.status}`);
            error.data = data;
            throw error;
        }
        return data;
    }

    function updateAvatarDisplay(avatarUrl, emailForPlaceholder = null) {
        let currentDisplay = document.getElementById('profileAvatarDisplay');
        if (!currentDisplay) return;

        if (avatarUrl) {
            if (currentDisplay.tagName === 'IMG') {
                currentDisplay.src = avatarUrl + '?t=' + new Date().getTime();
            } else {
                const img = document.createElement('img');
                img.src = avatarUrl + '?t=' + new Date().getTime();
                img.alt = "Ảnh đại diện";
                img.id = "profileAvatarDisplay";
                currentDisplay.parentNode.replaceChild(img, currentDisplay);
            }
        } else if (emailForPlaceholder) {
            const placeholderText = emailForPlaceholder.charAt(0).toUpperCase();
            if (currentDisplay.tagName === 'DIV') {
                currentDisplay.textContent = placeholderText;
            } else {
                const div = document.createElement('div');
                div.className = 'profile-avatar-placeholder';
                div.id = 'profileAvatarDisplay';
                div.textContent = placeholderText;
                currentDisplay.parentNode.replaceChild(div, currentDisplay);
            }
        } else {
            if (currentDisplay.tagName === 'DIV') {
                currentDisplay.textContent = '';
            } else {
                const div = document.createElement('div');
                div.className = 'profile-avatar-placeholder';
                div.id = 'profileAvatarDisplay';
                div.textContent = '';
                currentDisplay.parentNode.replaceChild(div, currentDisplay);
            }
        }
    }

    async function loadUserProfile() {
        try {
            const userData = await fetchAPI(API_URLS.profileMe);
            const avatarData = await fetchAPI(API_URLS.getAvatar);
            const avatarUrl = avatarData.avatarUrl || null;
            updateAvatarDisplay(avatarUrl, userData.email);

            if (userEmailDisplay) userEmailDisplay.textContent = userData.email || 'N/A';
            if (userStatusDisplay) {
                userStatusDisplay.textContent = userData.is_active ? 'Đang hoạt động' : 'Tạm khóa';
                userStatusDisplay.className = `user-status ${userData.is_active ? 'active' : 'inactive'}`;
            }

            const detailSpans = document.querySelectorAll('.profile-main-info .info-item .value');
            if (detailSpans.length >= 4) {
                detailSpans[0].textContent = userData.id || 'N/A';
                detailSpans[1].textContent = userData.email || 'N/A';
                if (userBalanceDisplay && typeof userData.balance !== 'undefined') {
                    userBalanceDisplay.textContent = `${parseFloat(userData.balance).toLocaleString('vi-VN')} VND`;
                } else if (userBalanceDisplay) {
                    userBalanceDisplay.textContent = '0 VND';
                }
                let joinDate = userData.created_at || userData.date_joined || 'N/A';
                const dateObj = new Date(joinDate);
                const formatted = dateObj instanceof Date && !isNaN(dateObj)
                    ? `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`
                    : joinDate;
                detailSpans[3].textContent = formatted;
            }
        } catch (error) {
            alert("Không thể tải thông tin hồ sơ.");
        }
    }

    async function handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024 || !file.type.startsWith('image/')) {
            alert("File không hợp lệ.");
            avatarUploadInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('profile_picture', file);

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
        };
        reader.readAsDataURL(file);

        try {
            const data = await fetchAPI(API_URLS.uploadAvatar, { method: 'POST', body: formData });
            alert(data.detail || "Đã cập nhật ảnh đại diện.");
            loadUserProfile();
        } catch (error) {
            alert(`Lỗi upload ảnh: ${error.data?.detail || error.message}`);
            loadUserProfile();
        } finally {
            avatarUploadInput.value = '';
        }
    }

    async function handleDeleteAccount() {
        if (!confirm("Bạn chắc chắn muốn xóa tài khoản?")) return;
        try {
            const result = await fetchAPI(API_URLS.deleteAccount, { method: 'DELETE' });
            if (result.status === 204 || result.success) {
                alert("Tài khoản đã xóa.");
                window.location.href = '/accounts/logout/';
            }
        } catch (e) {
            alert("Không thể xóa tài khoản.");
        }
    }

    if (changeAvatarBtn && avatarUploadInput) {
        changeAvatarBtn.addEventListener('click', () => avatarUploadInput.click());
        avatarUploadInput.addEventListener('change', handleAvatarUpload);
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDeleteAccount);
    }

    loadUserProfile();
});