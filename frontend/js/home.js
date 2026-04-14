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
    var email    = sessionStorage.getItem('email')    || '';

    if (!token) {
        // Chưa đăng nhập
        navRight.innerHTML = `
            <a href="../pages/auth.html#login"    class="btn-login">Đăng nhập</a>
            <a href="../pages/auth.html#register" class="btn-register">Đăng ký</a>
        `;
        return;
    }

    // Đã đăng nhập: lấy 2 chữ cái đầu của tên để hiện trong avatar
    var initials = getInitials(fullName);

    navRight.innerHTML = `
        <div class="user-menu" id="userMenu">
            <div class="user-avatar">${initials}</div>
            <span class="user-name">${fullName}</span>

            <div class="user-dropdown">
                <a href="#" class="dropdown-item">Hồ sơ của tôi</a>
                <a href="#" class="dropdown-item">Cài đặt</a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item logout" onclick="logout()">Đăng xuất</button>
            </div>
        </div>
    `;

    // Gắn sự kiện click để mở/đóng dropdown
    document.getElementById('userMenu').addEventListener('click', function (e) {
        this.classList.toggle('open');
        e.stopPropagation();            // không cho click lan ra ngoài
    });

    // Click ra ngoài thì đóng dropdown
    document.addEventListener('click', function () {
        var menu = document.getElementById('userMenu');
        if (menu) {
            menu.classList.remove('open');
        }
    });
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

/* ── Hàm Fetch & Render Việc làm (Job Board) ───────────────────── */
async function loadJobs() {
    const jobList = document.getElementById('job-list');
    
    try {
        // Gọi API public không cần token (trang chủ ai cũng xem được jobs)
        const res = await apiFetch('/api/jobs', 'GET');
        
        jobList.innerHTML = ''; // Clear skeleton
        
        if (!res.success || !res.data || res.data.length === 0) {
            jobList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Hiện chưa có công việc nào.</p>';
            return;
        }

        const jobs = res.data;
        
        jobs.forEach(job => {
            const logoHtml = job.companyLogo 
                ? `<img src="${job.companyLogo}" class="company-logo" alt="${job.companyName}">`
                : `<div class="company-logo">${getInitials(job.companyName)}</div>`;
                
            let salaryStr = 'Thỏa thuận';
            if (job.minSalary && job.maxSalary) {
                salaryStr = `$${job.minSalary.toLocaleString()} - $${job.maxSalary.toLocaleString()}`;
            } else if (job.minSalary) {
                salaryStr = `Tới $${job.minSalary.toLocaleString()}`;
            }
            
            // Format time ago
            const postDate = new Date(job.createdAt);
            const timeAgo = getTimeAgo(postDate);
            
            const cardHtml = `
                <div class="job-card">
                    <div>
                        <div class="job-card-header">
                            ${logoHtml}
                            <div class="job-info">
                                <h3>${job.title}</h3>
                                <div class="company-name">${job.companyName}</div>
                            </div>
                        </div>
                        <div class="job-tags">
                            <span class="tag tag-salary"><i class="fa-solid fa-money-bill-wave"></i> ${salaryStr}</span>
                            <span class="tag tag-location"><i class="fa-solid fa-map-location-dot"></i> ${job.location}</span>
                            <span class="tag tag-type"><i class="fa-solid fa-briefcase"></i> ${job.jobType}</span>
                        </div>
                    </div>
                    <div class="job-card-footer">
                        <span class="post-time"><i class="fa-regular fa-clock"></i> ${timeAgo}</span>
                        <button class="btn-apply" onclick="applyJob('${job.id}')">Ứng tuyển ngay</button>
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