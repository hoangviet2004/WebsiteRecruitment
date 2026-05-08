'use strict';
// ============================================================
// companies.js – Logic cho trang Danh sách Công ty
// ============================================================

let allCompanies = [];

document.addEventListener('DOMContentLoaded', () => {
    loadAllCompanies();
});

async function loadAllCompanies() {
    const grid = document.getElementById('co-company-grid');
    const countEl = document.getElementById('co-result-count');

    try {
        const response = await apiFetch('/api/companies', { method: 'GET' });
        const res = await response.json();

        if (!response.ok || !res.success || !res.data) {
            showEmpty();
            return;
        }

        allCompanies = res.data;
        renderCompanies(allCompanies);
    } catch (e) {
        console.error('Lỗi khi tải danh sách công ty:', e);
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#ef4444;">Đã có lỗi xảy ra. Vui lòng thử lại sau.</p>';
        if (countEl) countEl.textContent = '';
    }
}

function renderCompanies(companies) {
    const grid = document.getElementById('co-company-grid');
    const countEl = document.getElementById('co-result-count');
    const emptyEl = document.getElementById('co-empty-state');

    grid.innerHTML = '';

    if (!companies || companies.length === 0) {
        showEmpty();
        return;
    }

    emptyEl.style.display = 'none';
    grid.style.display = 'grid';

    if (countEl) {
        countEl.textContent = `Hiển thị ${companies.length} công ty`;
    }

    companies.forEach((company, idx) => {
        const card = buildCard(company, idx);
        grid.insertAdjacentHTML('beforeend', card);
    });
}

function buildCard(company, idx) {
    // Cover image
    const coverHtml = company.coverImageUrl
        ? `<img src="${esc(company.coverImageUrl)}" alt="${esc(company.name)}" loading="lazy">`
        : `<div class="co-cover-placeholder"><i class="fa-solid fa-city"></i></div>`;

    // Logo
    let logoHtml;
    if (company.logoUrl) {
        logoHtml = `<img src="${esc(company.logoUrl)}" alt="${esc(company.name)}" loading="lazy">`;
    } else {
        const initials = getInitialsLocal(company.name);
        logoHtml = `<span>${initials}</span>`;
    }

    // Description fallback
    const desc = company.description
        ? esc(company.description)
        : 'Chưa có mô tả về công ty này.';

    // Tags
    const sizeTag = company.companySize
        ? `<span class="co-tag co-tag-size"><i class="fa-solid fa-users"></i> ${esc(company.companySize)}</span>`
        : '';

    const locationTag = company.address
        ? `<span class="co-card-location"><i class="fa-solid fa-location-dot"></i> ${esc(company.address)}</span>`
        : '';

    const animDelay = `style="animation-delay: ${idx * 0.06}s"`;
    const featuredClass = company.isFeatured ? 'featured' : '';
    const featuredBadge = company.isFeatured ? `<div class="co-badge-featured"><i class="fa-solid fa-crown"></i> Nổi bật</div>` : '';

    return `
        <div class="co-card co-card-anim ${featuredClass}" ${animDelay} onclick="goToCompany('${company.id}')">
            ${featuredBadge}
            <div class="co-card-cover">${coverHtml}</div>
            <div class="co-card-body">
                <div class="co-card-logo-wrap">
                    <div class="co-card-logo">${logoHtml}</div>
                </div>
                <div class="co-card-name">${esc(company.name)}</div>
                <p class="co-card-desc">${desc}</p>
                <div class="co-card-footer">
                    ${sizeTag}
                    ${locationTag}
                </div>
            </div>
        </div>`;
}

function filterCompanies() {
    const query = (document.getElementById('co-search-input').value || '').trim().toLowerCase();
    if (!query) {
        renderCompanies(allCompanies);
        return;
    }
    const filtered = allCompanies.filter(c => c.name.toLowerCase().includes(query));
    renderCompanies(filtered);
}

function resetSearch() {
    const input = document.getElementById('co-search-input');
    if (input) input.value = '';
    renderCompanies(allCompanies);
}

function showEmpty() {
    const grid = document.getElementById('co-company-grid');
    const emptyEl = document.getElementById('co-empty-state');
    const countEl = document.getElementById('co-result-count');
    if (grid) grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (countEl) countEl.textContent = '';
}

function goToCompany(id) {
    window.location.href = `company-detail.html?id=${id}`;
}

// Helpers
function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getInitialsLocal(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
