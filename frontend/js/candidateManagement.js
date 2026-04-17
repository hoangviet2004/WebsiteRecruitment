// candidateManagement.js - Quản lý ứng viên (lọc user có role = Candidate)
document.addEventListener('DOMContentLoaded', () => {
    loadCandidates();
});

async function loadCandidates() {
    const tbody = document.getElementById('candidate-table-body');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    try {
        const response = await apiFetchAuth('/api/admin/users', { method: 'GET' });
        const res = await response.json();
        
        if (!response.ok || !res.success) throw new Error(res.message);

        // Lọc chỉ lấy Candidate
        const candidates = (res.data || []).filter(u => u.role === 'Candidate');
        
        if (candidates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Chưa có ứng viên nào.</td></tr>';
            return;
        }

        let html = '';
        candidates.forEach(u => {
            const dateStr = new Date(u.createdAt).toLocaleDateString('vi-VN');
            const isApproved = u.isApproved !== false;

            const statusBadge = isApproved ? 
                `<span class="badge badge-active">Hoạt động</span>` : 
                `<span class="badge badge-blocked">Bị chặn</span>`;

            let providerIcon = '';
            if(u.provider === 'Google') providerIcon = '<i class="fa-brands fa-google text-danger"></i>';
            else if(u.provider === 'GitHub') providerIcon = '<i class="fa-brands fa-github text-dark"></i>';
            else providerIcon = '<i class="fa-solid fa-envelope text-primary"></i>';

            const btnHtml = `
                <button class="btn-action btn-view" onclick="viewCandidateProfile('${u.id}')" title="Xem hồ sơ">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteCandidate('${u.id}')" title="Xóa ứng viên">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;

            html += `
                <tr>
                    <td><small>${u.id.substring(0, 8)}...</small></td>
                    <td><strong>${u.email}</strong></td>
                    <td>${u.displayName || '-'}</td>
                    <td>${providerIcon} ${u.provider}</td>
                    <td>${statusBadge}</td>
                    <td>${dateStr}</td>
                    <td>${btnHtml}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Lỗi: ${e.message}</td></tr>`;
    }
}

// ── View Candidate Profile Modal ──────────────────────────────────────────────

async function viewCandidateProfile(userId) {
    const modal   = document.getElementById('candidateProfileModal');
    const body    = document.getElementById('candidateModalBody');

    // Show loading state
    body.innerHTML = `
        <div style="text-align:center; padding: 32px 0;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:28px; color:#3b82f6;"></i>
            <p style="margin-top:12px; color:#64748b;">Đang tải hồ sơ...</p>
        </div>`;
    modal.classList.add('open');

    try {
        const res  = await apiFetchAuth(`/api/admin/candidates/${userId}/profile`, { method: 'GET' });
        const data = await res.json();

        if (!res.ok || !data.success) throw new Error(data.message || 'Không thể tải hồ sơ');

        const p = data.data;

        // Avatar or placeholder
        const initial = (p.displayName || p.email || '?')[0].toUpperCase();
        const avatarHtml = p.avatarUrl
            ? `<img src="${p.avatarUrl}" alt="Avatar" class="candidate-avatar">`
            : `<div class="candidate-avatar-placeholder">${initial}</div>`;

        // Provider icon
        let providerIcon = '<i class="fa-solid fa-envelope" style="color:#3b82f6;"></i>';
        if (p.provider === 'Google') providerIcon = '<i class="fa-brands fa-google" style="color:#ef4444;"></i>';
        else if (p.provider === 'GitHub') providerIcon = '<i class="fa-brands fa-github"></i>';

        // Status badge
        const statusBadge = p.isApproved
            ? `<span class="badge badge-active">Hoạt động</span>`
            : `<span class="badge badge-blocked">Bị chặn</span>`;

        const createdAt = new Date(p.createdAt).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const bioValue = (p.bio && p.bio.trim())
            ? p.bio
            : '<span class="empty">Chưa có giới thiệu</span>';

        body.innerHTML = `
            <div class="candidate-profile-header">
                ${avatarHtml}
                <div class="candidate-header-info">
                    <h3>${escapeHtml(p.displayName || p.fullName || '—')}</h3>
                    <p><i class="fa-solid fa-envelope fa-xs"></i> ${escapeHtml(p.email)}</p>
                    ${statusBadge}
                </div>
            </div>

            <div class="profile-info-grid">
                <div class="profile-info-item">
                    <div class="profile-info-label"><i class="fa-solid fa-user fa-xs"></i> Tên hiển thị</div>
                    <div class="profile-info-value">${escapeHtml(p.displayName || '—')}</div>
                </div>
                <div class="profile-info-item">
                    <div class="profile-info-label"><i class="fa-solid fa-id-badge fa-xs"></i> Họ tên</div>
                    <div class="profile-info-value">${escapeHtml(p.fullName || '—')}</div>
                </div>
                <div class="profile-info-item">
                    <div class="profile-info-label"><i class="fa-solid fa-calendar fa-xs"></i> Ngày đăng ký</div>
                    <div class="profile-info-value">${createdAt}</div>
                </div>
                <div class="profile-info-item">
                    <div class="profile-info-label">${providerIcon} Đăng nhập qua</div>
                    <div class="profile-info-value">${escapeHtml(p.provider)}</div>
                </div>
                <div class="profile-info-item full-width">
                    <div class="profile-info-label"><i class="fa-solid fa-pen-to-square fa-xs"></i> Giới thiệu bản thân</div>
                    <div class="profile-info-value">${bioValue}</div>
                </div>
                <div class="profile-info-item full-width">
                    <div class="profile-info-label"><i class="fa-solid fa-fingerprint fa-xs"></i> User ID</div>
                    <div class="profile-info-value" style="font-size:12px; font-family:monospace; color:#64748b;">${p.userId}</div>
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `
            <div style="text-align:center; padding: 24px;">
                <i class="fa-solid fa-circle-exclamation" style="font-size:32px; color:#ef4444;"></i>
                <p style="margin-top:12px; color:#ef4444; font-weight:600;">Không thể tải hồ sơ</p>
                <p style="color:#64748b; font-size:13px;">${e.message}</p>
            </div>`;
    }
}

function closeCandidateModal() {
    document.getElementById('candidateProfileModal').classList.remove('open');
}

function handleModalBackdropClick(event) {
    // Close only if clicking the dark backdrop (not the card itself)
    if (event.target === document.getElementById('candidateProfileModal')) {
        closeCandidateModal();
    }
}

// Close on Escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCandidateModal();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteCandidate(id) {
    if(!confirm("Bạn có chắc chắn muốn xóa ứng viên này?")) return;
    
    try {
        const response = await apiFetchAuth('/api/admin/users/' + id, { method: 'DELETE' });
        if(response.ok) {
            alert("Xóa ứng viên thành công!");
            loadCandidates();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) {
        alert("Lỗi mạng: " + e.message);
    }
}
