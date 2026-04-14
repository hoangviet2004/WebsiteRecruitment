// ============================================================
// home.js  –  Logic cho trang Home
// Đặt tại: js/home.js
// ============================================================


// ── Bước 1: Nếu là admin thì chuyển ngay sang admin.html ────
function checkAdminRedirect() {
    var role = sessionStorage.getItem('role');
    if (role === 'Admin') {
        window.location.href = '../pages/admin.html';
    }
}


// ── Bước 2: Render khu vực nav bên phải ─────────────────────
// Nếu chưa đăng nhập → hiện nút Đăng nhập / Đăng ký
// Nếu đã đăng nhập   → hiện avatar tròn + tên user
function renderNavRight() {
    var navRight = document.getElementById('nav-right');
    var token    = sessionStorage.getItem('token');
    var fullName = sessionStorage.getItem('fullName') || '';
    var email    = sessionStorage.getItem('email')    || '';

    if (!token) {
        // Chưa đăng nhập
        navRight.innerHTML = `
            <a href="../pages/auth.html#login"    class="btn-login">Đăng nhập</a>
            <a href="../pages/auth.html#register" class="btn-register">Đăng ký</a>
        `;
        return;
    }

    // Đã đăng nhập: lấy 2 chữ cái đầu của tên để hiện trong avatar
    var initials = getInitials(fullName);
    navRight.innerHTML = `
        <div class="user-menu" id="userMenu">
            <div class="user-avatar">${initials}</div>
            <span class="user-name">${fullName}</span>

            <div class="user-dropdown">
                <a href="../pages/profile.html" class="dropdown-item">Hồ sơ của tôi</a>
                <a href="#" class="dropdown-item">Cài đặt</a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item logout" onclick="logout()">Đăng xuất</button>
            </div>
        </div>
    `;

    // Gắn sự kiện click để mở/đóng dropdown
    document.getElementById('userMenu').addEventListener('click', function (e) {
        this.classList.toggle('open');
        e.stopPropagation();            // không cho click lan ra ngoài
    });

    // Click ra ngoài thì đóng dropdown
    document.addEventListener('click', function () {
        var menu = document.getElementById('userMenu');
        if (menu) {
            menu.classList.remove('open');
        }
    });
}


// ── Hàm lấy chữ cái đầu của họ tên ─────────────────────────
// Ví dụ: "Nguyễn Văn An" → "NA"
function getInitials(fullName) {
    var words = fullName.trim().split(' ').filter(function (w) { return w.length > 0; });
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    // Lấy chữ đầu tiên và chữ cuối cùng
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}


// ── Chạy khi trang load xong ─────────────────────────────────
checkAdminRedirect();
renderNavRight();