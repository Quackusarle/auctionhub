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
    }

    /**
     * Định dạng số tiền sang VNĐ (XXX.XXX.XXX VNĐ)
     */
    function formatPriceVN(priceValue) {
         try {
             // Chuyển đổi sang số, xử lý cả chuỗi và số
             const price = parseFloat(String(priceValue).replace(/[\.,]/g, ''));
             if (isNaN(price)) return "0 VNĐ";
             // Định dạng VNĐ, không có số lẻ
             return price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 });
         } catch (e) {
             console.error("Error formatting VN price:", priceValue, e);
             return priceValue ? `${priceValue} VNĐ` : '0 VNĐ';
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

         startingPriceElement.textContent = formatPriceVN(startingPrice);
         currentPriceElement.textContent = formatPriceVN(currentHighestBid);

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
      function updateMinBid() {
          const minBidValue = (currentHighestBid > 0 ? currentHighestBid : startingPrice) + (currentHighestBid > 0 ? bidStep : 0);
          bidAmountInput.min = Math.max(minBidValue, startingPrice); // Giá đặt không được thấp hơn giá khởi điểm
          bidAmountInput.step = bidStep;
          minBidLabel.textContent = `Giá đặt (Tối thiểu: ${formatPriceVN(Math.max(minBidValue, startingPrice))}):`;

           // Cập nhật giá trị mặc định của input nếu cần (ví dụ: bằng giá tối thiểu)
           // Hoặc giữ nguyên để người dùng tự nhập
           bidAmountInput.placeholder = formatPriceVN(Math.max(minBidValue, startingPrice)).replace(/\s*VNĐ$/, ''); // Placeholder là số
           // bidAmountInput.value = Math.max(minBidValue, startingPrice); // Tự điền giá tối thiểu
           updateTotalValue(); // Cập nhật tổng giá trị nếu input thay đổi
      }


     /**
      * Cập nhật bảng lịch sử bid
      */
     function updateBidHistoryUI(bidsData) {
         bidHistoryTableBody.innerHTML = ''; // Xóa nội dung cũ
         if (!bidsData || bidsData.length === 0) {
             bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: var(--muted-color);">Chưa có lượt đặt giá nào.</td></tr>';
             return;
         }

         // Sắp xếp theo thời gian mới nhất lên đầu (giả định API chưa sắp xếp)
         bidsData.sort((a, b) => new Date(b.bid_time) - new Date(a.bid_time));

         bidsData.forEach(bid => {
             const row = document.createElement('tr');
             row.innerHTML = `
                 <td>${formatPriceVN(bid.bid_amount)}</td>
                 <td>${bid.user?.email || bid.user_id?.email || 'Người dùng ẩn'}</td>
                 <td>${formatDateTimeVN(bid.bid_time)}</td>
             `;
             bidHistoryTableBody.appendChild(row);
         });
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

    /**
     * Xử lý việc đặt giá
     */
    async function handlePlaceBid(event) {
        event.preventDefault(); // Ngăn form submit theo cách truyền thống
        if (!isUserLoggedIn) {
             showBidMessage('Vui lòng đăng nhập để đặt giá.', true);
             // Có thể chuyển hướng đến trang đăng nhập
             // window.location.href = '/accounts/login/';
             return;
         }

        const bidAmount = parseFloat(bidAmountInput.value);
        const minBidValue = parseFloat(bidAmountInput.min);

        if (isNaN(bidAmount) || bidAmount <= 0) {
            showBidMessage('Vui lòng nhập số tiền hợp lệ.', true);
            return;
        }

        if (bidAmount < minBidValue) {
            showBidMessage(`Giá đặt phải tối thiểu là ${formatPriceVN(minBidValue)}.`, true);
            return;
        }

        // Vô hiệu hóa nút submit trong khi gửi request
        submitBidButton.disabled = true;
        submitBidButton.textContent = "Đang xử lý...";
        showBidMessage(''); // Xóa thông báo cũ

        try {
            const bidData = {
                item: currentItemId, // Hoặc item_id tùy theo API
                bid_amount: bidAmount
            };

            // *** GIẢ ĐỊNH API Endpoint và Method ***
            const placeBidApiUrl = '/api/bids/';
            const result = await fetchAPI(placeBidApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Nếu API yêu cầu CSRF token (thường không cần với API token/session riêng)
                    // 'X-CSRFToken': getCsrfToken() // Cần hàm getCsrfToken()
                },
                body: JSON.stringify(bidData)
            });

            showBidMessage('Đặt giá thành công!', false); // false = không phải lỗi
            bidAmountInput.value = ''; // Xóa input sau khi thành công
            updateTotalValue(); // Cập nhật lại tổng giá trị

            // Sau khi đặt giá thành công, tải lại giá mới nhất và lịch sử bid
            await loadItemDetails(); // Tải lại chi tiết item (để cập nhật giá hiện tại)
            await loadBidHistory(); // Tải lại lịch sử bid

        } catch (error) {
            console.error('Error placing bid:', error);
            // Hiển thị lỗi từ server hoặc lỗi chung
            showBidMessage(`Đặt giá thất bại: ${error.message || 'Lỗi không xác định'}`, true);
        } finally {
            // Kích hoạt lại nút submit (chỉ nếu phiên đấu giá chưa kết thúc)
            if (endTimeElement.textContent !== "Đã kết thúc" && isUserLoggedIn) {
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
         const settingsUrl = "#"; // Thay URL đúng
         const loginUrl = "/accounts/login/"; // Thay URL đúng
         const logoutUrl = "/accounts/logout/"; // Thay URL đúng
         const defaultAvatar = '/static/images/default_avatar.jpg'; // Thay URL đúng

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
                 triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="Avatar" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">`; // Dùng class CSS sẽ tốt hơn
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
        if (!currentItemId) return;
        const bidsApiUrl = `/api/items/${currentItemId}/bids/`; // *** GIẢ ĐỊNH API Endpoint ***
        try {
            const bidsData = await fetchAPI(bidsApiUrl);
            updateBidHistoryUI(bidsData);
        } catch (error) {
            console.error("Failed to load bid history:", error);
             bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: red;">Lỗi tải lịch sử đặt giá.</td></tr>';
        }
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
         if (typeof setupDropdownToggle === 'function') {
             setupDropdownToggle();
         } else {
            console.warn('setupDropdownToggle function not found. User dropdown might not work.');
         }

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