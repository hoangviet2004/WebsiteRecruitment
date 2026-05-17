'use strict';

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
});

async function loadDashboardStats() {
    const now = new Date();
    let users = [], jobs = [];

    // ── Users ─────────────────────────────────────────────────
    try {
        const res  = await apiFetchAuth('/api/admin/users', { method: 'GET' });
        const data = await res.json();
        if (res.ok && data.success) {
            users = data.data || [];
            document.getElementById('stat-users').textContent      = users.length;
            document.getElementById('stat-candidates').textContent = users.filter(u => u.role === 'Candidate').length;
            document.getElementById('stat-recruiters').textContent = users.filter(u => u.role === 'Recruiter').length;
        }
    } catch (e) { console.error('Lỗi load users:', e); }

    // ── Jobs ──────────────────────────────────────────────────
    try {
        const res  = await apiFetchAuth('/api/admin/jobs', { method: 'GET' });
        const data = await res.json();
        if (res.ok && data.success) {
            jobs = data.data || [];
            const pending = jobs.filter(j => !j.isApproved && !j.isBlocked);
            const active  = jobs.filter(j => j.isApproved && new Date(j.expiresAt) >= now);
            const expired = jobs.filter(j => new Date(j.expiresAt) < now);
            document.getElementById('stat-jobs').textContent         = jobs.length;
            document.getElementById('stat-pending-jobs').textContent = pending.length;
            document.getElementById('stat-active-jobs').textContent  = active.length;
            document.getElementById('stat-expired-jobs').textContent = expired.length;
        }
    } catch (e) { console.error('Lỗi load jobs:', e); }

    // ── Applications estimate ─────────────────────────────────
    try {
        const res  = await apiFetchAuth('/api/admin/statistics/overview', { method: 'GET' });
        const data = await res.json();
        if (res.ok && data.success) {
            document.getElementById('stat-applications').textContent = data.data?.totalApplicationsEstimate ?? '--';
        }
    } catch (e) { console.error('Lỗi load applications:', e); }

    // ── Widgets ───────────────────────────────────────────────
    renderPendingJobs(jobs);
    renderRecentUsers(users);
    renderAlerts(jobs, now);
}

// ── Widget: Tin chờ duyệt ─────────────────────────────────────
function renderPendingJobs(jobs) {
    const el      = document.getElementById('widget-pending-body');
    const badgeEl = document.getElementById('badge-pending');
    const pending = jobs
        .filter(j => !j.isApproved && !j.isBlocked)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (badgeEl) badgeEl.textContent = pending.length;

    if (!pending.length) {
        el.innerHTML = `
            <div style="text-align:center;padding:36px;color:#64748b;">
                <i class="fa-solid fa-circle-check" style="font-size:32px;color:#10b981;"></i>
                <p style="margin-top:10px;font-weight:500;">Không có tin nào chờ duyệt</p>
            </div>`;
        return;
    }

    const rows = pending.slice(0, 8).map(j => {
        const date = new Date(j.createdAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
        const typeColor = { 'Full-time':'#3b82f6', 'Part-time':'#8b5cf6', 'Remote':'#10b981', 'Freelance':'#f59e0b' };
        const color = typeColor[j.jobType] || '#64748b';
        return `
            <tr>
                <td style="max-width:220px;">
                    <div style="font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(j.title)}</div>
                </td>
                <td style="color:#475569;font-size:13px;">${escHtml(j.companyName)}</td>
                <td><span style="background:${color}1a;color:${color};font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;">${escHtml(j.jobType || '—')}</span></td>
                <td style="color:#64748b;font-size:13px;white-space:nowrap;">${date}</td>
                <td>
                    <button onclick="approveJob('${j.id}')" style="padding:5px 12px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                        <i class="fa-solid fa-check"></i> Duyệt
                    </button>
                </td>
            </tr>`;
    }).join('');

    el.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#64748b;">Tiêu đề</th>
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#64748b;">Công ty</th>
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#64748b;">Loại</th>
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#64748b;">Ngày đăng</th>
                    <th style="padding:10px 16px;text-align:left;font-weight:600;color:#64748b;">Thao tác</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;

    el.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.borderBottom = '1px solid #f1f5f9';
        tr.querySelectorAll('td').forEach(td => { td.style.padding = '10px 16px'; });
    });
}

// ── Widget: Người dùng mới nhất ───────────────────────────────
function renderRecentUsers(users) {
    const el = document.getElementById('widget-recent-users');
    const recent = [...users]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8);

    if (!recent.length) {
        el.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8;">Chưa có dữ liệu</div>`;
        return;
    }

    const roleStyle = {
        Candidate: { bg: '#eff6ff', color: '#2563eb', label: 'Ứng viên' },
        Recruiter: { bg: '#f0fdf4', color: '#16a34a', label: 'NTD' },
        Admin:     { bg: '#fef3c7', color: '#92400e', label: 'Admin' },
    };

    el.innerHTML = recent.map(u => {
        const initials = (u.displayName || u.email || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
        const rs = roleStyle[u.role] || { bg: '#f1f5f9', color: '#475569', label: u.role };
        const date = new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid #f1f5f9;">
                <div style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;color:#4338ca;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;color:#0f172a;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(u.displayName || '—')}</div>
                    <div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(u.email)}</div>
                </div>
                <span style="background:${rs.bg};color:${rs.color};font-size:11px;font-weight:600;padding:2px 7px;border-radius:20px;flex-shrink:0;">${rs.label}</span>
                <span style="font-size:11px;color:#94a3b8;flex-shrink:0;">${date}</span>
            </div>`;
    }).join('');
}

// ── Widget: Cảnh báo hệ thống ─────────────────────────────────
function renderAlerts(jobs, now) {
    const el = document.getElementById('widget-alerts');
    const alerts = [];

    const in7days = new Date(now); in7days.setDate(now.getDate() + 7);
    const expiringSoon = jobs.filter(j => j.isApproved && !j.isBlocked && new Date(j.expiresAt) > now && new Date(j.expiresAt) <= in7days);
    if (expiringSoon.length)
        alerts.push({ icon: 'fa-hourglass-half', color: '#f59e0b', bg: '#fef3c7', text: `${expiringSoon.length} tin tuyển dụng sắp hết hạn trong 7 ngày tới` });

    const blocked = jobs.filter(j => j.isBlocked);
    if (blocked.length)
        alerts.push({ icon: 'fa-ban', color: '#ef4444', bg: '#fef2f2', text: `${blocked.length} tin tuyển dụng đang bị chặn` });

    const expired = jobs.filter(j => j.isApproved && new Date(j.expiresAt) < now);
    if (expired.length)
        alerts.push({ icon: 'fa-calendar-xmark', color: '#64748b', bg: '#f1f5f9', text: `${expired.length} tin tuyển dụng đã hết hạn` });

    if (!alerts.length) {
        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;color:#10b981;">
                <i class="fa-solid fa-circle-check" style="font-size:18px;"></i>
                <span style="font-weight:500;">Hệ thống hoạt động bình thường, không có cảnh báo.</span>
            </div>`;
        return;
    }

    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:12px;">` +
        alerts.map(a => `
            <div style="display:flex;align-items:center;gap:10px;background:${a.bg};padding:10px 16px;border-radius:10px;flex:1;min-width:200px;">
                <i class="fa-solid ${a.icon}" style="color:${a.color};font-size:16px;flex-shrink:0;"></i>
                <span style="font-size:13px;font-weight:500;color:#1e293b;">${a.text}</span>
            </div>`).join('') +
        `</div>`;
}

// ── Approve job từ widget ─────────────────────────────────────
async function approveJob(id) {
    try {
        const res = await apiFetchAuth(`/api/admin/jobs/${id}/approve`, { method: 'PUT' });
        if (res.ok) {
            showAdminToast('Đã duyệt tin tuyển dụng thành công!', 'success');
            await loadDashboardStats();
        } else {
            showAdminToast('Duyệt thất bại, vui lòng thử lại.', 'error');
        }
    } catch (e) {
        showAdminToast('Lỗi kết nối: ' + e.message, 'error');
    }
}

// ── Utilities ─────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '—';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showAdminToast(message, type = 'success') {
    document.getElementById('admin-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.style.cssText = `
        position:fixed;bottom:28px;right:28px;z-index:9999;
        padding:14px 22px;border-radius:12px;font-family:'Inter',sans-serif;
        font-size:14px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.15);
        display:flex;align-items:center;gap:10px;
        background:${type === 'success' ? '#10b981' : '#ef4444'};color:#fff;`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${escHtml(message)}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
