// static/js/home.js
// JavaScript for the homepage (home.html) to display featured auction items.
// Version: 2024-05-24 (Rewritten for clarity, template literals, and robust handling)

/**
 * Formats a price string or number into Vietnamese Dong (VNĐ) currency format.
 * @param {string|number} priceInput - The price value to format.
 * @param {object} [options={}] - Formatting options.
 * @param {string} [options.currencySymbol='VNĐ'] - Currency symbol.
 * @param {string} [options.symbolPosition='after'] - Position of the symbol ('before' or 'after').
 * @param {number} [options.minimumFractionDigits=0] - Minimum decimal places.
 * @param {number} [options.maximumFractionDigits=0] - Maximum decimal places.
 * @returns {string} Formatted currency string or a default if input is invalid.
 */
function formatPrice(priceInput, options = {}) {
    const defaultOptions = {
        currencySymbol: 'VNĐ',
        symbolPosition: 'after',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    };
    const effectiveOptions = { ...defaultOptions, ...options };

    if (priceInput === null || priceInput === undefined || String(priceInput).trim() === '') {
        const zeroFormatted = (0).toLocaleString('vi-VN', {
            minimumFractionDigits: effectiveOptions.minimumFractionDigits,
            maximumFractionDigits: effectiveOptions.maximumFractionDigits,
        });
        return effectiveOptions.symbolPosition === 'after'
            ? `${zeroFormatted} ${effectiveOptions.currencySymbol}`
            : `${effectiveOptions.currencySymbol} ${zeroFormatted}`;
    }

    try {
        const cleanedString = String(priceInput).replace(/[^0-9.-]+/g, '').replace(/,/g, '');
        const price = parseFloat(cleanedString);

        if (isNaN(price)) {
            const seemsNumeric = String(priceInput).match(/\d/);
            return seemsNumeric 
                ? (effectiveOptions.symbolPosition === 'after' ? `${priceInput} ${effectiveOptions.currencySymbol}` : `${effectiveOptions.currencySymbol} ${priceInput}`) 
                : `0 ${effectiveOptions.currencySymbol}`;
        }

        const formattedPrice = price.toLocaleString('vi-VN', {
            minimumFractionDigits: effectiveOptions.minimumFractionDigits,
            maximumFractionDigits: effectiveOptions.maximumFractionDigits,
        });

        return effectiveOptions.symbolPosition === 'after'
            ? `${formattedPrice} ${effectiveOptions.currencySymbol}`
            : `${effectiveOptions.currencySymbol} ${formattedPrice}`;
    } catch (e) {
        console.warn("home.js - formatPrice error:", e);
        return String(priceInput || '0') + (effectiveOptions.symbolPosition === 'after' ? ` ${effectiveOptions.currencySymbol}` : '');
    }
}

document.addEventListener("DOMContentLoaded", function () {
    console.log("Home.js: DOMContentLoaded - Initializing featured items display.");

    const gridContainer = document.getElementById('item-grid-container');
    const initialLoadingMessageElement = document.getElementById('loading-items-message'); // From home.html

    const ITEMS_API_URL = '/api/items/?page_size=9&sort=newest'; // Fetch 9 newest items for homepage
    const DEFAULT_IMAGE_URL = '/static/images/placeholder_item_400x300.png'; // Ensure this placeholder exists

    if (!gridContainer) {
        console.error("Home.js: Critical error - #item-grid-container not found in the DOM.");
        if(initialLoadingMessageElement) initialLoadingMessageElement.textContent = "Lỗi hiển thị sản phẩm.";
        return;
    }

    /**
     * Displays a message (loading, error, empty) within the grid container.
     * @param {string} htmlContent - The HTML content for the message.
     * @param {boolean} isGridMessage - If true, wraps content in a p.grid-message
     */
    function displayGridMessage(htmlContent, isGridMessage = true) {
        if (initialLoadingMessageElement && initialLoadingMessageElement.parentNode === gridContainer) {
            initialLoadingMessageElement.remove();
        }
        if (isGridMessage) {
            // This structure ensures the message spans the full grid width as defined in home.css for .grid-message parent
             gridContainer.innerHTML = `<div style="grid-column: 1 / -1;"><p class="grid-message text-center p-3">${htmlContent}</p></div>`;
        } else {
            // For direct HTML like spinner
            gridContainer.innerHTML = `<div style="grid-column: 1 / -1;" class="text-center p-3">${htmlContent}</div>`;
        }
    }
    
    /**
     * Creates HTML string for a single product card.
     * Uses classes from base.css for styling.
     * @param {object} item - The item data from the API.
     * @returns {string} HTML string for the product card.
     */
    function createItemCardHTML(item) {
        if (!item || typeof item.current_price === 'undefined' || !item.name) {
            console.warn("Home.js: Skipping item due to invalid data:", item);
            return ''; // Return empty string for invalid items
        }

        const itemId = item.id || item.item_id; // Prefer 'id' if available
        const itemDetailUrl = item.absolute_url || (itemId ? `/items/${itemId}/` : '#');
        const imageUrl = item.image_url || DEFAULT_IMAGE_URL;
        
        // Short description or a placeholder if full description is too long for home.
        // For homepage, we might not need a description, or a very short one.
        // Let's omit description for now to keep cards cleaner on home, like the screenshot.
        // const descriptionSnippet = item.short_description || (item.description && item.description.length > 60 ? item.description.substring(0, 57) + "..." : item.description) || "";

        const viewDetailsText = window.viewDetailsTextHome || 'Xem chi tiết'; // Allow localization

        let timeRemainingHTML = '';
        if (item.end_time_formatted) { // Assuming API might provide this
            timeRemainingHTML = `<p class="time-remaining mb-2"><i class="fas fa-clock"></i> ${item.end_time_formatted}</p>`;
        } else if (item.end_time) {
            try {
                 // Basic formatting, could be enhanced with a countdown library if needed
                timeRemainingHTML = `<p class="time-remaining mb-2"><i class="fas fa-clock"></i> ${new Date(item.end_time).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour:'2-digit', minute: '2-digit'})}</p>`;
            } catch(e) { console.warn("Home.js: Could not format end_time", item.end_time); }
        }
        
        // Card structure based on base.css .product-card
        return `
            <a href="${itemDetailUrl}" class="product-card-link-wrapper text-decoration-none">
                <article class="product-card h-100">
                    <div class="product-image-link">
                        <img src="${imageUrl}" class="card-img-top" alt="${item.name || 'Sản phẩm đấu giá'}" loading="lazy">
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">
                           ${item.name || 'Chưa có tên'}
                        </h5>
                        
                        ${''/* descriptionSnippet ? `<p class="item-description mb-2">${descriptionSnippet}</p>` : '<p class="item-description mb-2">&nbsp;</p>' */}

                        <div class="item-price-info mt-auto">
                            <p class="price">${formatPrice(item.current_price)}</p>
                            ${timeRemainingHTML}
                            <span class="btn btn-view-details w-100">${viewDetailsText}</span>
                        </div>
                    </div>
                </article>
            </a>
        `;
    }

    // --- Main Fetch and Render Logic ---
    console.log(`Home.js: Fetching featured items from ${ITEMS_API_URL}`);
    const spinnerHtml = `
        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
            <span class="visually-hidden">Đang tải...</span>
        </div>
        <p class="mt-2 text-muted">Đang tải sản phẩm nổi bật...</p>`;
    displayGridMessage(spinnerHtml, false); // Display spinner directly

    fetch(ITEMS_API_URL)
        .then(response => {
            console.log("Home.js: API response received. Status:", response.status);
            if (!response.ok) {
                return response.json().then(errData => {
                    console.error('Home.js: API Error Data:', errData);
                    throw new Error(errData.detail || errData.error || `Lỗi ${response.status} khi tải sản phẩm.`);
                }).catch(() => {
                    throw new Error(`Lỗi HTTP ${response.status} khi tải sản phẩm. Máy chủ không cung cấp chi tiết lỗi.`);
                });
            }
            return response.json();
        })
        .then(apiResponse => {
            console.log("Home.js: API data successfully parsed:", apiResponse);
            const items = apiResponse?.results; // DRF paginated response

            if (!items || !Array.isArray(items) || items.length === 0) {
                console.log("Home.js: No featured items found or invalid data structure.");
                displayGridMessage('Hiện chưa có sản phẩm nổi bật nào.', true);
                return;
            }

            gridContainer.innerHTML = ''; // Clear spinner/loading message
            let cardsHtml = '';
            items.forEach(item => {
                cardsHtml += createItemCardHTML(item);
            });

            if (cardsHtml.trim() === '') {
                 console.log("Home.js: All items were invalid, no cards generated.");
                displayGridMessage('Không có sản phẩm nào phù hợp để hiển thị.', true);
            } else {
                gridContainer.innerHTML = cardsHtml;
                console.log(`Home.js: Successfully rendered ${items.length} item cards.`);
            }
        })
        .catch(error => {
            console.error('Home.js: Fatal error fetching or processing featured items:', error);
            displayGridMessage(`Lỗi: ${error.message || 'Không thể tải sản phẩm nổi bật. Vui lòng thử lại sau.'}`, true);
        });

    console.log("Home.js: Initialization complete. Waiting for fetch to resolve.");
});