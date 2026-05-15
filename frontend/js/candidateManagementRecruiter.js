// ============================================================
// candidateManagementRecruiter.js
// Quản lý ứng viên trong tab recruiter - recruiter.html
// ============================================================

let _allApplications = [];   // toàn bộ dữ liệu thô
let _filteredApps    = [];   // sau khi lọc
let _currentPage     = 1;
const PAGE_SIZE      = 10;
let _currentAppId    = null; // đơn đang mở trong modal
const _offerData     = {};   // { [appId]: { min, max } } — lưu lương đã xác nhận

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
    Interview: { label: 'Đang phỏng vấn', cls: 'interview', icon: 'fa-comments' },
    Offered:   { label: 'Đề nghị',   cls: 'offered',   icon: 'fa-handshake' },
    Rejected:  { label: 'Từ chối',   cls: 'rejected',  icon: 'fa-xmark' },
    Hired:     { label: 'Đã tuyển',  cls: 'hired',     icon: 'fa-trophy' },
};

function statusBadge(status) {
    const cfg = STATUS_CONFIG[status] || { label: status, cls: 'applied', icon: 'fa-circle' };
    return `<span class="badge badge-${cfg.cls}"><i class="fa-solid ${cfg.icon}"></i> ${cfg.label}</span>`;
}

const STAGE_CONFIG = {
    Applied:   { label: 'Nộp hồ sơ',  cls: 'stage-apply',      icon: 'fa-file-arrow-up',  step: 1 },
    Screening: { label: 'Nộp hồ sơ',  cls: 'stage-apply',      icon: 'fa-file-arrow-up',  step: 1 },
    Interview: { label: 'Phỏng vấn',  cls: 'stage-interview',  icon: 'fa-comments',        step: 2 },
    Offered:   { label: 'Offer',       cls: 'stage-offer',      icon: 'fa-handshake',       step: 3 },
    Rejected:  { label: 'Hoàn thành', cls: 'stage-done',       icon: 'fa-flag-checkered',  step: 4 },
    Hired:     { label: 'Hoàn thành', cls: 'stage-done',       icon: 'fa-flag-checkered',  step: 4 },
};

function stageBadge(status) {
    const cfg = STAGE_CONFIG[status] || STAGE_CONFIG.Applied;
    return `<span class="badge badge-stage ${cfg.cls}"><i class="fa-solid ${cfg.icon}"></i> ${cfg.label}</span>`;
}

// ── Tải dữ liệu từ API ──────────────────────────────────────
async function loadCandidates() {
    if (!currentCompanyId) {
        document.getElementById('cand-table-body').innerHTML =
            `<tr><td colspan="6" class="cand-loading"><i class="fa-solid fa-circle-info" style="color:#f59e0b;"></i> Vui lòng tạo Hồ sơ Công ty trước.</td></tr>`;
        return;
    }

    document.getElementById('cand-table-body').innerHTML =
        `<tr><td colspan="6" class="cand-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>`;
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
            `<tr><td colspan="6" class="cand-loading" style="color:#ef4444;"><i class="fa-solid fa-circle-exclamation"></i> ${e.message}</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="6" class="cand-loading"><i class="fa-solid fa-inbox" style="color:#cbd5e1;"></i> Không có ứng viên nào.</td></tr>`;
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
            <td>${stageBadge(a.status)}</td>
            <td>
                <button class="cand-action-btn view" title="Xem hồ sơ" onclick="openCandModal('${a.id}')">
                    <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button class="cand-action-btn" title="Đoạn chat" onclick="goToCandChat('${a.id}')" style="color:#3b82f6;">
                    <i class="fa-regular fa-comments"></i>
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
    let total = 0, interviews = 0, pending = 0;
    for (const a of _allApplications) {
        total++;
        if (a.status === 'Interview') interviews++;
        else if (a.status === 'Applied' || a.status === 'Screening') pending++;
    }

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

    // Render stage-aware actions
    document.getElementById('cand-modal-inline-form').innerHTML = '';
    renderModalActions(app);

    // Reset kết quả đánh giá cũ
    document.getElementById('cand-ai-result').style.display = 'none';

    document.getElementById('cand-modal').classList.add('show');
}

function closeCandModal() {
    document.getElementById('cand-modal').classList.remove('show');
    _currentAppId = null;
}

function goToCandChat(appId) {
    if (!appId) return;
    // Switch sang tab messages
    const menuBtn = document.getElementById('menu-messages');
    if (typeof switchTab === 'function' && menuBtn) switchTab('messages', menuBtn);
    // Mở conversation tương ứng sau khi conversations đã load
    const tryOpen = (attempt = 0) => {
        if (typeof openConversation === 'function' && typeof _convList !== 'undefined' && _convList.length > 0) {
            openConversation(appId);
        } else if (attempt < 10) {
            setTimeout(() => tryOpen(attempt + 1), 300);
        }
    };
    tryOpen();
}

// ── Stage-aware action rendering ────────────────────────────
function renderModalActions(app) {
    const el = document.getElementById('cand-modal-status-actions');
    const id = app.id;
    const rejectBtn = `<button class="cand-status-btn rejected" onclick="openRejectForm()"><i class="fa-solid fa-xmark"></i> Từ chối</button>`;

    const map = {
        Applied: `
            <button class="cand-status-btn screening" onclick="updateCandStatusDirect('${id}','Screening')"><i class="fa-solid fa-magnifying-glass"></i> Sàng lọc</button>
            ${rejectBtn}`,
        Screening: `
            <button class="cand-status-btn interview" onclick="openInterviewForm()"><i class="fa-solid fa-calendar-plus"></i> Hẹn phỏng vấn</button>
            ${rejectBtn}`,
        Interview: `
            <button class="cand-status-btn offered" onclick="updateCandStatusDirect('${id}','Offered')"><i class="fa-solid fa-check"></i> Đã phỏng vấn</button>
            <button class="cand-status-btn interview" onclick="openInterviewForm()"><i class="fa-solid fa-calendar-day"></i> Đổi lịch</button>
            ${rejectBtn}`,
        Offered: _offerData[id]
            ? null  // handled separately below
            : `<button class="cand-status-btn offered" onclick="openOfferForm()"><i class="fa-solid fa-handshake"></i> Gửi offer</button>
               <button class="cand-status-btn hired" onclick="updateCandStatusDirect('${id}','Hired')"><i class="fa-solid fa-trophy"></i> Offer thành công</button>
               ${rejectBtn}`,
        Hired: `<span class="cand-stage-done-msg" style="color:#854d0e;"><i class="fa-solid fa-trophy"></i> Đã tuyển</span>`,
        Rejected: `<span class="cand-stage-done-msg" style="color:#ef4444;"><i class="fa-solid fa-circle-xmark"></i> Đã từ chối ứng viên</span>`,
    };
    if (app.status === 'Offered' && _offerData[id]) {
        _renderOfferConfirmed(id);
        return;
    }
    el.innerHTML = map[app.status] || rejectBtn;
}

// ── Cập nhật trạng thái ─────────────────────────────────────
async function updateCandStatusDirect(appId, newStatus) {
    try {
        const res = await apiFetchAuth(`/api/applications/${appId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi cập nhật');

        const idx = _allApplications.findIndex(a => a.id === appId);
        if (idx !== -1) { _allApplications[idx].status = newStatus; _allApplications[idx].updatedAt = new Date().toISOString(); }

        if (newStatus === 'Hired' || newStatus === 'Rejected') delete _offerData[appId];

        applyCandidateFilters();
        renderStats();
        if (_currentAppId === appId) openCandModal(appId);
    } catch (e) { alert('Lỗi: ' + e.message); }
}

// ── Form từ chối (inline trong modal) ───────────────────────
const REJECT_REASONS = [
    'Không đủ kinh nghiệm',
    'Hồ sơ không phù hợp',
    'Vị trí đã tuyển đủ người',
    'Đã tuyển ứng viên khác phù hợp hơn',
    'Không đáp ứng yêu cầu kỹ năng',
    'Yêu cầu lương không phù hợp',
    'Lý do khác',
];

function openRejectForm() {
    const options = REJECT_REASONS.map((r, i) =>
        `<option value="${r}"${i === 0 ? ' selected' : ''}>${r}</option>`).join('');

    document.getElementById('cand-modal-inline-form').innerHTML = `
        <div class="cand-inline-form" style="border-color:#fca5a5;background:#fef2f2;">
            <div class="cand-inline-form-title" style="color:#dc2626;">
                <i class="fa-solid fa-circle-xmark"></i> Lý do từ chối
            </div>
            <div class="cand-form-grid">
                <div class="cand-form-group cand-form-full">
                    <label>Chọn lý do</label>
                    <select id="modal-reject-reason" onchange="toggleRejectOther(this)">${options}</select>
                </div>
                <div class="cand-form-group cand-form-full" id="modal-reject-other-wrap" style="display:none;">
                    <textarea id="modal-reject-other" rows="1" maxlength="100" placeholder="Mô tả lý do từ chối (tối đa 100 ký tự)..."
                        style="overflow:hidden;resize:none;"
                        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
                </div>
            </div>
        </div>`;

    document.getElementById('cand-modal-status-actions').innerHTML = `
        <button class="cand-status-btn rejected" onclick="confirmReject()">
            <i class="fa-solid fa-circle-xmark"></i> Xác nhận từ chối
        </button>
        <button class="btn-secondary" onclick="cancelModalForm()">Hủy</button>`;
}

function toggleRejectOther(sel) {
    const wrap = document.getElementById('modal-reject-other-wrap');
    wrap.style.display = sel.value === 'Lý do khác' ? 'block' : 'none';
    if (sel.value === 'Lý do khác') document.getElementById('modal-reject-other').focus();
}

async function confirmReject() {
    const sel = document.getElementById('modal-reject-reason');
    let reason = sel?.value || 'Hồ sơ không phù hợp';
    if (reason === 'Lý do khác') {
        const custom = document.getElementById('modal-reject-other')?.value.trim();
        if (!custom) { alert('Vui lòng nhập lý do từ chối.'); return; }
        reason = custom;
    }
    const app = _allApplications.find(a => a.id === _currentAppId);
    const jobTitle = app?.jobTitle || 'vị trí ứng tuyển';

    const rejectMsg = `Cảm ơn bạn đã ứng tuyển vào vị trí ${jobTitle}.\n\nSau khi xem xét kỹ hồ sơ, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn chưa phù hợp với yêu cầu hiện tại.\n📌 Lý do: ${reason}\n\nChúng tôi trân trọng sự quan tâm của bạn và mong có cơ hội hợp tác trong tương lai.`;

    try {
        await apiFetchAuth('/api/messaging/send', {
            method: 'POST',
            body: JSON.stringify({ applicationId: _currentAppId, content: rejectMsg, type: 'message' })
        });
    } catch { /* không block nếu gửi tin thất bại */ }

    await updateCandStatusDirect(_currentAppId, 'Rejected');
}

async function rejectCandidate(appId) {
    if (!confirm('Xác nhận từ chối ứng viên này?')) return;
    await updateCandStatusDirect(appId, 'Rejected');
}

async function updateCandStatus(appId, newStatus) {
    const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
    if (!confirm(`Cập nhật trạng thái ứng viên thành "${statusLabel}"?`)) return;
    await updateCandStatusDirect(appId, newStatus);
}

// ── Form hẹn phỏng vấn (inline trong modal) ─────────────────
function openInterviewForm() {
    const dt = new Date(); dt.setDate(dt.getDate() + 1); dt.setHours(10, 0, 0, 0);
    document.getElementById('cand-modal-inline-form').innerHTML = `
        <div class="cand-inline-form">
            <div class="cand-inline-form-title"><i class="fa-solid fa-calendar-plus"></i> Lên lịch phỏng vấn</div>
            <div class="cand-form-grid">
                <div class="cand-form-group">
                    <label>Ngày & giờ phỏng vấn <span style="color:#ef4444">*</span></label>
                    <input type="datetime-local" id="modal-sch-datetime" value="${dt.toISOString().slice(0,16)}">
                </div>
                <div class="cand-form-group">
                    <label>Thời lượng</label>
                    <select id="modal-sch-duration">
                        <option value="30">30 phút</option>
                        <option value="45">45 phút</option>
                        <option value="60" selected>60 phút</option>
                        <option value="90">90 phút</option>
                        <option value="120">120 phút</option>
                    </select>
                </div>
                <div class="cand-form-group cand-form-full">
                    <label>Link phỏng vấn trực tuyến</label>
                    <input type="url" id="modal-sch-link" placeholder="https://meet.google.com/...">
                </div>
                <div class="cand-form-group cand-form-full">
                    <label>Địa điểm (nếu trực tiếp)</label>
                    <input type="text" id="modal-sch-location" placeholder="Địa chỉ văn phòng...">
                </div>
                <div class="cand-form-group cand-form-full">
                    <label>Ghi chú</label>
                    <textarea id="modal-sch-notes" rows="2" placeholder="Yêu cầu chuẩn bị, trang phục..."></textarea>
                </div>
            </div>
        </div>`;
    document.getElementById('cand-modal-status-actions').innerHTML = `
        <button class="cand-status-btn interview" onclick="submitInterviewFromModal()"><i class="fa-solid fa-calendar-check"></i> Xác nhận lịch</button>
        <button class="btn-secondary" onclick="cancelModalForm()">Hủy</button>`;
}

async function submitInterviewFromModal() {
    const dt = document.getElementById('modal-sch-datetime')?.value;
    if (!dt) { alert('Vui lòng chọn ngày giờ phỏng vấn.'); return; }
    const payload = {
        applicationId:   _currentAppId,
        scheduledAt:     new Date(dt).toISOString(),
        durationMinutes: parseInt(document.getElementById('modal-sch-duration').value),
        meetingLink:     document.getElementById('modal-sch-link').value || null,
        location:        document.getElementById('modal-sch-location').value || null,
        notes:           document.getElementById('modal-sch-notes').value || null,
    };
    try {
        const res = await apiFetchAuth('/api/messaging/interviews', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi lên lịch');

        const idx = _allApplications.findIndex(a => a.id === _currentAppId);
        if (idx !== -1) { _allApplications[idx].status = 'Interview'; _allApplications[idx].updatedAt = new Date().toISOString(); }

        const iv = data.data;
        const dtStr = new Date(iv.scheduledAt).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' });
        const autoMsg = `📅 Lịch phỏng vấn đã được lên lịch!\n\n🗓 Thời gian: ${dtStr}\n⏱ Thời lượng: ${iv.durationMinutes} phút${iv.meetingLink ? `\n🔗 Link: ${iv.meetingLink}` : ''}${iv.location ? `\n📍 Địa điểm: ${iv.location}` : ''}${iv.notes ? `\n📝 Ghi chú: ${iv.notes}` : ''}`;
        await apiFetchAuth('/api/messaging/send', {
            method: 'POST',
            body: JSON.stringify({ applicationId: _currentAppId, content: autoMsg, type: 'message' })
        });

        applyCandidateFilters();
        renderStats();
        openCandModal(_currentAppId);
    } catch (e) { alert('Lỗi: ' + e.message); }
}

// ── Format tiền tệ ───────────────────────────────────────────
function formatCurrency(el) {
    const raw = el.value.replace(/\./g, '').replace(/\D/g, '');
    el.value = raw ? parseInt(raw).toLocaleString('vi-VN') : '';
}

function parseCurrency(el) {
    return el.value.replace(/\./g, '').trim() || null;
}

// ── Form gửi offer (inline trong modal) ─────────────────────
function openOfferForm() {
    document.getElementById('cand-modal-inline-form').innerHTML = `
        <div class="cand-inline-form">
            <div class="cand-inline-form-title"><i class="fa-solid fa-handshake"></i> Thông tin Offer</div>
            <div class="cand-form-grid">
                <div class="cand-form-group">
                    <label>Lương tối thiểu (VNĐ)</label>
                    <input type="text" id="modal-offer-min" placeholder="VD: 10.000.000"
                        inputmode="numeric" oninput="formatCurrency(this)">
                </div>
                <div class="cand-form-group">
                    <label>Lương tối đa (VNĐ)</label>
                    <input type="text" id="modal-offer-max" placeholder="VD: 15.000.000"
                        inputmode="numeric" oninput="formatCurrency(this)">
                </div>
            </div>
        </div>`;
    document.getElementById('cand-modal-status-actions').innerHTML = `
        <button class="cand-status-btn offered" onclick="confirmOfferSalary()"><i class="fa-solid fa-check"></i> Xác nhận mức lương</button>
        <button class="btn-secondary" onclick="cancelModalForm()">Hủy</button>`;
}

function confirmOfferSalary() {
    const min = parseCurrency(document.getElementById('modal-offer-min'));
    const max = parseCurrency(document.getElementById('modal-offer-max'));
    if (!min && !max) { alert('Vui lòng nhập ít nhất một mức lương.'); return; }
    if (min && max && parseInt(min) >= parseInt(max)) {
        alert('Lương tối thiểu phải nhỏ hơn lương tối đa.');
        document.getElementById('modal-offer-min').focus();
        return;
    }

    _offerData[_currentAppId] = { min, max };
    _renderOfferConfirmed(_currentAppId);
}

function _renderOfferConfirmed(appId) {
    const d = _offerData[appId];
    const fmt = v => v ? parseInt(v).toLocaleString('vi-VN') + ' VNĐ' : '—';
    document.getElementById('cand-modal-inline-form').innerHTML = `
        <div class="cand-inline-form cand-inline-form-success">
            <i class="fa-solid fa-circle-check" style="color:#059669;margin-right:8px;"></i>
            <strong>Mức lương đề nghị:</strong>&nbsp;${fmt(d.min)} – ${fmt(d.max)}
        </div>`;
    document.getElementById('cand-modal-status-actions').innerHTML = `
        <button class="cand-status-btn hired" onclick="confirmHired('${appId}')"><i class="fa-solid fa-trophy"></i> Offer thành công</button>
        <button class="cand-status-btn rejected" onclick="openRejectForm()"><i class="fa-solid fa-xmark"></i> Từ chối</button>
        <button class="btn-secondary" onclick="editOfferSalary()"><i class="fa-solid fa-pen"></i> Sửa</button>`;
}

async function confirmHired(appId) {
    const d = _offerData[appId];
    const fmt = v => v ? parseInt(v).toLocaleString('vi-VN') + ' VNĐ' : null;
    const minStr = fmt(d?.min);
    const maxStr = fmt(d?.max);

    let offerLine = '';
    if (minStr && maxStr) offerLine = `\n💰 Mức lương: ${minStr} – ${maxStr}`;
    else if (minStr)      offerLine = `\n💰 Mức lương: từ ${minStr}`;
    else if (maxStr)      offerLine = `\n💰 Mức lương: lên đến ${maxStr}`;

    const app = _allApplications.find(a => a.id === appId);
    const jobTitle = app?.jobTitle || 'vị trí ứng tuyển';

    const offerMsg = `🎉 Chúc mừng! Bạn đã được chấp nhận vào ${jobTitle}.${offerLine}\n\nChúng tôi sẽ liên hệ để hoàn tất các thủ tục tiếp theo. Xin chúc mừng và chào đón bạn!`;

    try {
        await apiFetchAuth('/api/messaging/send', {
            method: 'POST',
            body: JSON.stringify({ applicationId: appId, content: offerMsg, type: 'message' })
        });
    } catch { /* không block nếu gửi tin thất bại */ }

    await updateCandStatusDirect(appId, 'Hired');
}

function editOfferSalary() {
    const d = _offerData[_currentAppId] || {};
    delete _offerData[_currentAppId];
    openOfferForm();
    const minEl = document.getElementById('modal-offer-min');
    const maxEl = document.getElementById('modal-offer-max');
    if (d.min) { minEl.value = d.min; formatCurrency(minEl); }
    if (d.max) { maxEl.value = d.max; formatCurrency(maxEl); }
}

function cancelModalForm() {
    const app = _allApplications.find(a => a.id === _currentAppId);
    if (!app) return;
    document.getElementById('cand-modal-inline-form').innerHTML = '';
    renderModalActions(app);
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

function toggleQrOther(sel) {
    const ta = document.getElementById('qr-reason-other');
    ta.style.display = sel.value === 'Khác' ? 'block' : 'none';
    if (sel.value === 'Khác') ta.focus();
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
        if (a.status === 'Rejected' || a.status === 'Hired') return false;
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
    let reason = document.getElementById('qr-reason').value;
    if (reason === 'Khác') {
        const custom = document.getElementById('qr-reason-other')?.value.trim();
        if (!custom) { alert('Vui lòng nhập lý do từ chối.'); return; }
        reason = custom;
    }

    const toReject = _allApplications.filter(a => {
        if (a.status === 'Rejected' || a.status === 'Hired') return false;
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
    const NEXT = {
        Applied:   { status: 'Screening', cls: 'screening', icon: 'fa-magnifying-glass', label: 'Sàng lọc' },
        Screening: { status: 'Interview', cls: 'interview', icon: 'fa-comments',          label: 'Hẹn phỏng vấn' },
        Interview: { status: 'Offered',   cls: 'offered',   icon: 'fa-handshake',         label: 'Gửi offer' },
        Offered:   { status: 'Hired',     cls: 'hired',     icon: 'fa-trophy',             label: 'Offer thành công' },
    };
    const rejectBtn = `<button class="cand-status-btn rejected" style="font-size:11px;padding:3px 8px;"
        onclick="changeBatchResultStatus('${appId}','Rejected',this.parentElement)">
        <i class="fa-solid fa-xmark"></i> Từ chối
    </button>`;

    const currentLabel = STATUS_CONFIG[currentStatus]?.label || currentStatus;
    const next = NEXT[currentStatus];
    const nextBtn = next ? `<button class="cand-status-btn ${next.cls}" style="font-size:11px;padding:3px 8px;"
        onclick="changeBatchResultStatus('${appId}','${next.status}',this.parentElement)">
        <i class="fa-solid ${next.icon}"></i> ${next.label}
    </button>` : '';

    const done = currentStatus === 'Hired' || currentStatus === 'Rejected'
        ? `<span style="font-size:11px;color:#64748b;font-style:italic;">Đã hoàn tất</span>`
        : `${nextBtn}${rejectBtn}`;

    return `<span style="font-size:11px;color:#64748b;flex-shrink:0;">Trạng thái: <strong>${escHtml(currentLabel)}</strong></span>${done}`;
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
