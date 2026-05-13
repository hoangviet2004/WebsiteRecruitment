// ============================================================
// jobs.js - Logic cho trang Tìm việc
// ============================================================

let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
const itemsPerPage = 10;



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
    filteredJobs.sort((a, b) => {
        const getPriority = (job) => {
            const lvl = (job.featuredLevel || job.FeaturedLevel || '').toLowerCase();
            if (lvl === 'gold') return 3;
            if (lvl === 'silver') return 2;
            if (job.isFeatured || job.IsFeatured) return 1;
            return 0;
        };

        if (sortOrder === 'featured') {
            // 1. Ưu tiên cấp bậc hiển thị (Gold > Silver > Nổi bật thường > None)
            const pA = getPriority(a);
            const pB = getPriority(b);
            if (pA !== pB) return pB - pA;
        } else if (sortOrder === 'salary_desc') {
            // 2. Ưu tiên lương cao nhất tuyệt đối
            const valA = Math.max(Number(a.maxSalary || 0), Number(a.minSalary || 0));
            const valB = Math.max(Number(b.maxSalary || 0), Number(b.minSalary || 0));
            if (valB !== valA) return valB - valA;
        }

        // Mặc định hoặc khi chọn "Mới nhất": Sắp xếp theo thời gian đăng (Mới nhất lên đầu)
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });

    currentPage = 1;
    renderJobs();
}

function clearFilters() {
    document.getElementById('filter-keyword').value = '';
    document.getElementById('filter-location').value = '';
    document.getElementById('sort-order').value = 'featured';
    
    const checkboxes = document.querySelectorAll('input[name="jobType"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    document.querySelector('input[name="salaryRange"][value="all"]').checked = true;
    
    applyFilters();
}

// ── Render Jobs ──────────────────────────────────────────
function renderJobs() {
    const container = document.getElementById('jobs-list-container');
    
    container.innerHTML = '';
    
    if (filteredJobs.length === 0) {
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
        
        let featuredClass = '';
        let featuredBadge = '';
        const level = (job.featuredLevel || job.FeaturedLevel || '').toLowerCase();
        const isFeatured = job.isFeatured || job.IsFeatured;
        
        if (level === 'gold' || level === 'silver') {
            featuredClass = ` job-featured-${level}`;
        } else if (isFeatured) {
            featuredClass = ' job-featured';
        }

        const isSaved = window._jobsBookmarkMap?.[job.id];
        const cardHtml = `
            <div class="job-list-card ${newBadge}${featuredClass}" onclick="window.location.href='job-detail.html?id=${job.id}'"
                 id="jcard-${job.id}">
                <button class="btn-bookmark ${isSaved ? 'active' : ''}"
                        title="${isSaved ? 'Bỏ lưu' : 'Lưu tin'}"
                        onclick="event.stopPropagation(); jobsToggleBookmark(event,'${job.id}',this)">
                    <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
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
    loadBookmarkMap(); // batch load saved status, không block UI
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
fetchJobs();

// ── Bookmark integration (dùng API mới) ─────────────────────
window._jobsBookmarkMap = {}; // { jobPostId: savedJobId }

// Gọi 1 lần sau khi render xong, load tất cả saved jobs rồi build map
async function loadBookmarkMap() {
    const token = sessionStorage.getItem('token');
    const role  = sessionStorage.getItem('role');
    if (!token || role !== 'Candidate') return;

    try {
        const res  = await apiFetchAuth('/api/saved-jobs');
        if (!res?.ok) return;
        const data = await res.json();
        const list = data?.data || [];
        window._jobsBookmarkMap = {};
        list.forEach(j => { window._jobsBookmarkMap[j.jobPostId] = j.savedJobId; });

        // Cập nhật UI cho các card đang hiển thị
        Object.entries(window._jobsBookmarkMap).forEach(([jobPostId, savedJobId]) => {
            const btn = document.querySelector(`#jcard-${jobPostId} .btn-bookmark`);
            if (!btn) return;
            btn.classList.add('active');
            btn.title = 'Bỏ lưu';
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bookmark';
        });
    } catch (_) {}
}

async function jobsToggleBookmark(e, jobPostId, btn) {
    e.stopPropagation();
    const token = sessionStorage.getItem('token');
    if (!token) { window.location.href = 'auth.html#login'; return; }
    if (sessionStorage.getItem('role') !== 'Candidate') {
        alert('Chỉ tài khoản Ứng viên mới có thể lưu tin.'); return;
    }

    const savedJobId = window._jobsBookmarkMap[jobPostId];
    const isSaved    = !!savedJobId;
    const icon       = btn.querySelector('i');

    // Optimistic UI
    btn.classList.toggle('active', !isSaved);
    btn.title = isSaved ? 'Lưu tin' : 'Bỏ lưu';
    if (icon) icon.className = isSaved ? 'fa-regular fa-bookmark' : 'fa-solid fa-bookmark';

    try {
        if (isSaved) {
            const res = await apiFetchAuth(`/api/saved-jobs/${savedJobId}`, { method: 'DELETE' });
            if (!res?.ok) throw new Error();
            delete window._jobsBookmarkMap[jobPostId];
            jobsShowToast('Đã bỏ lưu tin tuyển dụng', 'info');
        } else {
            const res = await apiFetchAuth('/api/saved-jobs', {
                method: 'POST',
                body: JSON.stringify({ jobPostId, collection: 'Tất cả' })
            });
            if (!res?.ok) throw new Error();
            const data = await res.json();
            window._jobsBookmarkMap[jobPostId] = data?.data?.savedJobId;
            jobsShowToast('Đã lưu vào danh sách yêu thích!', 'success');
        }
    } catch {
        btn.classList.toggle('active', isSaved);
        btn.title = isSaved ? 'Bỏ lưu' : 'Lưu tin';
        if (icon) icon.className = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        jobsShowToast('Không thể thực hiện!', 'error');
    }
}

// ── AI Job Recommendation ────────────────────────────────
async function loadAiRecommendations() {
    const btn   = document.getElementById('ai-recommend-btn');
    const panel = document.getElementById('ai-recommend-panel');
    const list  = document.getElementById('ai-recommend-list');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích hồ sơ...';
    panel.style.display = 'none';

    try {
        const res  = await apiFetchAuth('/api/job-recommendations', { method: 'POST' });
        const data = await res.json();

        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi gợi ý');

        const recs = data.data?.recommendations || [];

        if (recs.length === 0) {
            list.innerHTML = `<div class="ai-empty">
                <i class="fa-solid fa-circle-info"></i>
                Không tìm thấy việc làm phù hợp. Hãy cập nhật CV và hồ sơ của bạn.
            </div>`;
        } else {
            list.innerHTML = recs.map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                if (!job) return '';
                const scoreColor = r.score >= 70 ? '#10b981' : r.score >= 50 ? '#f59e0b' : '#ef4444';
                const logoHtml = job.companyLogo
                    ? `<img src="${job.companyLogo}" alt="${job.companyName}" style="width:100%;height:100%;object-fit:cover;">`
                    : `<span style="font-weight:700;color:#3b82f6;font-size:14px;">${getInitials(job.companyName)}</span>`;
                return `
                <div class="ai-rec-card" onclick="window.location.href='job-detail.html?id=${job.id}'">
                    <div class="ai-rec-logo">${logoHtml}</div>
                    <div class="ai-rec-info">
                        <div class="ai-rec-title">${job.title}</div>
                        <div class="ai-rec-company">${job.companyName} • ${job.location || ''}</div>
                        <div class="ai-rec-reason"><i class="fa-solid fa-check-circle" style="color:#10b981;"></i> ${r.reason}</div>
                    </div>
                    <div class="ai-rec-score" style="background:${scoreColor};">${r.score}%</div>
                </div>`;
            }).join('');
        }

        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        jobsShowToast('Lỗi: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Gợi ý việc phù hợp với tôi';
    }
}

function closeAiPanel() {
    document.getElementById('ai-recommend-panel').style.display = 'none';
}

function jobsShowToast(msg, type = 'success') {
    let el = document.getElementById('jobs-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'jobs-toast';
        el.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:9999;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px;box-shadow:0 8px 24px rgba(0,0,0,0.1);font-family:Inter,sans-serif;transition:opacity 0.3s;';
        document.body.appendChild(el);
    }
    const styles = { success:'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;', error:'background:#fef2f2;color:#dc2626;border:1px solid #fecaca;', info:'background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;' };
    el.style.cssText += styles[type] || styles.success;
    el.innerHTML = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2800);
}
