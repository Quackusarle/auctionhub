// static/js/bidding_detail.js
// Phiên bản: 2025-05-26 (Tích hợp WebSocket real-time)

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
    // const minBidLabel = document.getElementById('min-bid-label'); // Giữ lại nếu vẫn dùng
    const minBidDisplay = document.getElementById('min-bid-display');
    const maxBidDisplay = document.getElementById('max-bid-display');
    const submitBidButton = placeBidForm?.querySelector('.btn-submit-bid');
    const bidFormMessage = document.getElementById('bid-form-message');
    const formItemIdInput = document.getElementById('form-item-id');
    const winnerInfoDisplay = document.getElementById('winner-info-display'); // Element để hiển thị người thắng

    // --- State Variables ---
    let currentItemId = null;
    let countdownInterval = null;
    let currentHighestBid = 0;
    let startingPrice = 0;
    let isUserClientSideLoggedIn = false;
    let bidSocket = null; // WebSocket instance

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

    function formatNumberWithCommas(number) {
        if (typeof number === 'string') {
            number = parseFloat(number.replace(/,/g, ''));
        }
        if (typeof number !== 'number' || isNaN(number)) {
            return '';
        }
        return number.toLocaleString('vi-VN');
    }

    function cleanNumberString(formattedString) {
        if (typeof formattedString !== 'string') return String(formattedString);
        return formattedString.replace(/[^0-9]/g, '');
    }

    function formatPriceVN(priceValue, includeCurrencySymbol = true) {
        if (priceValue === null || typeof priceValue === 'undefined' || isNaN(parseFloat(priceValue))) { // Sửa lỗi check isNaN
            return includeCurrencySymbol ? '0 VNĐ' : '0';
        }
        const numericValue = parseFloat(String(priceValue).replace(/,/g, '')); // Đảm bảo là số trước khi format
        const formatted = formatNumberWithCommas(numericValue);
        return includeCurrencySymbol ? formatted + ' VNĐ' : formatted;
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

    function updateBidRanges(basePrice) {
        basePrice = parseFloat(String(basePrice).replace(/,/g, '')); // Làm sạch basePrice
        if (isNaN(basePrice) || basePrice < 0) {
            console.error("[updateBidRanges] Invalid basePrice:", basePrice);
            if (minBidDisplay) minBidDisplay.textContent = 'Lỗi';
            if (maxBidDisplay) maxBidDisplay.textContent = 'Lỗi';
            if (bidAmountInput) {
                bidAmountInput.min = "0";
                bidAmountInput.value = "";
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
        
        const numericStartingPrice = parseFloat(String(startingPriceElement?.textContent.replace(/[^0-9]/g, '') || startingPrice).replace(/,/g, ''));

        calculatedMinBid = Math.max(calculatedMinBid, numericStartingPrice + minAbsoluteIncrement);
        calculatedMaxBid = Math.max(calculatedMaxBid, calculatedMinBid);


        if (bidAmountInput) {
            bidAmountInput.min = calculatedMinBid.toString();
            const currentInputValue = cleanNumberString(bidAmountInput.value);
            if (currentInputValue === "" || isNaN(parseFloat(currentInputValue)) || parseFloat(currentInputValue) < calculatedMinBid) {
                bidAmountInput.value = formatNumberWithCommas(calculatedMinBid);
                 updateTotalValue(); // Cập nhật totalValueSpan khi giá trị input thay đổi
            }
            bidAmountInput.placeholder = formatNumberWithCommas(calculatedMinBid);
        }
        if (minBidDisplay) {
            minBidDisplay.textContent = formatNumberWithCommas(calculatedMinBid);
        }
        if (maxBidDisplay) {
            maxBidDisplay.textContent = formatNumberWithCommas(calculatedMaxBid);
        }
        return { min: calculatedMinBid, max: calculatedMaxBid };
    }

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
            itemSeller.textContent = (itemData.seller && itemData.seller.email) ? itemData.seller.email : 'Người bán ẩn danh';
        }

        startingPrice = parseFloat(String(itemData.starting_price || 0).replace(/,/g, ''));
        currentHighestBid = parseFloat(String(itemData.current_price || 0).replace(/,/g, ''));

        if(startingPriceElement) startingPriceElement.textContent = formatPriceVN(lamTronTien(startingPrice), false); // Bỏ VNĐ ở đây
        if(currentPriceElement) currentPriceElement.textContent = formatPriceVN(lamTronTien(currentHighestBid));

        const baseForBidCalculations = currentHighestBid > 0 ? currentHighestBid : startingPrice;
        updateBidRanges(baseForBidCalculations);

        if (itemData.end_time && endTimeElement) {
             // Chỉ khởi động lại countdown nếu trạng thái là 'ongoing'
            if (itemData.status === 'ongoing') {
                startCountdown(itemData.end_time);
            } else {
                clearInterval(countdownInterval);
                endTimeElement.textContent = "Đã kết thúc!";
                disableBidForm(true, "Đã kết thúc");
            }
        } else if (endTimeElement) {
            endTimeElement.textContent = 'Không xác định';
            disableBidForm(true, "Không xác định thời gian");
        }
        if (formItemIdInput && itemData.item_id) formItemIdInput.value = itemData.item_id;
    }
    
    function disableBidForm(shouldDisable, buttonText = "Đặt giá") {
        if (bidAmountInput) bidAmountInput.disabled = shouldDisable;
        if (submitBidButton) {
            submitBidButton.disabled = shouldDisable;
            if (shouldDisable) {
                submitBidButton.textContent = buttonText;
            } else {
                submitBidButton.textContent = "Đặt giá";
            }
        }
    }


    function startCountdown(endTimeString) {
        clearInterval(countdownInterval);
        const endTime = new Date(endTimeString).getTime();

        function updateCountdown() {
            const now = new Date().getTime();
            const distance = endTime - now;
            const isAuctionEnded = distance < 0;

            if (isAuctionEnded) {
                clearInterval(countdownInterval);
                if (endTimeElement) endTimeElement.textContent = "Đã kết thúc!";
                // Không gọi showBidMessage ở đây nữa, để WebSocket xử lý thông báo cuối cùng
                disableBidForm(true, "Đã kết thúc");
            } else {
                if (endTimeElement) {
                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                    endTimeElement.textContent =
                        `${days > 0 ? days + " ngày " : ""}` +
                        `${hours.toString().padStart(2, '0')}:` +
                        `${minutes.toString().padStart(2, '0')}:` +
                        `${seconds.toString().padStart(2, '0')}`;
                }
                 // Kích hoạt lại form nếu chưa đăng nhập thì vẫn bị disable
                disableBidForm(!isUserClientSideLoggedIn, isUserClientSideLoggedIn ? "Đặt giá" : "Đăng nhập để đặt giá");
            }
        }
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    function updateTotalValue() {
        if (!totalValueSpan || !bidAmountInput) return;
        const currentInput = bidAmountInput.value;
        const cursorPosition = bidAmountInput.selectionStart;
        const rawValue = currentInput.replace(/[^0-9]/g, '');
        const amount = parseFloat(rawValue || 0);
        const formattedValue = formatNumberWithCommas(amount);
        const digitsBeforeCursor = currentInput.substring(0, cursorPosition).replace(/[^0-9]/g, '').length;
        bidAmountInput.value = formattedValue;

        let newCursorPosition = 0;
        let currentDigits = 0;
        for (let i = 0; i < formattedValue.length; i++) {
            if (formattedValue[i] >= '0' && formattedValue[i] <= '9') {
                currentDigits++;
            }
            if (currentDigits === digitsBeforeCursor && i + 1 <= formattedValue.length) { // Đảm bảo i+1 hợp lệ
                newCursorPosition = i + 1;
                break;
            } else if (currentDigits > digitsBeforeCursor) { // Xử lý khi con trỏ ở đầu
                 newCursorPosition = i;
                 break;
            }
        }
         if (digitsBeforeCursor === 0) newCursorPosition = 0; // Nếu con trỏ ở đầu và không có số nào trước đó
         else if (newCursorPosition === 0 && formattedValue.length > 0 && digitsBeforeCursor > 0) newCursorPosition = formattedValue.length; // Nếu con trỏ ở cuối
        
        newCursorPosition = Math.min(newCursorPosition, formattedValue.length);
        newCursorPosition = Math.max(newCursorPosition, 0);

        if (cursorPosition !== null && bidAmountInput === document.activeElement) { // Chỉ đặt lại nếu input đang focus
            bidAmountInput.setSelectionRange(newCursorPosition, newCursorPosition);
        }
        totalValueSpan.textContent = formatPriceVN(amount);
    }

    function showBidMessage(message, isError = true) {
        if (bidFormMessage) {
            bidFormMessage.textContent = message;
            bidFormMessage.className = `form-message ${isError ? 'error' : 'success'}`;
            if (isError) {
                 bidFormMessage.style.color = 'red';
            } else {
                 bidFormMessage.style.color = 'green';
            }
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
        const maxAllowedBidText = maxBidDisplay ? cleanNumberString(maxBidDisplay.textContent) : null;
        const maxAllowedBid = maxAllowedBidText ? parseFloat(maxAllowedBidText) : Infinity;
        if (bidAmount > maxAllowedBid) {
            showBidMessage(`Giá đặt không được vượt quá giá tối đa ${formatPriceVN(maxAllowedBid, false)}.`, true);
            return;
        }

        disableBidForm(true, "Đang gửi...");
        showBidMessage('Đang xử lý đặt giá...', false);

        try {
            const responseData = await fetchAPI('/api/bidding/place_bid/', {
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
            // Thông báo thành công từ HTTP POST (vẫn giữ để người đặt giá biết ngay)
            showBidMessage(`Yêu cầu đặt giá của bạn đã được gửi thành công.`, false);
            // Không cần gọi loadItemDetails() và loadBidHistory() nữa, WebSocket sẽ xử lý.
            // Giá trị input sẽ được cập nhật khi WebSocket message đến và updateBidRanges được gọi.

        } catch (error) {
            console.error('Lỗi khi đặt giá:', error);
            showBidMessage(error.message || 'Đã xảy ra lỗi khi đặt giá. Vui lòng thử lại.', true);
        } finally {
            // Kích hoạt lại form nếu phiên đấu giá chưa kết thúc và người dùng đăng nhập
            const endTime = new Date(endTimeElement.dataset.endTime).getTime(); // Giả sử bạn lưu endTime vào data-attribute
            const isAuctionStillActive = endTimeElement.textContent !== "Đã kết thúc!" && (endTime ? new Date().getTime() < endTime : true);

            if (isAuctionStillActive && isUserClientSideLoggedIn) {
                 disableBidForm(false);
            } else if (!isAuctionStillActive) {
                 disableBidForm(true, "Đã kết thúc");
            } else { // Chưa đăng nhập
                 disableBidForm(true, "Đăng nhập để đặt giá");
            }
        }
    }

    async function loadItemDetails() {
        if (!currentItemId) {
            console.error("loadItemDetails: currentItemId is null.");
            return;
        }
        try {
            const itemData = await fetchAPI(`/api/items/${currentItemId}/`);
            updateItemUI(itemData);
            // startCountdown đã được gọi trong updateItemUI nếu cần
        } catch (error) {
            console.error(`Error loading item details for ID ${currentItemId}:`, error);
            if(itemNameHeading) itemNameHeading.textContent = "Sản phẩm không hợp lệ hoặc không tìm thấy.";
            document.querySelector('.bidding-detail-layout')?.style.setProperty('display', 'none', 'important');
            showBidMessage('Không thể tải thông tin sản phẩm. Vui lòng thử lại sau.', true);
        }
    }

    async function loadBidHistory() {
        if (!currentItemId) {
            console.error("loadBidHistory: currentItemId is null.");
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
    
    function setupWebSocket() {
        if (!currentItemId) return;

        const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPath = `${socketProtocol}//${window.location.host}/ws/bidding/${currentItemId}/`;
        
        console.log(`Connecting to WebSocket: ${wsPath}`);
        bidSocket = new WebSocket(wsPath);

        bidSocket.onopen = function(e) {
            console.log("Bid WebSocket Connection established for item: " + currentItemId);
        };

        bidSocket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            console.log("Data received from WebSocket:", data);

            if (data.type === 'bid_update') {
                console.log("Processing bid_update from WebSocket");
                if (data.item_details) {
                    updateItemUI(data.item_details); // Cập nhật UI với thông tin item mới
                }
                if (data.bid_history) {
                    updateBidHistoryUI(data.bid_history); // Cập nhật lịch sử bid
                }
                // Không cần cập nhật currentHighestBid và gọi updateBidRanges riêng ở đây
                // vì updateItemUI đã làm điều đó khi nhận item_details mới.

                // Thông báo có bid mới (tùy chọn)
                if (data.bidder_info && typeof window.currentUserEmail !== 'undefined' && data.bidder_info.email !== window.currentUserEmail) {
                    // Bạn có thể tạo một thông báo nhỏ, không phải lỗi, ví dụ:
                    // const notifArea = document.getElementById('live-update-notification');
                    // if (notifArea) notifArea.textContent = `${data.bidder_info.email} vừa đặt giá mới!`;
                    console.log(`${data.bidder_info.email} vừa đặt giá mới!`);
                }


            } else if (data.type === 'auction_ended_update') {
                console.log("Processing auction_ended_update from WebSocket");
                if (data.item_details) {
                    updateItemUI(data.item_details); // Cập nhật UI với status 'completed'
                } else {
                    // Nếu không có item_details, tự cập nhật các phần cần thiết
                    if (endTimeElement) endTimeElement.textContent = "Đã kết thúc!";
                    disableBidForm(true, "Đã kết thúc");
                }
                if (data.message && bidFormMessage) { // Hiển thị message từ server
                    showBidMessage(data.message, false);
                }
                
                if (winnerInfoDisplay && data.winner_info) {
                    winnerInfoDisplay.innerHTML = `Người thắng cuộc: <strong>${data.winner_info.email}</strong> với giá <strong>${formatPriceVN(data.winner_info.bid_amount, true)}</strong>.`;
                    winnerInfoDisplay.style.display = 'block';
                } else if (winnerInfoDisplay && !data.winner_info && data.status === 'completed') {
                     winnerInfoDisplay.innerHTML = `Phiên đấu giá đã kết thúc không có người thắng.`;
                     winnerInfoDisplay.style.display = 'block';
                }

                clearInterval(countdownInterval); // Dừng đồng hồ đếm ngược
            }
        };

        bidSocket.onclose = function(e) {
            console.error('Bid WebSocket closed. Code:', e.code, 'Reason:', e.reason, 'Clean:', e.wasClean);
            // Có thể thử kết nối lại ở đây nếu cần, hoặc thông báo cho người dùng.
            // showBidMessage("Mất kết nối real-time tới máy chủ. Vui lòng làm mới trang.", true);
        };

        bidSocket.onerror = function(err) {
            console.error('Bid WebSocket error observed:', err);
            // showBidMessage("Lỗi kết nối real-time. Một số tính năng có thể không hoạt động.", true);
        };
    }

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
            console.log("User client-side logged in status:", isUserClientSideLoggedIn);

            Promise.all([loadItemDetails(), loadBidHistory()])
                .then(() => {
                    // Sau khi tải dữ liệu ban đầu, thiết lập WebSocket
                    setupWebSocket();
                    // Kích hoạt/Vô hiệu hóa form dựa trên trạng thái đăng nhập và phiên đấu giá
                    const itemStatus = document.getElementById('item-status-hidden')?.value || 'unknown'; // Giả sử bạn có thẻ ẩn lưu status
                    const isAuctionActive = endTimeElement?.textContent !== "Đã kết thúc!" && itemStatus !== 'completed' && itemStatus !== 'canceled';

                    if (!isUserClientSideLoggedIn) {
                        disableBidForm(true, "Đăng nhập để đặt giá");
                    } else if (!isAuctionActive) {
                        disableBidForm(true, "Đã kết thúc");
                    } else {
                        disableBidForm(false);
                    }
                })
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
                    console.warn("bidding_detail.js: Hết thời gian chờ 'authStateKnown'. Giả định chưa đăng nhập.");
                    isUserClientSideLoggedIn = false; // Cập nhật lại nếu timeout
                    onAuthStatusKnown(); // Gọi lại để xử lý UI với trạng thái giả định
                }
            }, 2500);
        }

        if (bidAmountInput) {
            bidAmountInput.addEventListener('input', updateTotalValue);
            bidAmountInput.addEventListener('blur', function() {
                if (bidAmountInput.disabled) return; // Không xử lý nếu input bị disable
                const rawValue = cleanNumberString(bidAmountInput.value);
                let amount = parseFloat(rawValue || 0);
                const minAllowedBid = parseFloat(bidAmountInput.min);

                if (!isNaN(minAllowedBid) && amount < minAllowedBid) {
                    amount = minAllowedBid;
                }
                bidAmountInput.value = formatNumberWithCommas(amount);
                updateTotalValue();
            });
        }
        if (placeBidForm) {
            placeBidForm.addEventListener('submit', handlePlaceBid);
            const cancelButton = placeBidForm.querySelector('.btn-cancel-bid');
            if (cancelButton) {
                cancelButton.addEventListener('click', function() {
                    if (bidAmountInput.disabled) return;
                    const minAllowedBid = parseFloat(bidAmountInput.min);
                    if (!isNaN(minAllowedBid)) {
                        bidAmountInput.value = formatNumberWithCommas(minAllowedBid);
                        updateTotalValue();
                    }
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