// jobManagement.js - Quản lý tin tuyển dụng
document.addEventListener('DOMContentLoaded', () => {
    loadJobs();
});

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
            loadJobs();
        } else {
            const error = await response.json();
            alert("Lỗi: " + error.message);
        }
    } catch(e) {
        alert("Lỗi kết nối.");
    }
}
