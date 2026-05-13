// ============================================================
// applied-jobs.js – Danh sách tin tuyển dụng đã ứng tuyển
// ============================================================

let allApplications = [];
let currentTab = 'all';
let searchQuery = '';

const STATUS_CONFIG = {
    Applied:   { label: 'Đã nộp',       color: '#3b82f6', bg: '#eff6ff', icon: 'fa-file-pen' },
    Screening: { label: 'Đang xem xét', color: '#ca8a04', bg: '#fefce8', icon: 'fa-magnifying-glass' },
    Interview: { label: 'Phỏng vấn',    color: '#16a34a', bg: '#f0fdf4', icon: 'fa-comments' },
    Offered:   { label: 'Đề nghị',      color: '#059669', bg: '#ecfdf5', icon: 'fa-handshake' },
    OnHold:    { label: 'Tạm giữ',      color: '#d97706', bg: '#fffbeb', icon: 'fa-clock' },
    Rejected:  { label: 'Từ chối',      color: '#dc2626', bg: '#fef2f2', icon: 'fa-xmark' },
};

async function initAppliedJobs() {
    setupSearch();
    await loadApplications();
}

function setupSearch() {
    const input = document.getElementById('aj-search-input');
    if (!input) return;
    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            searchQuery = input.value.trim().toLowerCase();
            renderCards();
        }, 250);
    });
}

async function loadApplications() {
    showSkeletons();
    try {
        const res = await apiFetchAuth('/api/applications/my-applications');
        if (!res) return;
        const data = await res.json();
        if (res.ok && data.success) {
            allApplications = data.data || [];
        } else {
            allApplications = [];
        }
    } catch {
        allApplications = [];
    }
    updateCounts();
    renderCards();
}

function getFiltered() {
    let list = currentTab === 'all'
        ? allApplications
        : allApplications.filter(a => a.status === currentTab);

    if (searchQuery) {
        list = list.filter(a =>
            (a.jobTitle || '').toLowerCase().includes(searchQuery)
        );
    }
    return list;
}

function renderCards() {
    const grid = document.getElementById('aj-grid');
    const empty = document.getElementById('aj-empty');
    const list = getFiltered();

    grid.innerHTML = '';

    if (!list.length) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    grid.innerHTML = list.map(a => buildCard(a)).join('');
}

function buildCard(a) {
    const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.Applied;
    const appliedDate = new Date(a.appliedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const updatedDate = new Date(a.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const isUpdated = a.appliedAt !== a.updatedAt;

    return `
        <div class="aj-card">
            <div class="aj-card-top">
                <div class="aj-job-icon">
                    <i class="fa-solid fa-briefcase"></i>
                </div>
                <span class="aj-status-badge" style="background:${cfg.bg};color:${cfg.color};">
                    <i class="fa-solid ${cfg.icon}" style="font-size:10px;"></i>
                    ${cfg.label}
                </span>
            </div>

            <div class="aj-job-title" title="${escHtml(a.jobTitle || '')}">${escHtml(a.jobTitle || 'Vị trí chưa xác định')}</div>

            <div class="aj-meta">
                <div class="aj-meta-item">
                    <i class="fa-regular fa-calendar" style="color:#94a3b8;"></i>
                    <span>Nộp: ${appliedDate}</span>
                </div>
                ${isUpdated ? `
                <div class="aj-meta-item">
                    <i class="fa-solid fa-rotate" style="color:${cfg.color};"></i>
                    <span style="color:${cfg.color};">Cập nhật: ${updatedDate}</span>
                </div>` : ''}
            </div>

            <div class="aj-card-actions">
                <a href="job-detail.html?id=${a.jobPostId}" class="aj-btn-detail" target="_blank">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Xem tin
                </a>
                <button class="aj-btn-chat" onclick="goToChat('${a.id}')">
                    <i class="fa-regular fa-comments"></i> Tin nhắn
                </button>
            </div>
        </div>`;
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function goToChat(applicationId) {
    window.location.href = `candidate-messages.html?appId=${applicationId}`;
}

function switchTab(status, el) {
    currentTab = status;
    document.querySelectorAll('.aj-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderCards();
}

function updateCounts() {
    const countAll = allApplications.length;
    const el = id => document.getElementById(id);
    if (el('count-all')) el('count-all').textContent = `(${countAll})`;

    Object.keys(STATUS_CONFIG).forEach(status => {
        const cnt = allApplications.filter(a => a.status === status).length;
        const countEl = el(`count-${status}`);
        if (countEl) countEl.textContent = `(${cnt})`;
    });
}

function showSkeletons() {
    const grid = document.getElementById('aj-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="aj-skeleton"></div>
        <div class="aj-skeleton"></div>
        <div class="aj-skeleton"></div>
    `;
    document.getElementById('aj-empty').style.display = 'none';
}
