// static/js/base.js
// Phiên bản: 2025-05-14 (Sửa lỗi query #newsletterMessage)

/**
 * Hàm tiện ích lấy giá trị cookie theo tên (nếu cần cho CSRF).
 */
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

/**
 * Thiết lập chức năng đóng/mở cho dropdown người dùng ở Header.
 */
function setupUserDropdown() {
    const container = document.querySelector('.user-dropdown-container');
    if (!container) return;
    const triggerBtn = container.querySelector('.user-dropdown-trigger');
    const dropdownMenu = container.querySelector('.user-dropdown-menu');
    if (!triggerBtn || !dropdownMenu) {
        // console.error("Base.js: User Dropdown trigger or menu not found.");
        return;
    }
    triggerBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isShown = dropdownMenu.classList.toggle('show');
        triggerBtn.setAttribute('aria-expanded', isShown.toString());
    });
    document.addEventListener('click', (event) => {
        if (dropdownMenu.classList.contains('show') && !container.contains(event.target)) {
            dropdownMenu.classList.remove('show');
            triggerBtn.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
            triggerBtn.setAttribute('aria-expanded', 'false');
            triggerBtn.focus();
        }
    });
}

/**
 * Thiết lập chức năng cho Search Modal.
 */
function setupSearchModal() {
    const searchModal = document.getElementById('searchModal');
    const searchTriggerBtn = document.querySelector('.search-trigger-btn');
    const closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
    const searchInput = document.getElementById('searchInputModal');
    if (!searchModal || !searchTriggerBtn || !closeSearchModalBtn || !searchInput) {
        // console.warn("Base.js: Search modal elements not found.");
        return;
    }
    const openModal = () => {
        searchModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        searchInput.value = '';
        searchInput.focus();
    };
    const closeModal = () => {
        searchModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        searchTriggerBtn.focus();
    };
    searchTriggerBtn.addEventListener('click', openModal);
    closeSearchModalBtn.addEventListener('click', closeModal);
    searchModal.addEventListener('click', (event) => { if (event.target === searchModal) closeModal(); });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchModal.getAttribute('aria-hidden') === 'false') closeModal();
    });
}

/**
 * Xử lý form đăng ký nhận bản tin ở Footer.
 */
function setupNewsletterForm() {
    const newsletterForm = document.getElementById('newsletterForm');
    if (!newsletterForm) return;

    const emailInput = newsletterForm.querySelector('#newsletterEmailInput');
    // **SỬA Ở ĐÂY: Tìm #newsletterMessage bằng document.getElementById vì nó không phải con của form**
    const messageElement = document.getElementById('newsletterMessage');
    const submitButton = newsletterForm.querySelector('#newsletterSubmitBtn');

    // Kiểm tra lại điều kiện sau khi sửa cách query messageElement
    if (!emailInput || !messageElement || !submitButton) {
        let errorMsg = "Base.js: Newsletter form setup failed. ";
        if (!document.getElementById('newsletterForm')) errorMsg += "'newsletterForm' not found. ";
        if (!emailInput || !newsletterForm.contains(emailInput)) errorMsg += "'#newsletterEmailInput' not found inside 'newsletterForm' or is not a child. ";
        if (!messageElement) errorMsg += "'#newsletterMessage' not found in the document. "; // Kiểm tra messageElement riêng
        if (!submitButton || !newsletterForm.contains(submitButton)) errorMsg += "'#newsletterSubmitBtn' not found inside 'newsletterForm' or is not a child. ";
        console.error(errorMsg.trim());
        return;
    }

    const showMessage = (message, type = 'info') => {
        messageElement.textContent = message;
        messageElement.className = `newsletter-message ${type}`;
        messageElement.style.display = 'block';
        messageElement.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    };

    newsletterForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const email = emailInput.value.trim();
        if (!email || !/^\S+@\S+\.\S{2,}$/.test(email)) {
            showMessage('Vui lòng nhập địa chỉ email hợp lệ.', 'error');
            emailInput.focus();
            return;
        }
        showMessage('Đang xử lý...', 'info');
        emailInput.disabled = true; submitButton.disabled = true; submitButton.textContent = 'Đang gửi...';

        const newsletterApiUrl = '/api/newsletter/subscribe/'; // **ĐỔI URL API NÀY NẾU CẦN**
        fetch(newsletterApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ email: email })
        })
        .then(response => response.json().then(data => ({ok: response.ok, status: response.status, data})))
        .then(({ok, status, data}) => {
            if (ok) {
                showMessage(data.message || 'Cảm ơn bạn đã đăng ký!', 'success');
                emailInput.value = '';
            } else {
                showMessage(data.error || `Lỗi ${status}: Không thể đăng ký.`, 'error');
            }
        })
        .catch(error => {
            console.error('Base.js: Newsletter error:', error);
            showMessage('Lỗi kết nối. Vui lòng thử lại.', 'error');
        })
        .finally(() => {
            emailInput.disabled = false; submitButton.disabled = false; submitButton.textContent = 'Đăng ký';
            setTimeout(() => { messageElement.style.display = 'none'; }, 7000);
        });
    });
}

/**
 * Đánh dấu link active trong navigation menu chính.
 */
function setActiveNavLink() {
    try {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.main-nav.plant-theme-nav ul li a[data-nav-path]');
        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkPath = link.dataset.navPath;
            if (linkPath === "/" && (currentPath === "/" || currentPath.startsWith('/index.html'))) {
                link.classList.add('active');
            } else if (linkPath !== "/" && currentPath.startsWith(linkPath)) {
                link.classList.add('active');
            }
        });
    } catch (e) { /* console.error("Base.js: Error in setActiveNavLink:", e); */ }
}

/**
 * Cập nhật UI Header (dropdown người dùng) dựa trên trạng thái đăng nhập.
 */
function updateUserAuthUI(isLoggedIn, userData = {}) {
    const userActionArea = document.getElementById('user-action-area');
    if (!userActionArea) return;
    const triggerBtn = userActionArea.querySelector('.user-dropdown-trigger');
    const dropdownMenuUl = userActionArea.querySelector('.user-dropdown-menu ul');
    if (!triggerBtn || !dropdownMenuUl) return;

    const URLS = {
        login: "/accounts/login/",
        register: "/accounts/register/",
        profile: "/user/profile/",
        myAuctions: "/my-auctions/",
        myPurchasingItems: "/my-purchasing-items/",
        createAuction: "/api/items/create-auction/", // Sửa lại từ code cậu gửi, có thể là create-auction
        settings: "/accounts/settings/",
        logout: "/accounts/logout/",
        wallet: "/api/wallet/",
        howItWorks: "/how-it-works/", // Thêm link này cho trạng thái chưa đăng nhập
        defaultAvatar: '/static/images/default_avatar.png'
    };

    if (isLoggedIn) {
        const avatarSrc = userData.avatarUrl || URLS.defaultAvatar;
        const welcomeMessage = 'Tài khoản của tôi';
        triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="User Avatar" class="user-avatar-trigger" title="${welcomeMessage}">`;
        triggerBtn.setAttribute('aria-label', welcomeMessage);
        dropdownMenuUl.innerHTML = `
            <li><a href="${URLS.profile}">Trang cá nhân</a></li>
            <li class="separator"></li>
            <li><a href="${URLS.myPurchasingItems}">Giỏ hàng của tôi</a></li>
            <li><a href="${URLS.myAuctions}">Phiên đấu giá của tôi</a></li>
            <li><a href="${URLS.createAuction}">Tạo phiên đấu giá</a></li>
            <li><a href="${URLS.settings}">Cài đặt tài khoản</a></li>
            <li><a href="${URLS.wallet}">Ví của tôi</a></li>

            <li class="separator"></li>
            <li><a href="${URLS.logout}">Đăng xuất</a></li>`;
    } else {
        triggerBtn.innerHTML = '<i class="fas fa-user header-icon"></i>';
        triggerBtn.setAttribute('aria-label', 'Tài khoản người dùng');
        dropdownMenuUl.innerHTML =
        `
            <li><a href="${URLS.login}">Đăng nhập</a></li>
            <li><a href="${URLS.register}">Đăng ký</a></li>
        `;
    }
}

/**
 * Gọi API /api/profile/get_avatar/ để kiểm tra trạng thái đăng nhập và cập nhật UI.
 */
function checkAuthStatusAndSetupHeader() {
    const profileAvatarApiUrl = '/api/profile/get_avatar/';

    fetch(profileAvatarApiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        if (response.ok) { // Status 200-299
            // API /api/profile/get_avatar/ khi thành công sẽ trả về { avatarUrl, profileUrl }
            // Chúng ta cần biến đổi nó thành { isLoggedIn: true, userData: { avatarUrl, profileUrl } }
            return response.json()
                .then(data => {
                    if (typeof data !== 'object' || data === null) { // Kiểm tra data có phải object không
                        console.error(`Base.js: API ${profileAvatarApiUrl} returned OK, but data is not a valid object:`, data);
                        return { isLoggedIn: true, userData: {} }; // Trả về mặc định nếu data không đúng dạng
                    }
                    return { isLoggedIn: true, userData: data }; // data ở đây là { avatarUrl, profileUrl }
                })
                .catch(jsonError => { // Bắt lỗi nếu response.json() thất bại (body không phải JSON)
                    console.error(`Base.js: Failed to parse JSON from ${profileAvatarApiUrl}. Status: ${response.status}`, jsonError);
                    return { isLoggedIn: true, userData: {} }; // Vẫn coi là loggedIn vì status OK, nhưng không có userData cụ thể
                });
        } else if (response.status === 401 || response.status === 403) {
            // console.log(`Base.js: User not authenticated for ${profileAvatarApiUrl} (${response.status})`);
            return { isLoggedIn: false, userData: {} }; // Trả về đúng cấu trúc
        } else {
            // Các lỗi server khác
            console.error(`Base.js: API error fetching profile avatar (${response.status}). URL: ${profileAvatarApiUrl}`);
            return { isLoggedIn: false, userData: {} }; // Trả về đúng cấu trúc
        }
    })
    .then(result => { // 'result' ở đây sẽ luôn là một object { isLoggedIn, userData }
        if (typeof result === 'undefined') { // Kiểm tra thêm một lần nữa cho chắc chắn
            console.error("Base.js: Result from auth API promise chain is undefined. Defaulting to not logged in.");
            updateUserAuthUI(false, {});
            // Set biến global (nếu cậu còn dùng cách này cho bidding_detail.js)
            window.isUserGloballyAuthenticated = false;
            window.globalUserData = {};
            document.dispatchEvent(new CustomEvent('authStateKnown', { detail: { isLoggedIn: false, userData: {} } }));
            return;
        }
        // Giờ thì 'result' chắc chắn là object, ta có thể destructure an toàn
        const { isLoggedIn, userData } = result;
        updateUserAuthUI(isLoggedIn, userData);

        // Set biến global hoặc dispatch event để bidding_detail.js biết
        window.isUserGloballyAuthenticated = isLoggedIn;
        window.globalUserData = userData || {}; // Đảm bảo userData không phải null/undefined
        const authEvent = new CustomEvent('authStateKnown', { detail: { isLoggedIn, userData: userData || {} } });
        document.dispatchEvent(authEvent);
        // console.log("Base.js: Dispatched 'authStateKnown' event.", authEvent.detail);
    })
    .catch(networkError => {
        console.error('Base.js: Network error fetching profile avatar:', networkError);
        updateUserAuthUI(false, {});
        // Set biến global hoặc dispatch event (trạng thái lỗi)
        window.isUserGloballyAuthenticated = false;
        window.globalUserData = {};
        document.dispatchEvent(new CustomEvent('authStateKnown', { detail: { isLoggedIn: false, userData: {} } }));
    });
}

// --- CHẠY CÁC HÀM KHI DOM ĐÃ TẢI XONG ---
document.addEventListener("DOMContentLoaded", function () {
    const copyrightYearSpan = document.getElementById('copyright-year');
    if (copyrightYearSpan) {
        copyrightYearSpan.textContent = new Date().getFullYear().toString();
    }

    setupUserDropdown();
    setupSearchModal();
    setupNewsletterForm();
    setActiveNavLink();
    checkAuthStatusAndSetupHeader();

    // Lấy thời gian hiện tại từ client để log
    console.log("Base.js (Using /api/profile/get_avatar/) initialized. Client date: " + new Date().toLocaleDateString('vi-VN'));
});