document.addEventListener("DOMContentLoaded", function () {
    function addClickEvent(id, url) {
        let button = document.getElementById(id);
        if (button) {
            button.addEventListener("click", function () {
                window.location.href = url;
            });
        }
    }

    addClickEvent("btn_home_page", "/");
    addClickEvent("btn_description", "/categories/");
    addClickEvent("btn_ending", "/ending-soon/");
    addClickEvent("btn_search", "/search/");
    addClickEvent("login-btn", "/login-page/");
    addClickEvent("register-btn", "/register-page/");
});

document.addEventListener('DOMContentLoaded', () => {
    const itemListContainer = document.getElementById('item-list-container');
    const loadingMessage = document.getElementById('loading-message');
    const copyrightYearSpan = document.getElementById('copyright-year');

    // Cập nhật năm hiện tại trong footer
    if (copyrightYearSpan) {
        copyrightYearSpan.textContent = new Date().getFullYear();
    }

    // --- Gọi API để lấy danh sách Items ---
    const apiUrl = '/api/items/'; // Đây là URL của ItemList API ông đã tạo

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                // Ném lỗi nếu response không thành công (VD: 4xx, 5xx)
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json(); // Chuyển response thành JSON
        })
        .then(items => {
            // Xóa thông báo "Đang tải..."
            if (loadingMessage) {
                loadingMessage.remove();
            }

            // Kiểm tra xem có item nào không
            if (items && items.length > 0) {
                // Lặp qua từng item trong danh sách JSON trả về
                items.forEach(item => {
                    // Tạo thẻ article.item-card
                    const article = document.createElement('article');
                    article.classList.add('item-card');

                    // Tạo ảnh (kiểm tra image_url hoặc dùng placeholder)
                    const img = document.createElement('img');
                    // Giả sử API trả về 'image_url'. Nếu là ImageField thì có thể là item.image
                    img.src = item.image_url || 'images/placeholder.png'; // Dùng ảnh placeholder nếu ko có ảnh
                    img.alt = item.name;

                    // Tạo tên sản phẩm (h3 và link a)
                    const heading = document.createElement('h3');
                    const link = document.createElement('a');
                    // Chú ý: Dùng item.item_id hay item.id tùy thuộc vào JSON trả về từ serializer
                    link.href = `/item/${item.item_id}/`; // Link đến trang chi tiết (trang này cũng cần làm bằng JS hoặc cách khác)
                    link.textContent = item.name;
                    heading.appendChild(link);

                    // Tạo giá hiện tại
                    const pricePara = document.createElement('p');
                    pricePara.classList.add('price');
                    // Giả sử API trả về 'current_price'
                    pricePara.textContent = `Giá hiện tại: ${formatPrice(item.current_price)} VNĐ`; // Có thể cần hàm format tiền tệ

                    // Tạo thời gian kết thúc (hiển thị đơn giản)
                    const timePara = document.createElement('p');
                    timePara.classList.add('time');
                    // Giả sử API trả về 'end_time'
                    timePara.textContent = `Kết thúc: ${formatDateTime(item.end_time)}`; // Cần hàm format ngày giờ

                    // Tạo nút xem chi tiết
                    const detailButton = document.createElement('a');
                    detailButton.classList.add('btn');
                    detailButton.href = `/item/${item.item_id}/`; // Link giống tên sản phẩm
                    detailButton.textContent = 'Xem Chi Tiết';

                    // Gắn các element con vào article
                    article.appendChild(img);
                    article.appendChild(heading);
                    article.appendChild(pricePara);
                    article.appendChild(timePara);
                    article.appendChild(detailButton);

                    // Gắn article vào container
                    itemListContainer.appendChild(article);
                });
            } else {
                // Hiển thị thông báo nếu không có item nào
                const noItemsPara = document.createElement('p');
                noItemsPara.textContent = 'Hiện tại không có phiên đấu giá nào đang diễn ra.';
                itemListContainer.appendChild(noItemsPara);
            }
        })
        .catch(error => {
            // Xử lý lỗi nếu gọi API thất bại
            console.error('Lỗi khi tải dữ liệu sản phẩm:', error);
            if (loadingMessage) {
                loadingMessage.textContent = 'Không thể tải dữ liệu. Vui lòng thử lại sau.';
                loadingMessage.style.color = 'red';
            } else {
                 const errorPara = document.createElement('p');
                 errorPara.textContent = 'Không thể tải dữ liệu. Vui lòng thử lại sau.';
                 errorPara.style.color = 'red';
                 itemListContainer.appendChild(errorPara);
            }
        });

    // --- Các hàm phụ trợ (ví dụ) ---
    function formatPrice(priceString) {
        // Hàm đơn giản để format giá, ông có thể làm phức tạp hơn
        try {
            const price = parseFloat(priceString);
            return price.toLocaleString('vi-VN'); // Format theo kiểu Việt Nam
        } catch (e) {
            return priceString; // Trả về chuỗi gốc nếu không format được
        }
    }

    function formatDateTime(dateTimeString) {
         // Hàm đơn giản để format ngày giờ, ông có thể làm phức tạp hơn
        try {
            const date = new Date(dateTimeString);
             const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            return date.toLocaleString('vi-VN', options); // Format theo kiểu Việt Nam
        } catch (e) {
            return dateTimeString; // Trả về chuỗi gốc nếu không format được
        }
    }

}); // End DOMContentLoaded