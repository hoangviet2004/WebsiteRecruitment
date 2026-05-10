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