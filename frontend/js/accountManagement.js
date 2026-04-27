/**
 * accountManagement.js
 * Quản lý tài khoản — Admin
 * Hỗ trợ: tìm kiếm, lọc theo role/trạng thái, sắp xếp cột, phân trang
 */

'use strict';

// ── State ────────────────────────────────────────────────────
let _allUsers    = [];          // dữ liệu gốc từ API
let _sortCol     = 'createdAt'; // cột đang sort
let _sortDir     = 'desc';      // 'asc' | 'desc'
let _currentPage = 1;
const PAGE_SIZE  = 15;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});

// ── Load data from API ────────────────────────────────────────
async function loadUsers() {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;color:#3b82f6;"></i><br><span style="margin-top:8px;display:block;color:#64748b;">Đang tải dữ liệu...</span></td></tr>';
    document.getElementById('am-count').textContent = '';

    try {
        const response = await apiFetchAuth('/api/admin/users', { method: 'GET' });
        const res      = await response.json();
        if (!response.ok || !res.success) throw new Error(res.message || 'Lỗi tải dữ liệu');

        _allUsers    = res.data || [];
        _currentPage = 1;
        applyFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:32px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size:24px;"></i><br>
            <span style="display:block;margin-top:8px;">Lỗi: ${e.message}</span>
        </td></tr>`;
    }
}

// ── Filter + Sort + Paginate ─────────────────────────────────
function applyFilters() {
    const keyword    = (document.getElementById('am-search')?.value || '').trim().toLowerCase();
    const roleFilter = document.getElementById('am-filter-role')?.value   || '';
    const stFilter   = document.getElementById('am-filter-status')?.value || '';
    const sortVal    = document.getElementById('am-sort')?.value || 'createdAt_desc';

    // Toggle clear btn
    const clearBtn = document.getElementById('am-clear-btn');
    if (clearBtn) clearBtn.style.display = keyword ? 'flex' : 'none';

    // Parse sort dropdown
    const [col, dir] = sortVal.split('_');
    _sortCol = col;
    _sortDir = dir;
    updateSortHeaders(col, dir);

    // 1. Filter
    let filtered = _allUsers.filter(u => {
        // keyword search
        if (keyword) {
            const haystack = [u.id, u.email, u.displayName, u.fullName, u.role]
                .filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(keyword)) return false;
        }
        // role filter
        if (roleFilter && u.role !== roleFilter) return false;
        // status filter
        if (stFilter === 'active'  && u.isApproved === false) return false;
        if (stFilter === 'blocked' && u.isApproved !== false)  return false;
        return true;
    });

    // 2. Sort
    filtered = sortUsers(filtered, _sortCol, _sortDir);

    // 3. Count
    const countEl = document.getElementById('am-count');
    if (countEl) {
        countEl.textContent = filtered.length === _allUsers.length
            ? `${filtered.length} tài khoản`
            : `${filtered.length} / ${_allUsers.length} tài khoản`;
    }

    // 4. Paginate
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (_currentPage > totalPages) _currentPage = totalPages;

    const start  = (_currentPage - 1) * PAGE_SIZE;
    const paged  = filtered.slice(start, start + PAGE_SIZE);

    renderTable(paged, filtered.length === 0);
    renderPagination(totalPages, filtered.length);
}

// ── Sort logic ────────────────────────────────────────────────
function sortUsers(list, col, dir) {
    return [...list].sort((a, b) => {
        let va, vb;
        switch (col) {
            case 'email':
                va = (a.email || '').toLowerCase();
                vb = (b.email || '').toLowerCase();
                break;
            case 'name':
                va = (a.displayName || a.fullName || '').toLowerCase();
                vb = (b.displayName || b.fullName || '').toLowerCase();
                break;
            case 'role':
                va = (a.role || '').toLowerCase();
                vb = (b.role || '').toLowerCase();
                break;
            case 'status':
                va = a.isApproved === false ? 0 : 1;
                vb = b.isApproved === false ? 0 : 1;
                break;
            case 'createdAt':
                va = new Date(a.createdAt || 0).getTime();
                vb = new Date(b.createdAt || 0).getTime();
                break;
            default: // id
                va = (a.id || '').toLowerCase();
                vb = (b.id || '').toLowerCase();
        }
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

// ── Column header click sort ──────────────────────────────────
function sortByCol(col) {
    if (_sortCol === col) {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        _sortCol = col;
        _sortDir = 'asc';
    }
    // Sync dropdown
    const sortEl = document.getElementById('am-sort');
    const wantedVal = `${col}_${_sortDir}`;
    for (const opt of sortEl.options) {
        if (opt.value === wantedVal) { sortEl.value = wantedVal; break; }
    }
    _currentPage = 1;
    applyFilters();
}

// ── Update sort icon on headers ───────────────────────────────
function updateSortHeaders(col, dir) {
    document.querySelectorAll('.am-th-sort').forEach(th => {
        const icon = th.querySelector('.am-sort-icon');
        if (!icon) return;
        const isActive = th.dataset.col === col;
        icon.className = 'fa-solid am-sort-icon' + (isActive ? ' active-sort' : '');
        if (isActive) {
            icon.classList.add(dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
        } else {
            icon.classList.add('fa-sort');
        }
    });
}

// ── Render table rows ─────────────────────────────────────────
function renderTable(users, isEmpty) {
    const tbody        = document.getElementById('user-table-body');
    const currentUserId = sessionStorage.getItem('userId') || '';
    const keyword      = (document.getElementById('am-search')?.value || '').trim();

    if (isEmpty) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748b;">
            <i class="fa-solid fa-inbox" style="font-size:28px;display:block;margin-bottom:8px;color:#cbd5e1;"></i>
            Không tìm thấy tài khoản phù hợp.
        </td></tr>`;
        return;
    }

    const roleLabels = { Admin: 'Quản trị viên', Recruiter: 'Nhà tuyển dụng', Candidate: 'Ứng viên' };
    let html = '';

    users.forEach(u => {
        const isApproved = u.isApproved !== false;
        const isSelf     = u.id === currentUserId;
        const dateStr    = u.createdAt
            ? new Date(u.createdAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })
            : '—';

        // Actions
        let btnHtml = '';
        if (isSelf) {
            btnHtml = '<span style="color:#94a3b8;font-style:italic;font-size:13px;">—</span>';
        } else {
            btnHtml += isApproved
                ? `<button class="btn-action btn-delete" onclick="toggleBlockUser('${u.id}')" title="Chặn tài khoản"><i class="fa-solid fa-ban"></i></button>`
                : `<button class="btn-action btn-toggle" onclick="toggleBlockUser('${u.id}')" title="Bỏ chặn tài khoản"><i class="fa-solid fa-unlock"></i></button>`;
            if (u.role !== 'Admin') {
                btnHtml += `<button class="btn-action btn-delete" onclick="deleteUser('${u.id}')" title="Xóa tài khoản"><i class="fa-solid fa-trash-can"></i></button>`;
            }
        }

        // Status
        const statusBadge = isApproved
            ? '<span class="badge badge-active">Hoạt động</span>'
            : '<span class="badge badge-blocked">Bị chặn</span>';

        // Role cell
        let roleHtml = '';
        if (isSelf) {
            roleHtml = `<span class="badge badge-active" style="background:#6366f1;color:#fff;">${roleLabels[u.role] || u.role} (Bạn)</span>`;
        } else {
            roleHtml = `<select class="role-select" onchange="changeRole('${u.id}', this.value)">
                ${['Recruiter','Candidate'].map(r =>
                    `<option value="${r}" ${u.role === r ? 'selected' : ''}>${roleLabels[r]}</option>`
                ).join('')}
            </select>`;
        }

        // Provider icon
        let providerIcon = '<i class="fa-solid fa-envelope text-primary"></i>';
        if      (u.provider === 'Google') providerIcon = '<i class="fa-brands fa-google text-danger"></i>';
        else if (u.provider === 'GitHub') providerIcon = '<i class="fa-brands fa-github text-dark"></i>';

        // Email with highlight
        const emailText   = u.email || '';
        const displayName = u.displayName || u.fullName || '—';

        const rowBg = !isApproved ? 'style="background:#fef2f2;"' : '';

        html += `
            <tr ${rowBg}>
                <td><small style="font-family:monospace;font-size:11px;color:#94a3b8;">${u.id.substring(0,8)}…</small></td>
                <td>
                    <strong>${highlight(emailText, keyword)}</strong>
                    ${!isApproved ? '<i class="fa-solid fa-ban text-danger" style="margin-left:4px;"></i>' : ''}
                    <small style="display:block;margin-top:3px;">${providerIcon} ${u.provider || 'Local'}</small>
                </td>
                <td>${highlight(displayName, keyword)}</td>
                <td>${roleHtml}</td>
                <td>${statusBadge}</td>
                <td style="white-space:nowrap;color:#64748b;font-size:13px;">${dateStr}</td>
                <td>${btnHtml}</td>
            </tr>`;
    });

    tbody.innerHTML = html;
}

// ── Highlight search keyword ──────────────────────────────────
function highlight(text, keyword) {
    if (!keyword || !text) return text || '—';
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'),
        '<mark style="background:#fef9c3;color:#92400e;border-radius:3px;padding:0 2px;">$1</mark>');
}

// ── Pagination ────────────────────────────────────────────────
function renderPagination(totalPages, totalCount) {
    const el = document.getElementById('am-pagination');
    if (!el) return;

    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const start = (_currentPage - 1) * PAGE_SIZE + 1;
    const end   = Math.min(_currentPage * PAGE_SIZE, totalCount);

    let html = `<span class="am-page-info">Hiển thị ${start}–${end} / ${totalCount}</span>`;

    // Prev
    html += `<button class="am-page-btn" ${_currentPage === 1 ? 'disabled' : ''} onclick="goPage(${_currentPage - 1})">
        <i class="fa-solid fa-chevron-left"></i>
    </button>`;

    // Page numbers
    const pages = getPageRange(totalPages, _currentPage);
    pages.forEach(p => {
        if (p === '…') {
            html += `<span class="am-page-dots">…</span>`;
        } else {
            html += `<button class="am-page-btn ${p === _currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
        }
    });

    // Next
    html += `<button class="am-page-btn" ${_currentPage === totalPages ? 'disabled' : ''} onclick="goPage(${_currentPage + 1})">
        <i class="fa-solid fa-chevron-right"></i>
    </button>`;

    el.innerHTML = html;
}

function getPageRange(total, current) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (current >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total];
    return [1, '…', current-1, current, current+1, '…', total];
}

function goPage(page) {
    _currentPage = page;
    applyFilters();
    document.querySelector('.data-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Clear search ──────────────────────────────────────────────
function clearSearch() {
    const inp = document.getElementById('am-search');
    if (inp) inp.value = '';
    _currentPage = 1;
    applyFilters();
    inp?.focus();
}

// ── Actions (unchanged logic, improved UX) ────────────────────
async function deleteUser(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?\nThao tác sẽ xóa luôn tất cả công ty và tin tuyển dụng liên quan!')) return;
    try {
        const response = await apiFetchAuth('/api/admin/users/' + id, { method: 'DELETE' });
        if (response.ok) {
            showToast('Đã xóa tài khoản thành công!', 'success');
            await loadUsers();
        } else {
            const error = await response.json();
            showToast('Lỗi: ' + (error.message || 'Không xác định'), 'error');
        }
    } catch (e) {
        showToast('Lỗi mạng: ' + e.message, 'error');
    }
}

async function toggleBlockUser(id) {
    if (!confirm('Bạn có chắc chắn muốn thay đổi trạng thái chặn của tài khoản này?')) return;
    try {
        const response = await apiFetchAuth(`/api/admin/users/${id}/toggle-block`, { method: 'PUT' });
        if (response.ok) {
            showToast('Đã cập nhật trạng thái tài khoản!', 'success');
            await loadUsers();
        } else {
            const error = await response.json();
            showToast('Lỗi: ' + (error.message || ''), 'error');
        }
    } catch (e) {
        showToast('Lỗi mạng.', 'error');
    }
}

async function changeRole(id, newRole) {
    const roleLabels = { Recruiter: 'Nhà tuyển dụng', Candidate: 'Ứng viên' };
    const label = roleLabels[newRole] || newRole;
    if (!confirm(`Bạn muốn chuyển quyền của tài khoản này thành "${label}"?`)) {
        await loadUsers(); return;
    }
    try {
        const response = await apiFetchAuth(`/api/admin/users/${id}/role`, {
            method: 'PUT',
            body: JSON.stringify({ newRole })
        });
        if (response.ok) {
            showToast(`Đã phân quyền "${label}" thành công!`, 'success');
            await loadUsers();
        } else {
            const error = await response.json();
            showToast('Lỗi: ' + (error.message || ''), 'error');
            await loadUsers();
        }
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
        await loadUsers();
    }
}

// ── Toast notification ────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.getElementById('am-toast');
    existing?.remove();

    const toast = document.createElement('div');
    toast.id = 'am-toast';
    toast.style.cssText = `
        position:fixed;bottom:28px;right:28px;z-index:9999;
        padding:14px 22px;border-radius:12px;font-family:'Inter',sans-serif;
        font-size:14px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.15);
        display:flex;align-items:center;gap:10px;
        animation:toastIn 0.3s ease;
        background:${type==='success' ? '#10b981' : '#ef4444'};color:#fff;
    `;
    toast.innerHTML = `<i class="fa-solid ${type==='success' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${message}`;

    if (!document.getElementById('am-toast-style')) {
        const style = document.createElement('style');
        style.id = 'am-toast-style';
        style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
