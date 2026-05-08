// recruiterTransactions.js - Lấy và hiển thị lịch sử giao dịch của Nhà tuyển dụng

async function loadMyTransactions() {
    const tbody = document.getElementById('txn-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    try {
        const res = await apiFetchAuth('/api/packages/my-transactions');
        const data = await res.json();

        if (data.success) {
            renderTransactions(data.data);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">${data.message || 'Lỗi khi tải dữ liệu.'}</td></tr>`;
        }
    } catch (e) {
        console.error('Error loading transactions:', e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Lỗi kết nối máy chủ.</td></tr>';
    }
}

function renderTransactions(transactions) {
    const tbody = document.getElementById('txn-table-body');
    
    // Chỉ lấy các giao dịch thành công
    const successTransactions = transactions.filter(t => t.status === 'Success');

    if (successTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">Bạn chưa có giao dịch thành công nào.</td></tr>';
        return;
    }

    tbody.innerHTML = successTransactions.map(t => {
        const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(t.finalAmount);
        
        // Chuyển đổi sang múi giờ địa phương (Ngày tạo)
        const dateObj = new Date(t.createdAt);
        const formattedDate = dateObj.toLocaleString('vi-VN', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
        });

        // Tính ngày hết hạn = Ngày tạo + durationDays
        const expiryDate = new Date(dateObj);
        expiryDate.setDate(expiryDate.getDate() + (t.durationDays || 0));
        const formattedExpiry = expiryDate.toLocaleDateString('vi-VN', {
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });

        return `
            <tr>
                <td style="font-family: monospace; font-size: 13px;">${t.transactionCode}</td>
                <td><strong>${t.packageName}</strong></td>
                <td style="font-weight: 600; color: #0f172a;">${formattedAmount}</td>
                <td>${t.paymentMethod}</td>
                <td style="color: #64748b; font-size: 13px;">${formattedDate}</td>
                <td style="color: #16a34a; font-weight: 600;">${formattedExpiry}</td>
            </tr>
        `;
    }).join('');
}
