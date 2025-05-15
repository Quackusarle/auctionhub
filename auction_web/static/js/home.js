// static/js/home.js
// File JavaScript dành riêng cho trang chủ (home.html).
// Phiên bản: 2025-05-14 (Không chứa Auth logic)

/**
 * Định dạng một chuỗi/số thành chuỗi tiền tệ.
 */
function formatPrice(priceString, options = {}) {
    const defaultOptions = { currencySymbol: 'VNĐ ', minimumFractionDigits: 0, maximumFractionDigits: 0 };
    const effectiveOptions = { ...defaultOptions, ...options };
    try {
        const cleanedString = String(priceString).replace(/,/g, '');
        const price = parseFloat(cleanedString);
        if (isNaN(price)) return priceString ? `${effectiveOptions.currencySymbol}${priceString}` : `${effectiveOptions.currencySymbol}0`;
        return `${effectiveOptions.currencySymbol}${price.toLocaleString('vi-VN', {
            minimumFractionDigits: effectiveOptions.minimumFractionDigits,
            maximumFractionDigits: effectiveOptions.maximumFractionDigits
        })}`;
    } catch (e) { return priceString ? `${effectiveOptions.currencySymbol}${priceString}` : `${effectiveOptions.currencySymbol}0`; }
}

document.addEventListener("DOMContentLoaded", function () {
    const gridContainer = document.getElementById('item-grid-container');
    const itemsApiUrl = '/api/items/'; // **QUAN TRỌNG: ĐẢM BẢO API NÀY TỒN TẠI VÀ TRẢ VỀ DỮ LIỆU ĐÚNG**

    if (gridContainer) {
        const loadingMessageElement = document.getElementById('loading-items-message');

        const displayMessageInGrid = (message, type = 'info') => {
            if (loadingMessageElement && loadingMessageElement.parentNode === gridContainer) {
                 loadingMessageElement.remove();
            }
            // Thêm class cho message để CSS có thể style
            gridContainer.innerHTML = `<p class="grid-message ${type}-message" style="grid-column: 1 / -1;">${message}</p>`;
        };

        fetch(itemsApiUrl)
            .then(response => {
                if (!response.ok) { // Lỗi 404 cho API này sẽ bị bắt ở đây
                    throw new Error(`HTTP error fetching items! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(apiResponse => {
                const items = Array.isArray(apiResponse) ? apiResponse : (apiResponse && Array.isArray(apiResponse.items) ? apiResponse.items : []);

                if (items.length === 0) {
                    displayMessageInGrid('Hiện chưa có sản phẩm nổi bật nào để hiển thị.', 'empty');
                    return;
                }
                if (loadingMessageElement && loadingMessageElement.parentNode === gridContainer) {
                     loadingMessageElement.remove();
                }
                gridContainer.innerHTML = '';

                const itemsToDisplay = items.slice(0, 9);

                itemsToDisplay.forEach(item => {
                    if (!item || typeof item.current_price === 'undefined' || !item.name) {
                        // console.warn("Home.js: Skipping invalid item data:", item);
                        return;
                    }
                    const itemId = item.item_id || item.id || item.pk;
                    const itemUrl = itemId ? `/items/${itemId}/` : '#';
                    // **QUAN TRỌNG: ĐẢM BẢO ẢNH NÀY TỒN TẠI HOẶC THAY BẰNG ẢNH CỦA BẠN**
                    const defaultImage = '/static/images/placeholder_item_320x230.png';

                    const linkWrapper = document.createElement('a');
                    linkWrapper.href = itemUrl;
                    linkWrapper.classList.add('item-card-link');
                    linkWrapper.setAttribute('aria-label', `Xem chi tiết ${item.name}`);

                    const article = document.createElement('article');
                    article.classList.add('item-card');

                    const imageWrapper = document.createElement('div');
                    imageWrapper.classList.add('item-image-wrapper');
                    const img = document.createElement('img');
                    img.src = item.image_url || defaultImage;
                    img.alt = item.name;
                    img.loading = 'lazy';
                    imageWrapper.appendChild(img);

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('card-content');
                    const heading = document.createElement('h3');
                    heading.textContent = item.name;
                    const pricePara = document.createElement('span');
                    pricePara.classList.add('price');
                    pricePara.textContent = formatPrice(item.current_price);

                    cardContent.appendChild(heading);
                    cardContent.appendChild(pricePara);
                    article.appendChild(imageWrapper);
                    article.appendChild(cardContent);
                    linkWrapper.appendChild(article);
                    gridContainer.appendChild(linkWrapper);
                });
                 if (gridContainer.innerHTML === '') {
                    displayMessageInGrid('Không có sản phẩm nào phù hợp để hiển thị.', 'empty');
                }
            })
            .catch(error => {
                console.error('Home.js: Error fetching or processing featured items:', error);
                displayMessageInGrid('Oops! Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại sau.', 'error');
            });
    }
    // console.log("Home.js (No Auth Logic) initialized successfully.");
});