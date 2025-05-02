    /**
     * Định dạng một chuỗi/số thành chuỗi tiền tệ USD.
     * @param {string|number} priceString - Giá trị cần định dạng.
     * @returns {string} Chuỗi giá đã định dạng (ví dụ: '$1,234') hoặc chuỗi gốc nếu lỗi.
     */
    function formatPrice(priceString) {
        try {
            // Chuyển đổi thành chuỗi và loại bỏ dấu phẩy
            const price = parseFloat(String(priceString).replace(/,/g, ''));

            // Kiểm tra nếu không phải là số hợp lệ
            if (isNaN(price)) {
                throw new Error("Invalid number for price");
            }

            // Định dạng theo kiểu en-US, không có số thập phân
            return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

        } catch (e) {
            console.error("Error formatting price:", priceString, e);
            // Trả về chuỗi gốc có dấu $ nếu có giá trị, hoặc '$0' nếu không
            return priceString ? `$${priceString}` : '$0';
        }
    }

    /**
     * Thiết lập chức năng đóng/mở cho dropdown người dùng.
     */
    function setupDropdownToggle() {
        const container = document.querySelector('.user-dropdown-container');
        if (!container) {
            console.warn("User dropdown container not found.");
            return; // Không tìm thấy container thì thôi
        }

        const triggerBtn = container.querySelector('.user-dropdown-trigger');
        const dropdownMenu = container.querySelector('.user-dropdown-menu');

        if (!triggerBtn || !dropdownMenu) {
            console.error("Dropdown trigger or menu not found inside container.");
            return;
        }

        // Bật/tắt dropdown khi nhấn nút trigger
        triggerBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Ngăn sự kiện click lan ra document ngay lập tức
            const isShown = dropdownMenu.classList.toggle('show');
            triggerBtn.setAttribute('aria-expanded', isShown);
        });

        // Đóng dropdown khi bấm ra ngoài
        document.addEventListener('click', (event) => {
            if (!container.contains(event.target) && dropdownMenu.classList.contains('show')) {
                dropdownMenu.classList.remove('show');
                triggerBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Đóng dropdown khi bấm phím Escape
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && dropdownMenu.classList.contains('show')) {
                dropdownMenu.classList.remove('show');
                triggerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }


    // --- Chạy code sau khi DOM tải xong ---
    document.addEventListener("DOMContentLoaded", function () {

        // == PHẦN 1: Cập nhật năm và Thiết lập Dropdown ==
        const copyrightYearSpan = document.getElementById('copyright-year');
        if (copyrightYearSpan) {
            copyrightYearSpan.textContent = new Date().getFullYear();
        }

        // Gọi hàm thiết lập toggle cho dropdown người dùng
        setupDropdownToggle();


        // == PHẦN 2: Tải và hiển thị sản phẩm lên Grid ==
        const gridContainer = document.getElementById('item-grid-container');
        const itemsApiUrl = '/api/items/'; // URL API để lấy danh sách items

        if (gridContainer) {
            // Hiển thị thông báo đang tải ban đầu
            gridContainer.innerHTML = '<p id="loading-message" style="text-align: center; width: 100%; padding: 20px;">Đang tải danh sách sản phẩm...</p>';
            const loadingMessage = gridContainer.querySelector('#loading-message'); // Lấy lại tham chiếu

            fetch(itemsApiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(items => {
                    if (loadingMessage) loadingMessage.remove(); // Xóa thông báo đang tải
                    gridContainer.innerHTML = ''; // Xóa nội dung hiện tại của grid

                    if (items && Array.isArray(items) && items.length > 0) {
                        // Lọc bỏ item không có giá và sắp xếp giảm dần theo giá
                        const sortedItems = items
                            .filter(item => item && typeof item.current_price !== 'undefined')
                            .sort((a, b) => {
                                const priceA = parseFloat(String(a.current_price || 0).replace(/,/g, ''));
                                const priceB = parseFloat(String(b.current_price || 0).replace(/,/g, ''));
                                // Đảm bảo NaN được xử lý như 0 để không làm hỏng việc sắp xếp
                                return (isNaN(priceB) ? 0 : priceB) - (isNaN(priceA) ? 0 : priceA);
                            });

                        const top9Items = sortedItems.slice(0, 9); // Lấy tối đa 9 item đầu tiên
                        console.log(`Displaying top ${top9Items.length} items in grid.`);

                        if (top9Items.length > 0) {
                            top9Items.forEach(item => {
                                const linkWrapper = document.createElement('a');
                                const itemId = item.item_id || item.id || item.pk; // Lấy ID ưu tiên item_id, id, rồi pk
                                if (itemId) {
                                    linkWrapper.href = `/items/${itemId}/`;
                                } else {
                                    console.warn("Item found without a usable ID:", item);
                                    linkWrapper.href = '#'; // Hoặc không đặt href nếu không có ID
                                }
                                linkWrapper.classList.add('item-card-link');

                                const article = document.createElement('article');
                                article.classList.add('item-card');

                                const img = document.createElement('img');
                                img.src = item.image_url || '/static/images/placeholder.png'; // Ảnh mặc định nếu không có
                                img.alt = item.name || 'Auction Item';
                                img.loading = 'lazy'; // Tải ảnh lười

                                const cardContent = document.createElement('div');
                                cardContent.classList.add('card-content');

                                const heading = document.createElement('h3');
                                heading.textContent = item.name || 'N/A'; // Tên mặc định nếu không có

                                const pricePara = document.createElement('span');
                                pricePara.classList.add('price');
                                pricePara.textContent = formatPrice(item.current_price || 0); // Định dạng giá

                                // Gắn các element con vào nhau
                                cardContent.appendChild(heading);
                                cardContent.appendChild(pricePara);
                                article.appendChild(img);
                                article.appendChild(cardContent);
                                linkWrapper.appendChild(article);
                                gridContainer.appendChild(linkWrapper);
                            });
                        } else {
                            // Trường hợp mảng items có phần tử nhưng sau khi lọc/sort không còn gì phù hợp
                            gridContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Không có sản phẩm nào phù hợp để hiển thị.</p>';
                        }
                    } else {
                        // Trường hợp API trả về mảng rỗng hoặc không phải mảng
                        gridContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 20px;">Hiện chưa có sản phẩm nào được đấu giá.</p>';
                    }
                })
                .catch(error => {
                    console.error('Error fetching or processing items:', error);
                    if (loadingMessage) loadingMessage.remove();
                    // Hiển thị thông báo lỗi thân thiện hơn trên UI
                    gridContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 20px; color: red;">Oops! Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại sau.</p>`;
                });
        } else {
            console.warn("Grid container '#item-grid-container' not found. Skipping item loading.");
        }


        // == PHẦN 3: Kiểm tra trạng thái đăng nhập và cập nhật Header Dropdown ==
        const userActionArea = document.getElementById('user-action-area');
        const profileApiUrl = '/api/profile/get_avatar/'; // URL API lấy avatar/profile

        if (userActionArea) {
            const triggerBtn = userActionArea.querySelector('.user-dropdown-trigger');
            const dropdownMenuUl = userActionArea.querySelector('.user-dropdown-menu ul');

            if (!triggerBtn || !dropdownMenuUl) {
                console.error("User action area is present, but trigger or menu UL is missing.");
                return; // Bỏ qua nếu cấu trúc HTML không đúng
            }

            // Hàm để thiết lập trạng thái mặc định (chưa đăng nhập)
            const setDefaultUserState = () => {
                console.log("Setting default user state (not logged in).");
                const settingsUrl = "#"; // Hoặc URL trang cài đặt chung nếu có
                const loginUrl = "/accounts/login/"; // ** NHỚ THAY URL ĐÚNG **

                triggerBtn.innerHTML = '<i class="fas fa-user header-icon"></i>'; // Icon người dùng mặc định
                dropdownMenuUl.innerHTML = `
                    <li><a href="${settingsUrl}">Cài đặt</a></li>
                    <li class="separator"></li>
                    <li><a href="${loginUrl}">Đăng nhập</a></li>
                `;
            };

            console.log('[home.js] Checking login status for header dropdown...');
            fetch(profileApiUrl, { credentials: 'include' }) // Gửi kèm cookie
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            // 401 (Unauthorized) hoặc 403 (Forbidden) thường có nghĩa là chưa đăng nhập hoặc không có quyền
                            console.log(`[home.js] Login check: Not logged in or no permission (${response.status}).`);
                            return null; // Trả về null để xử lý ở .then tiếp theo là chưa đăng nhập
                        } else {
                            // Các lỗi khác từ server
                            throw new Error(`Server error checking profile: ${response.status}`);
                        }
                    }
                    // Nếu response.ok là true, parse JSON
                    return response.json();
                })
                .then(data => {
                    console.log('[home.js] Profile data received:', data);
                    // Kiểm tra xem có dữ liệu hợp lệ không (ví dụ: có profileUrl hoặc avatarUrl)
                    if (data && (data.profileUrl || data.avatarUrl)) {
                        console.log('[home.js] User logged in. Updating dropdown.');

                        // Cập nhật nút trigger với avatar
                        const defaultAvatar = '/static/images/default_avatar.jpg'; // ** NHỚ THAY PATH ĐÚNG **
                        const avatarSrc = data.avatarUrl || defaultAvatar; // Ưu tiên avatarUrl, nếu không có dùng ảnh mặc định
                        // Dùng class CSS thay vì inline style sẽ tốt hơn
                        triggerBtn.innerHTML = `<img src="${avatarSrc}" alt="Avatar" class="user-avatar-trigger">`; // Ví dụ class 'user-avatar-trigger'

                        // Cập nhật menu dropdown cho người dùng đã đăng nhập
                        const userProfileUrl = data.profileUrl || '#'; // Link đến trang profile nếu có
                        const settingsUrl = "#"; // ** NHỚ THAY URL ĐÚNG ** trang cài đặt tài khoản
                        const logoutUrl = "/accounts/logout/"; // ** NHỚ THAY URL ĐÚNG **

                        dropdownMenuUl.innerHTML = `
                            <li><a href="${userProfileUrl}">Trang cá nhân</a></li>
                            <li><a href="${settingsUrl}">Cài đặt</a></li>
                            <li class="separator"></li>
                            <li><a href="${logoutUrl}">Đăng xuất</a></li>
                        `;
                    } else {
                        // Không có dữ liệu hợp lệ hoặc API trả về null/undefined -> Chưa đăng nhập
                        console.log('[home.js] User not logged in or data invalid. Setting default state.');
                        setDefaultUserState();
                    }
                })
                .catch(error => {
                    console.error('[home.js] Error checking login status or updating dropdown:', error);
                    // Gặp lỗi mạng hoặc lỗi server không xử lý được -> Đặt về trạng thái chưa đăng nhập cho an toàn
                    setDefaultUserState();
                });
        } else {
            console.warn("User action area '#user-action-area' not found. Skipping login check.");
        }

        const searchButtonTrigger = document.getElementById('search-button'); // Nút kính lúp
        const searchModalElement = document.getElementById('searchModalSimple');
        const closeModalButtonSimple = document.getElementById('closeModalSimple');
        const searchFormSimple = document.getElementById('searchFormSimple');
        const searchInputSimple = document.getElementById('searchInputSimple');
        const bodyElement = document.body;

        // Kiểm tra xem các thành phần modal có tồn tại không
        if (searchButtonTrigger && searchModalElement && closeModalButtonSimple && searchFormSimple && searchInputSimple) {

            // --- Hàm Mở Modal ---
            function openSearchModal() {
                bodyElement.classList.add('modal-visible'); // Thêm class để CSS hiển thị modal
                searchInputSimple.focus(); // Tự động focus vào ô input
            }

            // --- Hàm Đóng Modal ---
            function closeSearchModal() {
                bodyElement.classList.remove('modal-visible'); // Xóa class để CSS ẩn modal
            }

            // --- Gắn Sự Kiện ---

            // 1. Mở modal khi nhấn nút search (kính lúp)
            searchButtonTrigger.addEventListener('click', openSearchModal);

            // 2. Đóng modal khi nhấn nút X (trong modal)
            closeModalButtonSimple.addEventListener('click', closeSearchModal);

            // 3. Đóng modal khi nhấn ra ngoài vùng content (vào vùng overlay màu mờ)
            searchModalElement.addEventListener('click', function(event) {
                // Chỉ đóng khi click trực tiếp vào searchModalElement (vùng overlay)
                if (event.target === searchModalElement) {
                    closeSearchModal();
                }
            });

            // 4. Xử lý khi submit form tìm kiếm trong modal
            searchFormSimple.addEventListener('submit', function(event) {
                event.preventDefault(); // Ngăn form gửi đi theo cách truyền thống
                const searchTerm = searchInputSimple.value.trim(); // Lấy giá trị và xóa khoảng trắng thừa

                if (searchTerm) {
                    console.log("Dữ liệu tìm kiếm từ Modal:", searchTerm); // In ra console
                    // !!! THAY THẾ BẰNG LOGIC TÌM KIẾM THỰC TẾ CỦA BẠN !!!
                    // Ví dụ: Chuyển hướng trang hoặc gọi API tìm kiếm
                    // window.location.href = '/search?q=' + encodeURIComponent(searchTerm);

                    closeSearchModal(); // Đóng modal sau khi xử lý
                    // searchInputSimple.value = ''; // Tùy chọn: Xóa nội dung input sau khi tìm
                } else {
                    console.log("Vui lòng nhập từ khóa tìm kiếm vào modal.");
                    // Có thể thêm alert hoặc thông báo lỗi đơn giản nếu muốn
                }
            });

            // 5. (Tùy chọn) Đóng modal khi nhấn phím Escape
            document.addEventListener('keydown', function(event) {
                // Chỉ đóng nếu modal đang hiển thị (có class 'modal-visible')
                if (event.key === 'Escape' && bodyElement.classList.contains('modal-visible')) {
                    closeSearchModal();
                }
            });

            console.log("Simple search modal setup complete.");

        } else {
            console.warn("One or more elements for the simple search modal were not found. Skipping modal setup.");
            // Log ra các element không tìm thấy để debug
            if (!searchButtonTrigger) console.warn("- Missing: #search-button");
            if (!searchModalElement) console.warn("- Missing: #searchModalSimple");
            if (!closeModalButtonSimple) console.warn("- Missing: #closeModalSimple");
            if (!searchFormSimple) console.warn("- Missing: #searchFormSimple");
            if (!searchInputSimple) console.warn("- Missing: #searchInputSimple");
        }

    }); // Kết thúc DOMContentLoaded