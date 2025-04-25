// auction_web/static/js/home.js (Đã sửa đổi - Phiên bản Grid 3x3)

// --- Các hàm phụ trợ ---

/**
 * Định dạng chuỗi giá tiền sang dạng $X,XXX (Hoặc VNĐ nếu muốn)
 * @param {string | number} priceString Giá trị giá tiền đầu vào
 * @returns {string} Chuỗi giá tiền đã định dạng hoặc giá trị gốc nếu lỗi
 */
function formatPrice(priceString) {
    try {
        const price = parseFloat(String(priceString).replace(/,/g, ''));
        if (isNaN(price)) {
            throw new Error("Invalid number for price");
        }
        // Đổi sang định dạng VNĐ nếu muốn
        // return `${price.toLocaleString('vi-VN')} VNĐ`;
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } catch (e) {
        console.error("Error formatting price:", priceString, e);
        // return priceString ? `${priceString} VNĐ` : '0 VNĐ'; // Nếu dùng VNĐ
        return priceString ? `$${priceString}` : '$0';
    }
}

// --- Hàm khởi tạo Swiper đã bị XÓA BỎ ---
// function initializeSwiper() { ... } // <- ĐÃ XÓA

// --- Chạy code sau khi DOM tải xong ---
document.addEventListener("DOMContentLoaded", function () {

    // 1. Cập nhật năm bản quyền trong footer
    const copyrightYearSpan = document.getElementById('copyright-year');
    if (copyrightYearSpan) {
        copyrightYearSpan.textContent = new Date().getFullYear();
    }

    // 2. Tải dữ liệu sản phẩm, xử lý và hiển thị lên Grid
    const gridContainer = document.getElementById('item-grid-container'); // Lấy container grid mới
    const loadingMessage = document.getElementById('loading-message');
    const apiUrl = '/api/items/';

    if (!gridContainer) {
        console.error("Container '#item-grid-container' for grid not found!");
        // Không cần cập nhật loading message vì nó nằm trong container không tìm thấy
        return;
    }

    // Hiển thị loading message nếu nó tồn tại
    if (loadingMessage) {
         gridContainer.innerHTML = ''; // Xóa nội dung cũ nếu có
         gridContainer.appendChild(loadingMessage); // Chỉ hiển thị loading
    } else {
         gridContainer.innerHTML = '<p id="loading-message" style="text-align: center; width: 100%; padding: 20px;">Đang tải danh sách sản phẩm...</p>'; // Tạo mới nếu chưa có
    }


    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(items => {
            // Xóa loading message trước khi thêm item hoặc thông báo lỗi/không có item
            const currentLoadingMsg = gridContainer.querySelector('#loading-message');
            if (currentLoadingMsg) currentLoadingMsg.remove();
            gridContainer.innerHTML = ''; // Đảm bảo container trống

            if (items && Array.isArray(items) && items.length > 0) {
                console.log(`Received ${items.length} items from API.`);
                const sortedItems = items
                    .filter(item => item && typeof item.current_price !== 'undefined')
                    .sort((a, b) => {
                        const priceA = parseFloat(String(a.current_price || 0).replace(/,/g, ''));
                        const priceB = parseFloat(String(b.current_price || 0).replace(/,/g, ''));
                        return (isNaN(priceB) ? 0 : priceB) - (isNaN(priceA) ? 0 : priceA);
                    });

                const top9Items = sortedItems.slice(0, 9); // Lấy top 9 sản phẩm
                console.log(`Displaying top ${top9Items.length} highest priced items in a grid.`);

                if (top9Items.length > 0) {
                    // --- BẮT ĐẦU VÒNG LẶP TẠO THẺ ITEM (PHIÊN BẢN GRID) ---
                    top9Items.forEach(item => {
                        // 1. Tạo thẻ link <a> bao ngoài
                        const linkWrapper = document.createElement('a');
                        const itemId = item.item_id || item.id || item.pk; // Thử các tên phổ biến
                        if (!itemId) {
                            console.warn("Item missing ID, cannot create detail link:", item);
                            // Item không có link, nhưng vẫn hiển thị (hoặc có thể bỏ qua bằng return;)
                        } else {
                             linkWrapper.href = `/items/${itemId}/`; // URL khớp với urls.py
                        }
                        linkWrapper.classList.add('item-card-link'); // Thêm class để style (bỏ gạch chân...)

                        // 2. Tạo thẻ article chứa nội dung
                        const article = document.createElement('article');
                        article.classList.add('item-card');

                        const img = document.createElement('img');
                        img.src = item.image_url || '/static/images/placeholder.png'; // Luôn dùng ảnh placeholder nếu cần
                        img.alt = item.name || 'Auction Item';
                        img.loading = 'lazy'; // Thêm lazy loading

                        const cardContent = document.createElement('div');
                        cardContent.classList.add('card-content');

                        const heading = document.createElement('h3');
                        heading.textContent = item.name || 'N/A';

                        const pricePara = document.createElement('span');
                        pricePara.classList.add('price');
                        pricePara.textContent = formatPrice(item.current_price || 0);

                        // Gắn nội dung vào article
                        cardContent.appendChild(heading);
                        cardContent.appendChild(pricePara);
                        article.appendChild(img);
                        article.appendChild(cardContent);

                        // 3. Đưa article vào BÊN TRONG thẻ link <a>
                        linkWrapper.appendChild(article);

                        // 4. Đưa thẻ link <a> (đã chứa article) trực tiếp vào gridContainer
                        gridContainer.appendChild(linkWrapper);
                    });
                     // --- KẾT THÚC VÒNG LẶP TẠO THẺ ITEM (PHIÊN BẢN GRID) ---
                } else {
                    // Trường hợp có item nhưng sau khi sort/filter không còn cái nào hợp lệ
                     gridContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Không có sản phẩm nào phù hợp để hiển thị.</p>';
                }

            } else {
                console.log("No items received from API or items is not a valid array.");
                gridContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Hiện chưa có sản phẩm nào được đấu giá.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching or processing items:', error);
             // Xóa loading message nếu còn tồn tại trước khi báo lỗi
             const currentLoadingMsg = gridContainer.querySelector('#loading-message');
             if (currentLoadingMsg) currentLoadingMsg.remove();
            gridContainer.innerHTML = `<p style="text-align: center; width: 100%; padding: 20px; color: red;">Oops! Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại sau.</p>`;
        });

}); // Kết thúc DOMContentLoaded đầu tiên

// === Code xử lý trạng thái đăng nhập và cập nhật header ===
document.addEventListener('DOMContentLoaded', function() {

    const userActionArea = document.getElementById('user-action-area');
    if (!userActionArea) {
        console.error('[home.js] LỖI: Không tìm thấy thẻ có id="user-action-area" trong HTML!');
        return;
    }

    const apiUrl = '/api/profile/get_avatar/';

    console.log('[home.js] Bắt đầu kiểm tra trạng thái đăng nhập bằng cách gọi API...');

    fetch(apiUrl, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.log(`[home.js] API trả về ${response.status}. Có vẻ người dùng chưa đăng nhập hoặc không có quyền.`);
                    return null;
                } else {
                    console.error(`[home.js] LỖI: API ${apiUrl} phản hồi status ${response.status}`);
                    throw new Error(`Server phản hồi lỗi ${response.status}`);
                }
            }
            return response.json();
        })
        .then(data => {
            console.log('[home.js] Dữ liệu JSON nhận được từ API:', data);

            if (data === null) {
                return;
            }

            if (data && data.profileUrl) {
                console.log('[home.js] Dữ liệu hợp lệ, tiến hành thay thế icon bằng avatar.');

                if (!userActionArea) return;

                const profileLink = document.createElement('a');
                 // Đảm bảo backend trả về link TRANG PROFILE chứ không phải link API
                profileLink.href = data.profileUrl;
                profileLink.classList.add('header-avatar');
                profileLink.setAttribute('aria-label', 'Thông tin tài khoản');

                const avatarImg = document.createElement('img');
                const defaultAvatar = '/static/images/default_avatar.jpg';
                const avatarSrc = data.avatarUrl || defaultAvatar;
                avatarImg.src = avatarSrc;
                avatarImg.alt = 'Avatar';
                // Nên dùng CSS class thay vì inline style
                avatarImg.style.width = '30px';
                avatarImg.style.height = '30px';
                avatarImg.style.borderRadius = '50%';
                avatarImg.style.verticalAlign = 'middle';

                profileLink.appendChild(avatarImg);

                userActionArea.innerHTML = '';
                userActionArea.appendChild(profileLink);
                console.log('[home.js] Đã cập nhật thành công: Hiển thị avatar.');

            } else {
                console.log('[home.js] Kết luận: API không trả về đủ thông tin (thiếu profileUrl?). Giữ nguyên icon login.');
            }
        })
        .catch(error => {
            console.error('[home.js] LỖI TOANG!: Đã xảy ra lỗi trong quá trình fetch hoặc xử lý data:', error);
        });

}); // Kết thúc DOMContentLoaded thứ hai