// auction_web/static/js/home.js (Đã sửa đổi)

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

// --- Hàm khởi tạo Swiper ---

/**
 * Khởi tạo và cấu hình Swiper cho carousel sản phẩm.
 */
function initializeSwiper() {
    if (typeof Swiper === 'undefined') {
        console.error('Swiper library is not loaded.');
        return;
    }

    const swiperSelector = '.swiper-container .swiper';
    const swiperContainer = document.querySelector(swiperSelector);

    if (!swiperContainer) {
        console.log('Swiper container not found, skipping initialization.');
        return;
    }
    if (swiperContainer.swiper) {
        swiperContainer.swiper.destroy(true, true);
    }

    const swiper = new Swiper(swiperSelector, {
        loop: false, 
        slidesPerView: 2, 
        spaceBetween: 15, 
        breakpoints: {
            576: { slidesPerView: 3, spaceBetween: 15 }, 
            768: { slidesPerView: 4, spaceBetween: 20 }, 
            992: { slidesPerView: 5, spaceBetween: 20 }, 
            1200: { slidesPerView: 6, spaceBetween: 20 }  
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        slideActiveClass: 'is-active',
        watchOverflow: true, 
        observer: true, 
        observeParents: true, 
        grabCursor: true, 
    });

    // Xử lý class 'is-active' cho slide (Swiper tự quản lý)
    if (swiper.slides && swiper.slides.length > 0) {
        if (swiper.activeIndex >= 0 && swiper.slides[swiper.activeIndex]) {
            swiper.slides[swiper.activeIndex].classList.add('is-active');
        }
        swiper.on('slideChange', function () {
            swiper.slides.forEach(slide => {
                if (slide) {
                    slide.classList.remove('is-active');
                }
            });
            if (swiper.activeIndex >= 0 && swiper.slides[swiper.activeIndex]) {
                swiper.slides[swiper.activeIndex].classList.add('is-active');
            }
        });
    } else {
        console.log("Swiper initialized, but no slides were found or generated.");
    }
}


// --- Chạy code sau khi DOM tải xong ---
document.addEventListener("DOMContentLoaded", function () {

    // 1. Cập nhật năm bản quyền trong footer
    const copyrightYearSpan = document.getElementById('copyright-year');
    if (copyrightYearSpan) {
        copyrightYearSpan.textContent = new Date().getFullYear();
    }

    // 3. Tải dữ liệu sản phẩm, xử lý và khởi tạo Swiper
    const itemListContainer = document.getElementById('item-list-container'); // Chính là swiper-wrapper
    const loadingMessage = document.getElementById('loading-message');
    const apiUrl = '/api/items/'; 

    if (!itemListContainer) {
        console.error("Container '#item-list-container' for swiper not found!");
        if (loadingMessage) loadingMessage.textContent = 'Lỗi: Không tìm thấy khu vực hiển thị sản phẩm.';
        return; 
    }

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(items => {
            if (loadingMessage) loadingMessage.remove();
            itemListContainer.innerHTML = '';

            if (items && Array.isArray(items) && items.length > 0) {
                console.log(`Received ${items.length} items from API.`);
                const sortedItems = items
                    .filter(item => item && typeof item.current_price !== 'undefined') 
                    .sort((a, b) => {
                        const priceA = parseFloat(String(a.current_price || 0).replace(/,/g, ''));
                        const priceB = parseFloat(String(b.current_price || 0).replace(/,/g, ''));
                        return (isNaN(priceB) ? 0 : priceB) - (isNaN(priceA) ? 0 : priceA); 
                    });
                
                const top10Items = sortedItems.slice(0, 10); 
                console.log(`Displaying top ${top10Items.length} highest priced items.`);

                // --- BẮT ĐẦU VÒNG LẶP TẠO THẺ ITEM ---
                top10Items.forEach(item => {
                    const swiperSlide = document.createElement('div');
                    swiperSlide.classList.add('swiper-slide');

                    // ***** BẮT ĐẦU THAY ĐỔI *****
                    // 1. Tạo thẻ link <a> bao ngoài
                    const linkWrapper = document.createElement('a');
                    
                    // 2. Tạo URL chi tiết - KIỂM TRA LẠI TÊN TRƯỜNG ID TRONG API RESPONSE CỦA BẠN
                    // Thường là 'id', 'pk', hoặc 'item_id' nếu bạn định nghĩa rõ trong Serializer
                    const itemId = item.item_id || item.id || item.pk; // Thử các tên phổ biến
                    if (!itemId) {
                        console.warn("Item missing ID, cannot create detail link:", item);
                        // Có thể bỏ qua item này hoặc tạo thẻ không có link
                        // return; // Bỏ qua nếu không có ID
                    }
                    linkWrapper.href = `/items/${itemId}/`; // URL khớp với urls.py
                    linkWrapper.classList.add('item-card-link'); // Thêm class để style (bỏ gạch chân...)

                    // 3. Tạo thẻ article chứa nội dung (như cũ)
                    const article = document.createElement('article');
                    article.classList.add('item-card');

                    const img = document.createElement('img');
                    img.src = item.image_url || '/static/images/placeholder.png'; // Luôn dùng ảnh placeholder
                    img.alt = item.name || 'Auction Item';
                    img.loading = 'lazy';

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

                    // 4. Đưa article vào BÊN TRONG thẻ link <a>
                    linkWrapper.appendChild(article);

                    // 5. Đưa thẻ link <a> (đã chứa article) vào swiperSlide
                    swiperSlide.appendChild(linkWrapper);
                    // ***** KẾT THÚC THAY ĐỔI *****

                    itemListContainer.appendChild(swiperSlide); // Thêm slide vào container
                });
                 // --- KẾT THÚC VÒNG LẶP TẠO THẺ ITEM ---


                if (top10Items.length > 0) {
                     initializeSwiper();
                } else {
                    itemListContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Không có sản phẩm nào phù hợp để hiển thị.</p>';
                }

            } else {
                console.log("No items received from API or items is not a valid array.");
                itemListContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Hiện chưa có sản phẩm nào được đấu giá.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching or processing items:', error);
            if (loadingMessage) loadingMessage.remove(); 
            itemListContainer.innerHTML = `<p style="text-align: center; width: 100%; padding: 20px; color: red;">Oops! Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại sau.</p>`;
        });

}); // Kết thúc DOMContentLoaded

// === Code xử lý trạng thái đăng nhập và cập nhật header ===
// Anh có thể đặt đoạn code này vào cuối file home.js
// Lưu ý: Nếu anh có nhiều listener 'DOMContentLoaded', nên gộp chúng lại thành một cho gọn.

document.addEventListener('DOMContentLoaded', function() {

    const userActionArea = document.getElementById('user-action-area');
    if (!userActionArea) {
        // In ra lỗi nếu không tìm thấy khu vực để chèn avatar/icon
        console.error('[home.js] LỖI: Không tìm thấy thẻ có id="user-action-area" trong HTML!');
        return; // Không tìm thấy thì không làm gì cả
    }

    const apiUrl = '/api/profile/get_avatar/'; // API để lấy URL avatar và URL profile

    console.log('[home.js] Bắt đầu kiểm tra trạng thái đăng nhập bằng cách gọi API...');

    // Gọi API, thêm credentials: 'include' để đảm bảo cookie được gửi kèm (quan trọng!)
    fetch(apiUrl, { credentials: 'include' })
        .then(response => {
            // Kiểm tra xem response có OK không (status 200-299)
            if (!response.ok) {
                 // Nếu status là 401 hoặc 403 -> Chưa đăng nhập hoặc không có quyền
                 if (response.status === 401 || response.status === 403) {
                     console.log(`[home.js] API trả về ${response.status}. Có vẻ người dùng chưa đăng nhập hoặc không có quyền.`);
                     // Không throw error, chỉ đơn giản là không làm gì cả, giữ icon login
                     return null; // Trả về null để không chạy tiếp .then(data =>...) bên dưới
                 } else {
                     // Các lỗi khác (404, 500...) -> Báo lỗi và dừng lại
                     console.error(`[home.js] LỖI: API ${apiUrl} phản hồi status ${response.status}`);
                     throw new Error(`Server phản hồi lỗi ${response.status}`); // Ném lỗi để nhảy vào .catch()
                 }
            }
            // Nếu response.ok -> Đọc và trả về dữ liệu JSON
            return response.json();
        })
        .then(data => {
            // In dữ liệu nhận được ra console để kiểm tra (rất hữu ích khi debug)
            console.log('[home.js] Dữ liệu JSON nhận được từ API:', data);

            // Nếu data là null (do trả về từ bước kiểm tra 401/403 ở trên) thì không làm gì cả
            if (data === null) {
                return;
            }

            // --- Khối IF ĐÃ SỬA LẠI CHO ĐÚNG ---
            // Kiểm tra xem có dữ liệu và có trường 'profileUrl' không
            // Vì API đã trả về 200 OK, nên chỉ cần có profileUrl là đủ tín hiệu tốt
            if (data && data.profileUrl) {
                console.log('[home.js] Dữ liệu hợp lệ, tiến hành thay thế icon bằng avatar.');

                // Kiểm tra lại userActionArea một lần nữa cho chắc
                if (!userActionArea) return;

                // 1. Tạo thẻ link <a> bọc ngoài
                const profileLink = document.createElement('a');
                // **CẢNH BÁO**: Nhớ đảm bảo backend trả về ĐÚNG link trang profile HTML ở đây nhé!
                // Hiện tại nó đang là link API: data.profileUrl = http://127.0.0.1:8000/api/profile/me/
                profileLink.href = data.profileUrl;
                profileLink.classList.add('header-avatar'); // Thêm class để CSS style nếu cần
                profileLink.setAttribute('aria-label', 'Thông tin tài khoản');

                // 2. Tạo thẻ ảnh <img>
                const avatarImg = document.createElement('img');
                // **QUAN TRỌNG**: Đảm bảo file ảnh này tồn tại trong thư mục static!
                const defaultAvatar = '/static/images/default_avatar.jpg';
                // Lấy URL ảnh từ API. Nếu API trả về null hoặc undefined cho avatarUrl,
                // thì toán tử || sẽ tự động lấy giá trị defaultAvatar.
                const avatarSrc = data.avatarUrl || defaultAvatar;
                avatarImg.src = avatarSrc;
                avatarImg.alt = 'Avatar'; // Mô tả ảnh
                // Thêm chút style cơ bản, nên dùng CSS class để đẹp hơn
                avatarImg.style.width = '30px';
                avatarImg.style.height = '30px';
                avatarImg.style.borderRadius = '50%'; // Bo tròn
                avatarImg.style.verticalAlign = 'middle'; // Căn giữa theo chiều dọc nếu cần

                // 3. Đặt ảnh vào trong link
                profileLink.appendChild(avatarImg);

                // 4. Xóa icon login cũ và thay bằng link + avatar mới
                userActionArea.innerHTML = '';
                userActionArea.appendChild(profileLink);
                console.log('[home.js] Đã cập nhật thành công: Hiển thị avatar.');

            } else {
                // Trường hợp API trả về 200 OK nhưng JSON không có profileUrl hoặc data là null/undefined
                console.log('[home.js] Kết luận: API không trả về đủ thông tin (thiếu profileUrl?). Giữ nguyên icon login.');
                // Để nguyên icon login mặc định trong HTML
            }
            // --- Hết khối IF ĐÃ SỬA LẠI ---
        })
        .catch(error => {
            // Bắt các lỗi xảy ra trong quá trình fetch hoặc xử lý (ví dụ lỗi mạng, lỗi JSON parse, lỗi ném ra từ !response.ok)
            console.error('[home.js] LỖI TOANG!: Đã xảy ra lỗi trong quá trình fetch hoặc xử lý data:', error);
            // Gặp lỗi thì an toàn nhất là giữ nguyên icon login mặc định
        });

}); // Kết thúc listener 'DOMContentLoaded'