// ============================================================
// job-detail.js  –  Logic cho trang Chi tiết Tuyển dụng
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Lấy ID từ thanh điều hướng (URL)
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');

    if (!jobId) {
        alert("Không tìm thấy thông tin công việc!");
        window.location.href = 'home.html';
        return;
    }

    loadJobDetail(jobId);
    
    // Gọi hàm render nav từ home.js
    if (typeof renderNavRight === 'function') {
        renderNavRight();
    }
});

async function loadJobDetail(id) {
    try {
        const response = await apiFetch('/api/jobs/' + id, { method: 'GET' });
        const res = await response.json();

        // Ẩn Skeleton
        document.getElementById('job-skeleton').style.display = 'none';

        if (!response.ok || !res.success || !res.data) {
            document.getElementById('job-actual-data').style.display = 'block';
            document.getElementById('job-actual-data').innerHTML = `
                <div style="text-align:center; padding: 50px; background:#fff; border-radius:12px;">
                    <img src="https://cdni.iconscout.com/illustration/premium/thumb/folder-not-found-4064365-3363936.png" style="width:200px;">
                    <h2 style="color:#ef4444; margin-top:20px;">Không tìm thấy kết quả</h2>
                    <p style="color:#64748b; margin-top:10px;">Tin tuyển dụng này có thể đã bị xóa hoặc hết hạn.</p>
                </div>
            `;
            return;
        }

        const job = res.data;
        
        // Hiện Data thực tế
        document.getElementById('job-actual-data').style.display = 'block';

        // Gán Breadcrumb
        document.getElementById('bc-job-title').innerText = job.title;

        // Gán Tiêu đề
        document.getElementById('detail-title').innerText = job.title;

        // Gán Mức lương
        let salaryStr = 'Thỏa thuận';
        if (job.minSalary && job.maxSalary) {
            salaryStr = `$${job.minSalary.toLocaleString()} - $${job.maxSalary.toLocaleString()}`;
        } else if (job.minSalary) {
            salaryStr = `Từ $${job.minSalary.toLocaleString()}`;
        } else if (job.maxSalary) {
            salaryStr = `Tới $${job.maxSalary.toLocaleString()}`;
        }
        document.getElementById('detail-salary').innerText = salaryStr;

        // Gán Địa điểm & Loại hình
        document.getElementById('detail-location').innerText = job.location || "Đang cập nhật";
        document.getElementById('detail-type').innerText = job.jobType || "Đang cập nhật";

        // Gán Hạn nộp
        const dt = new Date(job.expiresAt);
        document.getElementById('detail-expire-date').innerText = dt.toLocaleDateString('vi-VN');
        
        // Tính toán đếm ngược ngày
        const today = new Date();
        const diffTime = dt - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
            document.getElementById('detail-expire-countdown').innerText = `(Còn ${diffDays} ngày)`;
        } else {
            document.getElementById('detail-expire-countdown').innerText = `(Đã hết hạn)`;
            document.getElementById('detail-expire-countdown').style.color = '#ef4444';
        }

        // Gán Nội dung chi tiết
        document.getElementById('detail-desc').innerText = job.description || "Nội dung đang được cập nhật.";
        document.getElementById('detail-req').innerText = job.requirements || "Không có yêu cầu đặc biệt.";
        document.getElementById('detail-ben').innerText = job.benefits || "Liên hệ để biết thêm chi tiết.";

        // Gán Tags
        const tagsHtml = `<span class="tag-pill">${job.jobType}</span> <span class="tag-pill">${job.location}</span>`;
        document.getElementById('detail-tags').innerHTML = tagsHtml;

        // CỘT PHẢI - Gán Company
        document.getElementById('detail-company-name').innerText = job.companyName;
        document.getElementById('detail-company-location').innerText = job.location;
        
        // Xử lý Logo
        const logoBox = document.getElementById('detail-company-logo');
        if (job.companyLogo) {
            logoBox.innerHTML = `<img src="${job.companyLogo}" alt="${job.companyName}">`;
        } else {
            // Lấy chữ cái tự động nếu không có logo
            const words = job.companyName.trim().split(' ').filter(w => w.length > 0);
            let init = '?';
            if (words.length === 1) init = words[0][0].toUpperCase();
            else if (words.length > 1) init = (words[0][0] + words[words.length - 1][0]).toUpperCase();
            logoBox.innerHTML = init;
        }

    } catch (error) {
        console.error(error);
        alert("Xảy ra lỗi mạng khi đọc chi tiết công việc.");
    }
}

function applyThisJob() {
    var token = sessionStorage.getItem('token');
    if (!token) {
        alert("Vui lòng đăng nhập để tiến hành nộp hồ sơ CV!");
        window.location.href = 'auth.html#login';
        return;
    }
    
    // Giao diện Mockup TopCV thường có modal
    alert("Cảm ơn bạn! Tính năng upload CV sẽ sớm được tích hợp.");
}
