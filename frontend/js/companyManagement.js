// companyManagement.js - Quản lý công ty
document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
});

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
