document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // Login Form Elements
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorElement = document.getElementById('login-error');
    const loginButton = document.getElementById('login-button');

    // Signup Form Elements
    const signupUsernameInput = document.getElementById('signup-username'); 
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupErrorElement = document.getElementById('signup-error');
    const signupButton = document.getElementById('signup-button');
    
    const checkbox = document.getElementById('chk'); // Lấy checkbox

    // ---- API URLs (!!! THAY THẾ BẰNG URL THẬT CỦA ANH !!!) ----
    const API_LOGIN_URL = '/api/token/'; 
    const API_REGISTER_URL = '/api/register/'; // Giả sử URL đăng ký là đây
    // --------------------------------------------------------------

    // ---- Xử lý Login Submit ----
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;
        
        setLoading(loginButton, true, 'Processing...');
        loginErrorElement.textContent = ''; 

        try {
            const response = await fetch(API_LOGIN_URL, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                handleLoginSuccess(data);
            } 
            else {
                handleError(loginErrorElement, data, 'Email hoặc mật khẩu không đúng.');
            }
        } 
        catch (error) {
             handleError(loginErrorElement, null, 'Lỗi kết nối máy chủ.');
             console.error("Login Fetch Error:", error);
        }
        finally {
             setLoading(loginButton, false, 'Login');
        }
    });

    // ---- Xử lý Signup Submit ----
    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = signupUsernameInput.value; 
        const email = signupEmailInput.value;
        const password = signupPasswordInput.value;
        // Thêm validate confirm password nếu có input đó

        setLoading(signupButton, true, 'Processing...');
        signupErrorElement.textContent = ''; 

        try {
            const response = await fetch(API_REGISTER_URL, { 
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ username, email, password }) // Nhớ gửi username nếu backend cần
            });
            const data = await response.json();

            if (response.status === 201 || response.ok) { // Chấp nhận 201 hoặc các mã 2xx khác
                handleSignupSuccess();
            } else {
                handleError(signupErrorElement, data, 'Đăng ký thất bại.');
            }
        } catch (error) {
            handleError(signupErrorElement, null, 'Lỗi kết nối máy chủ.');
            console.error("Signup Fetch Error:", error);
        } finally {
            setLoading(signupButton, false, 'Sign up');
        }
    });

    // --- Hàm Helper ---
    function setLoading(button, isLoading, loadingText) {
        button.disabled = isLoading;
        button.textContent = isLoading ? loadingText : button.textContent = (button.id === 'login-button' ? 'Login' : 'Sign up');
    }

    function handleLoginSuccess(data) {
        console.log('Đăng nhập thành công:', data);
        localStorage.setItem('accessToken', data.access);
        localStorage.setItem('refreshToken', data.refresh);
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        // Thay bằng chuyển hướng thật
        alert('Đăng nhập thành công!'); 
        window.location.href = '/'; // Ví dụ chuyển về trang chủ
    }

    function handleSignupSuccess() {
         alert('Đăng ký thành công! Vui lòng đăng nhập.');
         // Tự động chuyển về tab Login bằng cách bỏ check checkbox
         checkbox.checked = false; 
    }

    function handleError(errorElement, responseData, defaultMessage) {
         let message = defaultMessage;
         if (responseData) {
            // Cố gắng lấy lỗi chi tiết từ các trường trả về (ví dụ: email: ["user exists."])
            if (typeof responseData === 'object' && responseData !== null) {
                 message = Object.entries(responseData)
                             .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                             .join(' ');
                 // Hoặc chỉ lấy lỗi 'detail' nếu có (phổ biến với DRF/SimpleJWT)
                 if(responseData.detail) {
                     message = responseData.detail;
                 }
             } else {
                message = String(responseData); // Hoặc chỉ hiển thị string lỗi nếu có
             }
         }
         errorElement.textContent = message;
         errorElement.style.display = 'block'; // Đảm bảo lỗi được hiển thị
    }

});