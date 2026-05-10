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
    } else if (tabName === 'transactions') {
        loadMyTransactions();
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
            
            const endDate = new Date(s.endDate);
            const endDateStr = endDate.getFullYear() > 2070 
                ? '<span style="color:#22c55e;font-weight:700;">Vô thời hạn</span>' 
                : endDate.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
            
            const remainingText = endDate.getFullYear() > 2070 ? '' : ` (còn ${s.daysRemaining} ngày)`;

            let subFeaturesHtml = '';
            try {
                const subFeatures = JSON.parse(s.packageFeatures || '[]');
                if (subFeatures.length > 0) {
                    subFeaturesHtml = '<div class="sub-info-features-title">Tính năng của gói:</div><ul class="sub-info-features">' + subFeatures.map(f => '<li><i class="fa-solid fa-check"></i>' + escapeHtmlPkg(f) + '</li>').join('') + '</ul>';
                }
            } catch(e) {}

            subInfoHtml = '<div class="sub-info-card"><div class="sub-info-header"><i class="fa-solid fa-crown" style="color:#f59e0b;margin-right:8px;"></i>Gói hiện tại: <strong>' + escapeHtmlPkg(s.packageName) + '</strong></div><div class="sub-info-details"><div class="sub-info-item"><i class="fa-solid fa-newspaper"></i><span>Tin đăng: ' + jobsText + '</span></div><div class="sub-info-item"><i class="fa-solid fa-calendar-check"></i><span>Hạn dùng: ' + endDateStr + remainingText + '</span></div></div>' + subFeaturesHtml + '</div>';
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

            var ownedSub = _currentSubscription && _currentSubscription.ownedSubscriptions 
                ? _currentSubscription.ownedSubscriptions.find(os => os.packageId === pkg.id) 
                : null;
            
            var isCurrentPkg = ownedSub && ownedSub.isSelected;
            var highlightClass = pkg.isHighlighted ? ' pkg-highlighted' : '';
            var currentClass = isCurrentPkg ? ' pkg-current' : '';

            var btnHtml;
            if (isCurrentPkg) {
                btnHtml = '<button class="pkg-btn pkg-btn-current" disabled><i class="fa-solid fa-check-circle" style="margin-right:6px;"></i>Đang sử dụng</button>';
            } else if (ownedSub) {
                // Đã sở hữu nhưng chưa chọn
                btnHtml = '<button class="pkg-btn pkg-btn-primary" onclick="switchActiveSubscription(\'' + ownedSub.id + '\')"><i class="fa-solid fa-toggle-on" style="margin-right:6px;"></i>Sử dụng gói</button>';
            } else {
                var btnLabel = pkg.price === 0 ? 'Dùng miễn phí' : 'Đăng ký ngay';
                btnHtml = '<button class="pkg-btn' + (pkg.isHighlighted ? ' pkg-btn-primary' : '') + '" onclick="selectPackage(\'' + pkg.id + '\', \'' + escapeHtmlPkg(pkg.name) + '\', ' + pkg.price + ')"><i class="fa-solid fa-cart-shopping" style="margin-right:6px;"></i>' + btnLabel + '</button>';
            }

            var badgeHtml = '';
            if (isCurrentPkg) {
                badgeHtml = '<div class="pkg-badge" style="background:linear-gradient(135deg,#22c55e,#16a34a);">Gói hiện tại</div>';
            } else if (pkg.isHighlighted) {
                badgeHtml = '<div class="pkg-badge">Gói phổ biến</div>';
            }

            cardsHtml += '<div class="pkg-card' + highlightClass + currentClass + '">' + badgeHtml + '<div class="pkg-name">' + escapeHtmlPkg(pkg.name) + '</div><div class="pkg-price">' + priceStr + '</div><div class="pkg-jobs"><i class="fa-solid fa-briefcase" style="margin-right:6px;"></i>' + maxJobText + '</div><ul class="pkg-features">' + featuresHtml + '</ul>' + btnHtml + '</div>';
        });

        container.innerHTML = subInfoHtml + '<div class="packages-grid">' + cardsHtml + '</div>';
        _packagesLoaded = true;
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:32px 0;"><i class="fa-solid fa-circle-exclamation" style="font-size:32px; color:#ef4444;"></i><p style="margin-top:12px; color:#ef4444; font-weight:600;">Lỗi tải gói dịch vụ</p><p style="color:#64748b; font-size:13px;">' + e.message + '</p></div>';
    }
}

async function switchActiveSubscription(subscriptionId) {
    if (!confirm('Bạn có chắc muốn chuyển sang sử dụng gói này? Một số tin tuyển dụng có thể bị ẩn nếu gói mới có giới hạn thấp hơn.')) return;

    try {
        const res = await apiFetchAuth('/api/packages/select-subscription/' + subscriptionId, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            alert(data.message || 'Đã chuyển gói thành công!');
            loadPackages(); // Tải lại để cập nhật giao diện
        } else {
            alert('Lỗi: ' + data.message);
        }
    } catch (e) {
        console.error('Error switching subscription:', e);
        alert('Lỗi kết nối máy chủ.');
    }
}

let _selectedPackageId = null;
let _selectedPackageName = null;

async function selectPackage(packageId, packageName, price) {
    var action = price === 0 ? 'kích hoạt' : 'đăng ký';
    
    if (price > 0) {
        _selectedPackageId = packageId;
        _selectedPackageName = packageName;
        
        document.getElementById('payment-pkg-name').innerText = packageName;
        document.getElementById('payment-pkg-price').innerText = formatVND(price);
        document.getElementById('payment-modal').classList.add('show');
    } else {
        if (!confirm('Bạn có muốn ' + action + ' gói "' + packageName + '"?')) return;
        executePackageRegistration(packageId, packageName, 'Manual');
    }
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.remove('show');
    _selectedPackageId = null;
    _selectedPackageName = null;
}

function confirmPayment(method) {
    if (!_selectedPackageId) return;
    executePackageRegistration(_selectedPackageId, _selectedPackageName, method);
    closePaymentModal();
}

async function executePackageRegistration(packageId, packageName, paymentMethod) {
    try {
        const url = `/api/packages/register/${packageId}?paymentMethod=${paymentMethod}`;
        const response = await apiFetchAuth(url, { method: 'POST' });
        const res = await response.json();

        if (!response.ok || !res.success) {
            alert('Lỗi: ' + (res.message || 'Không thể đăng ký gói dịch vụ'));
            return;
        }

        if (res.data && res.data.paymentUrl) {
            window.location.href = res.data.paymentUrl;
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

async function loadSubscriptionInfo() {
    try {
        const response = await apiFetchAuth('/api/packages/my-subscription', { method: 'GET' });
        const res = await response.json();
        if (res.success && res.data) {
            _currentSubscription = res.data;
        }
    } catch (e) {
        console.error("Lỗi tải thông tin gói dịch vụ:", e);
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
            document.getElementById('company-taxcode').value = res.data.taxCode || '';
            document.getElementById('company-website').value = res.data.website || '';
            document.getElementById('company-address').value = res.data.address || '';
            document.getElementById('company-desc').value = res.data.description || '';
            document.getElementById('company-desc-count').textContent = (res.data.description || '').length;
            document.getElementById('company-email').value = res.data.contactEmail || '';
            document.getElementById('company-phone').value = res.data.contactPhone || '';
            // Quy mô công ty
            const sizeEl = document.getElementById('company-size');
            if (sizeEl && res.data.companySize) sizeEl.value = res.data.companySize;

            if (res.data.logoUrl) {
                document.getElementById('logo-image').src = res.data.logoUrl;
                document.getElementById('logo-image').style.display = 'block';
                document.getElementById('logo-placeholder').style.display = 'none';
            }
            if (res.data.coverImageUrl) {
                document.getElementById('cover-image').src = res.data.coverImageUrl;
                document.getElementById('cover-image').style.display = 'block';
            }
        }
    } catch (e) {
        // Backend throw 500 or 400 if not found, we ignore or log.
        console.log("Sẽ tạo mới công ty.");
    }
}

let cropper = null;
let currentCropType = null; // 'logo' or 'cover'

function handleImageSelect(input, type) {
    if (!input.files || input.files.length === 0) return;
    if (!currentCompanyId) {
        alert("Vui lòng tạo hồ sơ công ty trước khi tải ảnh lên.");
        input.value = '';
        return;
    }
    
    currentCropType = type;
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const cropImage = document.getElementById('crop-image');
        cropImage.src = e.target.result;
        
        // Cập nhật tiêu đề modal
        const modalTitle = document.querySelector('#crop-modal .modal-header h3');
        if (modalTitle) {
            modalTitle.textContent = type === 'logo' ? 'Cắt ảnh đại diện' : 'Cắt ảnh bìa';
        }
        
        document.getElementById('crop-modal').style.display = 'flex';
        
        if (cropper) {
            cropper.destroy();
        }
        
        cropper = new Cropper(cropImage, {
            aspectRatio: type === 'logo' ? 1 : NaN, // Logo 1:1, Cover tự do
            viewMode: 2,
            autoCropArea: 1,
            responsive: true,
        });
    };
    
    reader.readAsDataURL(file);
}

function uploadLogo(input) {
    handleImageSelect(input, 'logo');
}

function uploadCover(input) {
    handleImageSelect(input, 'cover');
}

function closeCropModal() {
    document.getElementById('crop-modal').style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    currentCropType = null;
    document.getElementById('logo-input').value = '';
    document.getElementById('cover-input').value = '';
}

async function confirmCrop() {
    if (!cropper || !currentCompanyId || !currentCropType) return;
    
    const btn = document.getElementById('crop-save-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    btn.disabled = true;
    
    // Tùy chỉnh độ phân giải khi xuất ảnh
    const cropOptions = currentCropType === 'logo' 
        ? { width: 400, height: 400 } 
        : { maxWidth: 1200 }; // Cover không cố định kích thước nhưng giới hạn chiều rộng
        
    cropper.getCroppedCanvas(cropOptions).toBlob(async (blob) => {
        const formData = new FormData();
        const fileName = currentCropType === 'logo' ? 'logo.png' : 'cover.png';
        formData.append('file', blob, fileName);

        const endpoint = currentCropType === 'logo' 
            ? `/api/companies/${currentCompanyId}/logo` 
            : `/api/companies/${currentCompanyId}/cover`;

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') },
                body: formData
            });
            const res = await response.json();
            
            if (response.ok && res.success) {
                if (currentCropType === 'logo') {
                    document.getElementById('logo-image').src = res.data;
                    document.getElementById('logo-image').style.display = 'block';
                    document.getElementById('logo-placeholder').style.display = 'none';
                } else {
                    document.getElementById('cover-image').src = res.data;
                    document.getElementById('cover-image').style.display = 'block';
                }
                closeCropModal();
            } else {
                alert(res.message || `Lỗi tải ảnh ${currentCropType === 'logo' ? 'logo' : 'bìa'}`);
            }
        } catch (e) {
            alert("Lỗi kết nối khi tải ảnh");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }, 'image/png');
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
        companySize: document.getElementById('company-size').value || null,
        contactEmail: document.getElementById('company-email').value || null,
        contactPhone: document.getElementById('company-phone').value || null
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
            const isExpired = new Date(job.expiresAt) < new Date();
            if (job.isBlocked) {
                const reasonTip = job.blockReason ? ` title="${job.blockReason}"` : '';
                statusHtml = `<span${reasonTip} style="background:#fee2e2; color:#dc2626; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600; cursor:${job.blockReason ? 'help' : 'default'};">Bị từ chối</span>`;
            } else if (!job.isActive) {
                statusHtml = '<span style="background:#fff7ed; color:#ea580c; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600;">Đã ẩn</span>';
            } else if (isExpired) {
                statusHtml = '<span style="background:#f1f5f9; color:#64748b; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600;">Hết hạn</span>';
            } else if (!job.isApproved) {
                statusHtml = '<span style="background:#fef3c7; color:#d97706; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600;">Chờ duyệt</span>';
            } else {
                statusHtml = '<span style="background:#dcfce7; color:#16a34a; padding: 4px 8px; border-radius: 4px; font-size:12px; font-weight:600;">Đang mở</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${job.title}</strong><br><small style="color:#64748b">${job.jobType} • ${job.location}</small></td>
                <td>${statusHtml}</td>
                <td>${expDate}</td>
                <td style="white-space:nowrap;">
                    ${job.isBlocked && job.blockReason ? `<button style="border:none;background:transparent;color:#dc2626;cursor:pointer;margin-right:8px;font-size:15px;" onclick="showBlockReason('${escapeJs(job.blockReason)}')"><i class="fa-solid fa-circle-info"></i></button>` : ''}
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
async function openJobModal() {
    if (!currentCompanyId) {
        alert("Vui lòng cập nhật và lưu Hồ Sơ Công Ty trước khi đăng tin.");
        return;
    }

    // Check subscription limit before opening modal
    try {
        var subRes = await apiFetchAuth('/api/packages/my-subscription', { method: 'GET' });
        var subData = await subRes.json();
        if (subData.success && subData.data && subData.data.hasSubscription) {
            _currentSubscription = subData.data;
            var s = _currentSubscription;
            if (s.maxJobPosts !== -1 && s.jobPostsUsed >= s.maxJobPosts) {
                alert('Bạn đã vượt quá giới hạn ' + s.maxJobPosts + ' tin đăng của gói "' + s.packageName + '".\nVui lòng đăng ký gói dịch vụ cao hơn để đăng thêm tin.');
                return;
            }
        } else {
            _currentSubscription = null;
        }
    } catch (e) {
        // If check fails, let the backend handle it
    }
    
    document.getElementById('job-form').reset();
    document.getElementById('job-id').value = '';
    document.getElementById('job-modal-title').innerText = 'Đăng tin tuyển dụng mới';
    
    // Kiểm tra quyền đăng tin nổi bật
    const featuredCheckbox = document.getElementById('job-featured');
    const featuredHint = document.getElementById('featured-hint');
    const canPostFeatured = _currentSubscription && _currentSubscription.hasSubscription && 
                           (_currentSubscription.allowFeaturedJob === true);
    
    if (!canPostFeatured) {
        featuredCheckbox.disabled = true;
        featuredCheckbox.checked = false;
        featuredHint.textContent = '(Gói dịch vụ hiện tại không hỗ trợ tính năng này)';
    } else {
        featuredCheckbox.disabled = false;
        featuredHint.textContent = 'Tin sẽ hiển thị nổi bật với màu vàng và huy hiệu đặc biệt';
    }
    
    // Set mặc định ngày hết hạn là 30 ngày sau
    const date = new Date();
    date.setDate(date.getDate() + 30);
    document.getElementById('job-expires').value = date.toISOString().slice(0, 16);

    document.getElementById('job-modal').classList.add('show');
}

function closeJobModal() {
    document.getElementById('job-modal').classList.remove('show');
}

// Format currency with dots as thousands separator
function formatCurrency(input) {
    let val = input.value;
    // Strip non-digits
    val = val.replace(/\D/g, '');
    // Add dots
    if (val !== '') {
        val = parseInt(val, 10).toLocaleString('vi-VN');
    }
    input.value = val;
}

async function submitJobForm() {
    const jobId = document.getElementById('job-id').value;
    const isUpdate = !!jobId;

    const parseSalary = (valStr) => {
        if (!valStr) return null;
        // Remove dots before parsing
        const cleanStr = valStr.replace(/\./g, '');
        const num = parseFloat(cleanStr);
        return isNaN(num) ? null : num;
    };

    const payload = {
        companyId: currentCompanyId,
        title: document.getElementById('job-title').value,
        jobType: document.getElementById('job-type').value,
        experience: document.getElementById('job-experience').value,
        education: document.getElementById('job-education').value,
        location: document.getElementById('job-location').value,
        minSalary: parseSalary(document.getElementById('job-min-salary').value),
        maxSalary: parseSalary(document.getElementById('job-max-salary').value),
        description: document.getElementById('job-desc').value,
        requirements: document.getElementById('job-req').value,
        benefits: document.getElementById('job-ben').value,
        applicationLimit: parseInt(document.getElementById('job-app-limit').value) || null,
        isFeatured: document.getElementById('job-featured').checked,
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
            alert(res.message || JSON.stringify(res.errors) || "Đã xảy ra lỗi, vui lòng thử lại.");
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
            if (job.experience) document.getElementById('job-experience').value = job.experience;
            if (job.education) document.getElementById('job-education').value = job.education;
            document.getElementById('job-location').value = job.location;
            document.getElementById('job-min-salary').value = job.minSalary || '';
            document.getElementById('job-max-salary').value = job.maxSalary || '';
            document.getElementById('job-desc').value = job.description;
            document.getElementById('job-req').value = job.requirements;
            document.getElementById('job-ben').value = job.benefits;
            document.getElementById('job-desc-count').textContent = (job.description || '').length;
            document.getElementById('job-req-count').textContent  = (job.requirements || '').length;
            document.getElementById('job-ben-count').textContent  = (job.benefits || '').length;
            
            // local datetime format YYYY-MM-DDThh:mm
            const dt = new Date(job.expiresAt);
            const tzOffset = dt.getTimezoneOffset() * 60000; // offset in milliseconds
            const localISOTime = (new Date(dt - tzOffset)).toISOString().slice(0, 16);
            document.getElementById('job-expires').value = localISOTime;
            
            document.getElementById('job-active').value = job.isActive.toString();
            document.getElementById('job-app-limit').value = job.applicationLimit || '';
            
            // Điền lại trạng thái nổi bật + kiểm tra quyền
            const featuredCheckbox = document.getElementById('job-featured');
            const featuredHint = document.getElementById('featured-hint');
            
            // Đảm bảo có thông tin subscription mới nhất
            await loadSubscriptionInfo();
            
            const canPostFeatured = _currentSubscription && _currentSubscription.hasSubscription && 
                                   (_currentSubscription.allowFeaturedJob === true);
            
            featuredCheckbox.checked = job.isFeatured || false;
            if (!canPostFeatured) {
                featuredCheckbox.disabled = true;
                // Nếu tin đang là nổi bật nhưng gói hiện tại không cho phép (hết hạn hoặc hạ cấp), vẫn giữ checked nhưng disable để họ biết
                featuredHint.textContent = '(Gói dịch vụ hiện tại không hỗ trợ tính năng này)';
            } else {
                featuredCheckbox.disabled = false;
                featuredHint.textContent = 'Tin sẽ hiển thị nổi bật với màu vàng và huy hiệu đặc biệt';
            }

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

// ── Lý do từ chối ──────────────────────────────────────────
function escapeJs(str) {
    return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showBlockReason(reason) {
    let modal = document.getElementById('block-reason-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'block-reason-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;padding:28px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                    <div style="width:36px;height:36px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;">
                        <i class="fa-solid fa-ban" style="color:#dc2626;font-size:16px;"></i>
                    </div>
                    <h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">Lý do từ chối</h3>
                </div>
                <p id="block-reason-text" style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;background:#fef2f2;padding:14px;border-radius:8px;border:1px solid #fecaca;word-break:break-word;"></p>
                <div style="display:flex;justify-content:flex-end;">
                    <button onclick="closeBlockReasonModal()" style="padding:9px 22px;border:none;border-radius:8px;background:#0f172a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Đóng</button>
                </div>
            </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) closeBlockReasonModal(); });
        document.body.appendChild(modal);
    }
    document.getElementById('block-reason-text').textContent = reason;
    modal.style.display = 'flex';
}

function closeBlockReasonModal() {
    const modal = document.getElementById('block-reason-modal');
    if (modal) modal.style.display = 'none';
}

// ── Khởi tạo ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
    requireRecruiter();
    await loadMyCompany();
    loadSubscriptionInfo();

    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab') || 'company';
    const vnpResponse = urlParams.get('vnp_ResponseCode');

    if (vnpResponse) {
        // *** Lấy rawQuery TRƯỚC khi thay đổi URL ***
        const rawQuery = window.location.search.slice(1);

        // Làm sạch URL
        const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + '?tab=packages';
        window.history.replaceState({}, '', cleanUrl);

        if (vnpResponse === '00') {
            console.log('[VNPay] Raw query gửi verify:', rawQuery);
            _packagesLoaded = false;

            // Gọi API verify để kích hoạt subscription
            apiFetchAuth('/api/packages/verify-vnpay', {
                method: 'POST',
                body: JSON.stringify({ rawQuery })
            })
            .then(res => res.json())
            .then(data => {
                console.log('[VNPay] Verify response:', data);
                if (data.success) {
                    alert('Thanh toán thành công! Gói dịch vụ của bạn đã được kích hoạt.');
                } else {
                    console.error('[VNPay] Verify failed:', data.message);
                    alert('Lỗi kích hoạt: ' + data.message);
                }
            })
            .catch(err => {
                console.error('[VNPay] Verify error:', err);
                alert('Thanh toán thành công nhưng xảy ra lỗi kết nối. Vui lòng tải lại trang.');
            })
            .finally(() => {
                // Chuyển sang tab packages và reload dữ liệu
                const pkgItem = document.querySelector('.menu-item[onclick*="packages"]');
                if (pkgItem) switchTab('packages', pkgItem);
            });
        } else {
            alert('Thanh toán thất bại hoặc bị hủy (Mã lỗi: ' + vnpResponse + '). Vui lòng thử lại.');
            const pkgItem = document.querySelector('.menu-item[onclick*="packages"]');
            if (pkgItem) switchTab('packages', pkgItem);
        }
        return;
    }

    // Xử lý tab param thông thường (không phải từ VNPay)
    if (tab && tab !== 'company') {
        const targetItem = document.querySelector(`.menu-item[onclick*="'${tab}'"]`);
        if (targetItem) switchTab(tab, targetItem);
    }
});
