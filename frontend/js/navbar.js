// ============================================================
// navbar.js - Logic dùng chung cho thanh điều hướng (navbar)
// ============================================================

// ── Notification helpers ──────────────────────────────────────
const _NOTIF_KEY = 'notif_seen';

function _getSeenStatuses() {
    try { return JSON.parse(localStorage.getItem(_NOTIF_KEY) || '{}'); } catch { return {}; }
}

function _escHtmlNav(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const _STATUS_NOTIF = {
    Applied:   { icon: 'fa-file-pen',        color: '#3b82f6', msg: 'Đơn ứng tuyển của bạn đã được ghi nhận.' },
    Screening: { icon: 'fa-magnifying-glass', color: '#ca8a04', msg: 'Hồ sơ của bạn đang được xem xét và sàng lọc.' },
    Interview: { icon: 'fa-comments',         color: '#16a34a', msg: 'Bạn được mời tham gia phỏng vấn.' },
    Offered:   { icon: 'fa-handshake',        color: '#059669', msg: 'Chúc mừng! Bạn nhận được đề nghị công việc.' },
    Hired:     { icon: 'fa-trophy',            color: '#854d0e', msg: 'Chúc mừng! Bạn đã được tuyển dụng.' },
    Rejected:  { icon: 'fa-xmark',            color: '#dc2626', msg: 'Rất tiếc, đơn ứng tuyển của bạn đã bị từ chối.' },
};

function _injectNotifPanel() {
    if (document.getElementById('notif-panel')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
        <div id="notif-overlay" class="notif-overlay" onclick="closeNotifPanel()"></div>
        <div id="notif-panel" class="notif-panel">
            <div class="notif-header">
                <span><i class="fa-solid fa-bell" style="color:#3b82f6;margin-right:8px;"></i>Thông báo</span>
                <button class="notif-close-btn" onclick="closeNotifPanel()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="notif-body" class="notif-body">
                <div class="notif-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>
            </div>
        </div>`;
    document.body.appendChild(wrap);
}

async function _loadNotifBadge() {
    const token = sessionStorage.getItem('token');
    if (!token || typeof API_URL === 'undefined') return;
    try {
        const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) _updateBadge(data.data || 0);
    } catch {}
}

function _updateBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

async function openNotifPanel() {
    document.getElementById('userMenu')?.classList.remove('open');
    _injectNotifPanel();
    document.getElementById('notif-overlay')?.classList.add('show');
    document.getElementById('notif-panel')?.classList.add('show');

    const body = document.getElementById('notif-body');
    body.innerHTML = '<div class="notif-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';

    const token = sessionStorage.getItem('token');
    const role = (sessionStorage.getItem('role') || '').toLowerCase();

    try {
        const res = await fetch(`${API_URL}/api/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error();
        if (role === 'recruiter') {
            _renderRecruiterNotifItems(data.data || []);
        } else {
            _renderCandidateNotifItems(data.data || []);
        }
        await fetch(`${API_URL}/api/notifications/mark-read`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        _updateBadge(0);
    } catch {
        body.innerHTML = '<div class="notif-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Không thể tải thông báo.</p></div>';
    }
}

function closeNotifPanel() {
    document.getElementById('notif-overlay')?.classList.remove('show');
    document.getElementById('notif-panel')?.classList.remove('show');
}

function _renderNotifItems(apps) {
    const body = document.getElementById('notif-body');
    const seen = _getSeenStatuses();

    if (!apps.length) {
        body.innerHTML = '<div class="notif-empty"><i class="fa-solid fa-bell-slash"></i><p>Bạn chưa ứng tuyển vị trí nào.</p></div>';
        return;
    }

    body.innerHTML = apps.map(a => {
        const cfg = _STATUS_NOTIF[a.status] || _STATUS_NOTIF.Applied;
        const isUnread = seen[a.id] !== a.status;
        const date = new Date(a.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `
            <div class="notif-item${isUnread ? ' unread' : ''}" onclick="goToChat('${a.id}')" title="Mở đoạn chat">
                <div class="notif-icon" style="background:${cfg.color}18;color:${cfg.color};">
                    <i class="fa-solid ${cfg.icon}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-job">${_escHtmlNav(a.jobTitle || 'Vị trí')}</div>
                    <div class="notif-msg">${cfg.msg}</div>
                    <div class="notif-date">${date}</div>
                </div>
                <div class="notif-arrow"><i class="fa-solid fa-chevron-right"></i></div>
            </div>`;
    }).join('');
}

function goToChat(applicationId) {
    closeNotifPanel();
    const base = window.location.pathname.includes('/pages/')
        ? 'candidate-messages.html'
        : 'pages/candidate-messages.html';
    window.location.href = `${base}?appId=${applicationId}`;
}

function _markAllRead(apps) {
    const seen = _getSeenStatuses();
    apps.forEach(a => { seen[a.id] = a.status; });
    localStorage.setItem(_NOTIF_KEY, JSON.stringify(seen));
    _updateBadge(0);
}

const _RECRUITER_NOTIF_CFG = {
    Approved:       { icon: 'fa-circle-check',  color: '#16a34a' },
    Rejected:       { icon: 'fa-ban',           color: '#dc2626' },
    Unblocked:      { icon: 'fa-unlock',        color: '#2563eb' },
    Hidden:         { icon: 'fa-eye-slash',     color: '#d97706' },
    Shown:          { icon: 'fa-eye',           color: '#0891b2' },
    NewApplication: { icon: 'fa-user-plus',     color: '#8b5cf6' },
};

function _renderCandidateNotifItems(notifications) {
    const body = document.getElementById('notif-body');
    if (!notifications.length) {
        body.innerHTML = '<div class="notif-empty"><i class="fa-solid fa-bell-slash"></i><p>Chưa có thông báo nào.</p></div>';
        return;
    }
    body.innerHTML = notifications.map(n => {
        const cfg = _STATUS_NOTIF[n.type] || { icon: 'fa-bell', color: '#64748b', msg: n.message };
        const date = new Date(n.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `
            <div class="notif-item${n.isRead ? '' : ' unread'}" onclick="_goToCandidateAppliedJobs()" style="cursor:pointer;">
                <div class="notif-icon" style="background:${cfg.color}18;color:${cfg.color};">
                    <i class="fa-solid ${cfg.icon}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-job">${_escHtmlNav(n.jobTitle || n.title)}</div>
                    <div class="notif-msg">${_escHtmlNav(n.message)}</div>
                    <div class="notif-date">${date}</div>
                </div>
                <div class="notif-arrow"><i class="fa-solid fa-chevron-right"></i></div>
            </div>`;
    }).join('');
}

function _goToCandidateAppliedJobs() {
    closeNotifPanel();
    const base = window.location.pathname.includes('/pages/')
        ? 'applied-jobs.html'
        : 'pages/applied-jobs.html';
    window.location.href = base;
}

function _goToRecruiterJobs() {
    closeNotifPanel();
    const base = window.location.pathname.includes('/pages/')
        ? 'recruiter.html'
        : 'pages/recruiter.html';
    window.location.href = `${base}?tab=jobs`;
}

function _goToRecruiterCandidates() {
    closeNotifPanel();
    const base = window.location.pathname.includes('/pages/')
        ? 'recruiter.html'
        : 'pages/recruiter.html';
    window.location.href = `${base}?tab=candidates`;
}

function _renderRecruiterNotifItems(notifications) {
    const body = document.getElementById('notif-body');
    if (!notifications.length) {
        body.innerHTML = '<div class="notif-empty"><i class="fa-solid fa-bell-slash"></i><p>Chưa có thông báo nào.</p></div>';
        return;
    }
    body.innerHTML = notifications.map(n => {
        const cfg = _RECRUITER_NOTIF_CFG[n.type] || { icon: 'fa-bell', color: '#64748b' };
        const date = new Date(n.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const candidateTypes = new Set(['NewApplication']);
        const onclick = candidateTypes.has(n.type) ? '_goToRecruiterCandidates()' : '_goToRecruiterJobs()';
        return `
            <div class="notif-item${n.isRead ? '' : ' unread'}" onclick="${onclick}" style="cursor:pointer;">
                <div class="notif-icon" style="background:${cfg.color}18;color:${cfg.color};">
                    <i class="fa-solid ${cfg.icon}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-job">${_escHtmlNav(n.title)}</div>
                    <div class="notif-msg">${_escHtmlNav(n.message)}</div>
                    <div class="notif-date">${date}</div>
                </div>
                <div class="notif-arrow"><i class="fa-solid fa-chevron-right"></i></div>
            </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
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
                        <a href="applied-jobs.html" class="dropdown-item">
                            <i class="fa-regular fa-paper-plane" style="width:14px;margin-right:8px;"></i>Việc làm đã ứng tuyển
                        </a>
                        <a href="savedJobs.html" class="dropdown-item">
                            <i class="fa-regular fa-bookmark" style="width:14px;margin-right:8px;"></i>Việc làm đã lưu
                        </a>
                    ` : ''}
                    ${role !== 'admin' ? `
                        <a href="#" class="dropdown-item" onclick="openNotifPanel(); return false;">
                            <i class="fa-solid fa-bell" style="width:14px;margin-right:8px;"></i>Thông báo
                            <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
                        </a>
                    ` : `
                        <a href="#" class="dropdown-item">
                            <i class="fa-solid fa-gear" style="width:14px;margin-right:8px;"></i>Cài đặt
                        </a>
                    `}
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

        if (role === 'candidate' || role === 'recruiter') {
            _injectNotifPanel();
            _loadNotifBadge();
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
