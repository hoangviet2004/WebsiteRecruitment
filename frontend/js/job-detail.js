// ============================================================
// job-detail.js  –  Logic cho trang Chi tiết Tuyển dụng
// ============================================================

let currentJobCompanyId = null;

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
        currentJobCompanyId = job.companyId;
        
        // Hiện Data thực tế
        document.getElementById('job-actual-data').style.display = 'block';

        // Gán Breadcrumb
        document.getElementById('bc-job-title').innerText = job.title;

        // Gán Tiêu đề
        document.getElementById('detail-title').innerText = job.title;

        // Gán Mức lương
        let salaryStr = 'Thỏa thuận';
        if (job.minSalary && job.maxSalary) {
            salaryStr = `${job.minSalary.toLocaleString('vi-VN')} - ${job.maxSalary.toLocaleString('vi-VN')} VNĐ`;
        } else if (job.minSalary) {
            salaryStr = `Từ ${job.minSalary.toLocaleString('vi-VN')} VNĐ`;
        } else if (job.maxSalary) {
            salaryStr = `Lên đến ${job.maxSalary.toLocaleString('vi-VN')} VNĐ`;
        }
        document.getElementById('detail-salary').innerText = salaryStr;

        // Gán Học vấn và Kinh nghiệm
        document.getElementById('detail-education').innerText = job.education || "Không yêu cầu";
        document.getElementById('detail-experience').innerText = job.experience || "Không yêu cầu";

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

        // CỘT PHẢI - Logo cơ bản (tên và logo từ job data)
        document.getElementById('detail-company-name').innerText = job.companyName;

        const logoBox = document.getElementById('detail-company-logo');
        if (job.companyLogo) {
            logoBox.innerHTML = `<img src="${job.companyLogo}" alt="${job.companyName}">`;
        } else {
            const words = job.companyName.trim().split(' ').filter(w => w.length > 0);
            let init = '?';
            if (words.length === 1) init = words[0][0].toUpperCase();
            else if (words.length > 1) init = (words[0][0] + words[words.length - 1][0]).toUpperCase();
            logoBox.innerHTML = init;
        }

        // Tải thêm thông tin chi tiết của công ty qua API
        if (job.companyId) {
            try {
                const cRes  = await apiFetch('/api/companies/' + job.companyId, { method: 'GET' });
                const cData = await cRes.json();
                if (cRes.ok && cData.success && cData.data) {
                    const c = cData.data;

                    if (c.companySize) {
                        document.getElementById('detail-company-size').innerText = c.companySize;
                        document.getElementById('sidebar-size-row').style.display = 'flex';
                    }
                    if (c.address && c.address.trim()) {
                        document.getElementById('detail-company-address').innerText = c.address;
                        document.getElementById('sidebar-address-row').style.display = 'flex';
                    }
                    if (c.website && c.website.trim()) {
                        const websiteEl = document.getElementById('detail-company-website');
                        websiteEl.href = c.website;
                        websiteEl.innerText = c.website.replace(/^https?:\/\//, '');
                        document.getElementById('sidebar-website-row').style.display = 'flex';

                        const linkEl = document.getElementById('detail-company-link');
                        linkEl.href = c.website;
                        linkEl.style.display = 'flex';
                        document.getElementById('detail-company-link-fallback').style.display = 'none';
                    }
                    if (c.description && c.description.trim()) {
                        document.getElementById('detail-company-desc').innerText = c.description;
                        document.getElementById('detail-company-desc-wrap').style.display = 'block';
                    }
                }
            } catch (_) { /* Silently ignore nếu không lấy được chi tiết công ty */ }
        }

    } catch (error) {
        console.error(error);
        alert("Xảy ra lỗi mạng khi đọc chi tiết công việc.");
    }
    
    // Gọi gợi ý việc làm
    loadSuggestedJobs(id, currentJobCompanyId);
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

function viewCompanyProfile() {
    if (currentJobCompanyId) {
        window.location.href = `company-detail.html?id=${currentJobCompanyId}`;
    } else {
        alert("Hiện tại chưa có thông tin hồ sơ của công ty này.");
    }
}

async function loadSuggestedJobs(currentJobId, currentCompanyId) {
    try {
        const res = await apiFetch('/api/jobs', { method: 'GET' });
        const data = await res.json();
        
        if (data.success && data.data) {
            let otherJobs = data.data.filter(j => j.id !== currentJobId);
            let suggested = otherJobs.filter(j => j.companyId === currentCompanyId);
            
            if (suggested.length < 3) {
                const rest = otherJobs.filter(j => j.companyId !== currentCompanyId);
                suggested = suggested.concat(rest).slice(0, 3);
            } else {
                suggested = suggested.slice(0, 3);
            }
            
            const container = document.getElementById('suggested-jobs-container');
            container.innerHTML = '';
            
            if (suggested.length === 0) {
                container.innerHTML = '<div style="color: #64748b; font-size: 13px;">Không có việc làm gợi ý.</div>';
                return;
            }
            
            suggested.forEach(job => {
                let salaryStr = 'Thỏa thuận';
                if (job.minSalary && job.maxSalary) {
                    salaryStr = `${job.minSalary.toLocaleString('vi-VN')} - ${job.maxSalary.toLocaleString('vi-VN')} VNĐ`;
                } else if (job.minSalary) {
                    salaryStr = `Từ ${job.minSalary.toLocaleString('vi-VN')} VNĐ`;
                } else if (job.maxSalary) {
                    salaryStr = `Lên đến ${job.maxSalary.toLocaleString('vi-VN')} VNĐ`;
                }
                
                const logoHtml = job.companyLogo 
                    ? `<img src="${job.companyLogo}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                    : `<div style="font-weight:bold; color:#3b82f6; font-size:20px;">${getInitials(job.companyName)}</div>`;

                const card = document.createElement('a');
                card.href = `job-detail.html?id=${job.id}`;
                card.style.cssText = "display: block; padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; transition: all 0.2s;";
                card.onmouseover = function() { this.style.borderColor = '#3b82f6'; this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; };
                card.onmouseout = function() { this.style.borderColor = '#e2e8f0'; this.style.boxShadow = 'none'; };
                
                card.innerHTML = `
                    <div style="display: flex; gap: 16px; margin-bottom: 12px;">
                        <div style="width: 56px; height: 56px; background: #fff; border-radius: 8px; border: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; padding: 4px;">
                            ${logoHtml}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; font-size: 15px; color: #1e293b; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; transition: color 0.2s;">${job.title}</div>
                            <div style="font-size: 13px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${job.companyName}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        <span style="background: #f1f5f9; color: #10b981; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600;"><i class="fa-solid fa-money-bill-wave"></i> ${salaryStr}</span>
                        <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 4px; font-size: 13px;"><i class="fa-solid fa-location-dot"></i> ${job.location || 'Khác'}</span>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (e) {
        document.getElementById('suggested-jobs-container').innerHTML = '<div style="color: #ef4444; font-size: 13px;">Lỗi tải dữ liệu.</div>';
    }
}

function getInitials(fullName) {
    if (!fullName) return '?';
    var words = fullName.trim().split(' ').filter(function (w) { return w.length > 0; });
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
