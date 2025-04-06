// --- Các hàm phụ trợ (Ví dụ) ---
function formatPrice(priceString) {
    try {
        const price = parseFloat(priceString);
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; 
    } catch (e) { return priceString || '$0'; } 
}

// --- Hàm khởi tạo Swiper (Cập nhật breakpoints) ---
function initializeSwiper() {
    if (typeof Swiper === 'undefined') { console.error('Swiper library is not loaded.'); return; }

    const swiperSelector = '.swiper-container .swiper'; 
    if (!document.querySelector(swiperSelector)) { console.log('Swiper container not found, skipping initialization.'); return; }

    const swiper = new Swiper(swiperSelector, { 
        loop: false, 
        slidesPerView: 2, // Bắt đầu với 2 slide trên màn hình nhỏ nhất
        spaceBetween: 15, // Giảm khoảng cách chút
        
        // Responsive breakpoints (TĂNG slidesPerView để card nhỏ lại)
        breakpoints: {
            // Khi >= 576px
            576: { slidesPerView: 3, spaceBetween: 15 },
            // Khi >= 768px
            768: { slidesPerView: 4, spaceBetween: 20 },
            // Khi >= 992px
            992: { slidesPerView: 5, spaceBetween: 20 }, // Hiển thị 5 slide 
            // Khi >= 1200px 
            1200: { slidesPerView: 6, spaceBetween: 20 } // Hiển thị 6 slide trên màn hình lớn
        },

        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        slideActiveClass: 'is-active', 
        watchOverflow: true, 
        observer: true, 
        observeParents: true, 
        grabCursor: true, 

        // Thêm hiệu ứng phóng to cho slide active (Cần CSS hỗ trợ)
        // centeredSlides: true, // Đặt true để slide active luôn ở giữa (giúp hiệu ứng scale đẹp hơn)
        // slidesOffsetBefore: 0, // Có thể cần điều chỉnh nếu dùng centeredSlides
        // slidesOffsetAfter: 0,
    });

    // Logic xử lý class 'is-active' khi slide thay đổi
    if (swiper.slides && swiper.slides.length > 0) {
         if(swiper.slides[swiper.activeIndex]){
             swiper.slides[swiper.activeIndex].classList.add('is-active');
             const activeItemCard = swiper.slides[swiper.activeIndex].querySelector('.item-card');
             if (activeItemCard) { activeItemCard.classList.add('is-active'); }
         }
         swiper.on('slideChange', function () {
             swiper.slides.forEach(slide => {
                 if(slide) { 
                    slide.classList.remove('is-active'); 
                    const itemCard = slide.querySelector('.item-card');
                    if (itemCard) { itemCard.classList.remove('is-active'); } 
                 }
             });
             if(swiper.slides[swiper.activeIndex]){ 
                swiper.slides[swiper.activeIndex].classList.add('is-active'); 
                const activeItemCard = swiper.slides[swiper.activeIndex].querySelector('.item-card');
                if (activeItemCard) { activeItemCard.classList.add('is-active'); }
             }
         });
    } else {
        console.log("Swiper initialized, but no slides found.");
    }
}


// --- Chạy tất cả code sau khi DOM tải xong ---
document.addEventListener("DOMContentLoaded", function () {
    
    // 1. Cập nhật năm bản quyền
    const copyrightYearSpan = document.getElementById('copyright-year');
    if (copyrightYearSpan) { copyrightYearSpan.textContent = new Date().getFullYear(); }

    // 2. Xử lý menu mobile
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav.plant-theme-nav'); 
    if (mobileMenuToggle && mainNav) {
        mobileMenuToggle.addEventListener('click', function() { mainNav.classList.toggle('active'); });
    }

    // 3. Tải dữ liệu sản phẩm và khởi tạo Swiper
    const itemListContainer = document.getElementById('item-list-container'); // swiper-wrapper
    const loadingMessage = document.getElementById('loading-message');
    const apiUrl = '/api/items/'; // Đảm bảo URL API đúng

    if (!itemListContainer) { console.error("Container '#item-list-container' for swiper not found!"); return; }

    fetch(apiUrl)
        .then(response => { /* ... xử lý response ... */ return response.json(); })
        .then(items => {
            if (loadingMessage) loadingMessage.remove(); 
            itemListContainer.innerHTML = ''; 

            if (items && items.length > 0) {
                items.forEach(item => {
                    // TẠO SLIDE VÀ ITEM CARD CHO CAROUSEL NGANG
                    const swiperSlide = document.createElement('div');
                    swiperSlide.classList.add('swiper-slide'); 

                    const article = document.createElement('article');
                    article.classList.add('item-card'); 

                    const img = document.createElement('img');
                    img.src = item.image_url || 'static/images/placeholder.png'; 
                    img.alt = item.name || 'Auction Item'; 
                    img.loading = 'lazy'; 

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('card-content');

                    const heading = document.createElement('h3');
                    heading.textContent = item.name || 'N/A'; 

                    const pricePara = document.createElement('span'); 
                    pricePara.classList.add('price');
                    pricePara.textContent = `${formatPrice(item.current_price || 0)}`; 

                    cardContent.appendChild(heading); 
                    cardContent.appendChild(pricePara); 
                    article.appendChild(img);
                    article.appendChild(cardContent);
                    swiperSlide.appendChild(article);
                    itemListContainer.appendChild(swiperSlide); 
                });

                // KHỞI TẠO SWIPER
                initializeSwiper(); 

            } else { /* ... xử lý không có item ... */ }
        })
        .catch(error => { /* ... xử lý lỗi ... */ });

}); // Kết thúc DOMContentLoaded