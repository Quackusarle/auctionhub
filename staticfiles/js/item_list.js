document.addEventListener('DOMContentLoaded', function () {
    console.log('item_list.js: DOMContentLoaded');

    const itemListContainer = document.getElementById('itemListContainer');
    const paginationContainer = document.getElementById('paginationContainer');
    const searchInput = document.getElementById('searchInput');
    // const categorySelect = document.getElementById('categorySelect'); // Đã xóa
    const sortSelect = document.getElementById('sortSelect');
    // const applyFiltersBtn = document.getElementById('applyFiltersBtn'); // Có thể không cần nếu search/sort tự động
    const itemListSpinner = document.getElementById('itemListSpinner');
    const itemListError = document.getElementById('itemListError');
    const noItemsMessage = document.getElementById('noItemsMessage');

    if (!itemListContainer) {
        console.error('item_list.js: itemListContainer not found!');
        return;
    }
    if (!paginationContainer) {
        console.warn('item_list.js: paginationContainer not found.');
    }

    let currentPage = 1;
    const API_BASE_URL = '/api/items/';
    const DEFAULT_PAGE_SIZE = /* Lấy từ settings của Django nếu có, ví dụ 12 hoặc 16 */ 12; // Cập nhật page size cho phù hợp với layout (ví dụ 4 cột thì 12, 16, 20)

    console.log('item_list.js: Initializing with API_BASE_URL:', API_BASE_URL);

    function showSpinner() {
        if (itemListSpinner) itemListSpinner.style.display = 'flex'; // Thay 'block' bằng 'flex' nếu spinner được căn giữa bằng flex
        if (itemListContainer) itemListContainer.innerHTML = '';
        if (paginationContainer) paginationContainer.innerHTML = '';
        if (itemListError) itemListError.style.display = 'none';
        if (noItemsMessage) noItemsMessage.style.display = 'none';
        console.log('item_list.js: showSpinner()');
    }

    function hideSpinner() {
        if (itemListSpinner) itemListSpinner.style.display = 'none';
        console.log('item_list.js: hideSpinner()');
    }

    function showError(message) {
        hideSpinner();
        if (itemListError) {
            // Giữ lại nội dung HTML gốc từ template, chỉ thay đổi phần message nếu cần
            const pElement = itemListError.querySelector('p');
            if (pElement) {
                pElement.textContent = message || 'Oops! Something went wrong. Please try again.';
            } else {
                itemListError.textContent = message || 'Oops! Something went wrong. Please try again.';
            }
            itemListError.style.display = 'block'; // Hoặc 'flex' nếu alert được căn giữa bằng flex
        }
        console.error('item_list.js: showError() - ', message);
    }

    function showNoItemsMessage() {
        hideSpinner();
        if (noItemsMessage) noItemsMessage.style.display = 'block'; // Hoặc 'flex'
        console.log('item_list.js: showNoItemsMessage()');
    }

    // Hàm formatPrice đã được cung cấp trong gợi ý trước, đảm bảo nó có trong scope này
    // Hoặc dùng phiên bản này nếu API trả về số
    function formatPrice(priceString, options = {}) {
        const defaultOptions = { currencySymbol: 'VNĐ', minimumFractionDigits: 0, maximumFractionDigits: 0, symbolPosition: 'after' }; // Thêm symbolPosition
        const effectiveOptions = { ...defaultOptions, ...options };
        try {
            const cleanedString = String(priceString).replace(/,/g, '');
            const price = parseFloat(cleanedString);
            if (isNaN(price)) {
                return priceString ? `${priceString}${effectiveOptions.symbolPosition === 'after' ? ' ' + effectiveOptions.currencySymbol : effectiveOptions.currencySymbol + ' '}` : `0${effectiveOptions.symbolPosition === 'after' ? ' ' + effectiveOptions.currencySymbol : effectiveOptions.currencySymbol + ' '}`;
            }
            const formattedPrice = price.toLocaleString('vi-VN', {
                minimumFractionDigits: effectiveOptions.minimumFractionDigits,
                maximumFractionDigits: effectiveOptions.maximumFractionDigits
            });
            return effectiveOptions.symbolPosition === 'after' ? `${formattedPrice} ${effectiveOptions.currencySymbol}` : `${effectiveOptions.currencySymbol} ${formattedPrice}`;
        } catch (e) {
            return priceString ? `${priceString}${effectiveOptions.symbolPosition === 'after' ? ' ' + effectiveOptions.currencySymbol : effectiveOptions.currencySymbol + ' '}` : `0${effectiveOptions.symbolPosition === 'after' ? ' ' + effectiveOptions.currencySymbol : effectiveOptions.currencySymbol + ' '}`;
        }
    }


    function fetchItems() {
        console.log(`item_list.js: fetchItems() called. Page: ${currentPage}`);
        showSpinner();
        const searchTerm = searchInput ? searchInput.value : '';
        // const category = categorySelect ? categorySelect.value : ''; // Đã xóa
        const sortBy = sortSelect ? sortSelect.value : 'newest';

        const params = new URLSearchParams({
            page: currentPage,
            page_size: DEFAULT_PAGE_SIZE, // Thêm page_size vào params
            search: searchTerm,
            // category: category, // Đã xóa
            sort: sortBy,
        });

        // Loại bỏ các params rỗng
        if (!searchTerm) params.delete('search');
        // if (!category) params.delete('category'); // Đã xóa

        const fullUrl = `${API_BASE_URL}?${params.toString()}`;
        console.log('item_list.js: Fetching from URL:', fullUrl);

        fetch(fullUrl)
            .then(response => {
                console.log('item_list.js: Fetch response received', response);
                if (!response.ok) {
                    return response.json().then(errData => {
                        console.error('item_list.js: API Error Data:', errData);
                        throw new Error(errData.detail || errData.error || `HTTP error! status: ${response.status}`);
                    }).catch(() => {
                        throw new Error(`HTTP error! status: ${response.status} - No error details from API.`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('item_list.js: Data received from API:', data);
                hideSpinner();
                if (data && data.results && Array.isArray(data.results)) {
                    if (data.results.length > 0) {
                        if(itemListContainer) itemListContainer.style.display = 'flex'; // Vì parent là row, row-cols
                        renderItems(data.results);
                        renderPagination(data.count, DEFAULT_PAGE_SIZE);
                    } else {
                        if(itemListContainer) itemListContainer.style.display = 'none';
                        showNoItemsMessage();
                    }
                } else {
                    console.error('item_list.js: Invalid data structure received from API:', data);
                    if(itemListContainer) itemListContainer.style.display = 'none';
                    showError('Received invalid data from server.');
                }
            })
            .catch(error => {
                console.error('item_list.js: Error fetching items:', error);
                if(itemListContainer) itemListContainer.style.display = 'none';
                showError(error.message);
            });
    }

    function renderItems(items) {
        if (!itemListContainer) return;
        console.log('item_list.js: renderItems() with', items.length, 'items.');
        itemListContainer.innerHTML = ''; 
        
        const viewDetailsText = window.viewDetailsText || 'View Details'; // Text for the button

        items.forEach(item => {
            const itemDetailUrl = item.absolute_url || `/items/${item.id || item.item_id}/`;
            const imageUrl = item.image_url || '/static/images/placeholder_item_400x300.png';
            
            let descriptionSnippet = 'No description available.';
            if (item.description && item.description.trim() !== "") {
                descriptionSnippet = item.description.length > 80 ? item.description.substring(0, 77) + "..." : item.description;
            } else if (item.short_description) {
                descriptionSnippet = item.short_description;
            }

            let timeRemainingHTML = '';
            if (item.end_time_formatted) {
                timeRemainingHTML = `<p class="time-remaining"><i class="fas fa-clock"></i> ${item.end_time_formatted}</p>`;
            } else if (item.end_time) {
                try {
                    timeRemainingHTML = `<p class="time-remaining"><i class="fas fa-clock"></i> Ends: ${new Date(item.end_time).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>`;
                } catch (e) { console.warn("Could not format end_time", item.end_time); }
            }
            
            // Standardized Card HTML Structure (matches home.js conceptually)
            // The outer 'col' div will be added if itemListContainer is a Bootstrap row.
            // For now, let's assume itemListContainer is a flex/grid container that handles item sizing.
            const itemCardHTML = `
                <div class="col d-flex align-items-stretch product-card-column">
                    <a href="${itemDetailUrl}" class="product-card-link-wrapper text-decoration-none w-100">
                        <article class="product-card h-100">
                            <div class="product-image-link">
                                <img src="${imageUrl}" class="card-img-top" alt="${item.name || 'Item'}" loading="lazy">
                            </div>
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title">
                                   ${item.name || 'Unnamed Item'}
                                </h5>
                                ${descriptionSnippet !== 'No description available.' ? `<p class="item-description mb-2">${descriptionSnippet}</p>` : '<p class="item-description mb-2">&nbsp;</p>'}
                                <div class="item-price-info mt-auto">
                                    <p class="price">${formatPrice(item.current_price)}</p>
                                    ${timeRemainingHTML}
                                    <span class="btn btn-view-details w-100">${viewDetailsText}</span>
                                </div>
                            </div>
                        </article>
                    </a>
                </div>
            `;
            itemListContainer.insertAdjacentHTML('beforeend', itemCardHTML);
        });
    }

    function renderPagination(totalItems, pageSize) {
        if (!paginationContainer) return;
        paginationContainer.innerHTML = ''; // Xóa pagination cũ

        if (!totalItems || totalItems <= pageSize) {
            return; // Không cần pagination nếu không có item hoặc chỉ 1 trang
        }

        const totalPages = Math.ceil(totalItems / pageSize);
        let paginationHTML = '';

        // Nút Previous
        paginationHTML += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                    <span aria-hidden="true">«</span>
                </a>
            </li>`;

        // Logic hiển thị số trang (có thể phức tạp hơn với dấu "...")
        let startPage, endPage;
        if (totalPages <= 5) { // Hiển thị tất cả nếu ít hơn hoặc bằng 5 trang
            startPage = 1;
            endPage = totalPages;
        } else { // Logic phức tạp hơn cho nhiều trang
            if (currentPage <= 3) {
                startPage = 1;
                endPage = 5;
            } else if (currentPage + 2 >= totalPages) {
                startPage = totalPages - 4;
                endPage = totalPages;
            } else {
                startPage = currentPage - 2;
                endPage = currentPage + 2;
            }
        }

        if (startPage > 1) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${currentPage === i ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }

        // Nút Next
        paginationHTML += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                    <span aria-hidden="true">»</span>
                </a>
            </li>`;

        paginationContainer.innerHTML = paginationHTML;

        // Gắn event listeners cho các link pagination
        document.querySelectorAll('#paginationContainer .page-link[data-page]').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page);
                if (page && page !== currentPage && page > 0 && page <= totalPages) {
                    currentPage = page;
                    fetchItems();
                    // Cuộn lên đầu trang hoặc đầu danh sách sản phẩm
                    const filterSortBar = document.querySelector('.filter-sort-bar');
                    if (filterSortBar) {
                        filterSortBar.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            });
        });
    }

    // Debounce function
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // Event Listeners Setup
    // if (applyFiltersBtn) { // Không cần nút này nữa nếu search/sort tự động
    //     applyFiltersBtn.addEventListener('click', () => {
    //         currentPage = 1;
    //         fetchItems();
    //     });
    // }

    if (searchInput) {
        // Dùng 'input' event với debounce để search "live"
        searchInput.addEventListener('input', debounce(function() {
            console.log('item_list.js: Search input changed (debounced).');
            currentPage = 1;
            fetchItems();
        }, 500)); // Delay 500ms

        // Vẫn giữ Enter key press để search ngay lập tức nếu muốn
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                console.log('item_list.js: Search input Enter key pressed.');
                currentPage = 1;
                fetchItems(); // Gọi fetchItems ngay, không qua debounce
            }
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            console.log('item_list.js: Sort select changed.');
            currentPage = 1;
            fetchItems();
        });
    }

    // Bỏ event listener cho categorySelect
    // if (categorySelect) { ... }

    console.log('item_list.js: Triggering initial fetchItems().');
    fetchItems();
});