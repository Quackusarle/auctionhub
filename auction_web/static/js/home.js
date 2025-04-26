// auction_web/static/js/home.js (Phiên bản Dropdown Menu)

// --- Các hàm phụ trợ ---

/**
 * Định dạng chuỗi giá tiền sang dạng $X,XXX
 */
function formatPrice(priceString) {
    try {
        const price = parseFloat(String(priceString).replace(/,/g, ''));
        if (isNaN(price)) {
            throw new Error("Invalid number for price");
        }
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } catch (e) {
        console.error("Error formatting price:", priceString, e);
        return priceString ? `$${priceString}` : '$0';
    }
}

/**
 * Thiết lập chức năng đóng/mở cho dropdown người dùng
 */
function setupDropdownToggle() {
    const container = document.querySelector('.user-dropdown-container');
    if (!container) return; // Không tìm thấy container thì thôi

    const triggerBtn = container.querySelector('.user-dropdown-trigger');
    const dropdownMenu = container.querySelector('.user-dropdown-menu');

    if (!triggerBtn || !dropdownMenu) {
        console.error("Dropdown trigger or menu not found inside container.");
        return;
    }

    triggerBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Ngăn sự kiện click nổi lên document ngay lập tức
        const isShown = dropdownMenu.classList.toggle('show');
        triggerBtn.setAttribute('aria-expanded', isShown);
    });

    // Đóng dropdown khi bấm ra ngoài
    document.addEventListener('click', (event) => {
        if (!container.contains(event.target) && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
            triggerBtn.setAttribute('aria-expanded', 'false');
        }
    });

     // Đóng dropdown khi bấm phím Escape
     document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
            triggerBtn.setAttribute('aria-expanded', 'false');
        }
     });
}


// --- Chạy code sau khi DOM tải xong ---
document.addEventListener("DOMContentLoaded", function () {

    // == PHẦN 1: Cập nhật năm và Thiết lập Dropdown ==
    const copyrightYearSpan = document.getElementById('copyright-year');
    if (copyrightYearSpan) {
        copyrightYearSpan.textContent = new Date().getFullYear();
    }

    // Gọi hàm thiết lập toggle cho dropdown
    setupDropdownToggle();


    // == PHẦN 2: Tải và hiển thị sản phẩm lên Grid ==
    const gridContainer = document.getElementById('item-grid-container');
    const loadingMessage = document.getElementById('loading-message');
    const itemsApiUrl = '/api/items/'; // Đổi tên biến cho rõ ràng

    if (gridContainer) { // Chỉ chạy nếu có grid container
        // Hiển thị loading message ban đầu
        if (loadingMessage) {
             gridContainer.innerHTML = '';
             gridContainer.appendChild(loadingMessage);
        } else {
             gridContainer.innerHTML = '<p id="loading-message" style="text-align: center; width: 100%; padding: 20px;">Đang tải danh sách sản phẩm...</p>';
        }

        fetch(itemsApiUrl)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(items => {
                const currentLoadingMsg = gridContainer.querySelector('#loading-message');
                if (currentLoadingMsg) currentLoadingMsg.remove();
                gridContainer.innerHTML = '';

                if (items && Array.isArray(items) && items.length > 0) {
                    const sortedItems = items
                        .filter(item => item && typeof item.current_price !== 'undefined')
                        .sort((a, b) => /* ... (giữ nguyên logic sort) ... */ {
                            const priceA = parseFloat(String(a.current_price || 0).replace(/,/g, ''));
                            const priceB = parseFloat(String(b.current_price || 0).replace(/,/g, ''));
                            return (isNaN(priceB) ? 0 : priceB) - (isNaN(priceA) ? 0 : priceA);
                         });

                    const top9Items = sortedItems.slice(0, 9);
                    console.log(`Displaying top ${top9Items.length} items in grid.`);

                    if (top9Items.length > 0) {
                        top9Items.forEach(item => {
                            // ... (Giữ nguyên logic tạo thẻ item và append vào gridContainer) ...
                            const linkWrapper = document.createElement('a');
                            const itemId = item.item_id || item.id || item.pk;
                            if (itemId) linkWrapper.href = `/items/${itemId}/`;
                            linkWrapper.classList.add('item-card-link');

                            const article = document.createElement('article');
                            article.classList.add('item-card');
                            // ... (Tạo img, cardContent, heading, pricePara như cũ) ...
                            const img = document.createElement('img');
                            img.src = item.image_url || '/static/images/placeholder.png';
                            img.alt = item.name || 'Auction Item';
                            img.loading = 'lazy';

                            const cardContent = document.createElement('div');
                            cardContent.classList.add('card-content');

                            const heading = document.createElement('h3');
                            heading.textContent = item.name || 'N/A';

                            const pricePara = document.createElement('span');
                            pricePara.classList.add('price');
                            pricePara.textContent = formatPrice(item.current_price || 0);

                            cardContent.appendChild(heading);
                            cardContent.appendChild(pricePara);
                            article.appendChild(img);
                            article.appendChild(cardContent);

                            linkWrapper.appendChild(article);
                            gridContainer.appendChild(linkWrapper);
                        });
                    } else {
                        gridContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Không có sản phẩm nào phù hợp để hiển thị.</p>';
                    }
                } else {
                    gridContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Hiện chưa có sản phẩm nào được đấu giá.</p>';
                }
            })
            .catch(error => {
                console.error('Error fetching or processing items:', error);
                const currentLoadingMsg = gridContainer.querySelector('#loading-message');
                if (currentLoadingMsg) currentLoadingMsg.remove();
                gridContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 20px; color: red;">Oops! Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại sau.</p>`;
            });
    } else {
         console.warn("Grid container '#item-grid-container' not found. Skipping item loading.");
    }


    // == PHẦN 3: Kiểm tra trạng thái đăng nhập và cập nhật Header Dropdown ==
    const userActionArea = document.getElementById('user-action-area');
    const profileApiUrl = '/api/profile/get_avatar/'; // Đổi tên biến

    if (userActionArea) { // Chỉ chạy nếu có khu vực user action
        const triggerBtn = userActionArea.querySelector('.user-dropdown-trigger');
        const dropdownMenuUl = userActionArea.querySelector('.user-dropdown-menu ul');

        if (!triggerBtn || !dropdownMenuUl) {
            console.error("User action area is present, but trigger or menu UL is missing.");
            return; // Bỏ qua nếu cấu trúc HTML không đúng
        }

        // Hàm để thiết lập trạng thái mặc định (chưa đăng nhập)
        const setDefaultUserState = () => {
            console.log("ĐANG CHẠY setDefaultUserState!");
            const settingsUrl = "#"; // Vì nút này chỉ chạy JS, nên href để # là được
            const loginUrl = "/accounts/login/"; // URL trang đăng nhập của cậu
            triggerBtn.innerHTML = '<i class="fas fa-user header-icon"></i>'; // Đặt lại icon
            dropdownMenuUl.innerHTML = 
            `<li><a href="${settingsUrl}">Cài đặt</a></li> 
             <li class="separator"></li>
             <li><a href="${loginUrl}">Đăng nhập</a></li>`
        };

        console.log('[home.js] Checking login status for header dropdown...');
        fetch(profileApiUrl, { credentials: 'include' })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        console.log(`[home.js] Login check: Not logged in or no permission (${response.status}).`);
                        return null; // Trả về null để xử lý ở .then tiếp theo
                    } else {
                        throw new Error(`Server error checking profile: ${response.status}`);
                    }
                }
                return response.json(); // Trả về dữ liệu nếu OK
            })
            .then(data => {
                console.log('[home.js] Profile data received:', data);
                if (data && data.profileUrl) { // Có vẻ đã đăng nhập và có dữ liệu
                    console.log('[home.js] User logged in. Updating dropdown.');
                    // Cập nhật nút trigger với avatar
                    const defaultAvatar = '/static/images/default_avatar.jpg';
                    const avatarSrc = data.avatarUrl || defaultAvatar;
                    triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="Avatar" style="width: 50px; height: 50px; border-radius: 50%; display: block; object-fit: cover; border: 1px solid var(--border-color);">`; // Nên dùng class CSS hơn là inline style

                    // Cập nhật menu dropdown
                    // ** NHỚ THAY URL ĐÚNG **
                    const settingsUrl = "#"; // URL trang cài đặt
                    const logoutUrl = "/accounts/logout/";   // URL đăng xuất
                    dropdownMenuUl.innerHTML = `
                        <li><a href="${settingsUrl}">Cài đặt</a></li>
                        <li><a href="${logoutUrl}">Đăng xuất</a></li>
                    `;
                } else { // Không có dữ liệu hợp lệ hoặc trả về null từ bước trước -> Chưa đăng nhập
                    console.log('[home.js] User not logged in or data invalid. Setting default state.');
                    setDefaultUserState(); // Đặt lại trạng thái mặc định
                }
            })
            .catch(error => {
                console.error('[home.js] Error checking login status or updating dropdown:', error);
                setDefaultUserState(); // Gặp lỗi thì cũng trả về trạng thái chưa đăng nhập cho an toàn
            });
    } else {
         console.warn("User action area '#user-action-area' not found. Skipping login check.");
    }

}); // Kết thúc DOMContentLoaded chính