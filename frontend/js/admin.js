// admin.js - Logic cho trang Quản trị viên
document.addEventListener('DOMContentLoaded', () => {
    // Ban đầu load tab Users
    loadUsers();
});

function switchTab(tabId) {
    // 1. Gỡ active khỏi nút
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // 2. Ẩn tất cả panes
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    // 3. Set active cho nút được bấm
    event.currentTarget.classList.add('active');
    // 4. Hiển thị pane tương ứng
    document.getElementById('tab-' + tabId).classList.add('active');

    // 5. Load dữ liệu
    if (tabId === 'users') loadUsers();
    if (tabId === 'jobs') loadJobs();
    if (tabId === 'companies') loadCompanies();
}

// ─── API FETCHERS ──────────────────────────────────────────────

async function loadUsers() {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

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
            const isApproved = u.isApproved !== false; // handle migration default true
            
            let btnHtml = '';
            if (!isApproved) {
                btnHtml += `<button class="btn-action btn-toggle" onclick="approveUser('${u.id}')" title="Phê duyệt"><i class="fa-solid fa-check"></i></button>`;
            }
            if (u.role !== 'Admin') {
                btnHtml += `<button class="btn-action btn-delete" onclick="deleteUser('${u.id}')" title="Từ chối/Xóa"><i class="fa-solid fa-trash-can"></i></button>`;
            }

            const trClass = !isApproved ? 'style="background-color: #fffbeb;"' : '';
            const statusBadge = isApproved ? 
                `<span class="badge badge-active">Hoạt động</span>` : 
                `<span class="badge badge-inactive">Chờ duyệt</span>`;

            // Role selection dropdown
            const roles = ['Admin', 'Recruiter', 'Candidate'];
            let roleSelectHtml = `<select class="role-select" onchange="changeRole('${u.id}', this.value)">`;
            roles.forEach(r => {
                roleSelectHtml += `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`;
            });
            roleSelectHtml += `</select>`;

            html += `
                <tr ${trClass}>
                    <td><small>${u.id.substring(0, 8)}...</small></td>
                    <td><strong>${u.email}</strong> ${!isApproved ? '<i class="fa-solid fa-clock text-warning"></i>' : ''}</td>
                    <td>${u.displayName || '-'}</td>
                    <td>${roleSelectHtml}</td>
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

async function loadJobs() {
    const tbody = document.getElementById('job-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    try {
        const response = await apiFetchAuth('/api/admin/jobs', { method: 'GET' });
        const res = await response.json();
        
        if (!response.ok || !res.success) throw new Error(res.message);

        const jobs = res.data;
        if (!jobs || jobs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có tin tuyển dụng nào.</td></tr>';
            return;
        }

        let html = '';
        jobs.forEach(j => {
            const dateStr = new Date(j.createdAt).toLocaleDateString();
            const expStr = new Date(j.expiresAt).toLocaleDateString();
            
            let stLabel = '';
            if (!j.isApproved) {
                stLabel = '<span class="badge badge-inactive">Chờ duyệt</span>';
            } else {
                stLabel = j.isActive ? '<span class="badge badge-active">Đã duyệt & Hiện</span>' : '<span class="badge badge-inactive">Đang ẩn</span>';
            }

            const trClass = !j.isApproved ? 'style="background-color: #fffbeb;"' : '';

            let actionHtml = '';
            if (!j.isApproved) {
                actionHtml += `<button class="btn-action btn-toggle" onclick="approveJob('${j.id}')" title="Phê duyệt Tin"><i class="fa-solid fa-check"></i></button>`;
            } else {
                const iconEye = j.isActive ? 'fa-eye-slash' : 'fa-eye';
                actionHtml += `<button class="btn-action btn-toggle" onclick="toggleJob('${j.id}')" title="Bật/Tắt Hiển Thị"><i class="fa-solid ${iconEye}"></i></button>`;
            }

            html += `
                <tr ${trClass}>
                    <td><strong>${j.title}</strong></td>
                    <td>${j.companyName}</td>
                    <td>${stLabel}</td>
                    <td>${dateStr}</td>
                    <td>${expStr}</td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Lỗi: ${e.message}</td></tr>`;
    }
}

async function loadCompanies() {
    const tbody = document.getElementById('company-table-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    try {
        const response = await apiFetchAuth('/api/admin/companies', { method: 'GET' });
        const res = await response.json();
        
        if (!response.ok || !res.success) throw new Error(res.message);

        const companies = res.data;
        if (!companies || companies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Chưa có công ty nào.</td></tr>';
            return;
        }

        let html = '';
        companies.forEach(c => {
            const logoHtml = c.logoUrl ? `<img src="${c.logoUrl}" class="company-logo">` : `<div class="company-logo" style="display:flex;align-items:center;justify-content:center;background:#eee;">?</div>`;
            
            html += `
                <tr>
                    <td>${logoHtml}</td>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.address || '-'}</td>
                    <td>${c.website || '-'}</td>
                    <td>
                        <button class="btn-action btn-delete" onclick="deleteCompany('${c.id}')" title="Xóa Doanh Nghiệp"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Lỗi: ${e.message}</td></tr>`;
    }
}

// ─── ACTIONS ───────────────────────────────────────────────────

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
        loadUsers(); // revert UI dropdown change
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
            loadUsers(); // revert UI
        }
    } catch(e) {
        alert("Lỗi kết nối.");
        loadUsers();
    }
}

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

async function toggleJob(id) {
    try {
        const response = await apiFetchAuth(`/api/admin/jobs/${id}/toggle`, { method: 'PUT' });
        if(response.ok) {
            loadJobs(); // Render lại trạng thái
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) {
        alert("Lỗi kết nối.");
    }
}

async function deleteCompany(id) {
    if(!confirm("Hành động này sẽ Xóa Vĩnh Viễn Thông tin Công Ty. Cảnh báo nguy hiểm!")) return;

    try {
        const response = await apiFetchAuth('/api/admin/companies/' + id, { method: 'DELETE' });
        if(response.ok) {
            alert("Xóa công ty thành công!");
            loadCompanies();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) {
        alert("Lỗi kết nối.");
    }
}
