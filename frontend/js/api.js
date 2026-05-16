// ============================================================
// api.js - File dùng chung cho toàn bộ frontend
// Đặt tại: js/api.js
// ============================================================

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5240'
    : 'https://techlist-api-cxekc6gycvbng0h8.southeastasia-01.azurewebsites.net';

// ── Gọi API không cần token (public) ────────────────────────
async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return response;
    } catch (error) {
        console.error('Lỗi kết nối server:', error);
        throw error;
    }
}

// ── Gọi API có token (private - cần đăng nhập) ──────────────
async function apiFetchAuth(endpoint, options = {}) {
    const token = sessionStorage.getItem('token');

    // Chưa đăng nhập → về trang auth
    if (!token) {
        window.location.href = '../pages/auth.html#login';
        return;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });

        // Token hết hạn → về trang login
        if (response.status === 401) {
            sessionStorage.clear();
            alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!');
            window.location.href = '../pages/auth.html#login';
            return;
        }

        return response;
    } catch (error) {
        console.error('Lỗi kết nối server:', error);
        throw error;
    }
}

// ── Mở CV ứng viên qua signed URL (tránh lỗi 401 Cloudinary) ──
async function openSignedCvView(candidateId) {
    const win = window.open('', '_blank');
    try {
        const res = await apiFetchAuth(`/api/profile/${encodeURIComponent(candidateId)}/cv-view`);
        if (!res) { win.close(); return; }
        const data = await res.json();
        if (data.data?.url) {
            win.location.href = data.data.url;
        } else {
            win.close();
            alert('Không thể tải CV của ứng viên này');
        }
    } catch {
        win.close();
        alert('Không thể mở CV');
    }
}

// ── Lấy thông tin user từ sessionStorage ───────────────────────
function getCurrentUser() {
    return {
        token:    sessionStorage.getItem('token'),
        refreshToken: sessionStorage.getItem('refreshToken'),
        fullName: sessionStorage.getItem('fullName'),
        email:    sessionStorage.getItem('email'),
        role:     sessionStorage.getItem('role')
    };
}

// ── Kiểm tra đã đăng nhập chưa ───────────────────────────────
function isLoggedIn() {
    return !!sessionStorage.getItem('token');
}

// ── Đăng xuất ─────────────────────────────────────────────────
async function refreshAccessToken() {
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    const response = await apiFetch('/api/auth/refresh-token', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
    });

    if (!response?.ok) return false;

    const data = await response.json();
    const payload = data?.data;
    if (!payload?.tokens?.accessToken || !payload?.tokens?.refreshToken) return false;

    sessionStorage.setItem('token', payload.tokens.accessToken);
    sessionStorage.setItem('refreshToken', payload.tokens.refreshToken);
    return true;
}

async function logout() {
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (refreshToken) {
        await apiFetch('/api/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken })
        });
    }
    sessionStorage.clear();
    window.location.href = '../pages/auth.html#login';
}

// ── Inline character counter (dùng chung cho mọi trang) ──────
// opts.inputStyle = true  → đặt counter kiểu input (top:50%) thay vì textarea (bottom)
function attachInlineCounter(el, opts) {
    if (!el) return;
    const max = parseInt(el.getAttribute('maxlength') || el.maxLength) || 0;
    if (!max) return;

    const isTextarea    = el.tagName.toLowerCase() === 'textarea';
    const useInputStyle = !isTextarea || (opts && opts.inputStyle);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);

    el.style.paddingRight = '52px';
    if (isTextarea && !useInputStyle) el.style.paddingBottom = '22px';

    const span = document.createElement('span');
    span.style.cssText = useInputStyle
        ? 'position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:#94a3b8;pointer-events:none;white-space:nowrap;'
        : 'position:absolute;bottom:8px;right:10px;font-size:11px;color:#94a3b8;pointer-events:none;white-space:nowrap;background:#fff;padding:0 2px;border-radius:2px;';
    span.textContent = `${el.value.length}/${max}`;
    wrapper.appendChild(span);

    const threshold = Math.max(Math.floor(max * 0.9), max - 10);
    el.addEventListener('input', function () {
        const len = this.value.length;
        span.textContent  = `${len}/${max}`;
        span.style.color  = len >= threshold ? '#ef4444' : '#94a3b8';
    });
}