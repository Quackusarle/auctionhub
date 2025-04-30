// auction_web/static/js/home.js (Đã sửa lỗi hiển thị Avatar)

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
        // Định dạng tiền tệ không có phần thập phân
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } catch (e) {
        console.error("Error formatting price:", priceString, e);
        return priceString ? `$${priceString}` : '$0'; // Trả về giá trị gốc nếu lỗi
    }
}

/**
 * Thiết lập chức năng đóng/mở cho dropdown người dùng
 */
function setupDropdownToggle() {
    const container = document.querySelector('.user-dropdown-container');
    if (!container) {
        console.warn('User dropdown container not found.');
        return; 
    }

    const triggerBtn = container.querySelector('.user-dropdown-trigger');
    const dropdownMenu = container.querySelector('.user-dropdown-menu');

    if (!triggerBtn || !dropdownMenu) {
        console.error("Dropdown trigger or menu not found inside container.");
        return;
    }

    // Mở/đóng khi bấm vào nút trigger (avatar hoặc icon)
    triggerBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Ngăn click lan ra document
        const isShown = dropdownMenu.classList.toggle('show');
        triggerBtn.setAttribute('aria-expanded', isShown);
    });

    // Đóng dropdown khi bấm ra ngoài khu vực dropdown
    document.addEventListener('click', (event) => {
        // Chỉ đóng nếu menu đang mở VÀ click không nằm trong container
        if (dropdownMenu.classList.contains('show') && !container.contains(event.target)) {
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


// --- Chạy code chính sau khi toàn bộ DOM đã tải xong ---
document.addEventListener("DOMContentLoaded", function () {

    // == PHẦN 1: Cập nhật năm Copyright và Thiết lập Dropdown ==
    const copyrightYearSpan = document.getElementById('copyright-year');
    if (copyrightYearSpan) {
        copyrightYearSpan.textContent = new Date().getFullYear();
    }

    // Gọi hàm thiết lập chức năng đóng/mở cho dropdown
    setupDropdownToggle();


    // == PHẦN 2: Tải và hiển thị sản phẩm lên Grid (Giữ nguyên logic của anh) ==
    const gridContainer = document.getElementById('item-grid-container');
    const loadingMessage = document.getElementById('loading-message'); // Giả sử có thẻ p#loading-message
    const itemsApiUrl = '/api/items/'; // URL API lấy danh sách sản phẩm

    if (gridContainer) { 
        // Hiển thị loading ban đầu
        if (loadingMessage) {
            gridContainer.innerHTML = ''; // Xóa nội dung cũ
            loadingMessage.style.display = 'block'; // Hiện loading
            gridContainer.appendChild(loadingMessage);
        } else {
            // Nếu không có sẵn thẻ loading thì tạo tạm
            gridContainer.innerHTML = '<p id="loading-message" style="text-align: center; width: 100%; padding: 20px;">Đang tải danh sách sản phẩm...</p>';
        }

        fetch(itemsApiUrl)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(items => {
                const currentLoadingMsg = gridContainer.querySelector('#loading-message');
                if (currentLoadingMsg) currentLoadingMsg.remove(); // Xóa loading
                gridContainer.innerHTML = ''; // Xóa sạch grid trước khi thêm item mới

                if (items && Array.isArray(items) && items.length > 0) {
                    // Logic sort và filter của anh (giữ nguyên)
                    const sortedItems = items
                        .filter(item => item && typeof item.current_price !== 'undefined')
                        .sort((a, b) => {
                            const priceA = parseFloat(String(a.current_price || 0).replace(/,/g, ''));
                            const priceB = parseFloat(String(b.current_price || 0).replace(/,/g, ''));
                            return (isNaN(priceB) ? 0 : priceB) - (isNaN(priceA) ? 0 : priceA);
                          });

                    const top9Items = sortedItems.slice(0, 9); // Lấy tối đa 9 item
                    console.log(`[home.js] Displaying top ${top9Items.length} items in grid.`);

                    if (top9Items.length > 0) {
                        top9Items.forEach(item => {
                            // Logic tạo card item của anh (giữ nguyên)
                            const linkWrapper = document.createElement('a');
                            const itemId = item.item_id || item.id || item.pk; // Lấy ID item
                            if (itemId) linkWrapper.href = `/items/${itemId}/`; // Link đến chi tiết item
                            linkWrapper.classList.add('item-card-link');

                            const article = document.createElement('article');
                            article.classList.add('item-card');
                            
                            const img = document.createElement('img');
                            img.src = item.image_url || '/static/images/placeholder.png'; // Ảnh item hoặc ảnh mặc định
                            img.alt = item.name || 'Auction Item';
                            img.loading = 'lazy'; // Tải lười ảnh

                            const cardContent = document.createElement('div');
                            cardContent.classList.add('card-content');

                            const heading = document.createElement('h3');
                            heading.textContent = item.name || 'N/A'; // Tên item

                            const pricePara = document.createElement('span');
                            pricePara.classList.add('price');
                            pricePara.textContent = formatPrice(item.current_price || 0); // Giá item đã format

                            cardContent.appendChild(heading);
                            cardContent.appendChild(pricePara);
                            article.appendChild(img);
                            article.appendChild(cardContent);

                            linkWrapper.appendChild(article);
                            gridContainer.appendChild(linkWrapper); // Thêm vào grid
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
                // Hiển thị lỗi thân thiện hơn trên UI
                gridContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 20px; color: red;">Oops! Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại sau.</p>`;
            });
    } else {
         console.warn("Grid container '#item-grid-container' not found. Skipping item loading.");
    }


    // == PHẦN 3: Kiếm tra trạng thái đăng nhập và cập nhật Header Dropdown (ĐÃ SỬA LỖI) ==
    const userActionArea = document.getElementById('user-action-area'); // ID của div chứa dropdown
    const profileApiUrl = '/api/profile/get_avatar/'; // URL API lấy avatar

    if (userActionArea) { 
        const triggerBtn = userActionArea.querySelector('.user-dropdown-trigger'); // Nút bấm mở dropdown (chứa icon hoặc avatar)
        const dropdownMenuUl = userActionArea.querySelector('.user-dropdown-menu ul'); // Thẻ ul chứa các link trong dropdown

        // Kiểm tra xem có tìm thấy các element cần thiết không
        if (!triggerBtn || !dropdownMenuUl) {
            console.error("User action area is present, but trigger button (.user-dropdown-trigger) or menu list (ul) is missing.");
            return; // Bỏ qua nếu HTML không đúng cấu trúc
        }

        // Hàm tiện ích: Đặt lại giao diện về trạng thái chưa đăng nhập
        const setDefaultUserState = () => {
            console.log("[home.js] Setting default user state (logged out).");
            const settingsUrl = "#"; // Link tới trang cài đặt (nếu có)
            const loginUrl = "/login-signup/"; // Link tới trang đăng nhập/đăng ký của anh
            // Đặt lại nút trigger thành icon người dùng mặc định (ví dụ dùng Font Awesome)
            triggerBtn.innerHTML = '<i class="fas fa-user header-icon"></i>'; // Đảm bảo class icon này tồn tại và được load
            // Đặt lại các mục trong menu dropdown
            dropdownMenuUl.innerHTML = 
            `<li><a href="${settingsUrl}">Cài đặt</a></li> 
             <li class="separator"></li> {/* Thẻ li để tạo dòng kẻ nếu muốn */}
             <li><a href="${loginUrl}">Đăng nhập hoặc Đăng ký</a></li>`;
        };

        console.log('[home.js] Checking login status for header dropdown...');

        // 1. Lấy access token từ localStorage
        const accessToken = localStorage.getItem('accessToken');

        // 2. Nếu không có token -> Chắc chắn chưa đăng nhập -> Gọi hàm đặt lại trạng thái
        if (!accessToken) {
            console.log('[home.js] No access token found in localStorage.');
            setDefaultUserState(); 
        } else {
            // 3. Có token -> Gọi API kiểm tra token và lấy thông tin avatar
            console.log('[home.js] Access token found. Fetching profile...');
            fetch(profileApiUrl, { 
                method: 'GET', 
                headers: {
                    // *** GỬI KÈM TOKEN TRONG HEADER AUTHORIZATION ***
                    'Authorization': `Bearer ${accessToken}`, 
                    'Accept': 'application/json' // Nên thêm Accept header
                }
            })
            .then(response => {
                // 4. Xử lý Response từ API
                if (!response.ok) {
                    // Nếu Server trả về lỗi (401 Unauthorized - token sai/hết hạn, 403 Forbidden, 500...)
                    if (response.status === 401 || response.status === 403) {
                        console.warn(`[home.js] Login check: Invalid/Expired Token or no permission (${response.status}). Clearing potentially stale tokens.`);
                         // Xóa token cũ khỏi localStorage vì nó không hợp lệ nữa
                         localStorage.removeItem('accessToken');
                         localStorage.removeItem('refreshToken');
                         localStorage.removeItem('user');
                         return null; // Trả về null để bước .then tiếp theo biết là chưa đăng nhập
                    } else {
                        // Lỗi server khác (5xx)
                        throw new Error(`Server error checking profile: ${response.status} ${response.statusText}`);
                    }
                }
                // Nếu response.ok (status 200) -> Token hợp lệ -> Parse dữ liệu JSON
                return response.json(); 
            })
            .then(data => {
                // 5. Xử lý dữ liệu trả về (hoặc null nếu có lỗi 401/403)
                console.log('[home.js] Profile data received:', data);
                if (data) { 
                    // Có data hợp lệ -> Đã đăng nhập -> Cập nhật giao diện
                    console.log('[home.js] User confirmed logged in. Updating dropdown UI.');
                    
                    const defaultAvatar = '/static/images/default_avatar.jpg'; // Đường dẫn ảnh đại diện mặc định
                    // Lấy avatarUrl từ data, nếu không có thì dùng ảnh mặc định
                    const avatarSrc = data.avatarUrl || defaultAvatar; 
                    
                    // Cập nhật nút trigger thành ảnh avatar (dùng class CSS sẽ đẹp hơn inline style)
                    triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="Avatar" class="header-avatar">`; // Thêm class .header-avatar

                    // Cập nhật menu dropdown cho người đã đăng nhập
                    const settingsUrl = "#"; // Thay bằng URL trang cài đặt
                    // URL Đăng xuất: Có thể là link trực tiếp của Django hoặc URL gọi API logout
                    const logoutUrl = "/api/logout/"; // Hoặc ví dụ: /api/auth/logout/
                    // Thêm link tới trang profile nếu API trả về profileUrl
                    const profileLink = data.profileUrl ? `<li><a href="${data.profileUrl}">Hồ sơ</a></li>` : '';

                    dropdownMenuUl.innerHTML = `
                        ${profileLink}
                        <li><a href="${settingsUrl}">Cài đặt</a></li>
                        <li class="separator"></li>
                        <li><a href="${logoutUrl}">Đăng xuất</a></li> 
                    `;
                } else { 
                    // Data là null (do lỗi 401/403 ở bước trước) -> Chưa đăng nhập
                    console.log('[home.js] User considered not logged in (null data). Setting default state.');
                    setDefaultUserState(); // Đặt lại trạng thái mặc định
                }
            })
            .catch(error => {
                // Xử lý lỗi mạng (fetch không thành công) hoặc lỗi khi parse JSON
                console.error('[home.js] Error in fetch chain while checking login status:', error);
                 // Gặp lỗi cũng nên xóa token cũ và coi như chưa đăng nhập
                 localStorage.removeItem('accessToken');
                 localStorage.removeItem('refreshToken');
                 localStorage.removeItem('user');
                 setDefaultUserState(); // Đặt lại trạng thái mặc định
            });
        } // Kết thúc else (có accessToken)

    } else {
        // Không tìm thấy khu vực user action trên trang này
        console.warn("User action area '#user-action-area' not found. Skipping login status check.");
    }

}); // Kết thúc DOMContentLoaded