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
    }

    /**
     * Định dạng số tiền sang dạng tiền tệ VNĐ (1.234.567 ₫).
     * @param {number|string} priceValue - Giá trị số tiền cần định dạng.
     * @returns {string} Chuỗi tiền tệ đã định dạng.
     */
    function formatPriceVN(priceValue) {
         try {
             const price = parseFloat(String(priceValue).replace(/[\.,]/g, ''));
             if (isNaN(price)) return "0 ₫";
             return price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 });
         } catch (e) {
             console.error("Error formatting VN price:", priceValue, e);
             return priceValue ? `${priceValue} ₫` : '0 ₫';
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

         if(startingPriceElement) startingPriceElement.textContent = formatPriceVN(startingPrice);
         if(currentPriceElement) currentPriceElement.textContent = formatPriceVN(currentHighestBid);

         updateMinBid(); // Tính toán và cập nhật giá bid tối thiểu

         if (itemData.end_time) {
             startCountdown(itemData.end_time);
         } else {
             if(endTimeElement) endTimeElement.textContent = 'Không xác định';
         }
     }

      /**
       * Tính toán bước giá (bidStep) dựa trên 0.1% giá khởi điểm (có làm tròn và giá trị tối thiểu).
       * Cập nhật giá đặt tối thiểu (finalMinBid) và các thuộc tính của input đặt giá.
       */
      function updateMinBid() {
          if (!bidAmountInput || !minBidLabel) return; // Thoát nếu thiếu element

          // 1. Tính bước giá = 0.1% giá khởi điểm
          let calculatedBidStep = startingPrice * 0.001;

          // 2. Làm tròn LÊN đến hàng NGHÌN gần nhất
          calculatedBidStep = Math.ceil(calculatedBidStep / 1000) * 1000;

          // 3. Đặt bước giá TỐI THIỂU
          const MINIMUM_BID_STEP = 1000;
          bidStep = Math.max(calculatedBidStep, MINIMUM_BID_STEP); // Cập nhật biến bidStep toàn cục

          // 4. Xác định giá tối thiểu người dùng phải đặt (finalMinBid)
          let finalMinBid;
          if (currentHighestBid >= startingPrice) {
              // Đã có người đặt giá >= giá khởi điểm
              finalMinBid = currentHighestBid + bidStep;
          } else {
              // Chưa có ai đặt giá hợp lệ / Phiên mới bắt đầu
              finalMinBid = startingPrice;
          }
          finalMinBid = Math.max(finalMinBid, startingPrice); // Luôn đảm bảo không thấp hơn giá khởi điểm

          // 5. Cập nhật UI
          bidAmountInput.min = finalMinBid;
          bidAmountInput.step = bidStep;
          minBidLabel.textContent = `Giá đặt (Tối thiểu: ${formatPriceVN(finalMinBid)}):`;
          bidAmountInput.placeholder = formatPriceVN(finalMinBid).replace(/\s*₫$/, '').trim(); // Bỏ ký hiệu tiền tệ khỏi placeholder
          updateTotalValue();
      }


     /**
      * Cập nhật bảng lịch sử đặt giá trên UI.
      * @param {Array<object>} bidsData - Mảng các lượt đặt giá từ API.
      */
     function updateBidHistoryUI(bidsData) {
         if (!bidHistoryTableBody) return;
         bidHistoryTableBody.innerHTML = ''; // Xóa nội dung cũ
         if (!bidsData || bidsData.length === 0) {
             bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: var(--muted-color);">Chưa có lượt đặt giá nào.</td></tr>';
             return;
         }

         // Sắp xếp theo thời gian mới nhất lên đầu (nếu API chưa sắp xếp)
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

    /**
     * Xử lý sự kiện submit form đặt giá.
     * Kiểm tra login, validate giá trị, lấy CSRF token và gửi request đặt giá lên API.
     * @param {Event} event - Sự kiện submit form.
     */
    async function handlePlaceBid(event) {
        event.preventDefault(); // Ngăn form submit truyền thống
        if (!isUserLoggedIn) {
            showBidMessage('Vui lòng đăng nhập để đặt giá.', true);
            return;
        }
        if (!bidAmountInput || !submitBidButton) return; // Kiểm tra element tồn tại

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

        // (Tùy chọn) Kiểm tra xem giá đặt có đúng bội số của bước giá không
        // const priceDifference = bidAmount - (currentHighestBid >= startingPrice ? currentHighestBid : startingPrice);
        // if (priceDifference > 0 && priceDifference % bidStep !== 0) {
        //     showBidMessage(`Số tiền đặt không hợp lệ theo bước giá ${formatPriceVN(bidStep)}. Giá hợp lệ gần nhất: ${formatPriceVN(minBidValue)} hoặc ${formatPriceVN(minBidValue+bidStep)}...`, true);
        //     return;
        // }

        submitBidButton.disabled = true;
        submitBidButton.textContent = "Đang xử lý...";
        showBidMessage(''); // Xóa thông báo cũ

        try {
            const bidData = {
                item_id: currentItemId, // ID sản phẩm
                bid_amount: bidAmount // Số tiền đặt giá
            };

            // URL API để đặt giá (Lấy từ log lỗi 403 gần nhất)
            const placeBidApiUrl = '/api/bidding/place_bid/';
            console.log('Dữ liệu gửi đi:', bidData); // <<< THÊM DÒNG NÀY
            const csrfToken = getCsrfToken(); // Lấy CSRF token từ cookie

            if (!csrfToken) {
                 // Nếu không tìm thấy token thì không thể gửi request
                 throw new Error('CSRF token không tìm thấy. Không thể đặt giá.');
            }

            // Gọi API để gửi thông tin đặt giá
            const result = await fetchAPI(placeBidApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken // Gửi kèm CSRF token trong header
                },
                body: JSON.stringify(bidData) // Dữ liệu gửi đi dạng JSON
            });

            showBidMessage('Đặt giá thành công!', false); // Thông báo thành công
            bidAmountInput.value = ''; // Xóa giá trị trong ô input
            updateTotalValue(); // Cập nhật lại tổng giá trị (về 0)

            // Tải lại thông tin mới nhất sau khi đặt giá thành công
            await loadItemDetails(); // Tải lại chi tiết item (cập nhật giá, min bid)
            await loadBidHistory(); // Tải lại lịch sử bid

        } catch (error) {
            console.error('Error placing bid:', error);
            // Hiển thị lỗi (bao gồm cả lỗi CSRF nếu có)
            showBidMessage(`Đặt giá thất bại: ${error.message || 'Lỗi không xác định'}`, true);
        } finally {
            // Luôn kích hoạt lại nút submit nếu phiên đấu giá chưa kết thúc và user đã login
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
         if (!userActionArea) {
            console.warn("Không tìm thấy #user-action-area. Bỏ qua kiểm tra login.");
            isUserLoggedIn = false; // Mặc định chưa login
            // Đảm bảo form bị khóa nếu không có user area
            if(bidAmountInput) bidAmountInput.disabled = true;
            if(submitBidButton) submitBidButton.disabled = true;
            return;
         }
         const profileApiUrl = '/api/profile/get_avatar/'; // API kiểm tra profile/avatar
         const triggerBtn = userActionArea.querySelector('.user-dropdown-trigger');
         const dropdownMenuUl = userActionArea.querySelector('.user-dropdown-menu ul');

         // URL cho các action (Nên lấy từ template hoặc cấu hình)
         const settingsUrl = "#";
         const loginUrl = "/accounts/login/";
         const logoutUrl = "/accounts/logout/";
         const defaultAvatar = '/static/images/default_avatar.jpg'; // Path tuyệt đối

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
                 triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="Avatar" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">`; // Nên dùng class CSS
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
        if (!currentItemId) return;
        // !!! KIỂM TRA LẠI ENDPOINT NÀY TRÊN BACKEND !!!
        const bidsApiUrl = `/api/bidding/get_bids/${currentItemId}/`;
        try {
            console.log(`Đang tải lịch sử bid: ${bidsApiUrl}`);
            const bidsData = await fetchAPI(bidsApiUrl);
            updateBidHistoryUI(bidsData);
        } catch (error) {
            console.error(`Lỗi tải lịch sử đặt giá (${bidsApiUrl}):`, error);
            if(bidHistoryTableBody) bidHistoryTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: red;">Lỗi tải lịch sử đặt giá.</td></tr>';
        }
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

         // Giả định hàm setupDropdownToggle từ home.js đã chạy hoặc sẽ chạy
         // Nếu cần đảm bảo, có thể gọi lại ở đây nhưng cẩn thận trùng lặp event listener
         // if (typeof setupDropdownToggle === 'function') { setupDropdownToggle(); }

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