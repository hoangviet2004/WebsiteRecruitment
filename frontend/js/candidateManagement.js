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
            const dateStr = new Date(u.createdAt).toLocaleDateString();
            const isApproved = u.isApproved !== false;

            const statusBadge = isApproved ? 
                `<span class="badge badge-active">Hoạt động</span>` : 
                `<span class="badge badge-inactive">Chờ duyệt</span>`;

            let providerIcon = '';
            if(u.provider === 'Google') providerIcon = '<i class="fa-brands fa-google text-danger"></i>';
            else if(u.provider === 'GitHub') providerIcon = '<i class="fa-brands fa-github text-dark"></i>';
            else providerIcon = '<i class="fa-solid fa-envelope text-primary"></i>';

            let btnHtml = `<button class="btn-action btn-delete" onclick="deleteCandidate('${u.id}')" title="Xóa ứng viên"><i class="fa-solid fa-trash-can"></i></button>`;

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
