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
    } else if (tabName === 'packages') {
        loadPackages();
    }
}

// ── 2b. Đăng ký Gói dịch vụ ────────────────────────────────
let _packagesLoaded = false;
let _currentSubscription = null;

async function loadPackages() {
    const container = document.getElementById('packages-container');

    try {
        const [subRes, pkgRes] = await Promise.all([
            apiFetchAuth('/api/packages/my-subscription', { method: 'GET' }),
            apiFetch('/api/packages/active', { method: 'GET' })
        ]);

        const subData = await subRes.json();
        const pkgData = await pkgRes.json();

        if (!pkgRes.ok || !pkgData.success) throw new Error(pkgData.message || 'Lỗi tải gói dịch vụ');

        _currentSubscription = subData.success ? subData.data : null;
        const packages = pkgData.data || [];

        if (packages.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:48px 0; color:#64748b;"><i class="fa-solid fa-box-open" style="font-size:48px; margin-bottom:16px; color:#cbd5e1;"></i><p>Hiện chưa có gói dịch vụ nào.</p></div>';
            return;
        }

        let subInfoHtml = '';
        if (_currentSubscription && _currentSubscription.hasSubscription) {
            const s = _currentSubscription;
            const jobsText = s.maxJobPosts === -1
                ? '<span style="color:#22c55e;font-weight:700;">Không giới hạn</span>'
                : '<strong>' + s.jobPostsUsed + '</strong> / ' + s.maxJobPosts + ' tin đã dùng';
            const endDateStr = new Date(s.endDate).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });

            subInfoHtml = '<div class="sub-info-card"><div class="sub-info-header"><i class="fa-solid fa-crown" style="color:#f59e0b;margin-right:8px;"></i>Gói hiện tại: <strong>' + escapeHtmlPkg(s.packageName) + '</strong></div><div class="sub-info-details"><div class="sub-info-item"><i class="fa-solid fa-newspaper"></i><span>Tin đăng: ' + jobsText + '</span></div><div class="sub-info-item"><i class="fa-solid fa-calendar-check"></i><span>Hết hạn: ' + endDateStr + ' (còn ' + s.daysRemaining + ' ngày)</span></div></div></div>';
        }

        let cardsHtml = '';
        packages.forEach(function(pkg) {
            var features = [];
            try { features = JSON.parse(pkg.features || '[]'); } catch(e) {}

            var featuresHtml = features.map(function(f) {
                return '<li><i class="fa-solid fa-check" style="color:#22c55e;margin-right:8px;"></i>' + escapeHtmlPkg(f) + '</li>';
            }).join('');

            var priceStr = pkg.price === 0
                ? '<span style="color:#22c55e;font-weight:700;">Miễn phí</span>'
                : '<span style="font-size:28px;font-weight:800;color:#0f172a;">' + formatVND(pkg.price) + '</span><span style="font-size:14px;color:#64748b;font-weight:400;"> / ' + pkg.durationDays + ' ngày</span>';

            var maxJobText = pkg.maxJobPosts === -1
                ? 'Không giới hạn tin đăng'
                : 'Tối đa ' + pkg.maxJobPosts + ' tin đăng';

            var isCurrentPkg = _currentSubscription && _currentSubscription.hasSubscription && _currentSubscription.packageId === pkg.id;
            var highlightClass = pkg.isHighlighted ? ' pkg-highlighted' : '';
            var currentClass = isCurrentPkg ? ' pkg-current' : '';

            var btnHtml;
            if (isCurrentPkg) {
                btnHtml = '<button class="pkg-btn pkg-btn-current" disabled><i class="fa-solid fa-check-circle" style="margin-right:6px;"></i>Đang sử dụng</button>';
            } else {
                var btnLabel = pkg.price === 0 ? 'Dùng miễn phí' : 'Đăng ký ngay';
                btnHtml = '<button class="pkg-btn' + (pkg.isHighlighted ? ' pkg-btn-primary' : '') + '" onclick="selectPackage(\'' + pkg.id + '\', \'' + escapeHtmlPkg(pkg.name) + '\', ' + pkg.price + ')"><i class="fa-solid fa-cart-shopping" style="margin-right:6px;"></i>' + btnLabel + '</button>';
            }

            var badgeHtml = '';
            if (isCurrentPkg) {
                badgeHtml = '<div class="pkg-badge" style="background:linear-gradient(135deg,#22c55e,#16a34a);">Gói hiện tại</div>';
            } else if (pkg.isHighlighted) {
                badgeHtml = '<div class="pkg-badge">Phổ biến nhất</div>';
            }

            cardsHtml += '<div class="pkg-card' + highlightClass + currentClass + '">' + badgeHtml + '<div class="pkg-name">' + escapeHtmlPkg(pkg.name) + '</div><div class="pkg-price">' + priceStr + '</div><div class="pkg-jobs"><i class="fa-solid fa-briefcase" style="margin-right:6px;"></i>' + maxJobText + '</div><ul class="pkg-features">' + featuresHtml + '</ul>' + btnHtml + '</div>';
        });

        container.innerHTML = subInfoHtml + '<div class="packages-grid">' + cardsHtml + '</div>';
        _packagesLoaded = true;
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:32px 0;"><i class="fa-solid fa-circle-exclamation" style="font-size:32px; color:#ef4444;"></i><p style="margin-top:12px; color:#ef4444; font-weight:600;">Lỗi tải gói dịch vụ</p><p style="color:#64748b; font-size:13px;">' + e.message + '</p></div>';
    }
}

async function selectPackage(packageId, packageName, price) {
    var action = price === 0 ? 'kích hoạt' : 'đăng ký';
    if (!confirm('Bạn có muốn ' + action + ' gói "' + packageName + '"?')) return;

    try {
        var response = await apiFetchAuth('/api/packages/register/' + packageId, { method: 'POST' });
        var res = await response.json();

        if (!response.ok || !res.success) {
            alert('Lỗi: ' + (res.message || 'Không thể đăng ký gói dịch vụ'));
            return;
        }

        alert(res.message || 'Đăng ký gói "' + packageName + '" thành công!');
        _packagesLoaded = false;
        loadPackages();
    } catch (e) {
        alert('Lỗi kết nối: ' + e.message);
    }
}

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function escapeHtmlPkg(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
            document.getElementById('company-taxcode').value = res.data.taxCode || '';
            document.getElementById('company-website').value = res.data.website || '';
            document.getElementById('company-address').value = res.data.address || '';
            document.getElementById('company-desc').value = res.data.description || '';
            // Quy mô công ty
            const sizeEl = document.getElementById('company-size');
            if (sizeEl && res.data.companySize) sizeEl.value = res.data.companySize;
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
        taxCode: document.getElementById('company-taxcode').value,
        website: document.getElementById('company-website').value || null,
        address: document.getElementById('company-address').value || null,
        description: document.getElementById('company-desc').value || null,
        companySize: document.getElementById('company-size').value || null
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
