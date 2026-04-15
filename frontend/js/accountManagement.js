// accountManagement.js - Quản lý tài khoản
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});

async function loadUsers() {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    const currentUserId = sessionStorage.getItem('userId') || '';

    try {
        const response = await apiFetchAuth('/api/admin/users', { method: 'GET' });
        const res = await response.json();
        
        if (!response.ok || !res.success) throw new Error(res.message);

        const users = res.data;
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có tài khoản nào.</td></tr>';
            return;
        }

        let html = '';
        users.forEach(u => {
            const dateStr = new Date(u.createdAt).toLocaleDateString();
            const isApproved = u.isApproved !== false;
            const isSelf = u.id === currentUserId;
            
            let btnHtml = '';
            if (isSelf) {
                btnHtml = '<span style="color: #999; font-style: italic;">—</span>';
            } else {
                if (!isApproved) {
                    btnHtml += `<button class="btn-action btn-toggle" onclick="approveUser('${u.id}')" title="Phê duyệt"><i class="fa-solid fa-check"></i></button>`;
                }
                if (u.role !== 'Admin') {
                    btnHtml += `<button class="btn-action btn-delete" onclick="deleteUser('${u.id}')" title="Từ chối/Xóa"><i class="fa-solid fa-trash-can"></i></button>`;
                }
            }

            const trClass = !isApproved ? 'style="background-color: #fffbeb;"' : '';
            const statusBadge = isApproved ? 
                `<span class="badge badge-active">Hoạt động</span>` : 
                `<span class="badge badge-inactive">Chờ duyệt</span>`;

            let roleHtml = '';
            if (isSelf) {
                roleHtml = `<span class="badge badge-active" style="background: #6366f1; color: #fff;">${u.role} (Bạn)</span>`;
            } else {
                const roles = ['Admin', 'Recruiter', 'Candidate'];
                roleHtml = `<select class="role-select" onchange="changeRole('${u.id}', this.value)">`;
                roles.forEach(r => {
                    roleHtml += `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`;
                });
                roleHtml += `</select>`;
            }

            let emailHtml = `<strong>${u.email}</strong> ${!isApproved ? '<i class="fa-solid fa-clock text-warning"></i>' : ''}`;
            
            let providerIcon = '';
            if(u.provider === 'Google') providerIcon = '<i class="fa-brands fa-google text-danger"></i>';
            else if(u.provider === 'GitHub') providerIcon = '<i class="fa-brands fa-github text-dark"></i>';
            else providerIcon = '<i class="fa-solid fa-envelope text-primary"></i>';
            
            const providerHtml = `<small style="display:block; margin-top:4px;">${providerIcon} ${u.provider}</small>`;

            html += `
                <tr ${trClass}>
                    <td><small>${u.id.substring(0, 8)}...</small></td>
                    <td>${emailHtml}${providerHtml}</td>
                    <td>${u.displayName || '-'}</td>
                    <td>${roleHtml}</td>
                    <td>${statusBadge}</td>
                    <td>${btnHtml}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Lỗi: ${e.message}</td></tr>`;
    }
}

async function deleteUser(id) {
    if(!confirm("Bạn có chắc chắn muốn xóa User này? Nó sẽ xóa tất cả việc làm và công ty rác liên quan của họ!")) return;
    
    try {
        const response = await apiFetchAuth('/api/admin/users/' + id, { method: 'DELETE' });
        if(response.ok) {
            alert("Xóa thành công!");
            loadUsers();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) {
        alert("Lỗi mạng: " + e.message);
    }
}

async function approveUser(id) {
    if(!confirm("Xác nhận phê duyệt cho tài khoản Nhà tuyển dụng này?")) return;
    try {
        const response = await apiFetchAuth(`/api/admin/users/${id}/approve`, { method: 'PUT' });
        if(response.ok) {
            alert("Đã duyệt tài khoản thành công!");
            loadUsers();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) { alert("Lỗi mạng."); }
}

async function changeRole(id, newRole) {
    if(!confirm(`Bạn muốn chuyển Role của tài khoản này thành ${newRole}?`)) {
        loadUsers();
        return;
    }
    
    try {
        const response = await apiFetchAuth(`/api/admin/users/${id}/role`, {
            method: 'PUT',
            body: JSON.stringify({ newRole: newRole })
        });
        
        if (response.ok) {
            alert(`Phân quyền ${newRole} thành công!`);
            loadUsers();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
            loadUsers();
        }
    } catch(e) {
        alert("Lỗi kết nối.");
        loadUsers();
    }
}
