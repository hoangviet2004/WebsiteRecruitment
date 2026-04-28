// ============================================================
// jobs.js - Logic cho trang Tìm việc
// ============================================================

let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
const itemsPerPage = 10;

// ── Render khu vực nav bên phải ─────────────────────
function renderNavRight() {
    var navRight = document.getElementById('nav-right');
    var token    = sessionStorage.getItem('token');
    var fullName = sessionStorage.getItem('fullName') || '';
    
    if (!token) {
        navRight.innerHTML = `
            <a href="../pages/auth.html#login"    class="btn-login">Đăng nhập</a>
            <a href="../pages/auth.html#register" class="btn-register">Đăng ký</a>
        `;
        return;
    }

    const updateDOM = (name, url) => {
        var avatarHtml = '';
        if (url && url !== 'null' && url !== 'undefined') {
            avatarHtml = `<img src="${url}" class="user-avatar" style="padding:0; object-fit:cover;" alt="Avatar">`;
        } else {
            var initials = getInitials(name);
            avatarHtml = `<div class="user-avatar">${initials}</div>`;
        }

        navRight.innerHTML = `
            <div class="user-menu" id="userMenu">
                ${avatarHtml}
                <span class="user-name">${name}</span>
                <div class="user-dropdown">
                    <a href="../pages/profile.html" class="dropdown-item">Hồ sơ của tôi</a>
                    <a href="#" class="dropdown-item">Cài đặt</a>
                    ${sessionStorage.getItem('role') === 'Recruiter' ? `<div class="dropdown-divider"></div><a href="../pages/recruiter.html" class="dropdown-item" style="color: #4f46e5; font-weight: bold;"><i class="fa-solid fa-briefcase"></i> Kênh Nhà Tuyển Dụng</a>` : ''}
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item logout" onclick="logout()">Đăng xuất</button>
                </div>
            </div>
        `;

        document.getElementById('userMenu').addEventListener('click', function (e) {
            this.classList.toggle('open');
            e.stopPropagation();
        });
    };

    updateDOM(fullName, sessionStorage.getItem('avatarUrl'));

    fetch(`${API_URL}/api/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(json => {
        if (json.data) {
            const realName = json.data.displayName || fullName;
            const realAvatar = json.data.avatarUrl;
            
            if (realName) sessionStorage.setItem('fullName', realName);
            if (realAvatar) sessionStorage.setItem('avatarUrl', realAvatar);

            updateDOM(realName, realAvatar);
        }
    })
    .catch(() => {});
    
    if (!window._navEventBound) {
        document.addEventListener('click', function () {
            var menu = document.getElementById('userMenu');
            if (menu) menu.classList.remove('open');
        });
        window._navEventBound = true;
    }
}

function getInitials(fullName) {
    var words = fullName.trim().split(' ').filter(function (w) { return w.length > 0; });
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}


// ── Fetch Jobs ───────────────────────────────────────────
async function fetchJobs() {
    try {
        const response = await apiFetch('/api/jobs', { method: 'GET' });
        const res = await response.json();
        
        if (res.success && res.data) {
            allJobs = res.data;
            
            // Check for URL parameters from Homepage search
            const urlParams = new URLSearchParams(window.location.search);
            const keywordParam = urlParams.get('keyword');
            const locationParam = urlParams.get('location');
            
            if (keywordParam) document.getElementById('filter-keyword').value = keywordParam;
            if (locationParam) document.getElementById('filter-location').value = locationParam;
            
            applyFilters();
        }
    } catch (error) {
        console.error('Error fetching jobs:', error);
        document.getElementById('jobs-list-container').innerHTML = '<p style="color:red; text-align:center;">Lỗi khi tải dữ liệu việc làm.</p>';
    }
}

// ── Filter Logic ─────────────────────────────────────────
function applyFilters() {
    const keyword = document.getElementById('filter-keyword').value.toLowerCase().trim();
    const location = document.getElementById('filter-location').value;
    const sortOrder = document.getElementById('sort-order').value;
    
    // Get checked Job Types
    const jobTypeCheckboxes = document.querySelectorAll('input[name="jobType"]:checked');
    const selectedJobTypes = Array.from(jobTypeCheckboxes).map(cb => cb.value);
    
    // Get selected Salary Range
    const salaryRadio = document.querySelector('input[name="salaryRange"]:checked').value;
    let minSal = 0;
    let maxSal = 999999999;
    if (salaryRadio !== 'all') {
        const parts = salaryRadio.split('-');
        minSal = parseInt(parts[0], 10);
        maxSal = parseInt(parts[1], 10);
    }

    filteredJobs = allJobs.filter(job => {
        // Keyword filter
        if (keyword) {
            const matchesTitle = job.title.toLowerCase().includes(keyword);
            const matchesCompany = job.companyName && job.companyName.toLowerCase().includes(keyword);
            if (!matchesTitle && !matchesCompany) return false;
        }
        
        // Location filter
        if (location && location !== '') {
            if (location === 'Khác') {
                if (job.location === 'Hà Nội' || job.location === 'Hồ Chí Minh' || job.location === 'Đà Nẵng') return false;
            } else {
                if (!job.location || !job.location.includes(location)) return false;
            }
        }
        
        // Job Type filter
        if (selectedJobTypes.length > 0) {
            if (!job.jobType || !selectedJobTypes.includes(job.jobType)) return false;
        }
        
        // Salary filter (check if job's max or min overlaps the selected range)
        if (salaryRadio !== 'all') {
            const jobMax = job.maxSalary || 0;
            const jobMin = job.minSalary || 0;
            
            // If the job has no salary specified, filter it out or keep it? We filter it out for strict matching.
            if (jobMax === 0 && jobMin === 0) return false;
            
            // Simple check: does the job's max salary fall in range, or min salary fall in range?
            const inRange = (jobMax > 0 && jobMax >= minSal && jobMax <= maxSal) || 
                            (jobMin > 0 && jobMin >= minSal && jobMin <= maxSal);
            
            if (!inRange) return false;
        }

        return true;
    });
    
    // Sort logic
    if (sortOrder === 'newest') {
        filteredJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortOrder === 'salary_desc') {
        filteredJobs.sort((a, b) => (b.maxSalary || b.minSalary || 0) - (a.maxSalary || a.minSalary || 0));
    }

    currentPage = 1;
    renderJobs();
}

function clearFilters() {
    document.getElementById('filter-keyword').value = '';
    document.getElementById('filter-location').value = '';
    document.getElementById('sort-order').value = 'newest';
    
    const checkboxes = document.querySelectorAll('input[name="jobType"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    document.querySelector('input[name="salaryRange"][value="all"]').checked = true;
    
    applyFilters();
}

// ── Render Jobs ──────────────────────────────────────────
function renderJobs() {
    const container = document.getElementById('jobs-list-container');
    const resultCount = document.getElementById('results-count');
    
    container.innerHTML = '';
    
    if (filteredJobs.length === 0) {
        resultCount.innerHTML = `Không tìm thấy việc làm phù hợp.`;
        container.innerHTML = `<div style="text-align:center; padding: 40px; color:#64748b; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
            <i class="fa-solid fa-magnifying-glass" style="font-size:40px; margin-bottom:16px; color:#cbd5e1;"></i>
            <p>Rất tiếc, không có công việc nào khớp với tiêu chí tìm kiếm của bạn.</p>
        </div>`;
        renderPagination();
        return;
    }
    
    // Calculate pagination
    const totalItems = filteredJobs.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    resultCount.innerHTML = `Hiển thị <strong>${startIndex + 1}-${endIndex}</strong> trong số <strong>${totalItems}</strong> việc làm`;
    
    const pageJobs = filteredJobs.slice(startIndex, endIndex);
    
    pageJobs.forEach(job => {
        const logoHtml = job.companyLogo
            ? `<img src="${job.companyLogo}" alt="${job.companyName}">`
            : `${getInitials(job.companyName)}`;

        let salaryStr = 'Thương lượng';
        if (job.minSalary && job.maxSalary) {
            salaryStr = `${job.minSalary.toLocaleString('vi-VN')} - ${job.maxSalary.toLocaleString('vi-VN')} VNĐ`;
        } else if (job.minSalary) {
            salaryStr = `Từ ${job.minSalary.toLocaleString('vi-VN')} VNĐ`;
        } else if (job.maxSalary) {
            salaryStr = `Lên đến ${job.maxSalary.toLocaleString('vi-VN')} VNĐ`;
        }

        const isNew = (new Date() - new Date(job.createdAt)) < 86400000 * 3; // within 3 days
        const newBadge = isNew ? 'is-new' : '';

        const cardHtml = `
            <div class="job-list-card ${newBadge}" onclick="window.location.href='job-detail.html?id=${job.id}'">
                <button class="btn-bookmark" onclick="event.stopPropagation(); this.classList.toggle('active'); this.querySelector('i').classList.toggle('fa-solid'); this.querySelector('i').classList.toggle('fa-regular');">
                    <i class="fa-regular fa-bookmark"></i>
                </button>
                
                <div class="job-list-logo">
                    ${logoHtml}
                </div>
                
                <div class="job-list-info">
                    <h3>${job.title}</h3>
                    <div class="company-name">${job.companyName}</div>
                    
                    <div class="job-list-meta">
                        <span title="Địa điểm"><i class="fa-solid fa-location-dot"></i> ${job.location || 'Chưa cập nhật'}</span>
                        <span class="salary-text" title="Mức lương"><i class="fa-solid fa-money-bill-wave"></i> ${salaryStr}</span>
                        <span title="Kinh nghiệm"><i class="fa-solid fa-briefcase"></i> Yêu cầu kinh nghiệm (Xem chi tiết)</span>
                    </div>
                    
                    <div class="job-list-tags">
                        ${job.jobType ? `<span class="tag">${job.jobType}</span>` : ''}
                    </div>
                    
                    <div class="job-list-desc">
                        ${job.description || 'Chưa có mô tả công việc'}
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
    
    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('pagination-container');
    container.innerHTML = '';
    
    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
    if (totalPages <= 1) return;
    
    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderJobs(); window.scrollTo(0,0); } };
    container.appendChild(prevBtn);
    
    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        // Simple logic to show near pages (for large numbers)
        if (totalPages > 7) {
            if (i !== 1 && i !== totalPages && Math.abs(i - currentPage) > 1) {
                if (i === 2 && currentPage > 3) {
                    const dots = document.createElement('span');
                    dots.innerHTML = '...';
                    dots.style.alignSelf = 'flex-end';
                    dots.style.margin = '0 5px';
                    container.appendChild(dots);
                } else if (i === totalPages - 1 && currentPage < totalPages - 2) {
                    const dots = document.createElement('span');
                    dots.innerHTML = '...';
                    dots.style.alignSelf = 'flex-end';
                    dots.style.margin = '0 5px';
                    container.appendChild(dots);
                }
                continue;
            }
        }
        
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => { currentPage = i; renderJobs(); window.scrollTo(0,0); };
        container.appendChild(btn);
    }
    
    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderJobs(); window.scrollTo(0,0); } };
    container.appendChild(nextBtn);
}


// Setup listeners for automatic filtering on change
document.querySelectorAll('input[name="jobType"], input[name="salaryRange"]').forEach(el => {
    el.addEventListener('change', applyFilters);
});

// Run on init
renderNavRight();
fetchJobs();
