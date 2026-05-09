// ============================================================
// home.js  –  Logic cho trang Home
// Đặt tại: js/home.js
// ============================================================


// ── Bước 1: Nếu là admin thì chuyển ngay sang admin.html ────
function checkAdminRedirect() {
    var role = sessionStorage.getItem('role');
    if (role === 'Admin') {
        window.location.href = '../pages/admin.html';
    }
}


// ── Chạy khi trang load xong ─────────────────────────────────
loadJobs();
loadFeaturedCompanies();

/* ── Hàm Fetch & Render Việc làm (Job Board) ───────────────────── */
async function loadFeaturedCompanies() {
    const list = document.getElementById('featured-companies-list');
    if (!list) return;

    try {
        const response = await apiFetch('/api/companies/featured', { method: 'GET' });
        const res = await response.json();

        list.innerHTML = '';
        
        // Lọc: Chỉ lấy các công ty cấp Bạc (Silver) trở lên
        const companies = res.data.filter(c => {
            const lvl = (c.featuredLevel || '').toLowerCase();
            return lvl === 'gold' || lvl === 'silver';
        }).sort((a, b) => {
            const lvlA = (a.featuredLevel || '').toLowerCase();
            const lvlB = (b.featuredLevel || '').toLowerCase();
            if (lvlA === lvlB) return 0;
            return lvlA === 'gold' ? -1 : 1;
        });

        if (companies.length === 0) {
            list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Hiện chưa có đối tác tiêu biểu nào.</p>';
            return;
        }
        
        companies.forEach(company => {
            const logoHtml = company.logoUrl
                ? `<div class="company-logo"><img src="${company.logoUrl}" alt="${company.name}"></div>`
                : `<div class="company-logo">${getInitials(company.name)}</div>`;

            const cardHtml = `
                <div class="company-card" onclick="window.location.href='#'">
                    <div class="company-card-header">
                        ${logoHtml}
                        <div class="company-info">
                            <h3>${company.name}</h3>
                            <div class="company-size"><i class="fa-solid fa-users"></i> ${company.companySize || 'Chưa cập nhật'} nhân viên</div>
                        </div>
                    </div>
                    <div class="company-card-footer">
                        <span class="tag tag-featured"><i class="fa-solid fa-star"></i> Nổi bật</span>
                        ${company.address ? `<span class="company-location" title="${company.address}"><i class="fa-solid fa-location-dot"></i> ${company.address}</span>` : ''}
                    </div>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', cardHtml);
        });

    } catch (error) {
        console.error('Lỗi khi tải công ty nổi bật:', error);
        list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Đã có lỗi xảy ra khi lấy dữ liệu.</p>';
    }
}
async function loadJobs() {
    const jobList = document.getElementById('job-list');
    
    try {
        // Gọi API public không cần token (trang chủ ai cũng xem được jobs)
        const response = await apiFetch('/api/jobs', { method: 'GET' });
        const res = await response.json();

        jobList.innerHTML = ''; // Clear skeleton
        
        if (!response.ok || !res.success || !res.data || res.data.length === 0) {
            jobList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Hiện chưa có công việc nào.</p>';
            return;
        }

        const getPriority = (job) => {
            const lvl = (job.featuredLevel || job.FeaturedLevel || '').toLowerCase();
            if (lvl === 'gold') return 3;
            if (lvl === 'silver') return 2;
            if (job.isFeatured || job.IsFeatured) return 1;
            return 0;
        };

        // Sắp xếp: Tin nổi bật (Gold > Silver > Nổi bật thường) lên đầu, sau đó theo thời gian mới nhất
        const sortedJobs = res.data.sort((a, b) => {
            const pA = getPriority(a);
            const pB = getPriority(b);
            
            if (pA !== pB) return pB - pA;
            
            // Nếu cùng cấp bậc, tin mới hơn lên trên
            return new Date(b.createdAt || b.CreatedAt) - new Date(a.createdAt || a.CreatedAt);
        });

        // Lấy tối đa 12 tin tuyển dụng cho trang chủ
        const jobs = sortedJobs.slice(0, 12);
        
        jobs.forEach(job => {
            // Casing fallback cho API
            const title = job.title || job.Title;
            const companyName = job.companyName || job.CompanyName;
            const companyLogo = job.companyLogo || job.CompanyLogo;
            const location = job.location || job.Location;
            const minSalary = job.minSalary || job.MinSalary;
            const maxSalary = job.maxSalary || job.MaxSalary;
            const createdAt = job.createdAt || job.CreatedAt;
            const isFeatured = job.isFeatured || job.IsFeatured;
            const featuredLevel = (job.featuredLevel || job.FeaturedLevel || '').toLowerCase();

            // Logo: wrapper div luôn có class, bên trong là <img> hoặc chữ cái
            const logoHtml = companyLogo
                ? `<div class="company-logo"><img src="${companyLogo}" alt="${companyName}"></div>`
                : `<div class="company-logo">${getInitials(companyName)}</div>`;

            // Lương — format VNĐ
            let salaryStr = 'Thỏa thuận';
            if (minSalary && maxSalary) {
                salaryStr = `${minSalary.toLocaleString('vi-VN')} - ${maxSalary.toLocaleString('vi-VN')} VNĐ`;
            } else if (minSalary) {
                salaryStr = `Từ ${minSalary.toLocaleString('vi-VN')} VNĐ`;
            } else if (maxSalary) {
                salaryStr = `Lên đến ${maxSalary.toLocaleString('vi-VN')} VNĐ`;
            }

            const timeAgo = getTimeAgo(new Date(createdAt));
            
            // Xử lý cấp bậc hiển thị
            let featuredClass = '';
            if (featuredLevel === 'gold' || featuredLevel === 'silver') {
                featuredClass = ` featured-${featuredLevel}`;
            } else if (isFeatured) {
                // Fallback cho trường hợp isFeatured=true nhưng không có level cụ thể
                featuredClass = ' featured';
            }

            const cardHtml = `
                <div class="job-card${featuredClass}" onclick="window.location.href='job-detail.html?id=${job.id || job.Id}'">
                    <div class="job-card-header">
                        ${logoHtml}
                        <div class="job-info">
                            <h3>${title}</h3>
                            <div class="company-name">${companyName}</div>
                        </div>
                    </div>
                    <div class="job-tags">
                        <span class="tag tag-salary"><i class="fa-solid fa-money-bill-wave"></i> ${salaryStr}</span>
                        <span class="tag tag-location"><i class="fa-solid fa-location-dot"></i> ${location}</span>
                    </div>
                    <div class="job-card-footer">
                        <span class="post-time"><i class="fa-regular fa-clock"></i> ${timeAgo}</span>
                        <button class="btn-save-heart" onclick="event.stopPropagation(); this.classList.toggle('saved'); this.querySelector('i').classList.toggle('fa-solid'); this.querySelector('i').classList.toggle('fa-regular');" title="Lưu tin">
                            <i class="fa-regular fa-heart"></i>
                        </button>
                    </div>
                </div>
            `;

            jobList.insertAdjacentHTML('beforeend', cardHtml);
        });

        
    } catch (error) {
        console.error('Lỗi khi tải danh sách việc làm:', error);
        jobList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Đã có lỗi xảy ra khi lấy dữ liệu.</p>';
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return Math.floor(seconds) + " giây trước";
}

function applyJob(id) {
    var token = sessionStorage.getItem('token');
    if (!token) {
        alert("Vui lòng đăng nhập để ứng tuyển!");
        window.location.href = '../pages/auth.html#login';
        return;
    }
    alert("Tính năng gửi CV đang được xây dựng: Job ID " + id);
}

function searchJobs() {
    const keyword = document.getElementById('search-keyword').value;
    const location = document.getElementById('search-location').value;
    
    let url = '../pages/jobs.html?';
    const params = new URLSearchParams();
    if (keyword) params.append('keyword', keyword);
    if (location) params.append('location', location);
    
    window.location.href = url + params.toString();
}