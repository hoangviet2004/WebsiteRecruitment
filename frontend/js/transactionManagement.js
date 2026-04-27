'use strict';

// ── State ────────────────────────────────────────────────────────
let packages = [];
let coupons = [];

// ── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Load revenue
    loadRevenueStats();
    // Start at packages tab
    switchTab('packages');
});

// ── TAB SWITCHING ───────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    document.getElementById(`tab-btn-${tabId}`).classList.add('active');
    document.getElementById(`pane-${tabId}`).classList.add('active');

    if (tabId === 'packages') loadPackages();
    else if (tabId === 'subscriptions') loadSubscriptions();
    else if (tabId === 'transactions') loadTransactions(1);
    else if (tabId === 'coupons') loadCoupons();
}

// ── HELPERS ─────────────────────────────────────────────────────
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function showToast(message, type = 'success') {
    const existing = document.getElementById('tm-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'tm-toast';
    toast.style.cssText = `
        position:fixed;bottom:28px;right:28px;z-index:9999;
        padding:14px 22px;border-radius:12px;font-family:'Inter',sans-serif;
        font-size:14px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.15);
        display:flex;align-items:center;gap:10px;
        animation:toastIn 0.3s ease;
        background:${type === 'success' ? '#10b981' : '#ef4444'};color:#fff;
    `;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${message}`;

    if (!document.getElementById('tm-toast-style')) {
        const style = document.createElement('style');
        style.id = 'tm-toast-style';
        style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// ════════════════════════════════════════════════════════════════
// REVENUE STATS
// ════════════════════════════════════════════════════════════════
async function loadRevenueStats() {
    try {
        const res = await apiFetchAuth('/api/admin/revenue/stats');
        const data = await res.json();
        if (data.success && data.data) {
            const stats = data.data;
            document.getElementById('stat-revenue-today').textContent = formatMoney(stats.totalRevenueToday);
            document.getElementById('stat-revenue-month').textContent = formatMoney(stats.totalRevenueMonth);
            document.getElementById('stat-total-transactions').textContent = stats.totalTransactions;
            document.getElementById('stat-refunded').textContent = stats.refundedTransactions;
        }
    } catch (e) {
        console.error('Error loading revenue stats', e);
    }
}

// ════════════════════════════════════════════════════════════════
// PACKAGES
// ════════════════════════════════════════════════════════════════
async function loadPackages() {
    const tbody = document.getElementById('pkg-table-body');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Đang tải...</td></tr>';
    try {
        const res = await apiFetchAuth('/api/admin/packages');
        const data = await res.json();
        if (data.success) {
            packages = data.data;
            renderPackages();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Lỗi tải gói dịch vụ', 'error');
    }
}

function renderPackages() {
    const tbody = document.getElementById('pkg-table-body');
    const search = (document.getElementById('pkg-search').value || '').toLowerCase();
    
    let filtered = packages.filter(p => p.name.toLowerCase().includes(search));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Không tìm thấy gói nào.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>${p.displayOrder}</td>
            <td><strong>${p.name}</strong></td>
            <td style="color:#10b981;font-weight:600;">${formatMoney(p.price)}</td>
            <td>${p.maxJobPosts === -1 ? 'Không giới hạn' : p.maxJobPosts}</td>
            <td>${p.durationDays} ngày</td>
            <td>${p.isHighlighted ? '<span class="badge badge-active">Có</span>' : '<span class="badge" style="background:#e2e8f0;">Không</span>'}</td>
            <td>${p.isActive ? '<span class="badge badge-active">Hoạt động</span>' : '<span class="badge badge-blocked">Ngừng</span>'}</td>
            <td>
                <button class="btn-action text-primary" onclick="editPackage('${p.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action text-danger" onclick="deletePackage('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openPackageModal() {
    document.getElementById('pkg-form').reset();
    document.getElementById('pkg-id').value = '';
    document.getElementById('pkg-modal-title').textContent = 'Tạo gói dịch vụ';
    document.getElementById('modal-package').classList.add('open');
}

function editPackage(id) {
    const p = packages.find(x => x.id === id);
    if (!p) return;

    document.getElementById('pkg-id').value = p.id;
    document.getElementById('pkg-name').value = p.name;
    document.getElementById('pkg-price').value = p.price;
    document.getElementById('pkg-max-jobs').value = p.maxJobPosts;
    document.getElementById('pkg-duration').value = p.durationDays;
    document.getElementById('pkg-order').value = p.displayOrder;
    document.getElementById('pkg-highlighted').checked = p.isHighlighted;
    document.getElementById('pkg-active').checked = p.isActive;
    
    let features = [];
    try { features = JSON.parse(p.features); } catch(e) {}
    document.getElementById('pkg-features').value = Array.isArray(features) ? features.join('\n') : '';

    document.getElementById('pkg-modal-title').textContent = 'Sửa gói dịch vụ';
    document.getElementById('modal-package').classList.add('open');
}

async function savePackage(e) {
    e.preventDefault();
    const id = document.getElementById('pkg-id').value;
    const name = document.getElementById('pkg-name').value;
    const price = parseInt(document.getElementById('pkg-price').value);
    const maxJobs = parseInt(document.getElementById('pkg-max-jobs').value);
    const duration = parseInt(document.getElementById('pkg-duration').value) || 30;
    const order = parseInt(document.getElementById('pkg-order').value) || 0;
    const isHighlighted = document.getElementById('pkg-highlighted').checked;
    const isActive = document.getElementById('pkg-active').checked;
    
    const featuresStr = document.getElementById('pkg-features').value;
    const features = featuresStr.split('\n').map(x => x.trim()).filter(x => x);

    const payload = {
        name, price, maxJobPosts: maxJobs, durationDays: duration,
        displayOrder: order, isHighlighted, isActive,
        features: JSON.stringify(features)
    };

    try {
        let res;
        if (id) {
            res = await apiFetchAuth(`/api/admin/packages/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
            res = await apiFetchAuth('/api/admin/packages', { method: 'POST', body: JSON.stringify(payload) });
        }

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('modal-package');
            loadPackages();
        } else {
            showToast(data.message, 'error');
        }
    } catch(err) {
        showToast('Lỗi mạng', 'error');
    }
}

async function deletePackage(id) {
    if (!confirm('Bạn có chắc muốn xóa gói này? Nếu có người đang dùng sẽ không thể xóa.')) return;
    try {
        const res = await apiFetchAuth(`/api/admin/packages/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadPackages();
        } else {
            showToast(data.message, 'error');
        }
    } catch(err) {
        showToast('Lỗi mạng', 'error');
    }
}

// ════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ════════════════════════════════════════════════════════════════
async function loadSubscriptions() {
    const tbody = document.getElementById('sub-table-body');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Đang tải...</td></tr>';
    
    const search = document.getElementById('sub-search').value;
    const status = document.getElementById('sub-filter-status').value;
    
    let url = '/api/admin/subscriptions?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    try {
        const res = await apiFetchAuth(url);
        const data = await res.json();
        if (data.success) {
            const subs = data.data;
            if (subs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Không có dữ liệu.</td></tr>';
                return;
            }

            tbody.innerHTML = subs.map(s => {
                let statusBadge = '';
                if (s.status === 'Active') statusBadge = '<span class="badge badge-active">Đang HĐ</span>';
                else if (s.status === 'Expired') statusBadge = '<span class="badge badge-blocked">Hết hạn</span>';
                else statusBadge = '<span class="badge" style="background:#e2e8f0;">Đã thu hồi</span>';

                let warning = '';
                if (s.status === 'Active' && s.daysRemaining <= 7) {
                    warning = `<span class="badge" style="background:#fef3c7;color:#d97706;font-size:10px;margin-left:5px;"><i class="fa-solid fa-triangle-exclamation"></i> Sắp hết</span>`;
                }

                return `<tr>
                    <td>
                        <strong style="color:#0f172a;">${s.userFullName}</strong><br>
                        <small style="color:#64748b;">${s.userEmail}</small>
                    </td>
                    <td>${s.companyName}</td>
                    <td><span class="badge" style="background:#e0e7ff;color:#4f46e5;">${s.packageName}</span></td>
                    <td>${formatDate(s.startDate)}</td>
                    <td>${formatDate(s.endDate)} ${warning}</td>
                    <td>${s.daysRemaining} ngày</td>
                    <td>${s.jobPostsUsed} / ${s.maxJobPosts === -1 ? '∞' : s.maxJobPosts}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-action text-primary" title="Gia hạn" onclick="openExtendModal('${s.id}')"><i class="fa-solid fa-calendar-plus"></i></button>
                        ${s.status === 'Active' ? `<button class="btn-action text-danger" title="Thu hồi" onclick="revokeSubscription('${s.id}')"><i class="fa-solid fa-ban"></i></button>` : ''}
                    </td>
                </tr>`;
            }).join('');
        }
    } catch(e) {
        showToast('Lỗi tải danh sách subscriptions', 'error');
    }
}

function openExtendModal(id) {
    document.getElementById('extend-sub-id').value = id;
    document.getElementById('extend-days').value = 30;
    document.getElementById('modal-extend').classList.add('open');
}

async function confirmExtend() {
    const id = document.getElementById('extend-sub-id').value;
    const days = parseInt(document.getElementById('extend-days').value);
    if (!days || days <= 0) {
        showToast('Số ngày không hợp lệ', 'error');
        return;
    }

    try {
        const res = await apiFetchAuth(`/api/admin/subscriptions/${id}/extend`, {
            method: 'PUT',
            body: JSON.stringify({ extraDays: days })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('modal-extend');
            loadSubscriptions();
        } else {
            showToast(data.message, 'error');
        }
    } catch(e) {
        showToast('Lỗi mạng', 'error');
    }
}

async function revokeSubscription(id) {
    if(!confirm('Chắc chắn muốn thu hồi gói dịch vụ này?')) return;
    try {
        const res = await apiFetchAuth(`/api/admin/subscriptions/${id}/revoke`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadSubscriptions();
        } else {
            showToast(data.message, 'error');
        }
    } catch(e) {
        showToast('Lỗi mạng', 'error');
    }
}

// ════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════════════════════════════
let txnPage = 1;
async function loadTransactions(page = 1) {
    txnPage = page;
    const tbody = document.getElementById('txn-table-body');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Đang tải...</td></tr>';
    
    const search = document.getElementById('txn-search').value;
    const status = document.getElementById('txn-filter-status').value;
    const method = document.getElementById('txn-filter-method').value;
    const from = document.getElementById('txn-from-date').value;
    const to = document.getElementById('txn-to-date').value;

    let url = `/api/admin/transactions?page=${page}&pageSize=15&`;
    if (search) url += `searchTerm=${encodeURIComponent(search)}&`;
    if (status) url += `status=${status}&`;
    if (method) url += `paymentMethod=${method}&`;
    if (from) url += `fromDate=${from}&`;
    if (to) url += `toDate=${to}&`;

    try {
        const res = await apiFetchAuth(url);
        const data = await res.json();
        if (data.success) {
            const paged = data.data;
            
            if (paged.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Không có giao dịch nào.</td></tr>';
                document.getElementById('txn-pagination').innerHTML = '';
                return;
            }

            tbody.innerHTML = paged.items.map(t => {
                let badge = '';
                if(t.status === 'Success') badge = '<span class="badge badge-active">Thành công</span>';
                else if(t.status === 'Pending') badge = '<span class="badge" style="background:#fef3c7;color:#d97706;">Đang xử lý</span>';
                else if(t.status === 'Failed') badge = '<span class="badge badge-blocked">Thất bại</span>';
                else badge = '<span class="badge" style="background:#e2e8f0;color:#475569;">Hoàn tiền</span>';

                let methodBadge = '';
                if (t.paymentMethod === 'VNPay') methodBadge = '<span style="color:#005baa;font-weight:600;">VNPay</span>';
                else if (t.paymentMethod === 'Momo') methodBadge = '<span style="color:#a50064;font-weight:600;">Momo</span>';
                else methodBadge = t.paymentMethod;

                return `<tr>
                    <td style="font-family:monospace;color:#64748b;">${t.transactionCode}</td>
                    <td>
                        <strong>${t.companyName}</strong><br>
                        <small style="color:#64748b;">${t.userEmail}</small>
                    </td>
                    <td>${t.packageName}</td>
                    <td style="color:#0f172a;font-weight:600;">${formatMoney(t.amount)}</td>
                    <td style="color:#ef4444;">${t.discountAmount > 0 ? '-' + formatMoney(t.discountAmount) : '0'}</td>
                    <td style="color:#10b981;font-weight:bold;">${formatMoney(t.finalAmount)}</td>
                    <td>${methodBadge}</td>
                    <td>${badge}</td>
                    <td>${formatDate(t.createdAt)}</td>
                    <td>
                        <button class="btn-action text-primary" title="Chi tiết" onclick="viewTransaction('${t.id}')"><i class="fa-solid fa-eye"></i></button>
                        ${t.status === 'Success' ? `<button class="btn-action text-danger" title="Hoàn tiền" onclick="openRefundModal('${t.id}', '${t.transactionCode}', ${t.finalAmount})"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
                    </td>
                </tr>`;
            }).join('');

            renderTxnPagination(paged.totalPages, paged.totalCount);
        }
    } catch(e) {
        showToast('Lỗi tải giao dịch', 'error');
    }
}

function renderTxnPagination(totalPages, totalCount) {
    const el = document.getElementById('txn-pagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    let html = `<span class="am-page-info">Tổng: ${totalCount}</span>`;
    
    html += `<button class="am-page-btn" ${txnPage === 1 ? 'disabled' : ''} onclick="loadTransactions(${txnPage - 1})">
        <i class="fa-solid fa-chevron-left"></i>
    </button>`;

    for(let i=1; i<=totalPages; i++) {
        if(i===1 || i===totalPages || (i >= txnPage-1 && i <= txnPage+1)) {
            html += `<button class="am-page-btn ${i === txnPage ? 'active' : ''}" onclick="loadTransactions(${i})">${i}</button>`;
        } else if (i === txnPage-2 || i === txnPage+2) {
            html += `<span class="am-page-dots">…</span>`;
        }
    }

    html += `<button class="am-page-btn" ${txnPage === totalPages ? 'disabled' : ''} onclick="loadTransactions(${txnPage + 1})">
        <i class="fa-solid fa-chevron-right"></i>
    </button>`;

    el.innerHTML = html;
}

async function viewTransaction(id) {
    try {
        const res = await apiFetchAuth(`/api/admin/transactions/${id}`);
        const data = await res.json();
        if (data.success) {
            const t = data.data;
            const body = document.getElementById('txn-detail-body');
            
            let statusText = '';
            if(t.status === 'Success') statusText = '<span style="color:#10b981;font-weight:bold;">Thành công</span>';
            else if(t.status === 'Pending') statusText = '<span style="color:#d97706;font-weight:bold;">Đang xử lý</span>';
            else if(t.status === 'Failed') statusText = '<span style="color:#ef4444;font-weight:bold;">Thất bại</span>';
            else statusText = '<span style="color:#64748b;font-weight:bold;">Hoàn tiền</span>';

            let historyHtml = '';
            try {
                const history = JSON.parse(t.statusHistory);
                historyHtml = history.map(h => `<li>[${formatDate(h.timestamp)}] ${h.status} - ${h.note || ''}</li>`).join('');
            } catch(e){}

            body.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
                    <div style="background:#f8fafc;padding:16px;border-radius:8px;">
                        <h4 style="margin:0 0 10px 0;color:#0f172a;font-size:14px;text-transform:uppercase;">Thông tin giao dịch</h4>
                        <p style="margin:0 0 8px;font-size:14px;"><strong>Mã GD:</strong> ${t.transactionCode}</p>
                        <p style="margin:0 0 8px;font-size:14px;"><strong>Trạng thái:</strong> ${statusText}</p>
                        <p style="margin:0 0 8px;font-size:14px;"><strong>Phương thức:</strong> ${t.paymentMethod}</p>
                        <p style="margin:0 0 8px;font-size:14px;"><strong>Ref Cổng TT:</strong> ${t.paymentGatewayRef || '—'}</p>
                        <p style="margin:0;font-size:14px;"><strong>Thời gian:</strong> ${formatDate(t.createdAt)}</p>
                    </div>
                    <div style="background:#f8fafc;padding:16px;border-radius:8px;">
                        <h4 style="margin:0 0 10px 0;color:#0f172a;font-size:14px;text-transform:uppercase;">Khách hàng</h4>
                        <p style="margin:0 0 8px;font-size:14px;"><strong>Tên:</strong> ${t.userFullName}</p>
                        <p style="margin:0 0 8px;font-size:14px;"><strong>Email:</strong> ${t.userEmail}</p>
                        <p style="margin:0;font-size:14px;"><strong>Công ty:</strong> ${t.companyName}</p>
                    </div>
                </div>

                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
                    <table style="width:100%;border-collapse:collapse;margin:0;">
                        <thead style="background:#f1f5f9;">
                            <tr>
                                <th style="padding:12px;text-align:left;font-size:14px;">Mô tả</th>
                                <th style="padding:12px;text-align:right;font-size:14px;">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding:12px;border-bottom:1px solid #f1f5f9;font-size:14px;">Gói dịch vụ: <strong>${t.packageName}</strong></td>
                                <td style="padding:12px;text-align:right;border-bottom:1px solid #f1f5f9;font-size:14px;">${formatMoney(t.amount)}</td>
                            </tr>
                            ${t.discountAmount > 0 ? `
                            <tr>
                                <td style="padding:12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#ef4444;">Giảm giá ${t.couponCode ? `(Mã: ${t.couponCode})` : ''}</td>
                                <td style="padding:12px;text-align:right;border-bottom:1px solid #f1f5f9;font-size:14px;color:#ef4444;">-${formatMoney(t.discountAmount)}</td>
                            </tr>` : ''}
                            <tr style="background:#f8fafc;">
                                <td style="padding:12px;font-weight:bold;font-size:16px;">TỔNG THANH TOÁN</td>
                                <td style="padding:12px;text-align:right;font-weight:bold;font-size:16px;color:#10b981;">${formatMoney(t.finalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                ${t.status === 'Refunded' ? `
                <div style="background:#fef2f2;padding:12px;border-radius:8px;border:1px solid #fca5a5;margin-bottom:20px;">
                    <strong style="color:#b91c1c;">Đã hoàn tiền</strong><br>
                    <span style="font-size:13px;color:#991b1b;">Lý do: ${t.refundReason}</span>
                </div>
                ` : ''}

                <div style="margin-top:20px;">
                    <h4 style="margin:0 0 10px 0;font-size:14px;">Lịch sử trạng thái</h4>
                    <ul style="margin:0;padding-left:20px;font-size:13px;color:#64748b;line-height:1.6;">
                        ${historyHtml}
                    </ul>
                </div>
            `;
            document.getElementById('modal-txn-detail').classList.add('open');
        }
    } catch(e) {
        showToast('Lỗi tải chi tiết', 'error');
    }
}

function openRefundModal(id, code, amount) {
    document.getElementById('refund-txn-id').value = id;
    document.getElementById('refund-txn-code').textContent = code;
    document.getElementById('refund-txn-amount').textContent = formatMoney(amount);
    document.getElementById('refund-reason').value = '';
    document.getElementById('modal-refund').classList.add('open');
}

async function confirmRefund() {
    const id = document.getElementById('refund-txn-id').value;
    const reason = document.getElementById('refund-reason').value.trim();
    if (!reason) {
        showToast('Vui lòng nhập lý do hoàn tiền', 'error');
        return;
    }

    try {
        const res = await apiFetchAuth(`/api/admin/transactions/${id}/refund`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('modal-refund');
            loadTransactions(txnPage);
            loadRevenueStats(); // Refresh stats
        } else {
            showToast(data.message, 'error');
        }
    } catch(e) {
        showToast('Lỗi mạng', 'error');
    }
}

// ════════════════════════════════════════════════════════════════
// COUPONS
// ════════════════════════════════════════════════════════════════
async function loadCoupons() {
    const tbody = document.getElementById('cpn-table-body');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Đang tải...</td></tr>';
    try {
        const res = await apiFetchAuth('/api/admin/coupons');
        const data = await res.json();
        if (data.success) {
            coupons = data.data;
            renderCoupons();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Lỗi tải mã giảm giá', 'error');
    }
}

function renderCoupons() {
    const tbody = document.getElementById('cpn-table-body');
    const search = (document.getElementById('cpn-search').value || '').toLowerCase();
    
    let filtered = coupons.filter(c => c.code.toLowerCase().includes(search));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Không tìm thấy mã nào.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
        const valueDisplay = c.discountType === 'Percentage' ? `${c.discountValue}%` : formatMoney(c.discountValue);
        let statusBadge = '';
        if (isExpired) statusBadge = '<span class="badge badge-blocked">Hết hạn</span>';
        else if (!c.isActive) statusBadge = '<span class="badge" style="background:#e2e8f0;">Ngừng</span>';
        else statusBadge = '<span class="badge badge-active">Hoạt động</span>';

        return `<tr>
            <td><strong style="color:#0f172a;letter-spacing:1px;background:#f1f5f9;padding:4px 8px;border-radius:4px;border:1px dashed #cbd5e1;">${c.code}</strong></td>
            <td>${c.discountType === 'Percentage' ? 'Phần trăm' : 'Tiền mặt'}</td>
            <td style="color:#10b981;font-weight:bold;">${valueDisplay}</td>
            <td>${c.currentUsageCount} / ${c.maxUsageCount === 0 ? '∞' : c.maxUsageCount}</td>
            <td>${formatDate(c.expiresAt)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn-action text-primary" onclick="editCoupon('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action text-danger" onclick="deleteCoupon('${c.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function openCouponModal() {
    document.getElementById('cpn-form').reset();
    document.getElementById('cpn-id').value = '';
    document.getElementById('cpn-modal-title').textContent = 'Tạo mã giảm giá';
    document.getElementById('modal-coupon').classList.add('open');
}

function editCoupon(id) {
    const c = coupons.find(x => x.id === id);
    if (!c) return;

    document.getElementById('cpn-id').value = c.id;
    document.getElementById('cpn-code').value = c.code;
    document.getElementById('cpn-type').value = c.discountType;
    document.getElementById('cpn-value').value = c.discountValue;
    document.getElementById('cpn-max-usage').value = c.maxUsageCount;
    if (c.expiresAt) {
        document.getElementById('cpn-expires').value = c.expiresAt.substring(0, 10);
    } else {
        document.getElementById('cpn-expires').value = '';
    }
    document.getElementById('cpn-active').checked = c.isActive;
    
    document.getElementById('cpn-modal-title').textContent = 'Sửa mã giảm giá';
    document.getElementById('modal-coupon').classList.add('open');
}

async function saveCoupon(e) {
    e.preventDefault();
    const id = document.getElementById('cpn-id').value;
    const code = document.getElementById('cpn-code').value.trim();
    const discountType = document.getElementById('cpn-type').value;
    const discountValue = parseInt(document.getElementById('cpn-value').value);
    const maxUsageCount = parseInt(document.getElementById('cpn-max-usage').value) || 0;
    const exp = document.getElementById('cpn-expires').value;
    const expiresAt = exp ? new Date(exp).toISOString() : null;
    const isActive = document.getElementById('cpn-active').checked;

    const payload = {
        code, discountType, discountValue, maxUsageCount, expiresAt,
        applicablePackageIds: "[]", isActive
    };

    try {
        let res;
        if (id) {
            res = await apiFetchAuth(`/api/admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
            res = await apiFetchAuth('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
        }

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('modal-coupon');
            loadCoupons();
        } else {
            showToast(data.message, 'error');
        }
    } catch(err) {
        showToast('Lỗi mạng', 'error');
    }
}

async function deleteCoupon(id) {
    if (!confirm('Bạn có chắc muốn xóa mã giảm giá này?')) return;
    try {
        const res = await apiFetchAuth(`/api/admin/coupons/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadCoupons();
        } else {
            showToast(data.message, 'error');
        }
    } catch(err) {
        showToast('Lỗi mạng', 'error');
    }
}
