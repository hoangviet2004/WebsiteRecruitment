// ============================================================
// blog.js  –  Logic cho trang Blog
// ============================================================

// ── Render khu vực nav bên phải ─────────────────────
function renderNavRight() {
    var navRight = document.getElementById('nav-right');
    var token    = sessionStorage.getItem('token');
    var fullName = sessionStorage.getItem('fullName') || '';
    
    if (!token) {
        navRight.innerHTML = `
            <a href="../pages/auth.html#login"    class="btn-login">Đăng nhập</a>
            <a href="../pages/auth.html#register" class="btn-register">Đăng ký</a>
        `;
        return;
    }

    const updateDOM = (name, url) => {
        var avatarHtml = '';
        if (url && url !== 'null' && url !== 'undefined') {
            avatarHtml = `<img src="${url}" class="user-avatar" style="padding:0; object-fit:cover;" alt="Avatar">`;
        } else {
            var initials = getInitials(name);
            avatarHtml = `<div class="user-avatar">${initials}</div>`;
        }

        navRight.innerHTML = `
            <div class="user-menu" id="userMenu">
                ${avatarHtml}
                <span class="user-name">${name}</span>
                <div class="user-dropdown">
                    <a href="../pages/profile.html" class="dropdown-item">Hồ sơ của tôi</a>
                    <a href="#" class="dropdown-item">Cài đặt</a>
                    ${sessionStorage.getItem('role') === 'Recruiter' ? `<div class="dropdown-divider"></div><a href="../pages/recruiter.html" class="dropdown-item" style="color: #4f46e5; font-weight: bold;"><i class="fa-solid fa-briefcase"></i> Kênh Nhà Tuyển Dụng</a>` : ''}
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item logout" onclick="logout()">Đăng xuất</button>
                </div>
            </div>
        `;

        document.getElementById('userMenu').addEventListener('click', function (e) {
            this.classList.toggle('open');
            e.stopPropagation();
        });
    };

    updateDOM(fullName, sessionStorage.getItem('avatarUrl'));

    fetch(`${API_URL}/api/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(json => {
        if (json.data) {
            const realName = json.data.displayName || fullName;
            const realAvatar = json.data.avatarUrl;
            
            if (realName) sessionStorage.setItem('fullName', realName);
            if (realAvatar) sessionStorage.setItem('avatarUrl', realAvatar);

            updateDOM(realName, realAvatar);
        }
    })
    .catch(() => {});
    
    if (!window._navEventBound) {
        document.addEventListener('click', function () {
            var menu = document.getElementById('userMenu');
            if (menu) menu.classList.remove('open');
        });
        window._navEventBound = true;
    }
}

// ── Hàm lấy chữ cái đầu của họ tên ─────────────────────────
function getInitials(fullName) {
    var words = fullName.trim().split(' ').filter(function (w) { return w.length > 0; });
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ── Chạy khi trang load xong ─────────────────────────────────
renderNavRight();
