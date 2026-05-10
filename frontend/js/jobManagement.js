// jobManagement.js - Quản lý tin tuyển dụng
'use strict';

let allJobs = [];

document.addEventListener('DOMContentLoaded', () => {
    loadJobs();
});

async function loadJobs() {
    const tbody = document.getElementById('job-table-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    try {
        const response = await apiFetchAuth('/api/admin/jobs', { method: 'GET' });
        const res = await response.json();
        
        if (!response.ok || !res.success) throw new Error(res.message);

        allJobs = res.data || [];
        filterJobs();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Lỗi: ${e.message}</td></tr>`;
    }
}

function filterJobs() {
    const search = (document.getElementById('job-search').value || '').toLowerCase();
    const statusFilter = document.getElementById('job-filter-status').value;

    let filtered = allJobs;

    // Lọc theo search text
    if (search) {
        filtered = filtered.filter(j =>
            j.title.toLowerCase().includes(search) ||
            j.companyName.toLowerCase().includes(search)
        );
    }

    // Lọc theo trạng thái
    if (statusFilter === 'pending') {
        filtered = filtered.filter(j => !j.isApproved && !j.isBlocked);
    } else if (statusFilter === 'active') {
        filtered = filtered.filter(j => j.isApproved && j.isActive && !j.isBlocked);
    } else if (statusFilter === 'hidden') {
        filtered = filtered.filter(j => j.isApproved && !j.isActive && !j.isBlocked);
    } else if (statusFilter === 'blocked') {
        filtered = filtered.filter(j => j.isBlocked);
    }

    renderJobs(filtered);
}

function renderJobs(jobs) {
    const tbody = document.getElementById('job-table-body');

    if (!jobs || jobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding:32px; color:#64748b;">Không tìm thấy tin tuyển dụng nào.</td></tr>';
        return;
    }

    let html = '';
    jobs.forEach(j => {
        const dateStr = new Date(j.createdAt).toLocaleDateString('vi-VN');
        const expStr = new Date(j.expiresAt).toLocaleDateString('vi-VN');
        
        let stLabel = '';
        if (j.isBlocked) {
            stLabel = '<span class="badge badge-blocked">Bị từ chối</span>';
        } else if (!j.isApproved) {
            stLabel = '<span class="badge badge-inactive">Chờ duyệt</span>';
        } else {
            stLabel = j.isActive ? '<span class="badge badge-active">Đã duyệt & Hiện</span>' : '<span class="badge" style="background:#e2e8f0;color:#475569;">Đang ẩn</span>';
        }

        let trClass = '';
        if (j.isBlocked) trClass = 'style="background-color: #fef2f2;"';
        else if (!j.isApproved) trClass = 'style="background-color: #fffbeb;"';

        let actionHtml = '';
        actionHtml += `<button class="btn-action btn-view" onclick="viewJob('${j.id}')" title="Xem chi tiết"><i class="fa-solid fa-eye"></i></button>`;

        if (!j.isBlocked) {
            if (!j.isApproved) {
                actionHtml += `<button class="btn-action btn-toggle" onclick="approveJob('${j.id}')" title="Phê duyệt Tin"><i class="fa-solid fa-check"></i></button>`;
            } else {
                const iconEye = j.isActive ? 'fa-eye-slash' : 'fa-eye';
                actionHtml += `<button class="btn-action btn-toggle" onclick="toggleJob('${j.id}')" title="Bật/Tắt Hiển Thị"><i class="fa-solid ${iconEye}"></i></button>`;
            }
            actionHtml += `<button class="btn-action btn-delete" onclick="blockJob('${j.id}')" title="Từ chối"><i class="fa-solid fa-ban"></i></button>`;
        } else {
            actionHtml += `<button class="btn-action btn-toggle" onclick="blockJob('${j.id}')" title="Khôi phục"><i class="fa-solid fa-unlock"></i></button>`;
        }

        html += `
            <tr ${trClass}>
                <td><strong style="color:#0f172a;">${j.title}</strong></td>
                <td>${j.companyName}</td>
                <td>${stLabel}</td>
                <td style="white-space:nowrap;">${actionHtml}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ── Xem chi tiết tin tuyển dụng (modal) ─────────────────────
function viewJob(id) {
    const j = allJobs.find(x => x.id === id);
    if (!j) return;

    const body = document.getElementById('job-detail-body');

    const formatSalary = (min, max) => {
        if (!min && !max) return 'Thỏa thuận';
        const fmt = (v) => new Intl.NumberFormat('vi-VN').format(v);
        if (min && max) return `${fmt(min)} - ${fmt(max)} VND`;
        if (min) return `Từ ${fmt(min)} VND`;
        return `Tối đa ${fmt(max)} VND`;
    };

    const dateStr = new Date(j.createdAt).toLocaleDateString('vi-VN');
    const expStr = new Date(j.expiresAt).toLocaleDateString('vi-VN');

    let stLabel = '';
    if (j.isBlocked) {
        stLabel = '<span class="badge badge-blocked">Bị từ chối</span>';
    } else if (!j.isApproved) {
        stLabel = '<span class="badge badge-inactive">Chờ duyệt</span>';
    } else {
        stLabel = j.isActive ? '<span class="badge badge-active">Đã duyệt & Hiện</span>' : '<span class="badge" style="background:#e2e8f0;color:#475569;">Đang ẩn</span>';
    }

    const blockReasonHtml = j.isBlocked && j.blockReason
        ? `<div style="margin-top:12px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#b91c1c;">
               <i class="fa-solid fa-circle-exclamation" style="margin-right:6px;"></i><strong>Lý do từ chối:</strong> ${j.blockReason}
           </div>`
        : '';

    body.innerHTML = `
        <!-- Header -->
        <div style="margin-bottom:20px;">
            <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 10px;">${j.title}</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                ${stLabel}
                <span class="badge" style="background:#e0e7ff;color:#4f46e5;">${j.jobType || 'N/A'}</span>
            </div>
            ${blockReasonHtml}
        </div>

        <!-- Quick info -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
            <div style="background:#f8fafc;padding:14px;border-radius:10px;">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Doanh nghiệp</div>
                <div style="font-size:14px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px;">
                    ${j.companyLogo ? `<img src="${j.companyLogo}" style="width:28px;height:28px;border-radius:6px;object-fit:contain;border:1px solid #e2e8f0;">` : ''}
                    ${j.companyName}
                </div>
            </div>
            <div style="background:#f8fafc;padding:14px;border-radius:10px;">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Mức lương</div>
                <div style="font-size:14px;font-weight:600;color:#10b981;">${formatSalary(j.minSalary, j.maxSalary)}</div>
            </div>
            <div style="background:#f8fafc;padding:14px;border-radius:10px;">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Địa điểm</div>
                <div style="font-size:14px;font-weight:500;color:#0f172a;"><i class="fa-solid fa-location-dot" style="color:#3b82f6;margin-right:4px;"></i> ${j.location || 'Chưa cập nhật'}</div>
            </div>
            <div style="background:#f8fafc;padding:14px;border-radius:10px;">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Thời hạn</div>
                <div style="font-size:14px;font-weight:500;color:#0f172a;">
                    <i class="fa-regular fa-calendar" style="color:#3b82f6;margin-right:4px;"></i> ${dateStr} → ${expStr}
                </div>
            </div>
        </div>

        <!-- Mô tả công việc -->
        <div style="margin-bottom:20px;">
            <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 10px;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-file-lines" style="color:#3b82f6;"></i> Mô tả công việc
            </h4>
            <div style="font-size:14px;color:#334155;line-height:1.7;background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;white-space:pre-line;">
                ${j.description || '<em style="color:#94a3b8;">Chưa có mô tả</em>'}
            </div>
        </div>

        <!-- Yêu cầu -->
        <div style="margin-bottom:20px;">
            <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 10px;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-clipboard-check" style="color:#f59e0b;"></i> Yêu cầu ứng viên
            </h4>
            <div style="font-size:14px;color:#334155;line-height:1.7;background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;white-space:pre-line;">
                ${j.requirements || '<em style="color:#94a3b8;">Chưa có yêu cầu</em>'}
            </div>
        </div>

        <!-- Quyền lợi -->
        <div style="margin-bottom:10px;">
            <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 10px;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-gift" style="color:#10b981;"></i> Quyền lợi
            </h4>
            <div style="font-size:14px;color:#334155;line-height:1.7;background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;white-space:pre-line;">
                ${j.benefits || '<em style="color:#94a3b8;">Chưa có thông tin</em>'}
            </div>
        </div>
    `;

    document.getElementById('modal-job-detail').classList.add('open');
}

// ── Phê duyệt ───────────────────────────────────────────────
async function approveJob(id) {
    if(!confirm("Xác nhận duyệt Tin Tuyển Dụng này để nó được hiển thị lên trang chủ?")) return;
    try {
        const response = await apiFetchAuth(`/api/admin/jobs/${id}/approve`, { method: 'PUT' });
        if(response.ok) {
            alert("Đã duyệt Job thành công!");
            loadJobs();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) { alert("Lỗi kết nối."); }
}

// ── Bật/Tắt hiển thị ────────────────────────────────────────
async function toggleJob(id) {
    try {
        const response = await apiFetchAuth(`/api/admin/jobs/${id}/toggle`, { method: 'PUT' });
        if(response.ok) {
            loadJobs();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) {
        alert("Lỗi kết nối.");
    }
}

// ── Từ chối / Khôi phục tin ─────────────────────────────────
let _pendingBlockJobId = null;

function blockJob(id) {
    const j = allJobs.find(x => x.id === id);
    if (!j) return;

    if (j.isBlocked) {
        if (!confirm('Bạn có chắc chắn muốn khôi phục tin tuyển dụng này?')) return;
        _sendBlockRequest(id, null);
    } else {
        _pendingBlockJobId = id;
        document.getElementById('block-reason-select').value = '';
        document.getElementById('block-reason-select').style.borderColor = '#e2e8f0';
        document.getElementById('block-reason-input').value = '';
        document.getElementById('block-reason-input').style.display = 'none';
        document.getElementById('block-reason-input').style.borderColor = '#e2e8f0';
        document.getElementById('modal-block-job').classList.add('open');
        setTimeout(() => document.getElementById('block-reason-select').focus(), 100);
    }
}

function closeBlockModal() {
    document.getElementById('modal-block-job').classList.remove('open');
    _pendingBlockJobId = null;
}

function onBlockReasonChange() {
    const select = document.getElementById('block-reason-select');
    const textarea = document.getElementById('block-reason-input');
    const isOther = select.value === 'other';
    textarea.style.display = isOther ? 'block' : 'none';
    if (isOther) textarea.focus();
    select.style.borderColor = '#e2e8f0';
    textarea.style.borderColor = '#e2e8f0';
}

async function confirmBlockJob() {
    const select = document.getElementById('block-reason-select');
    const textarea = document.getElementById('block-reason-input');

    let reason = '';
    if (select.value === 'other') {
        reason = textarea.value.trim();
        if (!reason) {
            textarea.style.borderColor = '#ef4444';
            textarea.focus();
            return;
        }
    } else {
        reason = select.value;
        if (!reason) {
            select.style.borderColor = '#ef4444';
            select.focus();
            return;
        }
    }

    const jobId = _pendingBlockJobId;
    select.style.borderColor = '#e2e8f0';
    textarea.style.borderColor = '#e2e8f0';
    closeBlockModal();
    await _sendBlockRequest(jobId, reason);
}

async function _sendBlockRequest(id, reason) {
    try {
        const response = await apiFetchAuth(`/api/admin/jobs/${id}/toggle-block`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        if (response.ok) {
            loadJobs();
        } else {
            const error = await response.json();
            alert('Lỗi: ' + error.message);
        }
    } catch(e) {
        alert('Lỗi kết nối.');
    }
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeBlockModal();
});

document.getElementById('modal-block-job')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-block-job')) closeBlockModal();
});
