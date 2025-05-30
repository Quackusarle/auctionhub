// static/js/new_about.js

document.addEventListener('DOMContentLoaded', () => {
    // Typed.js for Hero Section
    // Ensure Typed.js library is loaded in new_about.html: <script src="https://cdn.jsdelivr.net/npm/typed.js@2.0.12"></script>
    if (document.getElementById('typed-greeting')) {
        new Typed('#typed-greeting', {
            strings: ['Chào mừng bạn đến với'],
            typeSpeed: 50,
            showCursor: false, // Don't show cursor for the greeting
            onComplete: (self) => {
                if (document.getElementById('typed-tagline')) {
                    new Typed('#typed-tagline', {
                        strings: [
                            'Nơi công nghệ gặp gỡ niềm đam mê đấu giá, mang đến trải nghiệm minh bạch và hiệu quả.',
                            'Tham gia cùng chúng tôi để khám phá thế giới đấu giá!'
                        ],
                        typeSpeed: 40,
                        backSpeed: 15,
                        backDelay: 3000,
                        loop: true, // Loop the tagline
                        showCursor: true,
                        cursorChar: '_',
                    });
                }
            }
        });
    }

    // Simple scroll animation for sections
    const observerOptions = {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1 // Trigger when 10% of the item is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target); // Stop observing once animated
            }
        });
    }, observerOptions);

    // Apply animation to all sections (you might want to refine this)
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('fade-in-section'); // Add a base class for animation
        observer.observe(section);
    });

    // Add a simple animation class to CSS for fade-in effect
    const style = document.createElement('style');
    style.innerHTML = `
        .fade-in-section {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .fade-in-section.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);

    // Animation cho Security Tree (Tương tự Education Tree)
    const securitySection = document.getElementById('security');
    const securityTreeContainer = document.getElementById('security-tree-container');

    if (securitySection && securityTreeContainer) {
        const observerOptionsForTree = {
            root: null,
            rootMargin: '0px',
            threshold: 0.2 // Kích hoạt khi 20% của section hiển thị
        };

        const securityObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    securityTreeContainer.classList.add('animate'); // Thêm class 'animate' để kích hoạt CSS animation
                    observer.unobserve(entry.target); // Ngừng quan sát sau khi animation chạy
                }
            });
        }, observerOptionsForTree);

        securityObserver.observe(securitySection);

        // Optional: Reset animation if user navigates away and comes back (or for single-page apps)
        // document.querySelector('a[href="#security"]').addEventListener('click', () => {
        //     if (!securityTreeContainer.classList.contains('animate')) {
        //         securityTreeContainer.classList.add('animate');
        //     }
        // });
    }

    // Left Rocket and Fireworks
    const rocketLeft = document.getElementById('rocketLeft');
    const fireworksOverlay = document.getElementById('fireworks-overlay');
    let pageFireworksInstance = null;
    if(rocketLeft) {
        rocketLeft.addEventListener('click', () => {
            if (rocketLeft.classList.contains('flying')) return;
            rocketLeft.classList.add('flying');
            fireworksOverlay.style.display = 'block';
            if (pageFireworksInstance) pageFireworksInstance.stop();
            pageFireworksInstance = new Fireworks(fireworksOverlay, {
                maxRockets: 5, rocketSpawnInterval: 150, numParticles: 100,
                explosionMinHeight: 0.2, explosionMaxHeight: 0.9, explosionChance: 0.08,
                traceSpeed: 1.5, delay: { min: 15, max: 30 }
            });
            pageFireworksInstance.start();
            setTimeout(() => rocketLeft.classList.remove('flying'), 1200);
            setTimeout(() => { if (pageFireworksInstance) pageFireworksInstance.stop(); fireworksOverlay.style.display = 'none';}, 5000);
        });
    }

    // Present Box Interaction (Copy from myprofile.html)
    const giftBox = document.getElementById('giftBox');
    const presentEffectOverlay = document.getElementById('presentEffectOverlay');
    const matrixRainEffectContainer = document.getElementById('matrixRainEffect');

    const presentEffects = [
        function showBalloons() {
            presentEffectOverlay.innerHTML = '';
            presentEffectOverlay.style.display = 'flex';
            const colors = ['var(--primary-color)', 'var(--accent-color)', '#4ECDC4', '#FED766']; // Use primary/accent colors
            for (let i = 0; i < 10; i++) {
                const balloon = document.createElement('div');
                balloon.className = 'balloon';
                balloon.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                balloon.style.left = Math.random() * 80 + 10 + '%';
                balloon.style.animationDelay = Math.random() * 1 + 's';
                presentEffectOverlay.appendChild(balloon);
            }
            setTimeout(() => { presentEffectOverlay.style.display = 'none'; presentEffectOverlay.innerHTML = ''; }, 5000);
        },
        function showMessage() {
            presentEffectOverlay.innerHTML = '<div class="present-effect-content"><span>🎉</span> Chúc mừng! <span>🎉</span><br><small>Bạn đã tìm thấy một bí mật!</small></div>';
            presentEffectOverlay.style.display = 'flex';
            setTimeout(() => { presentEffectOverlay.style.display = 'none'; presentEffectOverlay.innerHTML = ''; }, 4000);
        },
        function showLollipops() {
            presentEffectOverlay.innerHTML = '';
            presentEffectOverlay.style.display = 'flex';
            const lollipopColors = [
                `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='35' r='30' fill='%23198754'/%3E%3Crect x='47' y='60' width='6' height='40' fill='%23FFFFFF'/%3E%3C/svg%3E")`, // Primary color
                `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='35' r='30' fill='%23157347'/%3E%3Crect x='47' y='60' width='6' height='40' fill='%23FFFFFF'/%3E%3C/svg%3E")`, // Accent color
                `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='35' r='30' fill='%23FFD700'/%3E%3Crect x='47' y='60' width='6' height='40' fill='%23FFFFFF'/%3E%3C/svg%3E")` // Gold color
            ];
            for (let i = 0; i < 5; i++) {
                const lollipop = document.createElement('div');
                lollipop.className = 'lollipop';
                lollipop.style.backgroundImage = lollipopColors[i % lollipopColors.length];
                lollipop.style.left = Math.random() * 70 + 15 + '%';
                lollipop.style.top = Math.random() * 40 + 30 + '%';
                lollipop.style.animationDelay = Math.random() * 0.5 + 's';
                presentEffectOverlay.appendChild(lollipop);
            }
            setTimeout(() => { presentEffectOverlay.style.display = 'none'; presentEffectOverlay.innerHTML = ''; }, 3000);
        },
        function showMatrixRain() {
            presentEffectOverlay.innerHTML = ''; // Clear other effects
            matrixRainEffectContainer.innerHTML = ''; // Clear previous rain
            matrixRainEffectContainer.style.display = 'block';
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}";
            const numColumns = Math.floor(window.innerWidth / 16); // 16px font size approx
            for (let i = 0; i < numColumns; i++) {
                const column = document.createElement('div');
                column.className = 'matrix-column';
                column.style.left = i * 16 + 'px';
                column.style.animationDuration = Math.random() * 2 + 1 + 's'; // Random fall speed
                column.style.animationDelay = Math.random() * 3 + 's'; // Stagger start
                let columnText = '';
                for (let j = 0; j < Math.floor(window.innerHeight / 16) + 10; j++) { // Extra length for full fall
                    columnText += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                column.textContent = columnText;
                matrixRainEffectContainer.appendChild(column);
            }
             setTimeout(() => { matrixRainEffectContainer.style.display = 'none'; matrixRainEffectContainer.innerHTML = ''; }, 6000); // Rain for 6 seconds
        }
    ];
    if (giftBox) {
        giftBox.addEventListener('click', () => {
            const randomIndex = Math.floor(Math.random() * presentEffects.length);
            presentEffects[randomIndex]();
        });
    }

    console.log("new_about.js loaded.");
});