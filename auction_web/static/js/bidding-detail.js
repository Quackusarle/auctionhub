// auction_web/static/js/bidding_standalone.js

// --- Hàm phụ trợ ---
/**
 * Định dạng số theo kiểu Việt Nam (dấu chấm)
 * @param {number | string} num Số cần định dạng
 * @returns {string} Chuỗi đã định dạng hoặc chuỗi rỗng nếu đầu vào không hợp lệ
 */
function formatNumber(num) {
    if (isNaN(parseFloat(num))) return ''; // Kiểm tra nếu không phải số hợp lệ
    return parseFloat(num).toLocaleString('vi-VN');
}

/**
 * Loại bỏ ký tự không phải số và chuyển về số nguyên
 * @param {string} formattedValue Chuỗi có thể chứa dấu ngăn cách
 * @returns {number} Số nguyên hoặc 0 nếu không parse được
 */
function unformatNumber(formattedValue) {
    if (!formattedValue) return 0;
    const rawValue = String(formattedValue).replace(/\D/g, ''); 
    return parseInt(rawValue, 10) || 0; 
}

/**
 * Định dạng thời gian đơn giản (Ví dụ)
 * @param {string} dateString Chuỗi thời gian ISO hoặc tương tự
 * @returns {string} Chuỗi thời gian đã định dạng (HH:MM:SS DD/MM) hoặc 'N/A'
 */
function formatBidTime(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A'; // Kiểm tra ngày hợp lệ
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); 
        return `${hours}:${minutes}:${seconds} ${day}/${month}`;
    } catch (e) {
        console.error("Error formatting time:", e);
        return 'N/A'; 
    }
}

/**
 * Lấy giá trị CSRF token từ cookie
 * @param {string} name Tên của cookie (thường là 'csrftoken')
 * @returns {string | null} Giá trị token hoặc null nếu không tìm thấy
 */
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


// --- Chạy code sau khi DOM tải xong ---
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Lấy các phần tử DOM cần thiết
    const displayInput = document.getElementById('bid-amount-display');
    const hiddenInput = document.getElementById('bid-amount-input');
    const totalValueSpan = document.getElementById('total-bid-value'); 
    const bidForm = document.getElementById('place-bid-form'); 
    const bidMessage = document.getElementById('bid-form-message'); 
    const bidTableBody = document.querySelector('.bid-list table tbody'); 
    const currentPriceStrong = document.querySelector('.bidding-history strong'); 
    const placeBidButton = document.querySelector('.btn-submit-bid'); 
    const copyrightYearSpan = document.getElementById('copyright-year');
    
    // 2. Cập nhật năm bản quyền
    if (copyrightYearSpan) {
        copyrightYearSpan.textContent = new Date().getFullYear();
    }

    // 3. Xử lý định dạng input khi nhập và khởi tạo
    if (displayInput && hiddenInput) {
        // Định dạng giá trị ban đầu
         const initialRawValue = unformatNumber(displayInput.value); // Lấy từ value của displayInput (đã được Django render)
         hiddenInput.value = initialRawValue; 
         displayInput.value = formatNumber(initialRawValue); 
         if (totalValueSpan) {
            totalValueSpan.textContent = formatNumber(initialRawValue); 
         }
         
        // Cập nhật khi người dùng nhập
        displayInput.addEventListener('input', function(e) {
            const rawValue = this.value.replace(/\D/g, ''); 
            const numberValue = parseInt(rawValue, 10) || 0;
            hiddenInput.value = numberValue; // Cập nhật input ẩn
            const formattedValue = formatNumber(numberValue);
            
            // Xử lý vị trí con trỏ (có thể cần cải thiện)
            let currentCursorPosition = this.selectionStart;
            const originalLength = this.value.length;
            this.value = formattedValue;
            const newLength = this.value.length;
            if (currentCursorPosition !== null) { // Kiểm tra null trước khi dùng
                 try {
                    currentCursorPosition = currentCursorPosition + (newLength - originalLength);
                    // Đảm bảo con trỏ không vượt quá giới hạn
                    currentCursorPosition = Math.max(0, Math.min(currentCursorPosition, newLength)); 
                    this.selectionStart = this.selectionEnd = currentCursorPosition;
                 } catch(err) { /* Bỏ qua lỗi */ }
            }

            if (totalValueSpan) {
                totalValueSpan.textContent = formattedValue; // Cập nhật tổng giá trị
            }
        });
    }

    // 4. Xử lý khi SUBMIT FORM ĐẶT GIÁ
    if (bidForm && placeBidButton && bidMessage) { // Thêm kiểm tra placeBidButton, bidMessage
        bidForm.addEventListener('submit', function(event) {
            event.preventDefault(); 
            bidMessage.textContent = ''; 
            placeBidButton.disabled = true; 
            placeBidButton.textContent = 'Đang xử lý...'; 

            const itemIdInput = this.querySelector('input[name="item_id"]');
            const userIdInput = this.querySelector('input[name="user_id"]');
            const bidAmountRaw = hiddenInput ? hiddenInput.value : '0'; // Lấy từ input ẩn

            const itemId = itemIdInput ? itemIdInput.value : null;
            const userId = userIdInput ? userIdInput.value : null; // Cần đảm bảo user đã đăng nhập
            const bidAmount = parseFloat(bidAmountRaw) || 0;
            const minBidValue = parseFloat(hiddenInput.min) || 0;
            const csrfToken = getCookie('csrftoken'); // Lấy CSRF Token

            // --- Kiểm tra dữ liệu ---
            if (!itemId || !userId || bidAmount <= 0) {
                bidMessage.textContent = 'Lỗi: Dữ liệu không hợp lệ.';
                placeBidButton.disabled = false; 
                placeBidButton.textContent = 'Đặt giá'; 
                return; 
            }
             if (!userId) { // Kiểm tra User ID rõ ràng hơn
                 bidMessage.textContent = 'Lỗi: Bạn cần đăng nhập để đặt giá.';
                 placeBidButton.disabled = false; 
                 placeBidButton.textContent = 'Đặt giá';
                 return;
            }
             if (bidAmount < minBidValue) {
                 bidMessage.textContent = `Lỗi: Giá đặt phải tối thiểu là ${formatNumber(minBidValue)} VNĐ.`;
                 placeBidButton.disabled = false; 
                 placeBidButton.textContent = 'Đặt giá';
                 return;
            }
            if (!csrfToken) {
                 bidMessage.textContent = 'Lỗi: Thiếu CSRF token. Vui lòng tải lại trang.';
                 placeBidButton.disabled = false; 
                 placeBidButton.textContent = 'Đặt giá';
                 return;
            }
            // --- Kết thúc kiểm tra ---


            console.log('Submitting bid:', { item_id: itemId, user_id: userId, bid_amount: bidAmount });

            fetch('/api/bidding/place_bid/', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken, 
                },
                body: JSON.stringify({
                    item_id: parseInt(itemId), 
                    user_id: parseInt(userId), 
                    bid_amount: bidAmount 
                })
            })
            .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data }))) 
            .then(({ ok, status, data }) => {
                if (ok) { 
                    console.log('Bid placed successfully:', data);
                    bidMessage.style.color = 'green';
                    // API cần trả về bid_amount, user_id_email (hoặc chỉ user_id), bid_time
                    bidMessage.textContent = `Đặt giá ${formatNumber(data.bid_amount)} thành công!`; 

                    // Cập nhật bảng lịch sử
                    if (bidTableBody) {
                        const newRow = bidTableBody.insertRow(0); 
                        // Giả sử API trả về data.user_email và data.bid_time_formatted
                        // Nếu không, cần lấy email từ nơi khác hoặc format thời gian
                        const userEmail = data.user_email || (userId === '{{ request.user.id }}' ? 'Bạn' : `User ${userId}`); // Cần cách lấy email tốt hơn
                        const bidTimeFormatted = formatBidTime(data.bid_time); // Format thời gian trả về
                        
                        newRow.innerHTML = `
                            <td>${formatNumber(data.bid_amount)} VNĐ</td>
                            <td>${userEmail}</td> 
                            <td>${bidTimeFormatted}</td>
                        `;
                        // Xóa thông báo "Chưa có lượt đặt giá nào" nếu có
                         const noBidRow = bidTableBody.querySelector('.no-bids-row'); // Nên thêm class cho dễ chọn
                         if (noBidRow) noBidRow.remove();
                         else { // Hoặc nếu chỉ là thẻ p
                             const noBidMessageP = bidTableBody.closest('.bid-list').querySelector('p');
                             if (noBidMessageP && noBidMessageP.textContent.includes('Chưa có lượt đặt giá nào')) noBidMessageP.remove();
                         }
                    }

                    // Cập nhật giá hiện tại
                    if (currentPriceStrong) {
                         currentPriceStrong.textContent = `${formatNumber(data.bid_amount)} VNĐ`;
                    }
                    
                    // Cập nhật input cho lần đặt tiếp theo
                    const minBidIncrement = 10000; // Nên lấy từ cấu hình
                    const newMinBidValue = parseFloat(data.bid_amount) + minBidIncrement; 
                    
                    hiddenInput.min = newMinBidValue; 
                    hiddenInput.value = ''; // Xóa giá trị ẩn
                    displayInput.value = ''; // Xóa giá trị hiển thị
                    displayInput.placeholder = formatNumber(newMinBidValue); // Đặt placeholder là giá min mới
                    
                    // Cập nhật label
                     const labelElement = document.querySelector('label[for="bid-amount-display"]');
                     if(labelElement) {
                         labelElement.textContent = `Giá đặt của bạn (Tối thiểu: ${formatNumber(newMinBidValue)} VNĐ):`;
                     }

                    if (totalValueSpan) totalValueSpan.textContent = '0'; // Reset tổng

                } else { 
                    console.error(`API Error (Status ${status}):`, data);
                    bidMessage.style.color = 'red';
                    bidMessage.textContent = `Lỗi: ${data.error || data.detail || `Không thể đặt giá (Lỗi ${status})`}`;
                }
            })
            .catch(error => {
                console.error('Fetch Error:', error);
                bidMessage.style.color = 'red';
                bidMessage.textContent = 'Lỗi kết nối hoặc xử lý. Vui lòng thử lại.';
            })
            .finally(() => {
                 placeBidButton.disabled = false; 
                 placeBidButton.textContent = 'Đặt giá'; 
            });
        });
    }

}); // Kết thúc DOMContentLoaded