function formatPrice(priceInput, options = {}) {
    const defaultOptions = {
        currencySymbol: 'VNĐ',
        symbolPosition: 'after',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    };
    const effectiveOptions = { ...defaultOptions, ...options };

    try {
        const cleaned = String(priceInput).replace(/[^0-9.-]+/g, '').replace(/,/g, '');
        const price = parseFloat(cleaned);
        const formatted = price.toLocaleString('vi-VN', {
            minimumFractionDigits: effectiveOptions.minimumFractionDigits,
            maximumFractionDigits: effectiveOptions.maximumFractionDigits,
        });
        return effectiveOptions.symbolPosition === 'after'
            ? `${formatted} ${effectiveOptions.currencySymbol}`
            : `${effectiveOptions.currencySymbol} ${formatted}`;
    } catch {
        return `0 ${effectiveOptions.currencySymbol}`;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const gridContainer = document.getElementById('item-grid-container');
    const ITEMS_API_URL = '/api/items/?page_size=9&sort=newest';
    const DEFAULT_IMAGE_URL = '/static/images/placeholder_item_400x300.png';

    function createItemCardHTML(item) {
        const itemId = item.id || item.item_id;
        let imageUrl = item.image_url || DEFAULT_IMAGE_URL;
        // Apply Cloudinary transformations if image_url is a Cloudinary URL
        if (imageUrl.startsWith('https://res.cloudinary.com')) {
            imageUrl = imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_400/');
        }
        const itemDetailUrl = `/items/${itemId}/`;
        const price = formatPrice(item.current_price);
        const endTime = item.end_time ? new Date(item.end_time).toLocaleString('vi-VN') : '';
        return `
            <a href="${itemDetailUrl}" class="product-card-link-wrapper text-decoration-none" data-item-id="${itemId}">
                <article class="product-card h-100">
                    <div class="product-image-link">
                        <img src="${imageUrl}" class="card-img-top" alt="${item.name}" 
                             loading="lazy" onerror="this.src='${DEFAULT_IMAGE_URL}'">
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${item.name}</h5>
                        <div class="item-price-info mt-auto">
                            <p class="price">${price}</p>
                            <p class="time-remaining">${endTime}</p>
                            <span class="btn btn-view-details w-100">Xem chi tiết</span>
                        </div>
                    </div>
                </article>
            </a>
        `;
    }

    function renderInitialItems() {
        gridContainer.innerHTML = '<p class="grid-message loading-message" style="grid-column: 1 / -1;"><i class="fas fa-spinner fa-spin"></i> Đang tải danh sách sản phẩm...</p>';
        fetch(ITEMS_API_URL)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                gridContainer.innerHTML = '';
                const items = data.results || [];
                if (items.length === 0) {
                    gridContainer.innerHTML = '<p class="grid-message" style="grid-column: 1 / -1;">Không có sản phẩm nào.</p>';
                    return;
                }
                items.forEach(item => {
                    gridContainer.innerHTML += createItemCardHTML(item);
                });
            })
            .catch(err => {
                console.error('Lỗi khi tải danh sách item:', err);
                gridContainer.innerHTML = '<p class="grid-message" style="grid-column: 1 / -1;">Lỗi khi tải sản phẩm. Vui lòng thử lại sau.</p>';
            });
    }

    function setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${window.location.host}/ws/home/`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = function (e) {
            const data = JSON.parse(e.data);
            if (data.type === 'bid_update' && data.item_details) {
                const item = data.item_details;
                const itemId = item.item_id;
                const itemCard = document.querySelector(`[data-item-id="${itemId}"]`);
                if (itemCard) {
                    const priceElement = itemCard.querySelector('.price');
                    if (priceElement) {
                        priceElement.textContent = formatPrice(item.current_price);
                    }
                }
            }
        };

        socket.onerror = function (e) {
            console.error('WebSocket Error on home page:', e);
        };
    }

    renderInitialItems();
    setupWebSocket();
});