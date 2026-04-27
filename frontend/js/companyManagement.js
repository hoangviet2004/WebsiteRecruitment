/**
 * companyManagement.js
 * Quản lý công ty — Admin
 * Hỗ trợ: tìm kiếm, lọc (quy mô, logo), sắp xếp cột, phân trang
 */

'use strict';

// ── State ────────────────────────────────────────────────────
let _allCompanies = [];
let _sortCol      = 'createdAt';
let _sortDir      = 'desc';
let _currentPage  = 1;
const PAGE_SIZE   = 15;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
});

// ── Load data ─────────────────────────────────────────────────
async function loadCompanies() {
    const tbody = document.getElementById('company-table-body');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:20px;color:#3b82f6;"></i>
        <span style="display:block;margin-top:8px;color:#64748b;">Đang tải dữ liệu...</span>
    </td></tr>`;
    const cmCount = document.getElementById('cm-count');
    if (cmCount) cmCount.textContent = '';

    try {
        const response = await apiFetchAuth('/api/admin/companies', { method: 'GET' });
        const res      = await response.json();
        if (!response.ok || !res.success) throw new Error(res.message || 'Lỗi tải dữ liệu');

        _allCompanies = res.data || [];
        _currentPage  = 1;
        applyFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:32px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size:24px;"></i>
            <span style="display:block;margin-top:8px;">Lỗi: ${e.message}</span>
        </td></tr>`;
    }
}

// ── Filter + Sort + Paginate ─────────────────────────────────
function applyFilters() {
    const keyword    = (document.getElementById('cm-search')?.value || '').trim().toLowerCase();
    const sizeFilter = document.getElementById('cm-filter-size')?.value  || '';
    const logoFilter = document.getElementById('cm-filter-logo')?.value  || '';
    const sortVal    = document.getElementById('cm-sort')?.value || 'createdAt_desc';

    // Toggle clear btn
    const clearBtn = document.getElementById('cm-clear-btn');
    if (clearBtn) clearBtn.style.display = keyword ? 'flex' : 'none';

    // Parse sort
    const [col, dir] = sortVal.split('_');
    _sortCol = col;
    _sortDir = dir;
    updateSortHeaders(col, dir);

    // 1. Filter
    let filtered = _allCompanies.filter(c => {
        if (keyword) {
            const hay = [c.name, c.address, c.website, c.description, c.companySize]
                .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(keyword)) return false;
        }
        if (sizeFilter && c.companySize !== sizeFilter) return false;
        if (logoFilter === 'yes' && !c.logoUrl)  return false;
        if (logoFilter === 'no'  &&  c.logoUrl)  return false;
        return true;
    });

    // 2. Sort
    filtered = sortCompanies(filtered, _sortCol, _sortDir);

    // 3. Count
    const countEl = document.getElementById('cm-count');
    if (countEl) {
        countEl.textContent = filtered.length === _allCompanies.length
            ? `${filtered.length} công ty`
            : `${filtered.length} / ${_allCompanies.length} công ty`;
    }

    // 4. Paginate
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (_currentPage > totalPages) _currentPage = totalPages;

    const start = (_currentPage - 1) * PAGE_SIZE;
    const paged = filtered.slice(start, start + PAGE_SIZE);

    renderTable(paged, filtered.length === 0);
    renderPagination(totalPages, filtered.length);
}

// ── Sort logic ────────────────────────────────────────────────
function sortCompanies(list, col, dir) {
    return [...list].sort((a, b) => {
        let va, vb;
        switch (col) {
            case 'name':
                va = (a.name || '').toLowerCase();
                vb = (b.name || '').toLowerCase();
                break;
            case 'address':
                va = (a.address || '').toLowerCase();
                vb = (b.address || '').toLowerCase();
                break;
            case 'size': {
                // Sort by numeric value of companySize range
                const sizeOrder = { '1-50': 1, '50-150': 2, '150-500': 3, '500+': 4 };
                va = sizeOrder[a.companySize] ?? 0;
                vb = sizeOrder[b.companySize] ?? 0;
                break;
            }
            case 'createdAt':
                va = new Date(a.createdAt || 0).getTime();
                vb = new Date(b.createdAt || 0).getTime();
                break;
            default:
                va = (a.name || '').toLowerCase();
                vb = (b.name || '').toLowerCase();
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
    // Sync dropdown where possible
    const sortEl = document.getElementById('cm-sort');
    const wantedVal = `${col}_${_sortDir}`;
    for (const opt of sortEl.options) {
        if (opt.value === wantedVal) { sortEl.value = wantedVal; break; }
    }
    _currentPage = 1;
    applyFilters();
}

// ── Update sort icons ─────────────────────────────────────────
function updateSortHeaders(col, dir) {
    document.querySelectorAll('.am-th-sort').forEach(th => {
        const icon = th.querySelector('.am-sort-icon');
        if (!icon) return;
        const isActive = th.dataset.col === col;
        icon.className = 'fa-solid am-sort-icon' + (isActive ? ' active-sort' : '');
        icon.classList.add(isActive ? (dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort');
    });
}

// ── Render table ──────────────────────────────────────────────
function renderTable(companies, isEmpty) {
    const tbody   = document.getElementById('company-table-body');
    const keyword = (document.getElementById('cm-search')?.value || '').trim();

    if (isEmpty) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748b;">
            <i class="fa-solid fa-inbox" style="font-size:28px;display:block;margin-bottom:8px;color:#cbd5e1;"></i>
            Không tìm thấy công ty phù hợp.
        </td></tr>`;
        return;
    }

    let html = '';
    companies.forEach(c => {
        // Logo cell
        const logoHtml = c.logoUrl
            ? `<img src="${c.logoUrl}" class="company-logo" alt="${escHtml(c.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="company-logo-placeholder" style="display:none;">${initials(c.name)}</div>`
            : `<div class="company-logo-placeholder">${initials(c.name)}</div>`;

        // Website link
        const webHtml = c.website
            ? `<a href="${c.website}" target="_blank" rel="noopener" class="cm-link">
                   <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;margin-right:4px;"></i>${truncate(c.website, 28)}
               </a>`
            : '<span style="color:#94a3b8;">—</span>';

        // Company size badge
        const sizeBadge = c.companySize
            ? `<span class="cm-size-badge">${c.companySize}</span>`
            : '<span style="color:#94a3b8;font-size:13px;">—</span>';

        // Date
        const dateStr = c.createdAt
            ? new Date(c.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';

        html += `
            <tr>
                <td>
                    <div class="cm-logo-cell">${logoHtml}</div>
                </td>
                <td>
                    <div class="cm-name-cell">
                        <strong>${highlight(escHtml(c.name), keyword)}</strong>
                        ${c.description
                            ? `<small style="display:block;color:#94a3b8;font-size:12px;margin-top:2px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.description)}</small>`
                            : ''}
                    </div>
                </td>
                <td style="max-width:200px;">
                    ${c.address
                        ? `<span style="color:#475569;">${highlight(escHtml(c.address), keyword)}</span>`
                        : '<span style="color:#94a3b8;">—</span>'}
                </td>
                <td>${webHtml}</td>
                <td>${sizeBadge}</td>
                <td style="white-space:nowrap;color:#64748b;font-size:13px;">${dateStr}</td>
                <td>
                    <button class="btn-action btn-delete" onclick="deleteCompany('${c.id}')" title="Xóa công ty">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

// ── Pagination ────────────────────────────────────────────────
function renderPagination(totalPages, totalCount) {
    const el = document.getElementById('cm-pagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const start = (_currentPage - 1) * PAGE_SIZE + 1;
    const end   = Math.min(_currentPage * PAGE_SIZE, totalCount);
    let html = `<span class="am-page-info">Hiển thị ${start}–${end} / ${totalCount}</span>`;

    html += `<button class="am-page-btn" ${_currentPage === 1 ? 'disabled' : ''} onclick="goPage(${_currentPage - 1})">
        <i class="fa-solid fa-chevron-left"></i></button>`;

    getPageRange(totalPages, _currentPage).forEach(p => {
        html += p === '…'
            ? `<span class="am-page-dots">…</span>`
            : `<button class="am-page-btn ${p === _currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
    });

    html += `<button class="am-page-btn" ${_currentPage === totalPages ? 'disabled' : ''} onclick="goPage(${_currentPage + 1})">
        <i class="fa-solid fa-chevron-right"></i></button>`;

    el.innerHTML = html;
}

function getPageRange(total, current) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', current - 1, current, current + 1, '…', total];
}

function goPage(page) {
    _currentPage = page;
    applyFilters();
    document.querySelector('.data-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Clear search ──────────────────────────────────────────────
function clearSearch() {
    const inp = document.getElementById('cm-search');
    if (inp) inp.value = '';
    _currentPage = 1;
    applyFilters();
    inp?.focus();
}

// ── Delete company ────────────────────────────────────────────
async function deleteCompany(id) {
    if (!confirm('Hành động này sẽ xóa vĩnh viễn công ty và toàn bộ tin tuyển dụng liên quan.\nBạn có chắc chắn không?')) return;

    try {
        const response = await apiFetchAuth('/api/admin/companies/' + id, { method: 'DELETE' });
        if (response.ok) {
            showToast('Đã xóa công ty thành công!', 'success');
            await loadCompanies();
        } else {
            const error = await response.json();
            showToast('Lỗi: ' + (error.message || 'Không xác định'), 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối: ' + e.message, 'error');
    }
}

// ── Utilities ─────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlight(text, keyword) {
    if (!keyword || !text) return text || '—';
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'),
        '<mark style="background:#fef9c3;color:#92400e;border-radius:3px;padding:0 2px;">$1</mark>');
}

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2)
        .map(w => w[0]?.toUpperCase() || '').join('');
}

function truncate(str, len) {
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

function showToast(message, type = 'success') {
    document.getElementById('cm-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'cm-toast';
    toast.style.cssText = `
        position:fixed;bottom:28px;right:28px;z-index:9999;
        padding:14px 22px;border-radius:12px;font-family:'Inter',sans-serif;
        font-size:14px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.15);
        display:flex;align-items:center;gap:10px;
        animation:toastIn 0.3s ease;
        background:${type === 'success' ? '#10b981' : '#ef4444'};color:#fff;
    `;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${escHtml(message)}`;

    if (!document.getElementById('cm-toast-style')) {
        const s = document.createElement('style');
        s.id = 'cm-toast-style';
        s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(s);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
