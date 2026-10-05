/* =========================================================
   Shared Navigation & Authentication Logic
   ========================================================= */

(function () {
    // Secret verification check
    const AUTH_KEY = 'ranood_auth_status';
    const SECRET_VAL = 'unlocked_rema261812';

    window.RanoodAuth = {
        isUnlocked: function () {
            return sessionStorage.getItem(AUTH_KEY) === SECRET_VAL || localStorage.getItem(AUTH_KEY) === SECRET_VAL;
        },
        unlock: function () {
            sessionStorage.setItem(AUTH_KEY, SECRET_VAL);
            localStorage.setItem(AUTH_KEY, SECRET_VAL);
        },
        lock: function () {
            sessionStorage.removeItem(AUTH_KEY);
            localStorage.removeItem(AUTH_KEY);
            window.location.href = 'index.html';
        },
        requireAuth: function () {
            // If on index.html, do nothing
            const currentPath = window.location.pathname.toLowerCase();
            if (currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '') {
                return;
            }
            if (!this.isUnlocked()) {
                window.location.href = 'index.html?redirect=' + encodeURIComponent(window.location.pathname);
            }
        }
    };

    // Auto check auth on content pages
    window.RanoodAuth.requireAuth();

    // Setup Navigation Bar interactivity
    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.querySelector('.mobile-toggle');
        const navLinks = document.querySelector('.nav-links');

        if (toggle && navLinks) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                navLinks.classList.toggle('show');
                toggle.setAttribute('aria-expanded', navLinks.classList.contains('show'));
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.site-navbar')) {
                    navLinks.classList.remove('show');
                }
            });
        }

        // Add soft ambient floating hearts if not present
        if (!document.querySelector('.floating-hearts') && !document.querySelector('.shared-floating-hearts')) {
            const container = document.createElement('div');
            container.className = 'shared-floating-hearts';
            container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:hidden;';
            document.body.prepend(container);

            const emojis = ['💕', '💖', '💗', '🌸', '✨', '🎀', '🤍'];
            for (let i = 0; i < 15; i++) {
                const heart = document.createElement('span');
                heart.innerText = emojis[Math.floor(Math.random() * emojis.length)];
                heart.style.cssText = `
                    position: absolute;
                    bottom: -30px;
                    left: ${Math.random() * 100}%;
                    font-size: ${Math.random() * 18 + 14}px;
                    opacity: ${Math.random() * 0.4 + 0.3};
                    animation: floatUpSlow ${Math.random() * 8 + 8}s linear infinite;
                    animation-delay: ${Math.random() * 6}s;
                `;
                container.appendChild(heart);
            }

            // Inject keyframes if not exists
            if (!document.getElementById('shared-heart-anim')) {
                const style = document.createElement('style');
                style.id = 'shared-heart-anim';
                style.textContent = `
                    @keyframes floatUpSlow {
                        0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                        15% { opacity: 0.7; }
                        85% { opacity: 0.7; }
                        100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    });
})();
