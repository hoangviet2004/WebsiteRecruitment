// ============================================================
// recruiter.js  –  Logic cho trang Kênh Nhà Tuyển Dụng
// ============================================================

let currentCompanyId = null;

// ── 1. Kiểm tra quyền truy cập ─────────────────────────────
function requireRecruiter() {
    var token = sessionStorage.getItem('token');
    var role = sessionStorage.getItem('role');
    if (!token || role !== 'Recruiter') {
        alert("Tính năng này chỉ dành cho Nhà Tuyển Dụng.");
        window.location.href = '../pages/home.html';
    }
}

// ── 2. Đổi Tab ─────────────────────────────────────────────
function switchTab(tabName, element) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');

    if (tabName === 'jobs' && currentCompanyId) {
        loadMyJobs(currentCompanyId);
    } else if (tabName === 'jobs' && !currentCompanyId) {
        document.getElementById('job-table-body').innerHTML = `<tr><td colspan="4" style="text-align:center;color:#ef4444;">Vui lòng tạo Hồ sơ Công ty trước khi đăng tin.</td></tr>`;
    }
}

// ── 3. Quản lý Hồ sơ Công ty ───────────────────────────────
async function loadMyCompany() {
    try {
        const response = await apiFetchAuth('/api/companies/my-company', { method: 'GET' });
        if (!response.ok) {
            console.log("Sẽ tạo mới công ty.");
            return;
        }
        const res = await response.json();
        if (res && res.success && res.data) {
            currentCompanyId = res.data.id;
            document.getElementById('company-id').value = res.data.id;
            document.getElementById('company-name').value = res.data.name || '';
            document.getElementById('company-website').value = res.data.website || '';
            document.getElementById('company-address').value = res.data.address || '';
            document.getElementById('company-desc').value = res.data.description || '';
        }
    } catch (e) {
        // Backend throw 500 or 400 if not found, we ignore or log.
        console.log("Sẽ tạo mới công ty.");
    }
}

document.getElementById('company-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('company-id').value;
    const isUpdate = !!id;
    
    const payload = {
        name: document.getElementById('company-name').value,
        website: document.getElementById('company-website').value || null,
        address: document.getElementById('company-address').value || null,
        description: document.getElementById('company-desc').value || null
    };

    try {
        let response;
        if (isUpdate) {
            response = await apiFetchAuth('/api/companies/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
            response = await apiFetchAuth('/api/companies', { method: 'POST', body: JSON.stringify(payload) });
        }
        
        let res = {};
        try { res = await response.json(); } catch(e) {}

        if (res.success) {
            alert(isUpdate ? "Cập nhật thành công!" : "Tạo công ty thành công!");
            currentCompanyId = res.data.id;
            document.getElementById('company-id').value = currentCompanyId;
        } else {
            let errorMsg = res.message || "Lỗi dữ liệu.";
            if (res.errors) {
                errorMsg += "\nChi tiết lỗi: " + JSON.stringify(res.errors);
            }
            alert("Lỗi: " + errorMsg);
        }
    } catch (error) {
        alert("Lỗi kết nối máy chủ");
    }
});


// ── 4. Quản lý Đăng tin Tuyển dụng ─────────────────────────
async function loadMyJobs(companyId) {
    const tbody = document.getElementById('job-table-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Đang tải...</td></tr>';
    
    try {
        const response = await apiFetchAuth('/api/jobs/company/' + companyId, { method: 'GET' });
        const res = await response.json();
        tbody.innerHTML = '';
        
        if (!response.ok || !res.success || !res.data || res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Bạn chưa có tin tuyển dụng nào.</td></tr>';
            return;
        }

        res.data.forEach(job => {
            const expDate = new Date(job.expiresAt).toLocaleDateString('vi-VN');
            let statusHtml = '';
            if (!job.isApproved) {
                statusHtml = '<span style="background:#fef3c7; color:#d97706; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600;">Chờ duyệt</span>';
            } else {
                statusHtml = job.isActive 
                    ? '<span style="background:#dcfce7; color:#16a34a; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600;">Đang mở</span>' 
                    : '<span style="background:#fee2e2; color:#dc2626; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600;">Đã ẩn</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${job.title}</strong><br><small style="color:#64748b">${job.jobType} • ${job.location}</small></td>
                <td>${statusHtml}</td>
                <td>${expDate}</td>
                <td>
                    <button style="border:none; background:transparent; color:#3b82f6; cursor:pointer; margin-right:10px;" onclick="editJob('${job.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button style="border:none; background:transparent; color:#ef4444; cursor:pointer;" onclick="deleteJob('${job.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color:red;">Lỗi tải dữ liệu.</td></tr>';
    }
}

// ── Modal Logic ────────────────────────────────────────────
function openJobModal() {
    if (!currentCompanyId) {
        alert("Vui lòng cập nhật và lưu Hồ Sơ Công Ty trước khi đăng tin.");
        return;
    }
    
    document.getElementById('job-form').reset();
    document.getElementById('job-id').value = '';
    document.getElementById('job-modal-title').innerText = 'Đăng tin tuyển dụng mới';
    
    // Set mặc định ngày hết hạn là 30 ngày sau
    const date = new Date();
    date.setDate(date.getDate() + 30);
    document.getElementById('job-expires').value = date.toISOString().slice(0, 16);

    document.getElementById('job-modal').classList.add('show');
}

function closeJobModal() {
    document.getElementById('job-modal').classList.remove('show');
}

async function submitJobForm() {
    const jobId = document.getElementById('job-id').value;
    const isUpdate = !!jobId;

    const payload = {
        companyId: currentCompanyId,
        title: document.getElementById('job-title').value,
        jobType: document.getElementById('job-type').value,
        location: document.getElementById('job-location').value,
        minSalary: parseFloat(document.getElementById('job-min-salary').value) || null,
        maxSalary: parseFloat(document.getElementById('job-max-salary').value) || null,
        description: document.getElementById('job-desc').value,
        requirements: document.getElementById('job-req').value,
        benefits: document.getElementById('job-ben').value,
        expiresAt: new Date(document.getElementById('job-expires').value).toISOString(),
        isActive: document.getElementById('job-active').value === 'true'
    };

    if (!payload.title || !payload.expiresAt) {
        alert("Vui lòng điền các trường bắt buộc.");
        return;
    }

    try {
        let response;
        if (isUpdate) {
            response = await apiFetchAuth('/api/jobs/' + jobId, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
            response = await apiFetchAuth('/api/jobs', { method: 'POST', body: JSON.stringify(payload) });
        }
        
        let res = {};
        try { res = await response.json(); } catch(e) {}

        if (res.success) {
            alert(isUpdate ? "Cập nhật thành công!" : "Đăng tin thành công!");
            closeJobModal();
            loadMyJobs(currentCompanyId);
        } else {
            alert("Lỗi: " + JSON.stringify(res.errors || res.message));
        }
    } catch (e) {
        alert("Lỗi hệ thống khi lưu tin.");
    }
}

// Chưa hỗ trợ Edit Job hoàn thiện (fetch chi tiết), sử dụng tạm thông báo
async function editJob(jobId) {
    try {
        const response = await apiFetch('/api/jobs/' + jobId, { method: 'GET' });
        const res = await response.json();
        if (response.ok && res.success && res.data) {
            const job = res.data;
            document.getElementById('job-id').value = job.id;
            document.getElementById('job-title').value = job.title;
            document.getElementById('job-type').value = job.jobType;
            document.getElementById('job-location').value = job.location;
            document.getElementById('job-min-salary').value = job.minSalary || '';
            document.getElementById('job-max-salary').value = job.maxSalary || '';
            document.getElementById('job-desc').value = job.description;
            document.getElementById('job-req').value = job.requirements;
            document.getElementById('job-ben').value = job.benefits;
            
            // local datetime format YYYY-MM-DDThh:mm
            const dt = new Date(job.expiresAt);
            const tzOffset = dt.getTimezoneOffset() * 60000; // offset in milliseconds
            const localISOTime = (new Date(dt - tzOffset)).toISOString().slice(0, 16);
            document.getElementById('job-expires').value = localISOTime;
            
            document.getElementById('job-active').value = job.isActive.toString();

            document.getElementById('job-modal-title').innerText = 'Chỉnh sửa tin tuyển dụng';
            document.getElementById('job-modal').classList.add('show');
        }
    } catch(e) {
        alert("Lỗi không lấy được dữ liệu tin.");
    }
}

async function deleteJob(jobId) {
    if (!confirm("Bạn có chắc chắn muốn xóa tin tuyển dụng này? Không thể khôi phục!")) return;
    
    try {
        const response = await apiFetchAuth('/api/jobs/' + jobId, { method: 'DELETE' });
        const res = await response.json();
        if (response.ok && res.success) {
            alert("Đã xóa tin tuyển dụng.");
            loadMyJobs(currentCompanyId);
        } else {
            alert("Xóa thất bại: " + res.message);
        }
    } catch(e) {
        alert("Lỗi mạng khi xóa.");
    }
}

// ── Khởi tạo ───────────────────────────────────────────────
window.onload = function() {
    requireRecruiter();
    loadMyCompany();
};
