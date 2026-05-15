'use strict';

// ── Panel switching ───────────────────────────────────────────
function showPanel(name) {
    ['register','login','forgot'].forEach(p =>
        document.getElementById('panel-' + p).style.display = 'none'
    );
    document.getElementById('panel-' + name).style.display = 'block';
    const subtitles = {
        register: 'Tìm kiếm công việc mơ ước của bạn',
        login:    'Chào mừng trở lại!',
        forgot:   'Đặt lại mật khẩu'
    };
    document.getElementById('subtitle').textContent = subtitles[name] || '';
}

// ── Helpers ───────────────────────────────────────────────────
function setErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    const input = el.closest('.auth-field')?.querySelector('input,select');
    if (input) input.classList.toggle('err', !!msg);
}

function clearErr(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    const input = el.closest('.auth-field')?.querySelector('input,select');
    if (input) input.classList.remove('err');
}

function showGlobalErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function setBtnLoading(id, loading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.orig = btn.dataset.orig || btn.innerHTML;
    btn.innerHTML = loading
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'
        : btn.dataset.orig;
}

function togglePassword(inputId, spanEl) {
    const input = document.getElementById(inputId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    const icon = spanEl?.querySelector('i');
    if (icon) icon.className = isText ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
}

// ── Password strength (register) ─────────────────────────────
function onRegPassInput(val) {
    const bar   = document.getElementById('reg-strength-bar');
    const label = document.getElementById('reg-strength-label');
    const wrap  = document.getElementById('reg-strength');
    if (!val) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
        { cls:'weak',   text:'Yếu' },
        { cls:'weak',   text:'Yếu' },
        { cls:'fair',   text:'Trung bình' },
        { cls:'good',   text:'Khá' },
        { cls:'strong', text:'Mạnh' },
        { cls:'strong', text:'Rất mạnh' },
    ];
    const lv = levels[score];
    bar.className   = 'auth-strength-bar ' + lv.cls;
    label.className = 'auth-strength-label ' + lv.cls;
    label.textContent = lv.text;
}

// ── Register ─────────────────────────────────────────────────
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const fullName = document.getElementById('reg-fullname').value.trim();
    const email    = document.getElementById('reg-email').value.trim().toLowerCase();
    const role     = document.getElementById('reg-role').value;
    const pass     = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-confirm').value;

    // Clear previous errors
    ['reg-fullname-err','reg-email-err','reg-password-err','reg-confirm-err'].forEach(clearErr);
    showGlobalErr('reg-global-err', '');

    let hasErr = false;

    if (!fullName) {
        setErr('reg-fullname-err', 'Vui lòng nhập họ và tên.'); hasErr = true;
    } else if (fullName.length > 50) {
        setErr('reg-fullname-err', 'Họ và tên không được vượt quá 50 ký tự.'); hasErr = true;
    }

    if (!email) {
        setErr('reg-email-err', 'Vui lòng nhập email.'); hasErr = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErr('reg-email-err', 'Email không hợp lệ.'); hasErr = true;
    }

    if (!pass) {
        setErr('reg-password-err', 'Vui lòng nhập mật khẩu.'); hasErr = true;
    } else if (pass.length < 6) {
        setErr('reg-password-err', 'Mật khẩu phải có ít nhất 6 ký tự.'); hasErr = true;
    }

    if (!confirm) {
        setErr('reg-confirm-err', 'Vui lòng xác nhận mật khẩu.'); hasErr = true;
    } else if (pass && confirm !== pass) {
        setErr('reg-confirm-err', 'Mật khẩu xác nhận không khớp.'); hasErr = true;
    }

    if (hasErr) return;

    setBtnLoading('btn-register', true);

    try {
        const response = await apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ Email: email, Password: pass, Role: role, DisplayName: fullName })
        });

        let data = null;
        try { data = await response.json(); } catch (_) {}

        if (response.ok) {
            document.getElementById('reg-fullname').value = '';
            document.getElementById('reg-email').value    = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm').value  = '';
            document.getElementById('reg-strength').style.display = 'none';

            document.getElementById('login-email').value = email;
            showPanel('login');
            showGlobalErr('login-global-err', '');

            const successEl = document.createElement('div');
            successEl.className = 'auth-success-banner';
            successEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đăng ký thành công! Vui lòng đăng nhập.';
            const loginForm = document.getElementById('loginForm');
            loginForm.parentNode.insertBefore(successEl, loginForm);
            setTimeout(() => successEl.remove(), 5000);
            return;
        }

        const msg = data?.message
            || (Array.isArray(data?.errors) ? data.errors.map(e => e.error || e).join(' ') : null)
            || `Đăng ký thất bại (HTTP ${response.status})`;
        showGlobalErr('reg-global-err', msg);
    } catch {
        showGlobalErr('reg-global-err', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
        setBtnLoading('btn-register', false);
    }
});

// ── Login ─────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const email    = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    ['login-email-err','login-password-err'].forEach(clearErr);
    showGlobalErr('login-global-err', '');

    let hasErr = false;
    if (!email) { setErr('login-email-err', 'Vui lòng nhập email.'); hasErr = true; }
    if (!password) { setErr('login-password-err', 'Vui lòng nhập mật khẩu.'); hasErr = true; }
    if (hasErr) return;

    setBtnLoading('btn-login', true);

    try {
        const response = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ Email: email, Password: password })
        });

        let data = null;
        try { data = await response.json(); } catch (_) {}

        if (response.ok) {
            const payload      = data?.data;
            const accessToken  = payload?.tokens?.accessToken;
            const refreshToken = payload?.tokens?.refreshToken;
            const user         = payload?.user;

            sessionStorage.setItem('token',         accessToken  || '');
            sessionStorage.setItem('refreshToken',  refreshToken || '');
            sessionStorage.setItem('userId',        user?.id          || '');
            sessionStorage.setItem('fullName',      user?.displayName || '');
            sessionStorage.setItem('email',         user?.email       || '');
            sessionStorage.setItem('avatarUrl',     user?.avatarUrl   || '');
            sessionStorage.setItem('loginProvider', 'local');

            const role = (user?.roles || [])[0] || '';
            sessionStorage.setItem('role', role);

            window.location.href = role.toLowerCase() === 'admin'
                ? '../pages/admin.html'
                : '../pages/home.html';
            return;
        }

        const msg = data?.message || data?.Message
            || (response.status === 401 ? 'Sai tên đăng nhập hoặc mật khẩu.' : `Đăng nhập thất bại (HTTP ${response.status})`);
        showGlobalErr('login-global-err', msg);
    } catch {
        showGlobalErr('login-global-err', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
        setBtnLoading('btn-login', false);
    }
});

// ── Forgot password ───────────────────────────────────────────
document.getElementById('forgotForm').addEventListener('submit', function(e) {
    e.preventDefault();
    alert('Chức năng đặt lại mật khẩu chưa được hỗ trợ.');
});

// ── OAuth ─────────────────────────────────────────────────────
document.querySelectorAll('.google').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        window.location.href = API_URL + '/api/auth/google?returnUrl=' + encodeURIComponent(window.location.href.split('#')[0]);
    });
});

document.querySelectorAll('.github').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        window.location.href = API_URL + '/api/auth/github?returnUrl=' + encodeURIComponent(window.location.href.split('#')[0]);
    });
});

// ── OAuth callback (hash) ─────────────────────────────────────
(function handleOAuthCallback() {
    const hash = window.location.hash.replace('#', '');
    if (!hash.includes('accessToken')) {
        if (hash === 'login' || hash === 'register' || hash === 'forgot') showPanel(hash);
        return;
    }

    const params       = new URLSearchParams(hash);
    const token        = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (!token || !refreshToken) return;

    function parseJwt(t) {
        try {
            const base64 = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
            return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')));
        } catch { return {}; }
    }

    const decoded = parseJwt(token);
    sessionStorage.setItem('token',         token);
    sessionStorage.setItem('refreshToken',  refreshToken);
    sessionStorage.setItem('userId',        decoded.sub || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || '');
    sessionStorage.setItem('email',         decoded.email || '');
    sessionStorage.setItem('fullName',      decoded['display_name'] || decoded.name || '');
    sessionStorage.setItem('loginProvider', 'oauth');
    const role = decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 'Candidate';
    sessionStorage.setItem('role', role);

    window.location.href = role.toLowerCase() === 'admin'
        ? '../pages/admin.html'
        : '../pages/home.html';
})();
