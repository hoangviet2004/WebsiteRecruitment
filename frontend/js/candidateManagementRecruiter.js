// ============================================================
// candidateManagementRecruiter.js
// Quản lý ứng viên trong tab recruiter - recruiter.html
// ============================================================

let _allApplications = [];   // toàn bộ dữ liệu thô
let _filteredApps    = [];   // sau khi lọc
let _currentPage     = 1;
const PAGE_SIZE      = 10;
let _currentAppId    = null; // đơn đang mở trong modal

// Màu avatar theo index
const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#6366f1','#14b8a6'];
function getAvatarColor(str) {
    let h = 0;
    for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Status helpers ──────────────────────────────────────────
const STATUS_CONFIG = {
    Applied:   { label: 'Mới nộp',   cls: 'applied',   icon: 'fa-file-pen' },
    Screening: { label: 'Sàng lọc',  cls: 'screening', icon: 'fa-magnifying-glass' },
    Interview: { label: 'Phỏng vấn', cls: 'interview', icon: 'fa-comments' },
    Offered:   { label: 'Đề nghị',   cls: 'offered',   icon: 'fa-handshake' },
    OnHold:    { label: 'Tạm giữ',   cls: 'onhold',    icon: 'fa-clock' },
    Rejected:  { label: 'Từ chối',   cls: 'rejected',  icon: 'fa-xmark' }
};

function statusBadge(status) {
    const cfg = STATUS_CONFIG[status] || { label: status, cls: 'applied', icon: 'fa-circle' };
    return `<span class="badge badge-${cfg.cls}"><i class="fa-solid ${cfg.icon}"></i> ${cfg.label}</span>`;
}

// ── Tải dữ liệu từ API ──────────────────────────────────────
async function loadCandidates() {
    if (!currentCompanyId) {
        document.getElementById('cand-table-body').innerHTML =
            `<tr><td colspan="5" class="cand-loading"><i class="fa-solid fa-circle-info" style="color:#f59e0b;"></i> Vui lòng tạo Hồ sơ Công ty trước.</td></tr>`;
        return;
    }

    document.getElementById('cand-table-body').innerHTML =
        `<tr><td colspan="5" class="cand-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>`;
    document.getElementById('cand-count-label').textContent = 'Đang tải...';
    document.getElementById('cand-stats-row').innerHTML = '';

    try {
        const res = await apiFetchAuth(`/api/applications/company/${currentCompanyId}`, { method: 'GET' });
        const data = await res.json();

        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi tải dữ liệu');

        _allApplications = data.data || [];
        populateJobFilter();
        applyCandidateFilters();
        renderStats();
    } catch (e) {
        document.getElementById('cand-table-body').innerHTML =
            `<tr><td colspan="5" class="cand-loading" style="color:#ef4444;"><i class="fa-solid fa-circle-exclamation"></i> ${e.message}</td></tr>`;
    }
}

// ── Điền filter "Vị trí tuyển dụng" ────────────────────────
function populateJobFilter() {
    const sel = document.getElementById('filter-job');
    const seen = new Set();
    sel.innerHTML = '<option value="">Tất cả vị trí</option>';
    _allApplications.forEach(a => {
        if (!seen.has(a.jobPostId)) {
            seen.add(a.jobPostId);
            const opt = document.createElement('option');
            opt.value = a.jobPostId;
            opt.textContent = a.jobTitle || 'Vị trí không tên';
            sel.appendChild(opt);
        }
    });
}

// ── Áp dụng bộ lọc ─────────────────────────────────────────
function applyCandidateFilters() {
    const jobId  = document.getElementById('filter-job').value;
    const status = document.getElementById('filter-status').value;
    const search = (document.getElementById('filter-search').value || '').toLowerCase().trim();

    _filteredApps = _allApplications.filter(a => {
        if (jobId  && a.jobPostId !== jobId) return false;
        if (status && a.status !== status) return false;
        if (search) {
            const inName  = (a.candidateName || '').toLowerCase().includes(search);
            const inEmail = (a.candidateEmail || '').toLowerCase().includes(search);
            if (!inName && !inEmail) return false;
        }
        return true;
    });

    _currentPage = 1;
    renderTable();
    renderPagination();
}

// ── Render bảng ─────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('cand-table-body');
    const label = document.getElementById('cand-count-label');
    const total = _filteredApps.length;

    label.textContent = `${total} ứng viên`;

    if (total === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="cand-loading"><i class="fa-solid fa-inbox" style="color:#cbd5e1;"></i> Không có ứng viên nào.</td></tr>`;
        return;
    }

    const start = (_currentPage - 1) * PAGE_SIZE;
    const page  = _filteredApps.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = page.map(a => {
        const color    = getAvatarColor(a.candidateName || a.candidateEmail);
        const initials = getInitials(a.candidateName);
        const avatarHtml = a.avatarUrl
            ? `<img src="${a.avatarUrl}" class="cand-avatar" alt="">`
            : `<span class="cand-initials" style="background:${color};">${initials}</span>`;

        const dateStr = new Date(a.appliedAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });

        return `<tr>
            <td>
                <div class="cand-info">
                    ${avatarHtml}
                    <div>
                        <div class="cand-name">${escHtml(a.candidateName || 'Ứng viên')}</div>
                        <div class="cand-email">${escHtml(a.candidateEmail || '')}</div>
                    </div>
                </div>
            </td>
            <td><span style="font-weight:500; color:#0f172a;">${escHtml(a.jobTitle || '')}</span></td>
            <td style="color:#64748b; font-size:13px;">${dateStr}</td>
            <td>${statusBadge(a.status)}</td>
            <td>
                <button class="cand-action-btn view" title="Xem hồ sơ" onclick="openCandModal('${a.id}')">
                    <i class="fa-solid fa-eye"></i> Xem
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Phân trang ──────────────────────────────────────────────
function renderPagination() {
    const container = document.getElementById('cand-pagination');
    const total     = _filteredApps.length;
    const pages     = Math.ceil(total / PAGE_SIZE);

    if (pages <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="cand-page-btn" onclick="goPage(${_currentPage - 1})" ${_currentPage === 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i></button>`;

    for (let i = 1; i <= pages; i++) {
        if (pages > 7 && i > 3 && i < pages - 1 && Math.abs(i - _currentPage) > 1) {
            if (i === 4) html += `<span style="color:#94a3b8;padding:0 4px;">…</span>`;
            continue;
        }
        html += `<button class="cand-page-btn ${i === _currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    }

    html += `<button class="cand-page-btn" onclick="goPage(${_currentPage + 1})" ${_currentPage === pages ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-right"></i></button>`;

    container.innerHTML = html;
}

function goPage(page) {
    const pages = Math.ceil(_filteredApps.length / PAGE_SIZE);
    if (page < 1 || page > pages) return;
    _currentPage = page;
    renderTable();
    renderPagination();
}

// ── Thống kê nhanh ──────────────────────────────────────────
function renderStats() {
    const total       = _allApplications.length;
    const interviews  = _allApplications.filter(a => a.status === 'Interview').length;
    const pending     = _allApplications.filter(a => a.status === 'Applied' || a.status === 'Screening').length;

    document.getElementById('cand-stats-row').innerHTML = `
        <div class="cand-stat-card">
            <div class="cand-stat-icon blue"><i class="fa-solid fa-users"></i></div>
            <div>
                <div class="cand-stat-value">${total}</div>
                <div class="cand-stat-label">Tổng đơn ứng tuyển</div>
            </div>
        </div>
        <div class="cand-stat-card">
            <div class="cand-stat-icon green"><i class="fa-solid fa-comments"></i></div>
            <div>
                <div class="cand-stat-value">${interviews}</div>
                <div class="cand-stat-label">Đang phỏng vấn</div>
            </div>
        </div>
        <div class="cand-stat-card">
            <div class="cand-stat-icon amber"><i class="fa-solid fa-hourglass-half"></i></div>
            <div>
                <div class="cand-stat-value">${pending}</div>
                <div class="cand-stat-label">Chờ xử lý</div>
            </div>
        </div>`;
}

// ── Modal chi tiết ứng viên ─────────────────────────────────
function openCandModal(appId) {
    _currentAppId = appId;
    const app = _allApplications.find(a => a.id === appId);
    if (!app) return;

    const color    = getAvatarColor(app.candidateName || app.candidateEmail);
    const initials = getInitials(app.candidateName);
    const avatarHtml = app.avatarUrl
        ? `<img src="${app.avatarUrl}" class="cand-modal-avatar-lg" alt="">`
        : `<span class="cand-modal-initials-lg" style="background:${color};">${initials}</span>`;

    const dateStr = new Date(app.appliedAt).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const skillsHtml = app.skills
        ? app.skills.split(',').map(s => `<span style="background:#eff6ff;color:#3b82f6;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${escHtml(s.trim())}</span>`).join(' ')
        : '<span style="color:#94a3b8;font-size:13px;">Chưa cập nhật</span>';

    const cvHtml = app.cvUrl
        ? `<a href="${app.cvUrl}" target="_blank" style="color:#3b82f6;text-decoration:none;font-weight:600;"><i class="fa-solid fa-file-pdf"></i> Xem / Tải CV</a>`
        : '<span style="color:#94a3b8;font-size:13px;">Chưa có CV</span>';

    const coverHtml = app.coverLetter
        ? `<div class="cand-cover-letter">
               <div class="cand-cover-letter-label"><i class="fa-solid fa-envelope-open-text" style="margin-right:4px;"></i>Thư giới thiệu</div>
               <div class="cand-cover-letter-text">${escHtml(app.coverLetter)}</div>
           </div>`
        : '';

    document.getElementById('cand-modal-body').innerHTML = `
        <div class="cand-modal-profile">
            ${avatarHtml}
            <div>
                <div class="cand-modal-name">${escHtml(app.candidateName || 'Ứng viên')}</div>
                <div class="cand-modal-email"><i class="fa-solid fa-envelope" style="margin-right:6px;color:#94a3b8;"></i>${escHtml(app.candidateEmail || '')}</div>
                <div style="margin-top:8px;">${statusBadge(app.status)}</div>
            </div>
        </div>

        <div class="cand-detail-grid">
            <div class="cand-detail-item">
                <div class="cand-detail-item-label"><i class="fa-solid fa-briefcase"></i> Vị trí ứng tuyển</div>
                <div class="cand-detail-item-value">${escHtml(app.jobTitle || '—')}</div>
            </div>
            <div class="cand-detail-item">
                <div class="cand-detail-item-label"><i class="fa-solid fa-calendar-check"></i> Ngày nộp đơn</div>
                <div class="cand-detail-item-value">${dateStr}</div>
            </div>
            <div class="cand-detail-item">
                <div class="cand-detail-item-label"><i class="fa-solid fa-tags"></i> Kỹ năng</div>
                <div class="cand-detail-item-value" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${skillsHtml}</div>
            </div>
            <div class="cand-detail-item">
                <div class="cand-detail-item-label"><i class="fa-solid fa-file-alt"></i> CV / Hồ sơ</div>
                <div class="cand-detail-item-value" style="margin-top:4px;">${cvHtml}</div>
            </div>
        </div>

        ${coverHtml}`;

    // Render nút cập nhật trạng thái (bỏ qua trạng thái hiện tại)
    const actions = [
        { status: 'Screening', cls: 'screening', icon: 'fa-magnifying-glass', label: 'Sàng lọc' },
        { status: 'Interview', cls: 'interview', icon: 'fa-comments',          label: 'Phỏng vấn' },
        { status: 'Offered',   cls: 'offered',   icon: 'fa-handshake',          label: 'Đề nghị' },
        { status: 'OnHold',    cls: 'onhold',    icon: 'fa-clock',              label: 'Tạm giữ' },
        { status: 'Rejected',  cls: 'rejected',  icon: 'fa-xmark',              label: 'Từ chối' },
    ];

    document.getElementById('cand-modal-status-actions').innerHTML = actions
        .filter(a => a.status !== app.status)
        .map(a => `<button class="cand-status-btn ${a.cls}" onclick="updateCandStatus('${app.id}', '${a.status}')">
            <i class="fa-solid ${a.icon}"></i> ${a.label}
        </button>`).join('');

    document.getElementById('cand-modal').classList.add('show');
}

function closeCandModal() {
    document.getElementById('cand-modal').classList.remove('show');
    _currentAppId = null;
}

// ── Cập nhật trạng thái ─────────────────────────────────────
async function updateCandStatus(appId, newStatus) {
    const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;

    if (!confirm(`Cập nhật trạng thái ứng viên thành "${statusLabel}"?`)) return;

    try {
        const res = await apiFetchAuth(`/api/applications/${appId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();

        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi cập nhật');

        // Cập nhật dữ liệu cục bộ
        const idx = _allApplications.findIndex(a => a.id === appId);
        if (idx !== -1) {
            _allApplications[idx].status = newStatus;
            _allApplications[idx].updatedAt = new Date().toISOString();
        }

        applyCandidateFilters();
        renderStats();

        // Nếu modal đang mở thì làm mới nội dung
        if (_currentAppId === appId) openCandModal(appId);
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

// ── Utility ─────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Hook vào switchTab của recruiter.js ─────────────────────
// Ghi đè switchTab để load candidates khi chuyển sang tab đó
(function patchSwitchTab() {
    const _orig = window.switchTab;
    window.switchTab = function(tabName, element) {
        _orig(tabName, element);
        if (tabName === 'candidates') {
            loadCandidates();
        }
    };
})();
