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


// ── Bước 2: Render khu vực nav bên phải ─────────────────────
// Nếu chưa đăng nhập → hiện nút Đăng nhập / Đăng ký
// Nếu đã đăng nhập   → hiện avatar tròn + tên user
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

    // Hàm nội bộ để render HTML
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

    // 1. Render nhanh với dữ liệu từ Cache (nếu có)
    updateDOM(fullName, sessionStorage.getItem('avatarUrl'));

    // 2. Tự động kiểm tra ngầm với server để tải Avatar mới nhất nếu session bị thiếu hoặc cũ
    fetch(`${API_URL}/api/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(json => {
        if (json.data) {
            const realName = json.data.displayName || fullName;
            const realAvatar = json.data.avatarUrl;
            
            // Xử lý cập nhật lại session
            if (realName) sessionStorage.setItem('fullName', realName);
            if (realAvatar) sessionStorage.setItem('avatarUrl', realAvatar);

            // Chèn lại avatar mới nhất vào thanh bar
            updateDOM(realName, realAvatar);
        }
    })
    .catch(() => {}); // Im lặng nếu lỗi (tránh spam console)
    
    // Đóng dropdown khi click ra ngoài
    if (!window._navEventBound) {
        document.addEventListener('click', function () {
            var menu = document.getElementById('userMenu');
            if (menu) menu.classList.remove('open');
        });
        window._navEventBound = true;
    }
}


// ── Hàm lấy chữ cái đầu của họ tên ─────────────────────────
// Ví dụ: "Nguyễn Văn An" → "NA"
function getInitials(fullName) {
    var words = fullName.trim().split(' ').filter(function (w) { return w.length > 0; });
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    // Lấy chữ đầu tiên và chữ cuối cùng
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}


// ── Chạy khi trang load xong ─────────────────────────────────
checkAdminRedirect();
renderNavRight();
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
        
        if (!response.ok || !res.success || !res.data || res.data.length === 0) {
            list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Chưa có công ty nổi bật nào.</p>';
            return;
        }

        const companies = res.data;
        
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

        const jobs = res.data;
        
        jobs.forEach(job => {
            // Logo: wrapper div luôn có class, bên trong là <img> hoặc chữ cái
            const logoHtml = job.companyLogo
                ? `<div class="company-logo"><img src="${job.companyLogo}" alt="${job.companyName}"></div>`
                : `<div class="company-logo">${getInitials(job.companyName)}</div>`;

            // Lương — format triệu VND
            let salaryStr = 'Thỏa thuận';
            if (job.minSalary && job.maxSalary) {
                salaryStr = `${job.minSalary} - ${job.maxSalary} triệu`;
            } else if (job.minSalary) {
                salaryStr = `Tới ${job.minSalary} triệu`;
            } else if (job.maxSalary) {
                salaryStr = `Lên đến ${job.maxSalary} triệu`;
            }

            const timeAgo = getTimeAgo(new Date(job.createdAt));

            const cardHtml = `
                <div class="job-card" onclick="window.location.href='job-detail.html?id=${job.id}'">
                    <div class="job-card-header">
                        ${logoHtml}
                        <div class="job-info">
                            <h3>${job.title}</h3>
                            <div class="company-name">${job.companyName}</div>
                        </div>
                    </div>
                    <div class="job-tags">
                        <span class="tag tag-salary"><i class="fa-solid fa-money-bill-wave"></i> ${salaryStr}</span>
                        <span class="tag tag-location"><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
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
    alert("Tính năng tìm kiếm đang được xây dựng!");
}