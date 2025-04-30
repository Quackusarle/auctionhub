// static/js/bidding_detail.js

/**
 * Lấy giá trị CSRF token từ cookie để gửi kèm request POST/PUT/DELETE
 * @returns {string|null} Giá trị CSRF token hoặc null nếu không tìm thấy.
 */
function getCsrfToken() {
    let csrfToken = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Tìm cookie có tên là 'csrftoken'
            if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                csrfToken = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                break;
            }
        }
    }
    if (!csrfToken) {
        console.error("CSRF token not found in cookies!");
    }
    return csrfToken;
}


document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    // (Lấy các element cần thiết bằng ID)
    const itemNameHeading = document.getElementById('item-name-heading');
    const itemImage = document.getElementById('item-image');
    const itemName = document.getElementById('item-name'); // Trong card
    const itemSeller = document.getElementById('item-seller');
    const currentPriceElement = document.getElementById('current-price');
    const startingPriceElement = document.getElementById('starting-price');
    const endTimeElement = document.getElementById('end-time');
    const bidHistoryTableBody = document.getElementById('bid-history-table-body');
    const placeBidForm = document.getElementById('place-bid-form');
    const bidAmountInput = document.getElementById('bid-amount-input');
    const totalValueSpan = document.getElementById('total-bid-value');
    const minBidLabel = document.getElementById('min-bid-label');
    const submitBidButton = placeBidForm?.querySelector('.btn-submit-bid'); // Thêm ? để tránh lỗi nếu form không tồn tại
    const bidFormMessage = document.getElementById('bid-form-message');
    // const cancelButton = placeBidForm?.querySelector('.btn-cancel'); // Tạm thời chưa dùng
    const userActionArea = document.getElementById('user-action-area');

    // --- State Variables ---
    // (Lưu trữ trạng thái của trang)
    let currentItemId = null;
    let countdownInterval = null;
    let currentHighestBid = 0;
    let startingPrice = 0;
    let bidStep = 1000; // Giá trị mặc định, sẽ được tính lại
    let isUserLoggedIn = false; // Trạng thái đăng nhập (quan trọng cho đặt giá)

    // --- Helper Functions ---

    /**
     * Lấy Item ID từ URL path.
     * Ví dụ: /items/123/bidding/ -> 123
     * @returns {number|null} Item ID hoặc null nếu không tìm thấy.
     */
    function getItemIdFromUrl() {
        const pathParts = window.location.pathname.split('/');
        const itemIdIndex = pathParts.indexOf('items') + 1;
        if (itemIdIndex > 0 && itemIdIndex < pathParts.length) {
            const id = parseInt(pathParts[itemIdIndex]);
            return !isNaN(id) ? id : null;
        }
        return null;
    }

    /**
     * Hàm gọi API dùng fetch, tự động kèm credentials (cookies).
     * Xử lý lỗi HTTP và trả về JSON hoặc null.
     * @param {string} url - URL của API endpoint.
     * @param {object} options - Tùy chọn cho hàm fetch (method, headers, body,...).
     * @returns {Promise<object|null>} Promise chứa dữ liệu JSON hoặc null.
     */
    async function fetchAPI(url, options = {}) {
        options.credentials = 'include'; // Luôn gửi cookie
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorData = null;
                try { errorData = await response.json(); } catch (e) { /* Ignore */ }
                const errorMessage = errorData?.detail || errorData?.message || `Lỗi ${response.status}`;
                console.error(`HTTP error! Status: ${response.status}`, errorData);
                throw new Error(errorMessage); // Ném lỗi kèm thông điệp từ server nếu có
            }
            if (response.status === 204) { // No Content
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error('Fetch API error:', error);
            throw error; // Ném lại lỗi để nơi gọi xử lý
        }
        /**
         * Hàm fetchAPI này là một wrapper (hàm bao bọc) xung quanh hàm fetch gốc, cung cấp các tính năng sau:

            -Luôn gửi kèm credentials.
            -Xử lý lỗi HTTP một cách chi tiết, cố gắng đọc thông báo lỗi JSON từ server.
            -Trả về null cho response có trạng thái 204.
            -Trả về dữ liệu JSON cho các response thành công khác.
            -Ghi log lỗi ra console và ném lại lỗi để nơi gọi có thể xử lý.
         */
    }

    /**
     * Định dạng số tiền sang dạng tiền tệ VNĐ (1.234.567 ₫).
     * @param {number|string} priceValue - Giá trị số tiền cần định dạng.
     * @returns {string} Chuỗi tiền tệ đã định dạng.
     */
    function lamTronTien(amount) {
        
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return 0; 
        }
    
        const nghin = Math.floor(numAmount / 1000); 
        const tram = numAmount % 1000;            
    
        if (tram >= 500) {
            return (nghin + 1) * 1000; 
        } else {
            return nghin * 1000;      
        }
    }

    function formatPriceVN(priceValue) {
        try {
            // Giá trị từ API có thể là chuỗi dạng "20718231.00" hoặc số
            // parseFloat sẽ xử lý đúng dấu chấm thập phân '.'
            const price = parseFloat(priceValue);

            // Kiểm tra xem kết quả có phải là số hợp lệ không
            if (isNaN(price)) {
                console.warn(`[formatPriceVN] Input could not be parsed to a valid number: ${priceValue}`);
                return "0 VNĐ"; // Trả về giá trị mặc định nếu không parse được
            }

            // Định dạng tiền tệ VNĐ, bỏ phần thập phân (minimumFractionDigits: 0)
            return price.toLocaleString('vi-VN', {
                style: 'currency',
                currency: 'VND',
                minimumFractionDigits: 0, // Bỏ .00
                maximumFractionDigits: 0  // Bỏ .00
               });
        } catch (e) {
            console.error("Error formatting VN price:", priceValue, e);
            // Trong trường hợp lỗi, trả về giá trị gốc để tránh hiển thị sai hoàn toàn
            return String(priceValue || '0') + ' VNĐ';
        }
    }

     /**
      * Định dạng chuỗi ngày giờ ISO sang dd/mm hh:mm:ss (giờ Việt Nam).
      * @param {string} dateTimeString - Chuỗi ngày giờ dạng ISO 8601.
      * @returns {string} Chuỗi ngày giờ đã định dạng hoặc 'N/A'.
      */
     function formatDateTimeVN(dateTimeString) {
         try {
             if (!dateTimeString) return 'N/A';
             const date = new Date(dateTimeString);
             if (isNaN(date.getTime())) return 'Ngày không hợp lệ';
             const options = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
             return date.toLocaleString('vi-VN', options);
         } catch (e) {
             console.error("Error formatting date:", dateTimeString, e);
             return 'N/A';
         }
     }

     /**
      * Cập nhật các thành phần UI với thông tin chi tiết của sản phẩm.
      * @param {object} itemData - Dữ liệu chi tiết sản phẩm từ API.
      */
     function updateItemUI(itemData) {
         if (!itemData) return;
         document.title = `Đấu giá: ${itemData.name || 'Sản phẩm'} - AuctionHub`;
         if(itemNameHeading) itemNameHeading.textContent = itemData.name || 'Không có tên';
         if(itemName) itemName.textContent = itemData.name || 'Không có tên';
         if(itemImage) {
             itemImage.src = itemData.image_url || '/static/images/placeholder.png'; // Dùng path tuyệt đối
             itemImage.alt = itemData.name || 'Hình ảnh sản phẩm';
         }
         if(itemSeller) itemSeller.textContent = itemData.seller?.email || itemData.seller_id?.email || 'Ẩn danh';

         startingPrice = parseFloat(String(itemData.starting_price || 0).replace(/[\.,]/g, ''));
         currentHighestBid = parseFloat(String(itemData.current_price || 0).replace(/[\.,]/g, ''));
         startingPriceElement.textContent = formatPriceVN(lamTronTien(startingPrice));
         currentPriceElement.textContent = formatPriceVN(lamTronTien(currentHighestBid));

         updateMinBid(); // Tính toán và cập nhật giá bid tối thiểu

         if (itemData.end_time) {
             startCountdown(itemData.end_time);
         } else {
             if(endTimeElement) endTimeElement.textContent = 'Không xác định';
         }
     }
      
    /**
       * Cập nhật giá tối thiểu cho input và label
       */

      function updateMinBid(nextMinBidFromServer = null) {
        let minBidValue;
        let calculationSource = ""; // Để log nguồn tính toán

        if (nextMinBidFromServer !== null && !isNaN(parseFloat(String(nextMinBidFromServer).replace(/,/g, '')))) {
             // Ưu tiên sử dụng giá tối thiểu do server tính toán và gửi về sau khi bid thành công
             minBidValue = parseFloat(String(nextMinBidFromServer).replace(/,/g, '')) || 0;
             calculationSource = "server";
             console.log(`[updateMinBid] Using next min bid from server: ${minBidValue}`);
        } else {
            // Tự tính toán khi tải trang lần đầu hoặc khi không có giá từ server
            const basePrice = currentHighestBid > 0 ? currentHighestBid : startingPrice;
            calculationSource = currentHighestBid > 0 ? `currentHighestBid (${currentHighestBid})` : `startingPrice (${startingPrice})`;

            if (isNaN(basePrice) || basePrice < 0) {
                 console.error(`[updateMinBid] Invalid basePrice: ${basePrice}. Falling back to 0.`);
                 minBidValue = 0; // Hoặc giá trị mặc định khác nếu cần
            } else {
                 const minIncrementValue = basePrice * 0.01; // Tính 1%
                 minBidValue = basePrice + minIncrementValue; // Áp dụng luật 1%
                 console.log(`[updateMinBid] Calculated locally: basePrice=${basePrice}, increment=${minIncrementValue}, rawMinBid=${minBidValue}`);
            }

            // Luôn đảm bảo giá tối thiểu không thấp hơn giá khởi điểm
             if (!isNaN(startingPrice)) {
                minBidValue = Math.max(minBidValue, startingPrice);
             }
             console.log(`[updateMinBid] Calculated min bid locally based on ${calculationSource}. Final Min (>= starting): ${minBidValue}`);
        }

        let displayMinBid = Math.ceil(minBidValue);
        displayMinBid = lamTronTien(displayMinBid);

         // Kiểm tra nếu displayMinBid không hợp lệ
         if (isNaN(displayMinBid)) {
            console.error("[updateMinBid] Failed to calculate displayMinBid. Check inputs:", {currentHighestBid, startingPrice, nextMinBidFromServer});
            minBidLabel.textContent = 'Giá đặt (Tối thiểu: Lỗi)';
            if(bidAmountInput) {
                bidAmountInput.min = "0";
                bidAmountInput.placeholder = "Lỗi";
            }
            return;
         }

        // --- Cập nhật các thành phần UI ---
        console.log(`[updateMinBid] Updating UI: displayMinBid=${displayMinBid}`);

        if(bidAmountInput) {
            // 1. Cập nhật thuộc tính 'min' của input (giá trị số nguyên)
            bidAmountInput.min = displayMinBid;

            // 2. Cập nhật placeholder (ví dụ: hiển thị số tối thiểu đã làm tròn)
            bidAmountInput.placeholder = displayMinBid.toLocaleString('vi-VN');
        }

        if(minBidLabel) {
            // 3. Cập nhật label hiển thị giá tối thiểu (dùng format tiền tệ)
            minBidLabel.textContent = `Giá đặt (Tối thiểu: ${formatPriceVN(displayMinBid)}):`;
        }

        // 4. Cập nhật lại giá trị tổng hiển thị (vì placeholder/min đã thay đổi)
        updateTotalValue();
    }

    /**
     * Cập nhật giao diện với thông tin chi tiết item
     * Hàm này gọi updateMinBid sau khi có dữ liệu item
     */
    function updateItemUI(itemData) {
        if (!itemData || !startingPriceElement || !currentPriceElement || !itemNameHeading || !itemName || !itemImage || !itemSeller || !endTimeElement) {
             console.error("[updateItemUI] Missing essential DOM elements.");
             return; // Không cập nhật nếu thiếu element quan trọng
        }

        document.title = `Đấu giá: ${itemData.name || 'Sản phẩm'} - AuctionHub`;
        itemNameHeading.textContent = itemData.name || 'Không có tên';
        itemName.textContent = itemData.name || 'Không có tên';
        itemImage.src = itemData.image_url || '/static/images/placeholder.png';
        itemImage.alt = itemData.name || 'Hình ảnh sản phẩm';
         try {
            // Kiểm tra seller_id tồn tại và là object trước khi truy cập email
            if(itemData.seller_id && typeof itemData.seller_id === 'object' && itemData.seller_id !== null) {
                itemSeller.textContent = itemData.seller_id.email || 'Ẩn danh';
            } else if(itemData.seller && typeof itemData.seller === 'object' && itemData.seller !== null) { // Fallback cho trường hợp seller là object trực tiếp
                 itemSeller.textContent = itemData.seller.email || 'Ẩn danh';
            }
            else {
                 itemSeller.textContent = 'Ẩn danh';
            }
         } catch (e) {
             console.warn("Could not access seller email, setting to 'Ẩn danh'.", e);
             itemSeller.textContent = 'Ẩn danh';
         }

        // Cập nhật biến state trước khi gọi updateMinBid
        startingPrice = parseFloat(String(itemData.starting_price || 0).replace(/,/g, ''));
        currentHighestBid = parseFloat(String(itemData.current_price || 0).replace(/,/g, ''));

         // Log giá trị trước khi cập nhật UI
         console.log(`[updateItemUI] Fetched data: startingPrice=${startingPrice}, currentHighestBid=${currentHighestBid}`);

        startingPriceElement.textContent = formatPriceVN(lamTronTien(startingPrice));
        currentPriceElement.textContent = formatPriceVN(lamTronTien(currentHighestBid));

        // Gọi updateMinBid ĐỂ TÍNH TOÁN LẠI DỰA TRÊN DỮ LIỆU MỚI NHẤT
        updateMinBid(); // Sẽ tự động tính theo luật 1%

        if (itemData.end_time) {
            startCountdown(itemData.end_time);
        } else {
            endTimeElement.textContent = 'Không xác định';
        }
    }
     /**
      * Bắt đầu đồng hồ đếm ngược thời gian kết thúc phiên đấu giá.
      * Vô hiệu hóa form đặt giá khi hết giờ.
      * @param {string} endTimeString - Chuỗi thời gian kết thúc dạng ISO 8601.
      */
     function startCountdown(endTimeString) {
         if (!endTimeElement) return;
         clearInterval(countdownInterval); // Xóa interval cũ

         const endTime = new Date(endTimeString).getTime();
         if (isNaN(endTime)) {
             endTimeElement.textContent = "Thời gian không hợp lệ";
             return;
         }

         countdownInterval = setInterval(() => {
             const now = new Date().getTime();
             const distance = endTime - now;

             if (distance < 0) {
                 clearInterval(countdownInterval);
                 endTimeElement.textContent = "Đã kết thúc";
                 endTimeElement.style.color = "#6c757d"; // Màu xám
                 if(bidAmountInput) bidAmountInput.disabled = true;
                 if(submitBidButton) {
                     submitBidButton.disabled = true;
                     submitBidButton.textContent = "Đã kết thúc";
                 }
                 showBidMessage('');
                 return;
             }

             const days = Math.floor(distance / (1000 * 60 * 60 * 24));
             const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
             const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
             const seconds = Math.floor((distance % (1000 * 60)) / 1000);

             let countdownText = "";
             if (days > 0) countdownText += `${days} ngày `;
             countdownText += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
             endTimeElement.textContent = countdownText;
             endTimeElement.style.color = "#dc3545";

             // Kích hoạt lại form nếu còn thời gian VÀ user đã login
             if (isUserLoggedIn) {
                 if(bidAmountInput) bidAmountInput.disabled = false;
                 if(submitBidButton) {
                     submitBidButton.disabled = false;
                     submitBidButton.textContent = "Đặt giá";
                 }
             } else {
                 // Đảm bảo form vẫn bị khóa nếu user chưa login
                 if(bidAmountInput) bidAmountInput.disabled = true;
                 if(submitBidButton) {
                    submitBidButton.disabled = true;
                    submitBidButton.textContent = "Đăng nhập để đặt giá";
                 }
             }

         }, 1000);
     }

     /**
      * Cập nhật hiển thị tổng giá trị trong form khi người dùng nhập liệu.
      */
     function updateTotalValue() {
          if (!bidAmountInput || !totalValueSpan) return;
          const amount = parseFloat(bidAmountInput.value) || 0;
          // Chỉ hiển thị số, không kèm ký hiệu tiền tệ ở đây
          totalValueSpan.textContent = amount.toLocaleString('vi-VN');
     }

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
     * Xử lý việc đặt giá
     */
    /**
     * Xử lý sự kiện submit form đặt giá.
     * Kiểm tra login, validate giá trị, lấy CSRF token và gửi request đặt giá lên API.
     * @param {Event} event - Sự kiện submit form.
     */
    async function handlePlaceBid(event) {
        const csrfToken = getCookie('csrftoken');
        event.preventDefault();

        // Clear previous message
        showBidMessage('');

        if (!isUserLoggedIn) {
            showBidMessage('Vui lòng đăng nhập để đặt giá.', true);
            return;
        }

        // Lấy giá trị số tiền dưới dạng chuỗi số (bỏ các dấu .)
        const bidAmountRawString = String(bidAmountInput.value).replace(/[.,]/g, ''); // Bỏ dấu . hoặc ,
        const bidAmount = parseFloat(bidAmountRawString); // Chuyển thành số để validation
        const minBidValue = parseFloat(bidAmountInput.min);

        const userIdInput = placeBidForm.querySelector('input[name="user_id"]');
        const userId = userIdInput ? userIdInput.value : null;

        // --- Validation ---
        if (!userId || userId === 'None' || isNaN(parseInt(userId))) {
            showBidMessage('Lỗi: Không thể xác định người dùng. Vui lòng đăng nhập lại.', true);
            return;
        }
         if (!currentItemId) {
             showBidMessage('Lỗi: Không thể xác định sản phẩm.', true);
             return;
         }
        if (isNaN(bidAmount) || bidAmount <= 0) {
            showBidMessage('Vui lòng nhập số tiền hợp lệ.', true);
            return;
        }
        if (isNaN(minBidValue) || bidAmount < minBidValue) {
             const displayMinBid = isNaN(minBidValue) ? 'không xác định' : formatPriceVN(minBidValue);
             showBidMessage(`Giá đặt phải tối thiểu là ${displayMinBid}.`, true);
            return;
        }
         if (!csrfToken) {
            showBidMessage('Lỗi: Thiếu mã bảo mật (CSRF). Vui lòng tải lại trang.', true);
            return;
         }
        // --- End Validation ---
        submitBidButton.disabled = true;
        submitBidButton.textContent = "Đang xử lý...";

        try {
            // *** Đảm bảo gửi bid_amount dưới dạng STRING ***
            const bidData = {
                item_id: currentItemId,          // Integer
                user_id: parseInt(userId),      // Integer
                bid_amount: String(bidAmount)   // *** GỬI DƯỚI DẠNG STRING ***
            };
            // **********************************************
            // **** LOG DỮ LIỆU GỬI ĐI ****
            console.log("Sending bid data (Raw Object):", bidData);
            console.log("Sending bid data (JSON String):", JSON.stringify(bidData));
            // ****************************

            const placeBidApiUrl = '/api/bidding/place_bid/';
            const response = await fetch(placeBidApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                    'Accept': 'application/json'
                },
                 credentials: 'include',
                body: JSON.stringify(bidData)
            });

            const responseBody = await response.text(); // Đọc body dưới dạng text trước

            // **** LOG PHẢN HỒI TỪ SERVER ****
            console.log("Raw Response Status:", response.status);
            console.log("Raw Response Body:", responseBody);
            // *******************************

            if (!response.ok) {
                 let errorData;
                 try {
                     errorData = JSON.parse(responseBody);
                 } catch (e) {
                     // Nếu không parse được JSON, dùng text body làm lỗi
                     errorData = { error: `Lỗi ${response.status}: ${responseBody || response.statusText}` };
                 }
                 const error = new Error(errorData.error || JSON.stringify(errorData));
                 error.status = response.status;
                 error.data = errorData;
                 throw error; // Ném lỗi để catch xử lý
            }

             const result = JSON.parse(responseBody);

            // --- Xử lý thành công ---
            showBidMessage('Đặt giá thành công!', false);
            bidAmountInput.value = ''; // Xóa input hiển thị
             // Quan trọng: Cập nhật lại giá trị min và placeholder sau khi bid thành công
            const newMinBidValue = parseFloat(result.bid_amount) + bidStep; // Tính min mới
            bidAmountInput.min = Math.max(newMinBidValue, startingPrice); // Cập nhật min attribute
            bidAmountInput.placeholder = formatPriceVN(Math.max(newMinBidValue, startingPrice)).replace(/\s*VNĐ$/, ''); // Cập nhật placeholder
            minBidLabel.textContent = `Giá đặt (Tối thiểu: ${formatPriceVN(Math.max(newMinBidValue, startingPrice))}):`; // Cập nhật label

            updateTotalValue(); // Cập nhật tổng (về 0)
            await loadItemDetails(); // Tải lại chi tiết item
            await loadBidHistory();  // Tải lại lịch sử bid
            // -----------------------

        } catch (error) {
            console.error('Error placing bid:', error);
            // Nếu có error.data thì log ra để xem chi tiết lỗi từ backend
            if (error.data) console.error('Error Data from Server:', error.data);

            // --- Hiển thị lỗi chi tiết hơn ---
             let errorMessage = 'Lỗi không xác định';
             if (error.data) {
                 if (typeof error.data === 'string') {
                    errorMessage = error.data;
                 } else if (error.data.detail) {
                     errorMessage = error.data.detail;
                 } else if (error.data.error) { // Ưu tiên lỗi chung từ view nếu có
                     errorMessage = error.data.error;
                 } else {
                     // Xử lý lỗi validation từ serializer
                     const validationErrors = [];
                     for (const field in error.data) {
                         if (Array.isArray(error.data[field])) {
                             // Lấy tên field dễ đọc hơn nếu có thể
                             let fieldName = field;
                             if (field === 'bid_amount') fieldName = 'Giá đặt';
                             else if (field === 'item_id') fieldName = 'Sản phẩm';
                             else if (field === 'user_id') fieldName = 'Người dùng';
                             validationErrors.push(`${fieldName}: ${error.data[field].join(' ')}`);
                         }
                     }
                     if (validationErrors.length > 0) {
                         errorMessage = validationErrors.join('; ');
                     } else {
                         // Fallback nếu không phải các định dạng trên
                          try {
                              errorMessage = JSON.stringify(error.data);
                          } catch {
                              errorMessage = error.message || 'Lỗi không xác định';
                          }
                     }
                 }
             } else {
                 errorMessage = error.message; // Lỗi mạng hoặc lỗi JS khác
             }
             showBidMessage(`Đặt giá thất bại: ${errorMessage}`, true);
             // ----------------------------------

        } finally {
            // Kích hoạt lại nút chỉ khi phiên đấu giá còn và user đăng nhập
            if (endTimeElement?.textContent !== "Đã kết thúc" && isUserLoggedIn) {
                submitBidButton.disabled = false;
                submitBidButton.textContent = "Đặt giá";
            }
        }
    }

     /**
      * Hiển thị thông báo (lỗi hoặc thành công) trên form đặt giá.
      * @param {string} message - Nội dung thông báo.
      * @param {boolean} [isError=true] - Đánh dấu là lỗi (true) hay thành công (false).
      */
     function showBidMessage(message, isError = true) {
         if (!bidFormMessage) return;
         bidFormMessage.textContent = message;
         bidFormMessage.classList.toggle('success', !isError); // Thêm/xóa class success
         bidFormMessage.classList.toggle('error', isError); // Thêm/xóa class error (nên có CSS cho class này)
         // Có thể dùng CSS thay vì set style trực tiếp
         bidFormMessage.style.color = isError ? '#dc3545' : 'var(--primary-color)';
     }

     /**
      * Kiểm tra trạng thái đăng nhập của user bằng cách gọi API profile.
      * Cập nhật header (avatar/icon, menu dropdown) và trạng thái isUserLoggedIn.
      * Đồng thời bật/tắt form đặt giá dựa trên trạng thái đăng nhập và thời gian đấu giá.
      */
     async function checkLoginStatusAndUpdateHeader() {
         const profileApiUrl = '/api/profile/get_avatar/';
         const triggerBtn = userActionArea?.querySelector('.user-dropdown-trigger');
         const dropdownMenuUl = userActionArea?.querySelector('.user-dropdown-menu ul');
         const settingsUrl = "#"; 
         const loginUrl = "/accounts/login/"; 
         const logoutUrl = "/accounts/logout/"; 
         const defaultAvatar = '/static/images/default_avatar.jpg'; 
         const setDefaultUserState = () => {
             isUserLoggedIn = false;
             if(triggerBtn) triggerBtn.innerHTML = '<i class="fas fa-user header-icon"></i>';
             if(dropdownMenuUl) dropdownMenuUl.innerHTML = `
                 <li><a href="${settingsUrl}">Cài đặt</a></li>
                 <li class="separator"></li>
                 <li><a href="${loginUrl}">Đăng nhập</a></li>`;
             // Luôn vô hiệu hóa form nếu chưa đăng nhập
             if(bidAmountInput) bidAmountInput.disabled = true;
             if(submitBidButton) {
                 submitBidButton.disabled = true;
                 // Chỉ đổi text nếu phiên chưa kết thúc
                 if (endTimeElement?.textContent !== "Đã kết thúc") {
                    submitBidButton.textContent = "Đăng nhập để đặt giá";
                 }
             }
         };

         if (!triggerBtn || !dropdownMenuUl) {
             console.error("Cấu trúc header dropdown không đúng (thiếu trigger hoặc menu ul).");
             setDefaultUserState(); // Đặt về trạng thái chưa login nếu cấu trúc sai
             return;
         }

         try {
             const data = await fetchAPI(profileApiUrl); // Gọi API kiểm tra

             if (data && (data.profileUrl || data.avatarUrl)) { // Có dữ liệu -> Đã đăng nhập
                 isUserLoggedIn = true;
                 console.log('[bidding_detail.js] User đã đăng nhập.');
                 const avatarSrc = data.avatarUrl || defaultAvatar;
                 triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="Avatar" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">`; // Dùng class CSS sẽ tốt hơn
                 dropdownMenuUl.innerHTML = `
                     <li><a href="${settingsUrl}">Cài đặt</a></li>
                     <li><a href="${logoutUrl}">Đăng xuất</a></li>`;

                 // Kích hoạt form nếu phiên chưa kết thúc
                 if (endTimeElement?.textContent !== "Đã kết thúc") {
                     if(bidAmountInput) bidAmountInput.disabled = false;
                     if(submitBidButton) {
                         submitBidButton.disabled = false;
                         submitBidButton.textContent = "Đặt giá";
                     }
                 } else {
                    // Đảm bảo form vẫn bị khóa nếu phiên đã kết thúc
                     if(bidAmountInput) bidAmountInput.disabled = true;
                     if(submitBidButton) {
                         submitBidButton.disabled = true;
                         submitBidButton.textContent = "Đã kết thúc";
                     }
                 }

             } else { // Không có dữ liệu -> Chưa đăng nhập
                  console.log('[bidding_detail.js] User chưa đăng nhập.');
                 setDefaultUserState();
             }
         } catch (error) { // Lỗi API (401/403 hoặc mạng)
             console.error('[bidding_detail.js] Lỗi kiểm tra trạng thái đăng nhập:', error);
             setDefaultUserState(); // Coi như chưa đăng nhập nếu có lỗi
         }
     }


    // --- Initialization ---

    /**
     * Tải dữ liệu chi tiết sản phẩm từ API và cập nhật UI.
     */
    async function loadItemDetails() {
        if (!currentItemId) return;
        const itemDetailApiUrl = `/api/items/${currentItemId}/`;
        try {
            console.log(`Đang tải chi tiết item: ${itemDetailApiUrl}`);
            const itemData = await fetchAPI(itemDetailApiUrl);
            updateItemUI(itemData); // Cập nhật UI (sẽ gọi updateMinBid)
        } catch (error) {
            console.error("Lỗi tải chi tiết sản phẩm:", error);
            if(itemNameHeading) itemNameHeading.textContent = "Không thể tải sản phẩm";
            // Có thể ẩn các thành phần khác nếu lỗi nghiêm trọng
        }
    }

    /**
     * Tải lịch sử các lượt đặt giá từ API và cập nhật bảng lịch sử.
     */
    async function loadBidHistory() {
        if (!currentItemId) {
             console.error("[loadBidHistory] currentItemId is not set.");
             bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: red;">Lỗi: Không xác định được sản phẩm.</td></tr>';
             return;
        }

        const bidsApiUrl = `/api/bidding/get_bids/`; 

        // Hiển thị trạng thái đang tải
        if (bidHistoryTableBody) { 
             bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: var(--muted-color);">Đang tải lịch sử...</td></tr>';
        } else {
            console.error("[loadBidHistory] bidHistoryTableBody element not found.");
            return; // Dừng nếu không tìm thấy bảng
        }


        try {
            // *** 2. Sử dụng POST và gửi item_id trong body ***
            const bidsData = await fetchAPI(bidsApiUrl, {
                method: 'POST', // Dùng phương thức POST
                headers: {
                    'Content-Type': 'application/json',
                     // Gửi kèm CSRF token cho request POST nếu backend yêu cầu
                     // (Thường cần nếu dùng SessionAuthentication)
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ item_id: currentItemId }) // Gửi item_id dạng JSON
            });
            // Gọi hàm cập nhật UI với dữ liệu nhận được
            updateBidHistoryUI(bidsData);
        } catch (error) {
            console.error("Failed to load bid history:", error);
             if (bidHistoryTableBody) { // Kiểm tra lại element trước khi cập nhật lỗi
                 bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: red;">Lỗi tải lịch sử đặt giá. Vui lòng thử lại.</td></tr>';
             }
        }
    }

    /**
      * Cập nhật bảng lịch sử bid
      */
     function updateBidHistoryUI(bidsData) {
         if (!bidHistoryTableBody) { // Luôn kiểm tra element trước khi dùng
            console.error("[updateBidHistoryUI] bidHistoryTableBody element not found.");
            return;
         }

         bidHistoryTableBody.innerHTML = ''; // Xóa nội dung cũ (loading/error)

         if (!bidsData || !Array.isArray(bidsData) || bidsData.length === 0) {
             bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: var(--muted-color);">Chưa có lượt đặt giá nào.</td></tr>';
             return;
         }

         // Backend đã sắp xếp, không cần sort lại ở đây trừ khi muốn logic khác
         // bidsData.sort((a, b) => new Date(b.bid_time) - new Date(a.bid_time));

         bidsData.forEach(bid => {
             const row = document.createElement('tr');

             // *** 3. Lấy email từ user_detail (đã sửa ở serializer) ***
             // Sử dụng optional chaining (?.) để tránh lỗi nếu user_detail không có hoặc không có email
             const userEmail = bid.user_detail?.email || 'Người dùng ẩn';

             // Lấy thời gian đã được format sẵn từ serializer (nếu có) hoặc format lại
             // Giả sử serializer chưa format, dùng hàm formatDateTimeVN
             const bidTimeFormatted = formatDateTimeVN(bid.bid_time); // Format lại ở đây

             row.innerHTML = `
                 <td>${formatPriceVN(bid.bid_amount)}</td>
                 <td>${userEmail}</td>
                 <td>${bidTimeFormatted}</td>
             `;
             bidHistoryTableBody.appendChild(row);
         });
     }
     /**
      * Hàm chính khởi tạo trang: lấy ID, kiểm tra login, tải dữ liệu, gắn listeners.
      */
     async function initializePage() {
         currentItemId = getItemIdFromUrl();
         if (!currentItemId) {
             if(itemNameHeading) itemNameHeading.textContent = "Sản phẩm không hợp lệ";
             console.error("Không tìm thấy Item ID hợp lệ trong URL.");
             // Có thể ẩn các thành phần khác
             document.querySelector('.bidding-detail-layout')?.style.setProperty('display', 'none');
             return;
         }
         console.log(`Trang chi tiết đấu giá khởi tạo cho item ID: ${currentItemId}`);

         // Kiểm tra login và cập nhật header/trạng thái form
         await checkLoginStatusAndUpdateHeader();

         // Tải dữ liệu chính (chi tiết item và lịch sử bid)
         await loadItemDetails();
         await loadBidHistory();

         // Gắn các event listeners cho form đặt giá
         if (placeBidForm && bidAmountInput) {
             bidAmountInput.addEventListener('input', updateTotalValue);
             placeBidForm.addEventListener('submit', handlePlaceBid);
         } else {
            console.error("Không tìm thấy form đặt giá hoặc input số tiền.");
         }
     }

     // --- Chạy khởi tạo ---
     initializePage();

}); // End DOMContentLoaded