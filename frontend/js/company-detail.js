'use strict';
// ============================================================
// company-detail.js – Trang Chi tiết Công ty
// ============================================================

const params = new URLSearchParams(window.location.search);
const COMPANY_ID = params.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    if (!COMPANY_ID) { showError(); return; }
    await loadCompany();
});

// ── Load Company ─────────────────────────────────────────────
async function loadCompany() {
    try {
        const res  = await apiFetch(`/api/companies/${COMPANY_ID}`);
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) { showError(); return; }
        renderCompany(json.data);
        loadJobs(); // load jobs tab in background
    } catch (e) {
        console.error(e);
        showError();
    }
}

function renderCompany(c) {
    // Page title
    document.title = `${c.name} – TechList`;

    // Cover
    const cover = document.getElementById('cd-cover');
    if (c.coverImageUrl) {
        const img = document.createElement('img');
        img.src = c.coverImageUrl;
        img.alt = c.name;
        cover.prepend(img);
    }

    // Logo
    const logoBox = document.getElementById('cd-logo-box');
    const logoImg = document.getElementById('cd-logo-img');
    const logoInitials = document.getElementById('cd-logo-initials');
    if (c.logoUrl) {
        logoImg.src  = c.logoUrl;
        logoImg.alt  = c.name;
        logoImg.style.display = 'block';
        logoInitials.style.display = 'none';
    } else {
        logoInitials.textContent = getInitials(c.name);
    }

    // Name
    setText('cd-company-name', c.name);

    // Meta chips
    if (c.companySize) {
        setText('cd-size-text', c.companySize + ' nhân viên');
        show('cd-size-tag');
    }
    if (c.address) {
        setText('cd-location-text', c.address);
        show('cd-location-tag');
    }

    // Website button
    if (c.website) {
        const btn = document.getElementById('cd-website-btn');
        btn.href = normalizeUrl(c.website);
        btn.style.display = 'inline-flex';
    }

    // Sidebar Key Information
    if (c.companySize) { setText('si-size-val', c.companySize); show('si-size'); }
    if (c.taxCode)     { setText('si-tax-val',  c.taxCode);     show('si-tax');  }
    if (c.contactEmail) {
        setText('si-email-val', c.contactEmail);
        show('si-email');
    }
    if (c.contactPhone) {
        setText('si-phone-val', c.contactPhone);
        show('si-phone');
    }
    if (c.address) {
        setText('si-address-val', c.address);
        show('si-address');
    }
    if (c.website) {
        const link = document.getElementById('si-website-val');
        link.href        = normalizeUrl(c.website);
        link.textContent = c.website;
        show('si-website');
    }

    // About text
    const aboutEl = document.getElementById('cd-about-text');
    if (c.description?.trim()) {
        aboutEl.innerHTML = '';
        // Render each paragraph
        c.description.split(/\n+/).forEach(para => {
            if (!para.trim()) return;
            const p = document.createElement('p');
            p.textContent = para;
            p.style.marginBottom = '12px';
            aboutEl.appendChild(p);
        });
    }

    // Show main content
    document.getElementById('cd-skeleton').style.display = 'none';
    document.getElementById('cd-main').style.display     = 'block';
}

// ── Load Jobs ────────────────────────────────────────────────
async function loadJobs() {
    try {
        const res  = await apiFetch(`/api/jobs/company/${COMPANY_ID}`);
        const json = await res.json();
        let jobs = (res.ok && json.success) ? (json.data || []) : [];

        // Chỉ hiển thị tin đang mở (isActive == true và isApproved == true)
        jobs = jobs.filter(j => j.isActive && j.isApproved);

        // Update tab count
        const countEl = document.getElementById('cd-job-count');
        if (countEl) countEl.textContent = jobs.length;

        renderJobs(jobs);
    } catch (e) {
        renderJobs([]);
    }
}

function renderJobs(jobs) {
    const container = document.getElementById('cd-jobs-list');

    if (!jobs.length) {
        container.innerHTML = `
            <div class="cd-no-jobs">
                <i class="fa-regular fa-folder-open"></i>
                <p>Hiện chưa có vị trí tuyển dụng nào.</p>
            </div>`;
        return;
    }

    container.innerHTML = jobs.map(job => {
        const salary = formatSalary(job.minSalary, job.maxSalary);
        const timeAgo = getTimeAgo(new Date(job.createdAt));
        const logo = job.companyLogo
            ? `<img src="${esc(job.companyLogo)}" alt="">`
            : `<span>${getInitials(job.companyName || '')}</span>`;

        return `
            <div class="cd-job-card" onclick="window.location.href='job-detail.html?id=${job.id}'">
                <div class="cd-job-logo">${logo}</div>
                <div class="cd-job-body">
                    <div class="cd-job-title">${esc(job.title)}</div>
                    <div class="cd-job-meta">
                        <span class="cd-job-tag cd-job-tag-salary"><i class="fa-solid fa-money-bill-wave"></i> ${salary}</span>
                        ${job.location ? `<span class="cd-job-tag cd-job-tag-location"><i class="fa-solid fa-location-dot"></i> ${esc(job.location)}</span>` : ''}
                        <span class="cd-job-time"><i class="fa-regular fa-clock"></i> ${timeAgo}</span>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
    ['about', 'jobs'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
        const panel = document.getElementById(`panel-${t}`);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
    });
}

// ── Share ─────────────────────────────────────────────────────
function shareCompany() {
    navigator.clipboard?.writeText(window.location.href)
        .then(() => alert('Đã sao chép liên kết!'))
        .catch(() => alert('Không thể sao chép!'));
}

// ── Error state ───────────────────────────────────────────────
function showError() {
    document.getElementById('cd-skeleton').style.display = 'none';
    document.getElementById('cd-error').style.display    = 'flex';
}

// ── Helpers ───────────────────────────────────────────────────
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
}

function show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function normalizeUrl(url) {
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}

function formatSalary(min, max) {
    if (min && max) return `${(min/1e6).toFixed(0)}M – ${(max/1e6).toFixed(0)}M VNĐ`;
    if (min) return `Từ ${(min/1e6).toFixed(0)}M VNĐ`;
    if (max) return `Đến ${(max/1e6).toFixed(0)}M VNĐ`;
    return 'Thỏa thuận';
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Vừa đăng';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    const months = Math.floor(days / 30);
    return `${months} tháng trước`;
}
