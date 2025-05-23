// static/js/bidding_detail.js
// Phiên bản: 2025-05-23 (Đã điều chỉnh giao diện và logic tính giá)

/**
 * Lấy giá trị CSRF token từ cookie.
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
    return csrfToken;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const itemNameHeading = document.getElementById('item-name-heading');
    const itemImage = document.getElementById('item-image');
    const itemName = document.getElementById('item-name');
    const itemSeller = document.getElementById('item-seller');
    const currentPriceElement = document.getElementById('current-price');
    const startingPriceElement = document.getElementById('starting-price');
    const endTimeElement = document.getElementById('time-remaining');
    const bidHistoryTableBody = document.getElementById('bid-history-table-body');
    const placeBidForm = document.getElementById('place-bid-form');
    const bidAmountInput = document.getElementById('bid-amount-input');
    const totalValueSpan = document.getElementById('total-bid-value');
    const minBidLabel = document.getElementById('min-bid-label'); // Label cho giá bid tối thiểu trên input
    const minBidDisplay = document.getElementById('min-bid-display'); // Vị trí hiển thị Giá tối thiểu
    const maxBidDisplay = document.getElementById('max-bid-display'); // Vị trí hiển thị Giá tối đa
    const submitBidButton = placeBidForm?.querySelector('.btn-submit-bid');
    const bidFormMessage = document.getElementById('bid-form-message');
    const formItemIdInput = document.getElementById('form-item-id');
    // const bIndicator = document.getElementById('b-indicator'); // Đã bỏ chỉ báo B trong HTML và JS

    // --- State Variables ---
    let currentItemId = null;
    let countdownInterval = null;
    let currentHighestBid = 0;
    let startingPrice = 0;
    let isUserClientSideLoggedIn = false;

    // --- Helper Functions ---
    function getItemIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/items\/(\d+)\/bidding\//);
        if (match && match[1]) {
            return parseInt(match[1]);
        }
        return null;
    }

    async function fetchAPI(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.detail || `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }
            return response.json();
        } catch (error) {
            console.error('Fetch API error:', error);
            throw error;
        }
    }

    // Hàm làm tròn tiền theo quy tắc của bạn (làm tròn lên hàng nghìn nếu >=500, xuống nếu <500)
    function lamTronTien(amount) {
        const num = Number(amount);
        if (isNaN(num)) return 0;
        const nghin = Math.floor(num / 1000);
        const tram = num % 1000;
        if (tram >= 500) {
            return (nghin + 1) * 1000;
        } else {
            return nghin * 1000;
        }
    }

    // Hàm định dạng số thành chuỗi có dấu phẩy phân cách hàng nghìn
    function formatNumberWithCommas(number) {
        if (typeof number === 'string') {
            number = parseFloat(number.replace(/,/g, ''));
        }
        if (typeof number !== 'number' || isNaN(number)) {
            return '';
        }
        return number.toLocaleString('vi-VN');
    }

    // Hàm loại bỏ dấu phẩy khỏi chuỗi số
    function cleanNumberString(formattedString) {
        if (typeof formattedString !== 'string') return String(formattedString);
        // Chỉ giữ lại các ký tự số
        return formattedString.replace(/[^0-9]/g, '');
    }

    // Hàm định dạng giá trị tiền tệ cho hiển thị cuối cùng
    function formatPriceVN(priceValue, includeCurrencySymbol = true) {
        if (priceValue === null || typeof priceValue === 'undefined' || isNaN(priceValue)) {
            return includeCurrencySymbol ? '0 VNĐ' : '0';
        }
        const formatted = formatNumberWithCommas(priceValue);
        return includeCurrencySymbol ? formatted + ' VNĐ' : formatted;
    }

    // Hàm định dạng số lớn thành "B" (tỷ) - Đã bỏ việc sử dụng trong UI
    function formatToBillions(amount) {
        if (typeof amount === 'string') {
            amount = parseFloat(amount.replace(/,/g, ''));
        }
        if (isNaN(amount)) return '';
        if (amount === 0) return '0';

        if (Math.abs(amount) >= 1000000000) {
            const billions = amount / 1000000000;
            const displayBillions = Math.round(billions * 100) / 100;
            return `${displayBillions.toLocaleString('vi-VN')}B`;
        } else {
            return formatNumberWithCommas(amount);
        }
    }

    function formatDateTimeVN(dateTimeString) {
        if (!dateTimeString) return 'Không xác định';
        try {
            const date = new Date(dateTimeString);
            if (isNaN(date.getTime())) return 'Không xác định';

            const options = {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                day: '2-digit', month: '2-digit', year: 'numeric'
            };
            return date.toLocaleString('vi-VN', options);
        } catch (e) {
            console.error("Error formatting date:", e);
            return 'Không xác định';
        }
    }

    /**
     * Cập nhật giá tối thiểu cho input và label, và tính cả giá tối đa
     */
    function updateBidRanges(basePrice) {
        if (isNaN(basePrice) || basePrice < 0) {
            console.error("[updateBidRanges] Invalid basePrice:", basePrice);
            if (minBidDisplay) minBidDisplay.textContent = 'Lỗi';
            if (maxBidDisplay) maxBidDisplay.textContent = 'Lỗi';
            if (bidAmountInput) {
                bidAmountInput.min = "0";
                bidAmountInput.value = ""; // Đặt giá trị mặc định là rỗng
                bidAmountInput.placeholder = "Lỗi";
            }
            return { min: 0, max: 0 };
        }

        const minIncrementPercentage = 0.01;
        const maxIncrementPercentage = 0.10;
        const minAbsoluteIncrement = 1000;

        let calculatedMinBid = basePrice + Math.max(basePrice * minIncrementPercentage, minAbsoluteIncrement);
        calculatedMinBid = lamTronTien(Math.ceil(calculatedMinBid));

        let calculatedMaxBid = basePrice + Math.max(basePrice * maxIncrementPercentage, minAbsoluteIncrement * 10);
        calculatedMaxBid = lamTronTien(Math.ceil(calculatedMaxBid));

        calculatedMinBid = Math.max(calculatedMinBid, startingPrice + minAbsoluteIncrement);
        calculatedMaxBid = Math.max(calculatedMaxBid, calculatedMinBid);

        if (bidAmountInput) {
            bidAmountInput.min = calculatedMinBid.toString();
            const currentInputValue = cleanNumberString(bidAmountInput.value);
            // Cập nhật giá trị input CHỈ KHI nó rỗng, hoặc giá trị hiện tại không hợp lệ,
            // hoặc nhỏ hơn giá min mới (để nó nhảy lên giá min mới).
            if (currentInputValue === "" || isNaN(parseFloat(currentInputValue)) || parseFloat(currentInputValue) < calculatedMinBid) {
                bidAmountInput.value = formatNumberWithCommas(calculatedMinBid);
            }
            bidAmountInput.placeholder = formatNumberWithCommas(calculatedMinBid);
        }
        if (minBidDisplay) {
            // Hiển thị giá trị không có "B"
            minBidDisplay.textContent = formatNumberWithCommas(calculatedMinBid);
        }
        if (maxBidDisplay) {
            // Hiển thị giá trị không có "B"
            maxBidDisplay.textContent = formatNumberWithCommas(calculatedMaxBid);
        }

        return { min: calculatedMinBid, max: calculatedMaxBid };
    }


    /**
     * Cập nhật UI với thông tin sản phẩm
     */
    async function updateItemUI(itemData) {
        if (!itemData) {
            console.error("No item data provided to updateItemUI.");
            if(itemNameHeading) itemNameHeading.textContent = "Không tìm thấy thông tin sản phẩm.";
            document.querySelector('.bidding-detail-layout')?.style.setProperty('display', 'none', 'important');
            return;
        }

        const dynamicTitleSpan = document.getElementById('dynamic-item-title');
        if(dynamicTitleSpan) dynamicTitleSpan.textContent = itemData.name || 'Sản phẩm';
        else document.title = `Đấu giá: ${itemData.name || 'Sản phẩm'} - AuctionHub`;

        if(itemNameHeading) itemNameHeading.textContent = itemData.name || 'Không có tên';
        if(itemName) itemName.textContent = itemData.name || 'Không có tên';
        if(itemImage) {
            itemImage.src = itemData.image_url || '/static/images/placeholder_item_large.png';
            itemImage.alt = itemData.name || 'Hình ảnh sản phẩm';
        }
        if(itemSeller) {
            if (itemData.seller && itemData.seller.email) {
                itemSeller.textContent = itemData.seller.email;
            } else {
                itemSeller.textContent = 'Người bán ẩn danh';
            }
        }

        startingPrice = parseFloat(String(itemData.starting_price || 0).replace(/,/g, ''));
        currentHighestBid = parseFloat(String(itemData.current_price || 0).replace(/,/g, ''));

        if(startingPriceElement) startingPriceElement.textContent = formatPriceVN(lamTronTien(startingPrice)).replace(/\s*VNĐ$/, '');
        if(currentPriceElement) currentPriceElement.textContent = formatPriceVN(lamTronTien(currentHighestBid));

        const baseForBidCalculations = currentHighestBid > 0 ? currentHighestBid : startingPrice;
        updateBidRanges(baseForBidCalculations); // Gọi hàm này để thiết lập giá trị mặc định cho input

        if (itemData.end_time && endTimeElement) {
            startCountdown(itemData.end_time);
        } else if (endTimeElement) {
            endTimeElement.textContent = 'Không xác định';
        }
        if (formItemIdInput && itemData.item_id) formItemIdInput.value = itemData.item_id;
    }


    /**
     * Đồng hồ đếm ngược
     */
    function startCountdown(endTimeString) {
        clearInterval(countdownInterval);

        const endTime = new Date(endTimeString).getTime();

        function updateCountdown() {
            const now = new Date().getTime();
            const distance = endTime - now;

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const isAuctionEnded = distance < 0;

            if (isAuctionEnded) {
                clearInterval(countdownInterval);
                if (endTimeElement) endTimeElement.textContent = "Đã kết thúc!";
                showBidMessage('Phiên đấu giá đã kết thúc.', false);
            } else {
                if (endTimeElement) {
                    endTimeElement.textContent =
                        `${days > 0 ? days + " ngày " : ""}` +
                        `${hours.toString().padStart(2, '0')}:` +
                        `${minutes.toString().padStart(2, '0')}:` +
                        `${seconds.toString().padStart(2, '0')}`;
                }
            }

            if (bidAmountInput && submitBidButton) {
                if (isAuctionEnded || !isUserClientSideLoggedIn) {
                    bidAmountInput.disabled = true;
                    submitBidButton.disabled = true;
                    submitBidButton.textContent = isAuctionEnded ? "Đã kết thúc" : "Đăng nhập để đặt giá";
                } else {
                    bidAmountInput.disabled = false;
                    submitBidButton.disabled = false;
                    submitBidButton.textContent = "Đặt giá";
                }
            }
        }

        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    function updateTotalValue() {
        if (!totalValueSpan || !bidAmountInput) return;

        const currentInput = bidAmountInput.value;
        const cursorPosition = bidAmountInput.selectionStart; // Vị trí con trỏ trước khi thay đổi

        // Làm sạch chỉ giữ lại các ký tự số
        const rawValue = currentInput.replace(/[^0-9]/g, '');
        const amount = parseFloat(rawValue || 0);

        // Định dạng lại giá trị
        const formattedValue = formatNumberWithCommas(amount);

        // Tính toán độ dài của phần số nguyên trước con trỏ (không tính dấu phẩy)
        const digitsBeforeCursor = currentInput.substring(0, cursorPosition).replace(/[^0-9]/g, '').length;

        // Định dạng lại input
        bidAmountInput.value = formattedValue;

        // Tính toán lại vị trí con trỏ mới
        let newCursorPosition = 0;
        let currentDigits = 0;
        for (let i = 0; i < formattedValue.length; i++) {
            if (formattedValue[i] >= '0' && formattedValue[i] <= '9') {
                currentDigits++;
            }
            if (currentDigits === digitsBeforeCursor) {
                newCursorPosition = i + 1;
                break;
            }
        }
        // Đảm bảo con trỏ không vượt quá giới hạn và không lùi về quá xa
        newCursorPosition = Math.min(newCursorPosition, formattedValue.length);
        newCursorPosition = Math.max(newCursorPosition, 0);


        // Đặt lại vị trí con trỏ
        if (cursorPosition !== null) {
            bidAmountInput.setSelectionRange(newCursorPosition, newCursorPosition);
        }

        // Cập nhật tổng giá trị hiển thị bên dưới form
        totalValueSpan.textContent = formatPriceVN(amount);
    }

    function showBidMessage(message, isError = true) {
        if (bidFormMessage) {
            bidFormMessage.textContent = message;
            bidFormMessage.className = `form-message ${isError ? 'error' : 'success'}`;
        }
    }

    async function handlePlaceBid(event) {
        event.preventDefault();
        showBidMessage('');

        if (!isUserClientSideLoggedIn) {
            showBidMessage('Vui lòng đăng nhập để đặt giá.', true);
            return;
        }

        if (!currentItemId) {
            showBidMessage('Lỗi: Không tìm thấy ID sản phẩm.', true);
            return;
        }

        const rawBidAmountString = cleanNumberString(bidAmountInput.value);
        const bidAmount = parseFloat(rawBidAmountString);

        const minAllowedBid = parseFloat(bidAmountInput.min);

        if (isNaN(bidAmount) || bidAmount <= 0) {
            showBidMessage('Số tiền đặt giá không hợp lệ. Vui lòng nhập số dương.', true);
            return;
        }

        if (bidAmount < minAllowedBid) {
            showBidMessage(`Giá đặt phải lớn hơn hoặc bằng ${formatPriceVN(minAllowedBid, false)}.`, true);
            return;
        }

        const maxAllowedBidText = maxBidDisplay ? cleanNumberString(maxBidDisplay.textContent.replace('B', '000000000')) : null;
        const maxAllowedBid = maxAllowedBidText ? parseFloat(maxAllowedBidText) : Infinity;

        if (bidAmount > maxAllowedBid) {
            showBidMessage(`Giá đặt không được vượt quá giá tối đa ${formatPriceVN(maxAllowedBid, false)}.`, true);
            return;
        }

        submitBidButton.disabled = true;
        submitBidButton.textContent = 'Đang gửi...';
        showBidMessage('Đang xử lý đặt giá...', false);

        try {
            const response = await fetchAPI('/api/bidding/place_bid/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({
                    item_id: currentItemId,
                    bid_amount: bidAmount
                })
            });

            const data = response;

            showBidMessage(`Đặt giá thành công! Giá hiện tại: ${formatPriceVN(lamTronTien(data.bid_amount), false)} VNĐ.`, false);
            await loadItemDetails();
            await loadBidHistory();
            updateTotalValue();

        } catch (error) {
            console.error('Lỗi khi đặt giá:', error);
            showBidMessage(error.message || 'Đã xảy ra lỗi khi đặt giá. Vui lòng thử lại.', true);
        } finally {
            submitBidButton.disabled = false;
            submitBidButton.textContent = 'Đặt giá';
        }
    }


    // --- TẢI DỮ LIỆU ---
    async function loadItemDetails() {
        if (!currentItemId) {
            console.error("loadItemDetails: currentItemId is null. Cannot fetch item details.");
            return;
        }
        try {
            const itemData = await fetchAPI(`/api/items/${currentItemId}/`);
            updateItemUI(itemData);
            if (itemData.end_time) {
                startCountdown(itemData.end_time);
            }
        } catch (error) {
            console.error(`Error loading item details for ID ${currentItemId}:`, error);
            if(itemNameHeading) itemNameHeading.textContent = "Sản phẩm không hợp lệ hoặc không tìm thấy.";
            document.querySelector('.bidding-detail-layout')?.style.setProperty('display', 'none', 'important');
            showBidMessage('Không thể tải thông tin sản phẩm. Vui lòng thử lại sau.', true);
        }
    }

    async function loadBidHistory() {
        if (!currentItemId) {
            console.error("loadBidHistory: currentItemId is null. Cannot fetch bid history.");
            if(bidHistoryTableBody) bidHistoryTableBody.innerHTML = '<tr><td colspan="3" class="loading-text">Lỗi: Không tìm thấy ID sản phẩm.</td></tr>';
            return;
        }
        try {
            const bidsData = await fetchAPI('/api/bidding/get_bids/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ item_id: currentItemId })
            });
            updateBidHistoryUI(bidsData);
        } catch (error) {
            console.error(`Error loading bid history for item ID ${currentItemId}:`, error);
            if(bidHistoryTableBody) bidHistoryTableBody.innerHTML = '<tr><td colspan="3" class="loading-text">Lỗi khi tải lịch sử đấu giá.</td></tr>';
        }
    }

    function updateBidHistoryUI(bidsData) {
        if (!bidHistoryTableBody) return;

        bidHistoryTableBody.innerHTML = '';

        if (!bidsData || bidsData.length === 0) {
            bidHistoryTableBody.innerHTML = '<tr><td colspan="3" class="loading-text">Chưa có giá thầu nào cho sản phẩm này.</td></tr>';
            return;
        }

        bidsData.forEach(bid => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatPriceVN(lamTronTien(bid.bid_amount), false)}</td>
                <td>${bid.user_detail?.email || 'Người dùng ẩn danh'}</td>
                <td>${formatDateTimeVN(bid.bid_time)}</td>
            `;
            bidHistoryTableBody.appendChild(row);
        });
    }

    /**
     * Hàm chính khởi tạo trang.
     */
    async function initializePage() {
        currentItemId = getItemIdFromUrl();
        if (!currentItemId) {
            if(itemNameHeading) itemNameHeading.textContent = "Sản phẩm không hợp lệ hoặc không tìm thấy.";
            document.querySelector('.bidding-detail-layout')?.style.setProperty('display', 'none', 'important');
            return;
        }
        if(formItemIdInput) formItemIdInput.value = currentItemId;

        function onAuthStatusKnown() {
            isUserClientSideLoggedIn = window.isUserGloballyAuthenticated || false;

            Promise.all([loadItemDetails(), loadBidHistory()])
                .catch(error => {
                    console.error("Error loading initial page data:", error);
                    showBidMessage('Lỗi khi tải thông tin trang. Vui lòng thử lại.', true);
                });
        }

        if (typeof window.isUserGloballyAuthenticated !== 'undefined') {
            onAuthStatusKnown();
        } else {
            document.addEventListener('authStateKnown', onAuthStatusKnown, { once: true });
            setTimeout(() => {
                if (typeof window.isUserGloballyAuthenticated === 'undefined') {
                    console.warn("bidding_detail.js: Hết thời gian chờ sự kiện 'authStateKnown'. Giả định chưa đăng nhập.");
                    isUserClientSideLoggedIn = false;
                    onAuthStatusKnown();
                }
            }, 2500);
        }

        if (bidAmountInput) {
            bidAmountInput.addEventListener('input', updateTotalValue);
            bidAmountInput.addEventListener('blur', function() {
                const rawValue = cleanNumberString(bidAmountInput.value);
                let amount = parseFloat(rawValue || 0);

                const minAllowedBid = parseFloat(bidAmountInput.min);
                if (amount < minAllowedBid) {
                    amount = minAllowedBid;
                }
                bidAmountInput.value = formatNumberWithCommas(amount);
                updateTotalValue(); // Cập nhật lại hiển thị tổng giá trị
            });
        }
        if (placeBidForm) {
            placeBidForm.addEventListener('submit', handlePlaceBid);
            const cancelButton = placeBidForm.querySelector('.btn-cancel-bid');
            if (cancelButton) {
                cancelButton.addEventListener('click', function() {
                    const minAllowedBid = parseFloat(bidAmountInput.min);
                    bidAmountInput.value = formatNumberWithCommas(minAllowedBid);
                    updateTotalValue();
                    showBidMessage('');
                    bidAmountInput.focus();
                });
            }
        } else {
            console.warn("Không tìm thấy form đặt giá hoặc input số tiền để gắn event listeners.");
        }
    }

    initializePage();

});