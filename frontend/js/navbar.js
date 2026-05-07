// ============================================================
// navbar.js - Logic dùng chung cho thanh điều hướng (navbar)
// ============================================================

function renderNavRight() {
    const navRight = document.getElementById('nav-right');
    if (!navRight) return;

    const token = sessionStorage.getItem('token');
    const fullName = sessionStorage.getItem('fullName') || '';
    const avatarUrl = sessionStorage.getItem('avatarUrl');

    if (!token) {
        navRight.innerHTML = `
            <a href="auth.html#login"    class="btn-login">Đăng nhập</a>
            <a href="auth.html#register" class="btn-register">Đăng ký</a>
        `;
        return;
    }

    const updateDOM = (name, url) => {
        let avatarHtml = '';
        if (url && url !== 'null' && url !== 'undefined') {
            avatarHtml = `<img src="${url}" class="user-avatar" style="padding:0; object-fit:cover;" alt="Avatar">`;
        } else {
            const initials = getInitials(name);
            avatarHtml = `<div class="user-avatar">${initials}</div>`;
        }

        const role = (sessionStorage.getItem('role') || '').toLowerCase();
        navRight.innerHTML = `
            <div class="user-menu" id="userMenu">
                ${avatarHtml}
                <span class="user-name">${name}</span>
                <div class="user-dropdown">
                    <a href="profile.html" class="dropdown-item">
                        <i class="fa-regular fa-user" style="width:14px;margin-right:8px;"></i>Hồ sơ của tôi
                    </a>
                    ${role === 'candidate' ? `
                        <a href="candidate-messages.html" class="dropdown-item">
                            <i class="fa-regular fa-comments" style="width:14px;margin-right:8px;"></i>Tin nhắn
                        </a>
                        <a href="savedJobs.html" class="dropdown-item">
                            <i class="fa-regular fa-bookmark" style="width:14px;margin-right:8px;"></i>Việc làm đã lưu
                        </a>
                    ` : ''}
                    <a href="#" class="dropdown-item">
                        <i class="fa-solid fa-gear" style="width:14px;margin-right:8px;"></i>Cài đặt
                    </a>
                    ${role === 'recruiter' ? `
                        <div class="dropdown-divider"></div>
                        <a href="recruiter.html" class="dropdown-item" style="color: #4f46e5; font-weight: bold;">
                            <i class="fa-solid fa-briefcase" style="width:14px;margin-right:8px;"></i>Kênh Nhà Tuyển Dụng
                        </a>
                    ` : ''}
                    ${role === 'admin' ? `
                        <div class="dropdown-divider"></div>
                        <a href="admin.html" class="dropdown-item" style="color: #dc2626; font-weight: bold;">
                            <i class="fa-solid fa-gauge-high" style="width:14px;margin-right:8px;"></i>Trang Quản Trị
                        </a>
                    ` : ''}
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item logout" onclick="logout()">
                        <i class="fa-solid fa-arrow-right-from-bracket" style="width:14px;margin-right:8px;"></i>Đăng xuất
                    </button>
                </div>
            </div>
        `;

        const menuEl = document.getElementById('userMenu');
        if (menuEl) {
            menuEl.addEventListener('click', function (e) {
                this.classList.toggle('open');
                e.stopPropagation();
            });
        }
    };

    // 1. Render từ cache
    updateDOM(fullName, avatarUrl);

    // 2. Refresh từ server (API_URL được định nghĩa trong api.js)
    if (typeof API_URL !== 'undefined') {
        fetch(`${API_URL}/api/profile/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(json => {
            if (json.success && json.data) {
                const realName = json.data.displayName || fullName;
                const realAvatar = json.data.avatarUrl;
                if (realName) sessionStorage.setItem('fullName', realName);
                if (realAvatar) sessionStorage.setItem('avatarUrl', realAvatar);
                updateDOM(realName, realAvatar);
            }
        })
        .catch(() => {});
    }

    // Close on click outside
    if (!window._navEventBound) {
        document.addEventListener('click', function () {
            const menu = document.getElementById('userMenu');
            if (menu) menu.classList.remove('open');
        });
        window._navEventBound = true;
    }
}

function getInitials(fullName) {
    if (!fullName) return '?';
    const words = fullName.trim().split(' ').filter(w => w.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Tự động chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
    renderNavRight();
});
