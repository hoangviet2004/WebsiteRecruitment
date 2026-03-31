// ============================================================
// api.js - File dùng chung cho toàn bộ frontend
// Đặt tại: js/api.js
// ============================================================

const API_URL = 'http://localhost:5240'; // backend đang chạy port 5500

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
    const token = localStorage.getItem('token');

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
            localStorage.clear();
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

// ── Lấy thông tin user từ localStorage ───────────────────────
function getCurrentUser() {
    return {
        token:    localStorage.getItem('token'),
        refreshToken: localStorage.getItem('refreshToken'),
        fullName: localStorage.getItem('fullName'),
        email:    localStorage.getItem('email'),
        role:     localStorage.getItem('role')
    };
}

// ── Kiểm tra đã đăng nhập chưa ───────────────────────────────
function isLoggedIn() {
    return !!localStorage.getItem('token');
}

// ── Đăng xuất ─────────────────────────────────────────────────
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    const response = await apiFetch('/api/auth/refresh-token', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
    });

    if (!response?.ok) return false;

    const data = await response.json();
    const payload = data?.data;
    if (!payload?.tokens?.accessToken || !payload?.tokens?.refreshToken) return false;

    localStorage.setItem('token', payload.tokens.accessToken);
    localStorage.setItem('refreshToken', payload.tokens.refreshToken);
    return true;
}

async function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
        await apiFetch('/api/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken })
        });
    }
    localStorage.clear();
    window.location.href = '../pages/auth.html#login';
}