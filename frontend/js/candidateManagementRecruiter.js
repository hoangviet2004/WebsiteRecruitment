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
        if (!res) return; // Token hết hạn → apiFetchAuth đã redirect về login
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

    const _parsedSkills = (() => {
        if (!app.skills) return [];
        try { return JSON.parse(app.skills); } catch { return []; }
    })();
    const skillsHtml = _parsedSkills.length
        ? _parsedSkills.map(s => `<span style="background:#eff6ff;color:#3b82f6;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${escHtml(s.name || s)}</span>`).join(' ')
        : '<span style="color:#94a3b8;font-size:13px;">Chưa cập nhật</span>';

    const cvHtml = app.cvUrl
        ? `<a href="javascript:void(0)" onclick="openSignedCvView('${app.candidateId}')" style="color:#3b82f6;text-decoration:none;font-weight:600;cursor:pointer;"><i class="fa-solid fa-file-pdf"></i> Xem / Tải CV</a>`
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

    // Reset kết quả đánh giá cũ
    document.getElementById('cand-ai-result').style.display = 'none';

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

// ── Quick Reject ─────────────────────────────────────────────
function openQuickRejectModal() {
    const sel = document.getElementById('qr-job-filter');
    sel.innerHTML = '<option value="">Tất cả vị trí</option>';
    const seen = new Set();
    _allApplications.forEach(a => {
        if (!seen.has(a.jobPostId)) {
            seen.add(a.jobPostId);
            const opt = document.createElement('option');
            opt.value = a.jobPostId;
            opt.textContent = a.jobTitle || 'Vị trí không tên';
            sel.appendChild(opt);
        }
    });

    document.querySelectorAll('input[name="qr-status"]').forEach(cb => {
        cb.checked = cb.value === 'Applied';
    });
    document.querySelectorAll('input[name="qr-profile"]').forEach(cb => {
        cb.checked = false;
    });
    document.getElementById('qr-job-filter').value = '';

    updateQuickRejectCount();
    document.getElementById('quick-reject-modal').classList.add('show');
}

function closeQuickRejectModal() {
    document.getElementById('quick-reject-modal').classList.remove('show');
}

function _isEmptyJson(val) {
    if (!val) return true;
    const s = val.trim();
    if (s === '' || s === '[]' || s === 'null') return true;
    try { const arr = JSON.parse(s); return Array.isArray(arr) && arr.length === 0; } catch { return false; }
}

function _matchesProfileFilter(a, profileFilters) {
    if (profileFilters.length === 0) return true;
    for (const f of profileFilters) {
        if (f === 'no-cv'         && !_isEmptyJson(a.cvUrl))         return false;
        if (f === 'no-skills'     && !_isEmptyJson(a.skills))        return false;
        if (f === 'no-experience' && !_isEmptyJson(a.experience))    return false;
        if (f === 'no-education'  && !_isEmptyJson(a.education))     return false;
    }
    return true;
}

function updateQuickRejectCount() {
    const selectedStatuses = [...document.querySelectorAll('input[name="qr-status"]:checked')].map(cb => cb.value);
    const profileFilters   = [...document.querySelectorAll('input[name="qr-profile"]:checked')].map(cb => cb.value);
    const jobId = document.getElementById('qr-job-filter').value;

    const affected = _allApplications.filter(a => {
        if (a.status === 'Rejected' || a.status === 'Offered') return false;
        if (!selectedStatuses.includes(a.status)) return false;
        if (jobId && a.jobPostId !== jobId) return false;
        if (!_matchesProfileFilter(a, profileFilters)) return false;
        return true;
    });

    const count  = affected.length;
    const btn    = document.getElementById('qr-confirm-btn');
    const textEl = document.getElementById('qr-count-text');
    const box    = document.getElementById('qr-preview-box');

    if (selectedStatuses.length === 0) {
        textEl.textContent = 'Vui lòng chọn ít nhất một trạng thái.';
        btn.disabled = true;
        box.className = 'qr-preview-box';
        return;
    }

    if (count === 0) {
        textEl.textContent = 'Không có ứng viên nào phù hợp với tiêu chí đã chọn.';
        btn.disabled = true;
        box.className = 'qr-preview-box warning';
    } else {
        textEl.textContent = `Sẽ từ chối ${count} ứng viên phù hợp với tiêu chí đã chọn.`;
        btn.disabled = false;
        box.className = 'qr-preview-box danger';
    }
}

async function executeQuickReject() {
    const selectedStatuses = [...document.querySelectorAll('input[name="qr-status"]:checked')].map(cb => cb.value);
    const profileFilters   = [...document.querySelectorAll('input[name="qr-profile"]:checked')].map(cb => cb.value);
    const jobId = document.getElementById('qr-job-filter').value;
    const reason = document.getElementById('qr-reason').value;

    const toReject = _allApplications.filter(a => {
        if (a.status === 'Rejected' || a.status === 'Offered') return false;
        if (!selectedStatuses.includes(a.status)) return false;
        if (jobId && a.jobPostId !== jobId) return false;
        if (!_matchesProfileFilter(a, profileFilters)) return false;
        return true;
    });

    if (toReject.length === 0) return;

    if (!confirm(`Xác nhận từ chối ${toReject.length} ứng viên?\nLý do: "${reason}"\n\nHành động này không thể hoàn tác.`)) return;

    const btn = document.getElementById('qr-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    let success = 0, failed = 0;

    for (const app of toReject) {
        try {
            const res = await apiFetchAuth(`/api/applications/${app.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'Rejected' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const idx = _allApplications.findIndex(a => a.id === app.id);
                if (idx !== -1) {
                    _allApplications[idx].status = 'Rejected';
                    _allApplications[idx].updatedAt = new Date().toISOString();
                }
                success++;
            } else {
                failed++;
            }
        } catch {
            failed++;
        }
    }

    closeQuickRejectModal();
    applyCandidateFilters();
    renderStats();

    const msg = failed > 0
        ? `Đã từ chối ${success} ứng viên. ${failed} trường hợp xảy ra lỗi.`
        : `Đã từ chối thành công ${success} ứng viên.`;
    alert(msg);
}

// ── Batch AI Đánh giá CV hàng loạt ─────────────────────────
function openBatchAIModal() {
    document.querySelectorAll('input[name="bai-status"]').forEach(cb => {
        cb.checked = cb.value === 'Applied';
    });

    const sel = document.getElementById('bai-job-filter');
    sel.innerHTML = '<option value="">Tất cả tin tuyển dụng</option>';
    const seen = new Set();
    _allApplications.forEach(a => {
        if (!seen.has(a.jobPostId)) {
            seen.add(a.jobPostId);
            const opt = document.createElement('option');
            opt.value = a.jobPostId;
            opt.textContent = a.jobTitle || 'Vị trí không tên';
            sel.appendChild(opt);
        }
    });

    const resultsEl = document.getElementById('bai-results');
    resultsEl.style.display = 'none';
    resultsEl.innerHTML = '';
    const btn = document.getElementById('bai-confirm-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-robot"></i> Đánh giá';

    updateBatchAICount();
    document.getElementById('batch-ai-modal').classList.add('show');
}

function closeBatchAIModal() {
    document.getElementById('batch-ai-modal').classList.remove('show');
}

function updateBatchAICount() {
    const jobFilter = document.getElementById('bai-job-filter').value;
    const statuses  = [...document.querySelectorAll('input[name="bai-status"]:checked')].map(cb => cb.value);
    const btn    = document.getElementById('bai-confirm-btn');
    const textEl = document.getElementById('bai-count-text');
    const box    = document.getElementById('bai-preview-box');

    if (statuses.length === 0) {
        textEl.textContent = 'Vui lòng chọn ít nhất một trạng thái.';
        btn.disabled = true;
        box.className = 'qr-preview-box';
        return;
    }

    const matched  = _allApplications.filter(a =>
        (!jobFilter || a.jobPostId === jobFilter) && statuses.includes(a.status)
    );
    const withCV    = matched.filter(a => a.cvUrl).length;
    const withoutCV = matched.length - withCV;

    if (matched.length === 0) {
        textEl.textContent = 'Không có ứng viên nào phù hợp với tiêu chí đã chọn.';
        btn.disabled = true;
        box.className = 'qr-preview-box warning';
    } else if (withCV === 0) {
        textEl.textContent = `${matched.length} ứng viên phù hợp nhưng không ai có CV để đánh giá.`;
        btn.disabled = true;
        box.className = 'qr-preview-box warning';
    } else {
        let msg = `Sẽ đánh giá CV của ${withCV} ứng viên.`;
        if (withoutCV > 0) msg += ` (${withoutCV} người không có CV sẽ bỏ qua)`;
        textEl.textContent = msg;
        btn.disabled = false;
        box.className = 'qr-preview-box';
        box.style.borderColor = '#8b5cf6';
        box.style.background  = '#f5f3ff';
    }
}

async function executeBatchAI() {
    const jobFilter = document.getElementById('bai-job-filter').value;
    const statuses  = [...document.querySelectorAll('input[name="bai-status"]:checked')].map(cb => cb.value);

    const targets = _allApplications.filter(a =>
        (!jobFilter || a.jobPostId === jobFilter) && statuses.includes(a.status) && a.cvUrl
    );
    if (targets.length === 0) return;

    const btn       = document.getElementById('bai-confirm-btn');
    const resultsEl = document.getElementById('bai-results');

    btn.disabled    = true;
    btn.innerHTML   = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đánh giá...';
    resultsEl.style.display = 'block';
    resultsEl.innerHTML     = `<div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:10px;">Kết quả (${targets.length} ứng viên):</div>`;

    for (const app of targets) {
        const item = document.createElement('div');
        item.style.cssText = 'padding:12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;font-size:13px;background:#fff;';
        item.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <strong style="color:#0f172a;">${escHtml(app.candidateName || 'Ứng viên')}</strong>
                <span style="color:#94a3b8;font-size:12px;">— ${escHtml(app.jobTitle || '')}</span>
                <span style="margin-left:auto;color:#94a3b8;font-size:12px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích...</span>
            </div>`;
        resultsEl.appendChild(item);

        try {
            const res  = await apiFetchAuth(`/api/cv-evaluation/${app.id}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi đánh giá');

            const r          = data.data;
            const scoreColor = r.score >= 75 ? '#10b981' : r.score >= 50 ? '#f59e0b' : '#ef4444';
            const recColor   = r.recommendation === 'Nên phỏng vấn' ? '#10b981'
                             : r.recommendation === 'Cân nhắc thêm'  ? '#f59e0b' : '#ef4444';

            item.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <strong style="color:#0f172a;">${escHtml(app.candidateName || 'Ứng viên')}</strong>
                    <span style="color:#94a3b8;font-size:12px;">— ${escHtml(app.jobTitle || '')}</span>
                    <span style="margin-left:auto;background:${scoreColor};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${r.score}/100</span>
                </div>
                <div style="color:${recColor};font-size:12px;font-weight:600;margin-bottom:3px;">
                    <i class="fa-solid fa-circle-check"></i> ${escHtml(r.recommendation)}
                </div>
                <div style="color:#64748b;font-size:12px;line-height:1.5;margin-bottom:8px;">${escHtml(r.summary)}</div>`;

            const statusRow = document.createElement('div');
            statusRow.style.cssText = 'padding-top:8px;border-top:1px solid #f1f5f9;display:flex;flex-wrap:wrap;align-items:center;gap:6px;';
            statusRow.innerHTML = _batchStatusButtons(app.id, app.status);
            item.appendChild(statusRow);
        } catch (e) {
            item.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;">
                    <strong style="color:#0f172a;">${escHtml(app.candidateName || 'Ứng viên')}</strong>
                    <span style="color:#94a3b8;font-size:12px;">— ${escHtml(app.jobTitle || '')}</span>
                    <span style="margin-left:auto;color:#ef4444;font-size:12px;"><i class="fa-solid fa-circle-exclamation"></i> ${escHtml(e.message)}</span>
                </div>`;
        }
    }

    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-robot"></i> Đánh giá lại';
}

function _batchStatusButtons(appId, currentStatus) {
    const all = [
        { status: 'Screening', cls: 'screening', icon: 'fa-magnifying-glass', label: 'Sàng lọc' },
        { status: 'Interview', cls: 'interview', icon: 'fa-comments',         label: 'Phỏng vấn' },
        { status: 'Offered',   cls: 'offered',   icon: 'fa-handshake',        label: 'Đề nghị' },
        { status: 'OnHold',    cls: 'onhold',    icon: 'fa-clock',            label: 'Tạm giữ' },
        { status: 'Rejected',  cls: 'rejected',  icon: 'fa-xmark',            label: 'Từ chối' },
    ];
    const currentLabel = STATUS_CONFIG[currentStatus]?.label || currentStatus;
    const btns = all
        .filter(s => s.status !== currentStatus)
        .map(s => `<button class="cand-status-btn ${s.cls}" style="font-size:11px;padding:3px 8px;"
            onclick="changeBatchResultStatus('${appId}','${s.status}',this.parentElement)">
            <i class="fa-solid ${s.icon}"></i> ${s.label}
        </button>`).join('');
    return `<span style="font-size:11px;color:#64748b;flex-shrink:0;">Trạng thái: <strong>${escHtml(currentLabel)}</strong></span>${btns}`;
}

async function changeBatchResultStatus(appId, newStatus, rowEl) {
    const prev = rowEl.innerHTML;
    rowEl.innerHTML = '<span style="font-size:11px;color:#3b82f6;"><i class="fa-solid fa-spinner fa-spin"></i> Đang cập nhật...</span>';

    try {
        const res  = await apiFetchAuth(`/api/applications/${appId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi cập nhật');

        const idx = _allApplications.findIndex(a => a.id === appId);
        if (idx !== -1) {
            _allApplications[idx].status    = newStatus;
            _allApplications[idx].updatedAt = new Date().toISOString();
        }
        applyCandidateFilters();
        renderStats();

        rowEl.innerHTML = _batchStatusButtons(appId, newStatus);
    } catch (e) {
        rowEl.innerHTML = prev;
        alert('Lỗi đổi trạng thái: ' + e.message);
    }
}

// ── AI Đánh giá CV ──────────────────────────────────────────
async function evaluateCvWithAI(appId) {
    const btn = document.getElementById('cand-modal-ai-btn');
    const resultBox = document.getElementById('cand-ai-result');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích...';
    resultBox.style.display = 'none';

    try {
        const res = await apiFetchAuth(`/api/cv-evaluation/${appId}`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi đánh giá CV');

        const r = data.data;
        const scoreColor = r.score >= 75 ? '#10b981' : r.score >= 50 ? '#f59e0b' : '#ef4444';
        const recColor   = r.recommendation === 'Nên phỏng vấn' ? '#10b981'
                         : r.recommendation === 'Cân nhắc thêm' ? '#f59e0b' : '#ef4444';

        resultBox.innerHTML = `
            <div class="ai-result-header">
                <i class="fa-solid fa-robot" style="color:#8b5cf6;font-size:18px;"></i>
                <span>Đánh giá bởi AI</span>
                <span class="ai-score-badge" style="background:${scoreColor};">${r.score}/100</span>
            </div>
            <div class="ai-recommendation" style="color:${recColor};">
                <i class="fa-solid fa-circle-check"></i> ${escHtml(r.recommendation)}
            </div>
            <p class="ai-summary">${escHtml(r.summary)}</p>
            <div class="ai-columns">
                <div class="ai-col">
                    <div class="ai-col-title strengths"><i class="fa-solid fa-thumbs-up"></i> Điểm mạnh</div>
                    <ul>${r.strengths.map(s => `<li>${escHtml(s)}</li>`).join('')}</ul>
                </div>
                <div class="ai-col">
                    <div class="ai-col-title weaknesses"><i class="fa-solid fa-thumbs-down"></i> Điểm yếu</div>
                    <ul>${r.weaknesses.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>
                </div>
            </div>
            <div class="ai-details">${escHtml(r.details)}</div>`;

        resultBox.style.display = 'block';
    } catch (e) {
        resultBox.innerHTML = `<div style="color:#ef4444;padding:12px;"><i class="fa-solid fa-circle-exclamation"></i> ${escHtml(e.message)}</div>`;
        resultBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-robot"></i> Đánh giá CV bằng AI';
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
