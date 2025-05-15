// static/js/bidding_detail.js
// Phiên bản: 2025-05-14 (Đã điều chỉnh để "hòa hợp" với base.js)

/**
 * Lấy giá trị CSRF token từ cookie (giữ lại ở đây cho rõ ràng).
 */
function getCsrfToken() {
    let csrfToken = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                csrfToken = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                break;
            }
        }
    }
    // if (!csrfToken) {
    //     console.warn("bidding_detail.js: CSRF token not found in cookies!"); // Có thể comment lại nếu base.js cũng check
    // }
    return csrfToken;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (Giữ nguyên như cậu đã khai báo) ---
    const itemNameHeading = document.getElementById('item-name-heading');
    const itemImage = document.getElementById('item-image');
    const itemName = document.getElementById('item-name');
    const itemSeller = document.getElementById('item-seller');
    const currentPriceElement = document.getElementById('current-price');
    const startingPriceElement = document.getElementById('starting-price');
    const endTimeElement = document.getElementById('time-remaining'); // **ĐỔI ID NÀY TRONG HTML CỦA CẬU THÀNH 'time-remaining' CHO KHỚP**
    const bidHistoryTableBody = document.getElementById('bid-history-table-body');
    const placeBidForm = document.getElementById('place-bid-form');
    const bidAmountInput = document.getElementById('bid-amount-input');
    const totalValueSpan = document.getElementById('total-bid-value');
    const minBidLabel = document.getElementById('min-bid-label');
    const minBidValueSpan = document.getElementById('min-bid-value'); // **THÊM ID NÀY VÀO SPAN TRONG LABEL MIN BID TRONG HTML**
    const submitBidButton = placeBidForm?.querySelector('.btn-submit-bid');
    const bidFormMessage = document.getElementById('bid-form-message');
    const formItemIdInput = document.getElementById('form-item-id'); // Input ẩn chứa item_id (cần có trong HTML)

    // --- State Variables (Giữ nguyên) ---
    let currentItemId = null;
    let countdownInterval = null;
    let currentHighestBid = 0;
    let startingPrice = 0;
    // let bidStep = 1000; // Sẽ được tính lại
    let isUserClientSideLoggedIn = false; // **SẼ ĐƯỢC CẬP NHẬT TỪ BASE.JS**

    // --- Helper Functions (getItemIdFromUrl, fetchAPI, lamTronTien, formatPriceVN, formatDateTimeVN giữ nguyên như code của cậu) ---
    function getItemIdFromUrl() { /* ... code của cậu ... */ }
    async function fetchAPI(url, options = {}) { /* ... code của cậu ... */ }
    function lamTronTien(amount) { /* ... code của cậu ... */ }
    function formatPriceVN(priceValue) { /* ... code của cậu ... */ }
    function formatDateTimeVN(dateTimeString) { /* ... code của cậu ... */ }


    /**
     * Cập nhật giá tối thiểu cho input và label (đã sửa đổi)
     */
    function updateMinBidDisplay(minBidCalculated) {
        if (isNaN(minBidCalculated) || minBidCalculated < 0) {
            console.error("[updateMinBidDisplay] Invalid minBidCalculated:", minBidCalculated);
            if (minBidValueSpan) minBidValueSpan.textContent = 'Lỗi';
            if (bidAmountInput) {
                bidAmountInput.min = "0";
                bidAmountInput.placeholder = "Lỗi";
            }
            return 0;
        }
        const displayMinBid = lamTronTien(Math.ceil(minBidCalculated));

        if (bidAmountInput) {
            bidAmountInput.min = displayMinBid.toString();
            bidAmountInput.placeholder = displayMinBid.toLocaleString('vi-VN');
        }
        if (minBidValueSpan) { // Cập nhật span bên trong label
            minBidValueSpan.textContent = formatPriceVN(displayMinBid).replace(/\s*VNĐ$/, '');
        }
        return displayMinBid;
    }

    /**
     * Cập nhật UI với thông tin sản phẩm (đã sửa đổi để tính min bid)
     */
    function updateItemUI(itemData) {
        if (!itemData) { /* ... xử lý lỗi ... */ return; }

        // Cập nhật title trang
        const dynamicTitleSpan = document.getElementById('dynamic-item-title');
        if(dynamicTitleSpan) dynamicTitleSpan.textContent = itemData.name || 'Sản phẩm';
        else document.title = `Đấu giá: ${itemData.name || 'Sản phẩm'} - AuctionHub`;

        if(itemNameHeading) itemNameHeading.textContent = itemData.name || 'Không có tên';
        if(itemName) itemName.textContent = itemData.name || 'Không có tên';
        if(itemImage) {
            itemImage.src = itemData.image_url || '/static/images/placeholder_item_large.png'; // **PATH ẢNH CỦA CẬU**
            itemImage.alt = itemData.name || 'Hình ảnh sản phẩm';
        }
        if(itemSeller) itemSeller.textContent = itemData.seller?.email || itemData.seller_id?.email || 'Ẩn danh';

        startingPrice = parseFloat(String(itemData.starting_price || 0).replace(/,/g, ''));
        currentHighestBid = parseFloat(String(itemData.current_price || 0).replace(/,/g, ''));

        if(startingPriceElement) startingPriceElement.textContent = formatPriceVN(lamTronTien(startingPrice)).replace(/\s*VNĐ$/, '');
        if(currentPriceElement) currentPriceElement.textContent = formatPriceVN(lamTronTien(currentHighestBid));

        // Tính toán và cập nhật giá bid tối thiểu
        const baseForMinBid = currentHighestBid > 0 ? currentHighestBid : startingPrice;
        const minIncrementPercentage = 0.01; // 1%
        const minAbsoluteIncrement = 1000; // Hoặc một giá trị cố định tối thiểu
        let calculatedMinBid;

        if (baseForMinBid <= 0 && startingPrice > 0) { // Trường hợp chưa có ai bid, và có giá khởi điểm
            calculatedMinBid = startingPrice;
        } else if (baseForMinBid > 0) {
            calculatedMinBid = baseForMinBid + Math.max(baseForMinBid * minIncrementPercentage, minAbsoluteIncrement);
        } else { // Không có giá hiện tại, không có giá khởi điểm (ít xảy ra)
            calculatedMinBid = minAbsoluteIncrement;
        }
        // Đảm bảo không thấp hơn giá khởi điểm nếu có
        if (startingPrice > 0) {
            calculatedMinBid = Math.max(calculatedMinBid, startingPrice);
        }


        updateMinBidDisplay(calculatedMinBid);

        if (itemData.end_time && endTimeElement) {
            startCountdown(itemData.end_time);
        } else if (endTimeElement) {
            endTimeElement.textContent = 'Không xác định';
        }
        if (formItemIdInput && itemData.id) formItemIdInput.value = itemData.id;
    }


    /**
     * Đồng hồ đếm ngược (Giữ nguyên logic, nhưng phần bật/tắt form sẽ dùng isUserClientSideLoggedIn)
     */
    function startCountdown(endTimeString) {
        // ... (logic đếm ngược của cậu) ...
        // Phần bật/tắt form sẽ như sau:
        if (distance < 0) {
            // ... (đã kết thúc) ...
            if(bidAmountInput) bidAmountInput.disabled = true;
            if(submitBidButton) { /* ... */ }
        } else {
            // ... (còn thời gian) ...
            if (isUserClientSideLoggedIn) { // **DÙNG BIẾN NÀY**
                if(bidAmountInput) bidAmountInput.disabled = false;
                if(submitBidButton) { /* ... */ }
            } else {
                if(bidAmountInput) bidAmountInput.disabled = true;
                if(submitBidButton) {
                    submitBidButton.disabled = true;
                    submitBidButton.textContent = "Đăng nhập để đặt giá";
                }
            }
        }
        // ...
    }

    function updateTotalValue() { /* ... code của cậu ... */ }
    function showBidMessage(message, isError = true) { /* ... code của cậu ... */ }
    async function handlePlaceBid(event) {
        event.preventDefault();
        showBidMessage('');
        if (!isUserClientSideLoggedIn) { // **DÙNG BIẾN NÀY**
            showBidMessage('Vui lòng đăng nhập để đặt giá.', true);
            // Cân nhắc chuyển hướng đến trang login:
            // window.location.href = `/accounts/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            return;
        }
        // ... (phần còn lại của handlePlaceBid của cậu, đảm bảo API đặt giá là /api/bidding/place_bid/)
        // Và sau khi đặt giá thành công, gọi lại:
        // await loadItemDetails();
        // await loadBidHistory();
    }


    // --- TẢI DỮ LIỆU (loadItemDetails, loadBidHistory, updateBidHistoryUI giữ nguyên) ---
    async function loadItemDetails() { /* ... code của cậu, đảm bảo API là /api/items/${currentItemId}/ ... */ }
    async function loadBidHistory() { /* ... code của cậu, đảm bảo API là /api/bidding/get_bids/ và dùng POST ... */ }
    function updateBidHistoryUI(bidsData) { /* ... code của cậu ... */ }


    /**
     * BỎ HÀM checkLoginStatusAndUpdateHeader() CỦA bidding_detail.js ĐI
     * THAY VÀO ĐÓ, CHÚNG TA SẼ ĐỢI THÔNG TIN TỪ BASE.JS
     */

    /**
     * Hàm chính khởi tạo trang.
     */
    async function initializePage() {
        currentItemId = getItemIdFromUrl();
        if (!currentItemId) {
            if(itemNameHeading) itemNameHeading.textContent = "Sản phẩm không hợp lệ hoặc không tìm thấy.";
            // console.error("Không tìm thấy Item ID hợp lệ trong URL.");
            document.querySelector('.bidding-detail-layout')?.style.setProperty('display', 'none', 'important');
            return;
        }
        // console.log(`Trang chi tiết đấu giá khởi tạo cho item ID: ${currentItemId}`);
        if(formItemIdInput) formItemIdInput.value = currentItemId;


        // Hàm này sẽ được gọi sau khi base.js đã xác định trạng thái đăng nhập
        function onAuthStatusKnown() {
            isUserClientSideLoggedIn = window.isUserGloballyAuthenticated || false;
            // console.log("[bidding_detail.js] Auth status from base.js:", isUserClientSideLoggedIn);

            // Bây giờ mới tải dữ liệu sản phẩm và lịch sử bid
            // vì việc hiển thị/cho phép bid phụ thuộc vào trạng thái đăng nhập
            Promise.all([loadItemDetails(), loadBidHistory()])
                .then(() => {
                    // console.log("Item details and bid history loaded.");
                    // Các logic khác cần chạy sau khi cả hai đã tải xong
                })
                .catch(error => {
                    console.error("Error loading initial page data:", error);
                });
        }

        // Kiểm tra xem base.js đã set biến global chưa
        if (typeof window.isUserGloballyAuthenticated !== 'undefined') {
            onAuthStatusKnown();
        } else {
            // Nếu chưa, lắng nghe custom event từ base.js
            // (base.js cần dispatch event này sau khi gọi API auth)
            document.addEventListener('authStateKnown', onAuthStatusKnown, { once: true });
            // Fallback an toàn nếu event không được bắn ra sau 1 khoảng thời gian
            setTimeout(() => {
                if (typeof window.isUserGloballyAuthenticated === 'undefined') {
                    // console.warn("bidding_detail.js: Timed out waiting for 'authStateKnown' event. Assuming not logged in.");
                    isUserClientSideLoggedIn = false; // Mặc định là chưa login
                    onAuthStatusKnown(); // Vẫn chạy để tải dữ liệu item (có thể hiển thị thông tin nhưng không cho bid)
                }
            }, 2500); // Chờ tối đa 2.5 giây
        }

        if (placeBidForm && bidAmountInput) {
            bidAmountInput.addEventListener('input', updateTotalValue);
            placeBidForm.addEventListener('submit', handlePlaceBid);
        } else {
            // console.error("Không tìm thấy form đặt giá hoặc input số tiền để gắn event listeners.");
        }
    }

    // --- Chạy khởi tạo ---
    initializePage();

}); // End DOMContentLoaded