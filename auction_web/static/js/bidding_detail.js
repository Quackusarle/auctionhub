// static/js/bidding_detail.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
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
    const submitBidButton = placeBidForm.querySelector('.btn-submit-bid');
    const bidFormMessage = document.getElementById('bid-form-message');
    const cancelButton = placeBidForm.querySelector('.btn-cancel');
    const userActionArea = document.getElementById('user-action-area'); // Để kiểm tra login

    // --- State Variables ---
    let currentItemId = null;
    let countdownInterval = null;
    let currentHighestBid = 0;
    let startingPrice = 0;
    let bidStep = 10000; // Giả định bước giá là 10,000 VNĐ
    let isUserLoggedIn = false; // Trạng thái đăng nhập

    // --- Helper Functions ---

    /**
     * Lấy Item ID từ URL path (ví dụ: /items/123/ -> 123)
     */
    function getItemIdFromUrl() {
        const pathParts = window.location.pathname.split('/');
        // Tìm phần tử là số sau 'items'
        const itemIdIndex = pathParts.indexOf('items') + 1;
        if (itemIdIndex > 0 && itemIdIndex < pathParts.length) {
            const id = parseInt(pathParts[itemIdIndex]);
            return !isNaN(id) ? id : null;
        }
        return null;
    }

    /**
     * Hàm gọi API Fetch đơn giản (Có thể tách ra utils.js)
     */
    async function fetchAPI(url, options = {}) {
        // Luôn gửi kèm credentials (cookies) cho các request
        options.credentials = 'include';
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // Thử đọc lỗi JSON từ server nếu có
                let errorData = null;
                try { errorData = await response.json(); } catch (e) { /* Ignore parsing error */ }
                console.error(`HTTP error! Status: ${response.status}`, errorData);
                const errorMessage = errorData?.detail || errorData?.message || `Lỗi ${response.status}`;
                throw new Error(errorMessage); // Ném lỗi với thông điệp từ server hoặc status code
            }
            // Nếu là response không có content (204 No Content)
            if (response.status === 204) {
                return null;
            }
            return await response.json(); // Trả về dữ liệu JSON
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
     * Định dạng số tiền sang VNĐ (XXX.XXX.XXX VNĐ)
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
      * Định dạng ngày giờ sang dd/mm hh:mm:ss (Ví dụ)
      */
     function formatDateTimeVN(dateTimeString) {
         try {
             if (!dateTimeString) return 'N/A';
             const date = new Date(dateTimeString);
             if (isNaN(date.getTime())) return 'Invalid Date';

             const options = {
                 day: '2-digit', month: '2-digit', // year: 'numeric',
                 hour: '2-digit', minute: '2-digit', second: '2-digit',
                 hour12: false // Use 24-hour format
             };
             return date.toLocaleString('vi-VN', options);
         } catch (e) {
             console.error("Error formatting date:", dateTimeString, e);
             return 'N/A';
         }
     }

     /**
      * Cập nhật giao diện với thông tin chi tiết item
      */
     function updateItemUI(itemData) {
         if (!itemData) return;
         document.title = `Đấu giá: ${itemData.name || 'Sản phẩm'} - AuctionHub`;
         itemNameHeading.textContent = itemData.name || 'Không có tên';
         itemName.textContent = itemData.name || 'Không có tên';
         itemImage.src = itemData.image_url || 'static/images/placeholder.png';
         itemImage.alt = itemData.name || 'Hình ảnh sản phẩm';
         itemSeller.textContent = itemData.seller?.email || itemData.seller_id?.email || 'Ẩn danh'; // Giả định có thông tin seller

         startingPrice = parseFloat(String(itemData.starting_price || 0).replace(/,/g, ''));
         currentHighestBid = parseFloat(String(itemData.current_price || 0).replace(/,/g, ''));

         startingPriceElement.textContent = formatPriceVN(lamTronTien(startingPrice));
         currentPriceElement.textContent = formatPriceVN(lamTronTien(currentHighestBid));

         // Cập nhật giá tối thiểu cho input và label
         updateMinBid();

         // Bắt đầu countdown nếu có end_time
         if (itemData.end_time) {
             startCountdown(itemData.end_time);
         } else {
             endTimeElement.textContent = 'Không xác định';
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
      * Bắt đầu đồng hồ đếm ngược
      */
     function startCountdown(endTimeString) {
         clearInterval(countdownInterval); // Xóa interval cũ nếu có

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
                 // Vô hiệu hóa form đặt giá
                 bidAmountInput.disabled = true;
                 submitBidButton.disabled = true;
                 submitBidButton.textContent = "Đã kết thúc";
                 return;
             }

             // Tính toán ngày, giờ, phút, giây
             const days = Math.floor(distance / (1000 * 60 * 60 * 24));
             const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
             const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
             const seconds = Math.floor((distance % (1000 * 60)) / 1000);

             // Hiển thị kết quả
             let countdownText = "";
             if (days > 0) countdownText += `${days} ngày `;
             countdownText += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
             endTimeElement.textContent = countdownText;
             endTimeElement.style.color = "#dc3545"; // Giữ màu đỏ

             // Kích hoạt lại form (nếu trước đó bị disable)
             if (isUserLoggedIn) { // Chỉ enable nếu user đã login
                bidAmountInput.disabled = false;
                submitBidButton.disabled = false;
                submitBidButton.textContent = "Đặt giá";
             }


         }, 1000);
     }

     /**
      * Cập nhật hiển thị tổng giá trị khi nhập liệu
      */
     function updateTotalValue() {
          const amount = parseFloat(bidAmountInput.value) || 0;
          totalValueSpan.textContent = formatPriceVN(amount).replace(/\s*VNĐ$/, ''); // Chỉ hiển thị số
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
     * Xử lý việc đặt giá
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
      * Hiển thị thông báo trên form đặt giá
      */
     function showBidMessage(message, isError = true) {
         bidFormMessage.textContent = message;
         if (isError) {
             bidFormMessage.classList.remove('success');
             bidFormMessage.style.color = '#dc3545'; // Màu đỏ lỗi
         } else {
             bidFormMessage.classList.add('success');
             bidFormMessage.style.color = 'var(--primary-color)'; // Màu xanh thành công
         }
     }

     /**
      * Hàm kiểm tra trạng thái đăng nhập (có thể gọi lại API hoặc dùng cờ từ home.js)
      * Giả định gọi lại API cho chắc chắn
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
            // Vô hiệu hóa form đặt giá nếu chưa đăng nhập
            if(bidAmountInput) bidAmountInput.disabled = true;
            if(submitBidButton) submitBidButton.disabled = true;
            if(submitBidButton && endTimeElement.textContent !== "Đã kết thúc") submitBidButton.textContent = "Đăng nhập để đặt giá";

         };

         if (!userActionArea || !triggerBtn || !dropdownMenuUl) {
             console.warn("User action area not found or incomplete. Assuming logged out.");
             setDefaultUserState();
             return;
         }

         try {
             // Gọi API kiểm tra profile
             const data = await fetchAPI(profileApiUrl); // fetchAPI đã bao gồm credentials: 'include'

             if (data && (data.profileUrl || data.avatarUrl)) { // Có dữ liệu -> Đã đăng nhập
                 isUserLoggedIn = true;
                 console.log('[bidding_detail.js] User is logged in.');
                 const avatarSrc = data.avatarUrl || defaultAvatar;
                 triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="Avatar" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">`; // Dùng class CSS sẽ tốt hơn
                 dropdownMenuUl.innerHTML = `
                     <li><a href="${settingsUrl}">Cài đặt</a></li>
                     <li><a href="${logoutUrl}">Đăng xuất</a></li>`;

                 // Kích hoạt form đặt giá (nếu phiên chưa kết thúc)
                 if (endTimeElement.textContent !== "Đã kết thúc") {
                     bidAmountInput.disabled = false;
                     submitBidButton.disabled = false;
                     submitBidButton.textContent = "Đặt giá";
                 }

             } else { // Không có dữ liệu hợp lệ -> Chưa đăng nhập
                  console.log('[bidding_detail.js] User is not logged in.');
                 setDefaultUserState();
             }
         } catch (error) { // Lỗi khi gọi API (có thể do 401/403 hoặc lỗi mạng)
             console.error('[bidding_detail.js] Error checking login status:', error);
              // Kiểm tra xem lỗi có phải do chưa đăng nhập không (401/403)
              // fetchAPI ném lỗi với message là status text hoặc detail từ server
              // Nên kiểm tra message lỗi hoặc có cách khác để xác định lỗi 401/403
              // Tạm thời cứ coi mọi lỗi là chưa đăng nhập
             setDefaultUserState();
         }
     }


     // --- Initialization ---

    /**
     * Tải dữ liệu chi tiết item
     */
    async function loadItemDetails() {
        if (!currentItemId) return;
        const itemDetailApiUrl = `/api/items/${currentItemId}/`; // *** GIẢ ĐỊNH API Endpoint ***
        try {
            const itemData = await fetchAPI(itemDetailApiUrl);
            updateItemUI(itemData);
        } catch (error) {
            console.error("Failed to load item details:", error);
            itemNameHeading.textContent = "Không thể tải sản phẩm";
            // Hiển thị lỗi ở khu vực nào đó trang trọng hơn
        }
    }

    /**
     * Tải lịch sử bid
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
      * Khởi tạo trang
      */
     async function initializePage() {
         currentItemId = getItemIdFromUrl();
         if (!currentItemId) {
             itemNameHeading.textContent = "Sản phẩm không hợp lệ";
             console.error("Invalid Item ID found in URL.");
             // Ẩn các phần còn lại hoặc hiển thị thông báo lỗi lớn
             return;
         }

         // Thiết lập dropdown user (giả định hàm này có sẵn từ home.js)
         //if (typeof setupDropdownToggle === 'function') {
         //    setupDropdownToggle();
         //} else {
         //   console.warn('setupDropdownToggle function not found. User dropdown might not work.');
         //}

         // Kiểm tra trạng thái đăng nhập và cập nhật header
         await checkLoginStatusAndUpdateHeader();

         // Tải dữ liệu chính của trang
         await loadItemDetails();
         await loadBidHistory();

         // Gắn các event listeners
         bidAmountInput.addEventListener('input', updateTotalValue);
         placeBidForm.addEventListener('submit', handlePlaceBid);
         // cancelButton.addEventListener('click', () => { /* Logic nút hủy nếu cần */ });

         // Có thể thêm refresh định kỳ (không khuyến khích bằng WebSocket)
         // setInterval(async () => {
         //     await loadItemDetails();
         //     await loadBidHistory();
         // }, 30000); // Ví dụ: 30 giây tải lại

         console.log(`Bidding detail page initialized for item ID: ${currentItemId}`);
     }

     // --- Chạy khởi tạo ---
     initializePage();

}); // End DOMContentLoaded