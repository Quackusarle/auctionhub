// --- Các hàm phụ trợ ---

/**
 * Định dạng chuỗi giá tiền sang dạng $X,XXX
 * @param {string | number} priceString Giá trị giá tiền đầu vào
 * @returns {string} Chuỗi giá tiền đã định dạng hoặc giá trị gốc nếu lỗi
 */
function formatPrice(priceString) {
    try {
        // Chuyển đổi sang số, xử lý cả trường hợp là số sẵn
        const price = parseFloat(String(priceString).replace(/,/g, '')); // Xóa dấu phẩy nếu có trước khi parse
        if (isNaN(price)) {
            throw new Error("Invalid number for price");
        }
        // Định dạng sang USD, không có số lẻ thập phân
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } catch (e) {
        console.error("Error formatting price:", priceString, e);
        // Trả về $0 hoặc giá trị gốc nếu không parse được
        return priceString ? `$${priceString}` : '$0';
    }
}

// --- Hàm khởi tạo Swiper ---

/**
 * Khởi tạo và cấu hình Swiper cho carousel sản phẩm.
 */
function initializeSwiper() {
    // Kiểm tra xem thư viện Swiper đã được tải chưa
    if (typeof Swiper === 'undefined') {
        console.error('Swiper library is not loaded.');
        return;
    }

    const swiperSelector = '.swiper-container .swiper';
    const swiperContainer = document.querySelector(swiperSelector);

    // Kiểm tra xem container của Swiper có tồn tại không
    if (!swiperContainer) {
        console.log('Swiper container not found, skipping initialization.');
        return;
    }
    // Xóa instance cũ nếu có để tránh lỗi khi re-init (ví dụ: khi fetch lại data)
    if (swiperContainer.swiper) {
        swiperContainer.swiper.destroy(true, true);
    }


    // Cấu hình Swiper
    const swiper = new Swiper(swiperSelector, {
        loop: false, // Không lặp lại carousel
        slidesPerView: 2, // Hiển thị 2 slide trên màn hình nhỏ nhất
        spaceBetween: 15, // Khoảng cách giữa các slide

        // Responsive breakpoints cho số lượng slide hiển thị
        // Giữ lại để carousel hiển thị tốt trên các kích thước cửa sổ desktop khác nhau
        breakpoints: {
            576: { slidesPerView: 3, spaceBetween: 15 }, // >= 576px
            768: { slidesPerView: 4, spaceBetween: 20 }, // >= 768px
            992: { slidesPerView: 5, spaceBetween: 20 }, // >= 992px
            1200: { slidesPerView: 6, spaceBetween: 20 }  // >= 1200px
        },

        // Cấu hình nút điều hướng
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },

        // Class cho slide đang active (Swiper tự quản lý)
        slideActiveClass: 'is-active',

        watchOverflow: true, // Tự động vô hiệu hóa nav/pagination nếu không đủ slide
        observer: true, // Tự cập nhật khi có thay đổi trong Swiper container
        observeParents: true, // Tự cập nhật khi cha của Swiper thay đổi kích thước
        grabCursor: true, // Hiển thị con trỏ bàn tay khi rê chuột
    });

    // Xử lý class 'is-active' cho slide (không tác động item-card cho hover)
    // Dùng để Swiper tự quản lý trạng thái active của slide
    // Hiệu ứng hover giờ được xử lý hoàn toàn bằng CSS :hover
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

    // 2. Xử lý menu mobile (Giữ lại cho trường hợp cửa sổ desktop hẹp)
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav.plant-theme-nav');
    if (mobileMenuToggle && mainNav) {
        // Đảm bảo menu đóng khi tải trang trên mobile/cửa sổ hẹp
        mainNav.classList.remove('active');
        // Thêm sự kiện click cho nút toggle
        mobileMenuToggle.addEventListener('click', function() {
            mainNav.classList.toggle('active');
        });
    } else {
        // Ẩn nút toggle nếu nav không tồn tại (hoặc ngược lại) để tránh lỗi
        if (mobileMenuToggle) mobileMenuToggle.style.display = 'none';
        console.warn("Mobile menu toggle or main navigation not found.");
    }


    // 3. Tải dữ liệu sản phẩm, xử lý và khởi tạo Swiper
    const itemListContainer = document.getElementById('item-list-container'); // Chính là swiper-wrapper
    const loadingMessage = document.getElementById('loading-message');
    const apiUrl = '/api/items/'; // URL API để lấy danh sách sản phẩm (vẫn dùng cách lọc ở frontend)

    // Kiểm tra container tồn tại trước khi fetch
    if (!itemListContainer) {
        console.error("Container '#item-list-container' for swiper not found!");
        if (loadingMessage) loadingMessage.textContent = 'Lỗi: Không tìm thấy khu vực hiển thị sản phẩm.';
        return; // Dừng thực thi nếu container không tồn tại
    }

    // Gọi API để lấy dữ liệu
    fetch(apiUrl)
        .then(response => {
            // Kiểm tra response có thành công không (status 200-299)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Parse JSON từ response body
            return response.json();
        })
        .then(items => {
            // Xử lý dữ liệu trả về từ API

            // Xóa thông báo đang tải
            if (loadingMessage) loadingMessage.remove();
            // Dọn sạch container trước khi thêm item mới
            itemListContainer.innerHTML = '';

            // Kiểm tra xem 'items' có phải là mảng và có phần tử không
            if (items && Array.isArray(items) && items.length > 0) {

                // --- Sắp xếp items theo giá giảm dần và lấy top 10 ---
                console.log(`Received ${items.length} items from API.`);
                const sortedItems = items
                    .filter(item => item && typeof item.current_price !== 'undefined') // Lọc bỏ item lỗi
                    .sort((a, b) => {
                        const priceA = parseFloat(String(a.current_price || 0).replace(/,/g, ''));
                        const priceB = parseFloat(String(b.current_price || 0).replace(/,/g, ''));
                        return (isNaN(priceB) ? 0 : priceB) - (isNaN(priceA) ? 0 : priceA); // Sắp xếp giảm dần, xử lý NaN
                    });

                const top10Items = sortedItems.slice(0, 10); // Chỉ lấy 10 item đầu
                console.log(`Displaying top ${top10Items.length} highest priced items.`);
                // --- Kết thúc sắp xếp và lọc ---

                // Lặp qua top 10 items để tạo HTML
                top10Items.forEach(item => {
                    // Tạo các element HTML cho mỗi item
                    const swiperSlide = document.createElement('div');
                    swiperSlide.classList.add('swiper-slide');

                    const article = document.createElement('article');
                    article.classList.add('item-card');
                    // Thêm data attribute nếu cần liên kết đến trang chi tiết
                    // article.dataset.itemId = item.id;

                    const img = document.createElement('img');
                    img.src = item.image_url || 'static/images/placeholder.png'; // Luôn có ảnh placeholder
                    img.alt = item.name || 'Auction Item';
                    img.loading = 'lazy'; // Bật lazy loading

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('card-content');

                    const heading = document.createElement('h3');
                    heading.textContent = item.name || 'N/A'; // Hiển thị N/A nếu không có tên

                    const pricePara = document.createElement('span');
                    pricePara.classList.add('price');
                    pricePara.textContent = formatPrice(item.current_price || 0); // Định dạng giá

                    // Gắn các element con vào cha
                    cardContent.appendChild(heading);
                    cardContent.appendChild(pricePara);
                    article.appendChild(img);
                    article.appendChild(cardContent);
                    swiperSlide.appendChild(article);

                    // Thêm slide hoàn chỉnh vào container Swiper
                    itemListContainer.appendChild(swiperSlide);
                });

                // Khởi tạo Swiper sau khi đã thêm tất cả slide
                if (top10Items.length > 0) {
                     initializeSwiper();
                } else {
                    // Xử lý trường hợp sau khi lọc không còn item nào
                    itemListContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Không có sản phẩm nào phù hợp để hiển thị.</p>';
                }

            } else {
                // Xử lý trường hợp API trả về không phải mảng hoặc mảng rỗng
                console.log("No items received from API or items is not a valid array.");
                itemListContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Hiện chưa có sản phẩm nào được đấu giá.</p>';
            }
        })
        .catch(error => {
            // Xử lý lỗi nếu fetch API thất bại hoặc có lỗi trong quá trình xử lý
            console.error('Error fetching or processing items:', error);
            if (loadingMessage) loadingMessage.remove(); // Đảm bảo xóa loading message khi có lỗi
            // Hiển thị thông báo lỗi thân thiện trên UI
            itemListContainer.innerHTML = `<p style="text-align: center; width: 100%; padding: 20px; color: red;">Oops! Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại sau.</p>`;
        });

}); // Kết thúc DOMContentLoaded