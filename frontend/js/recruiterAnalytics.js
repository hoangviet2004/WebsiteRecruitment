// ============================================================
// recruiterAnalytics.js
// Tab Thống kê & Báo cáo — recruiter.html
// ============================================================

'use strict';

// ── State ────────────────────────────────────────────────────
let _anPeriod   = '30d';
let _anCharts   = {};          // { donut, bar, line }
let _anRawData  = {};          // cache dữ liệu đã tải
let _anLoaded   = false;

// Bảng màu đồng bộ với design system
const STATUS_COLORS = {
    Applied:   '#3b82f6',
    Screening: '#f59e0b',
    Interview: '#22c55e',
    Offered:   '#10b981',
    Hired:     '#854d0e',
    Rejected:  '#ef4444',
};

const CHART_PALETTE = ['#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#f97316','#14b8a6','#6366f1'];

// ── Khởi tạo khi chuyển sang tab ────────────────────────────
function loadAnalytics() {
    if (!currentCompanyId) {
        showAnError('Vui lòng tạo <strong>Hồ sơ Công ty</strong> trước khi xem thống kê.');
        return;
    }
    fetchAllAnalytics();
}

// ── Đổi kỳ thống kê ─────────────────────────────────────────
function setAnalyticsPeriod(period, btn) {
    if (_anPeriod === period && _anLoaded) return;
    _anPeriod = period;

    document.querySelectorAll('.an-period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    _anLoaded = false;
    fetchAllAnalytics();
}

// ── Parse JSON an toàn (tránh crash khi response rỗng / 404) ─
async function safeJson(res) {
    if (!res) return null;
    const text = await res.text();
    if (!text || !text.trim()) return null;
    try { return JSON.parse(text); } catch { return null; }
}

// ── Tải song song tất cả API ─────────────────────────────────
async function fetchAllAnalytics() {
    showSkeletons();

    const cId = currentCompanyId;
    const p   = _anPeriod;

    const [overviewRes, statusRes, trendRes, skillsRes, perfRes] = await Promise.allSettled([
        apiFetchAuth(`/api/recruiter-stats/overview?companyId=${cId}&period=${p}`),
        apiFetchAuth(`/api/recruiter-stats/status-distribution?companyId=${cId}`),
        apiFetchAuth(`/api/recruiter-stats/trend?companyId=${cId}&period=${p}`),
        apiFetchAuth(`/api/recruiter-stats/hot-skills?companyId=${cId}`),
        apiFetchAuth(`/api/recruiter-stats/job-performance?companyId=${cId}&period=${p}`),
    ]);

    // Overview là bắt buộc
    if (overviewRes.status === 'rejected' || !overviewRes.value) {
        showAnError('Lỗi tải dữ liệu thống kê: không thể kết nối server.');
        return;
    }
    const overviewJson = await safeJson(overviewRes.value);
    if (!overviewRes.value.ok) {
        showAnError(overviewJson?.message || `Lỗi server ${overviewRes.value.status}`);
        return;
    }

    const safeData = async (settled) => {
        if (settled.status === 'rejected' || !settled.value) return null;
        const json = await safeJson(settled.value);
        return json?.data ?? null;
    };

    const [statusData, trendData, skillsData, perfData] = await Promise.all([
        safeData(statusRes), safeData(trendRes), safeData(skillsRes), safeData(perfRes),
    ]);

    _anRawData = {
        overview: overviewJson?.data,
        status:   statusData ?? [],
        trend:    trendData  ?? [],
        skills:   skillsData ?? [],
        perf:     perfData   ?? [],
    };

    renderOverviewCards(_anRawData.overview);
    renderDonutChart(_anRawData.status);
    renderSkillsBar(_anRawData.skills);
    renderTrendLine(_anRawData.trend);
    renderJobPerfTable(_anRawData.perf);
    updateLastUpdated();
    _anLoaded = true;
}

// ── Skeleton loading ─────────────────────────────────────────
function showSkeletons() {
    document.getElementById('an-overview-grid').innerHTML =
        '<div class="an-card-skeleton"></div>'.repeat(3);
    document.getElementById('an-job-perf-body').innerHTML =
        `<tr><td colspan="7" style="text-align:center;padding:32px 0;color:#64748b;">
           <i class="fa-solid fa-spinner fa-spin" style="color:#3b82f6;margin-right:8px;"></i>Đang tải...
         </td></tr>`;
}

function showAnError(msg) {
    document.getElementById('an-overview-grid').innerHTML =
        `<div style="grid-column:1/-1;background:#fef2f2;border-radius:12px;padding:20px 24px;
         color:#dc2626;font-weight:600;font-size:14px;display:flex;align-items:center;gap:10px;">
         <i class="fa-solid fa-circle-exclamation"></i><span>${msg}</span></div>`;
}

// ── 1. Overview Cards ────────────────────────────────────────
function renderOverviewCards(d) {
    const cards = [
        {
            color:      'blue',
            icon:       'fa-paper-plane',
            label:      'Lượt ứng tuyển trong kỳ',
            value:      d.currentPeriodApplications,
            totalLabel: 'Tổng',
            total:      d.totalApplications,
            pct:        d.applicationGrowthPct,
        },
        {
            color:      'green',
            icon:       'fa-briefcase',
            label:      'Tin đăng mới trong kỳ',
            value:      d.currentPeriodJobs,
            totalLabel: 'Đang hoạt động',
            total:      d.activeJobs,
            pct:        d.jobGrowthPct,
        },
        {
            color:      'amber',
            icon:       'fa-comments',
            label:      'Ứng viên phỏng vấn',
            value:      d.interviewCount,
            totalLabel: 'Đã đề nghị',
            total:      d.offeredCount,
            pct:        d.interviewGrowthPct,
        },
    ];

    document.getElementById('an-overview-grid').innerHTML = cards.map(c => {
        const pctClass = c.pct > 0 ? 'up' : c.pct < 0 ? 'down' : 'flat';
        const pctIcon  = c.pct > 0 ? 'fa-arrow-trend-up' : c.pct < 0 ? 'fa-arrow-trend-down' : 'fa-minus';
        const vsText   = c.pct > 0 ? `+${Math.abs(c.pct).toFixed(1)}%` : (c.pct < 0 ? `-${Math.abs(c.pct).toFixed(1)}%` : '0%');

        return `<div class="an-overview-card ${c.color}">
            <div class="an-card-icon"><i class="fa-solid ${c.icon}"></i></div>
            <div class="an-card-label">${c.label}</div>
            <div class="an-card-value">${c.value.toLocaleString('vi-VN')}</div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${c.totalLabel}: <strong>${c.total.toLocaleString('vi-VN')}</strong></div>
            <span class="an-card-change ${pctClass}">
                <i class="fa-solid ${pctIcon}"></i> ${vsText} so kỳ trước
            </span>
        </div>`;
    }).join('');
}

// ── 2. Donut Chart: Trạng thái ứng viên ─────────────────────
function renderDonutChart(data) {
    const canvas = document.getElementById('chart-status-donut');
    if (!canvas) return;

    if (_anCharts.donut) { _anCharts.donut.destroy(); _anCharts.donut = null; }

    if (!data || data.length === 0) {
        canvas.style.display = 'none';
        document.getElementById('an-donut-center').textContent = '0';
        document.getElementById('an-donut-legend').innerHTML =
            '<span style="color:#94a3b8;font-size:13px;">Chưa có dữ liệu.</span>';
        return;
    }

    canvas.style.display = 'block';
    const total = data.reduce((s, d) => s + d.count, 0);
    document.getElementById('an-donut-center').innerHTML =
        `<div style="font-size:24px;font-weight:800;">${total}</div><div style="font-size:11px;color:#64748b;font-weight:600;">ứng viên</div>`;

    const labels  = data.map(d => d.label);
    const counts  = data.map(d => d.count);
    const colors  = data.map(d => STATUS_COLORS[d.status] || '#94a3b8');

    _anCharts.donut = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }] },
        options: {
            cutout: '70%',
            plugins: { legend: { display: false }, tooltip: {
                callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${data[ctx.dataIndex].percentage}%)` }
            }},
            animation: { animateRotate: true, duration: 600 }
        }
    });

    // Custom legend
    document.getElementById('an-donut-legend').innerHTML = data.map(d =>
        `<div class="an-legend-item">
            <span class="an-legend-dot" style="background:${STATUS_COLORS[d.status] || '#94a3b8'};"></span>
            <span class="an-legend-label">${d.label}</span>
            <span class="an-legend-count">${d.count}</span>
            <span class="an-legend-pct">${d.percentage}%</span>
        </div>`
    ).join('');
}

// ── 3. Bar Chart: Kỹ năng hot ────────────────────────────────
function renderSkillsBar(data) {
    const canvas = document.getElementById('chart-skills-bar');
    if (!canvas) return;

    if (_anCharts.bar) { _anCharts.bar.destroy(); _anCharts.bar = null; }

    if (!data || data.length === 0) {
        canvas.style.display = 'none';
        return;
    }

    canvas.style.display = 'block';
    const top = data.slice(0, 8);

    _anCharts.bar = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: top.map(d => d.skill),
            datasets: [{
                label: 'Số ứng viên',
                data: top.map(d => d.count),
                backgroundColor: top.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length] + 'CC'),
                borderColor:     top.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.raw} ứng viên` } }
            },
            scales: {
                x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 12 } } },
                y: { grid: { display: false },   ticks: { font: { size: 12, weight: '600' } } }
            },
            animation: { duration: 600 }
        }
    });
}

// ── 4. Line Chart: Xu hướng ứng tuyển ───────────────────────
function renderTrendLine(data) {
    const canvas = document.getElementById('chart-trend-line');
    if (!canvas) return;

    if (_anCharts.line) { _anCharts.line.destroy(); _anCharts.line = null; }

    const subEl = document.getElementById('an-trend-sub');
    if (subEl) {
        const periodMap = { '7d': '7 ngày qua', '30d': '30 ngày qua', '3m': '3 tháng qua' };
        subEl.textContent = periodMap[_anPeriod] || '';
    }

    if (!data || data.length === 0) {
        canvas.style.display = 'none'; return;
    }

    canvas.style.display = 'block';

    _anCharts.line = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Lượt ứng tuyển',
                data: data.map(d => d.count),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.08)',
                borderWidth: 2.5,
                pointBackgroundColor: '#3b82f6',
                pointRadius: data.length > 30 ? 0 : 3,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: { label: ctx => ` ${ctx.raw} lượt` }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 }, maxTicksLimit: 12, maxRotation: 0 }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 11 }, beginAtZero: true, precision: 0 }
                }
            },
            animation: { duration: 700 }
        }
    });
}

// ── 5. Job Performance Table ─────────────────────────────────
function renderJobPerfTable(data) {
    const tbody = document.getElementById('an-job-perf-body');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px 0;color:#64748b;">
            <i class="fa-solid fa-inbox" style="color:#cbd5e1;margin-right:8px;"></i>Chưa có dữ liệu tin đăng.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(j => {
        const convRate = j.totalApplications > 0
            ? Math.round((j.offeredCount / j.totalApplications) * 100)
            : 0;

        const isExpired = new Date(j.expiresAt) < new Date();
        let statusHtml;
        if (!j.isApproved) {
            statusHtml = '<span class="badge badge-screening">Chờ duyệt</span>';
        } else if (isExpired) {
            statusHtml = '<span class="badge badge-rejected">Hết hạn</span>';
        } else if (j.isActive) {
            statusHtml = '<span class="badge badge-interview">Đang mở</span>';
        } else {
            statusHtml = '<span class="badge badge-onhold">Đã ẩn</span>';
        }

        const typeTag = `<span style="font-size:11px;color:#64748b;">${anEsc(j.jobType || '')}</span>`;

        return `<tr>
            <td>
                <div style="font-weight:600;color:#0f172a;">${anEsc(j.title)}</div>
                ${typeTag}
            </td>
            <td style="text-align:center;font-weight:700;color:#0f172a;">${j.totalApplications}</td>
            <td style="text-align:center;color:#ca8a04;">${j.screeningCount}</td>
            <td style="text-align:center;color:#16a34a;">${j.interviewCount}</td>
            <td style="text-align:center;color:#059669;font-weight:700;">${j.offeredCount}</td>
            <td>
                <div class="an-convert-bar">
                    <div class="an-convert-track">
                        <div class="an-convert-fill" style="width:${convRate}%;"></div>
                    </div>
                    <span class="an-convert-pct">${convRate}%</span>
                </div>
            </td>
            <td>${statusHtml}</td>
        </tr>`;
    }).join('');
}

// ── Xuất Excel (CSV) ─────────────────────────────────────────
function exportAnalyticsCSV() {
    if (!_anRawData.perf || !_anRawData.perf.length) {
        alert('Không có dữ liệu để xuất. Vui lòng tải thống kê trước.');
        return;
    }

    const rows = [
        ['Vị trí', 'Loại hình', 'Tổng đơn', 'Sàng lọc', 'Phỏng vấn', 'Đề nghị', 'Từ chối', 'Tỉ lệ chuyển đổi (%)'],
        ..._anRawData.perf.map(j => [
            j.title, j.jobType,
            j.totalApplications, j.screeningCount, j.interviewCount,
            j.offeredCount, j.rejectedCount,
            j.totalApplications > 0 ? Math.round(j.offeredCount / j.totalApplications * 100) : 0
        ])
    ];

    // Append overview summary
    rows.push([]);
    rows.push(['=== TỔNG QUAN ===']);
    const d = _anRawData.overview;
    if (d) {
        rows.push(['Tổng lượt ứng tuyển', d.totalApplications]);
        rows.push(['Tin đang hoạt động', d.activeJobs]);
        rows.push(['Ứng viên phỏng vấn', d.interviewCount]);
        rows.push(['Đã đề nghị (Offered)', d.offeredCount]);
    }

    const bom  = '﻿';
    const csv  = bom + rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href     = url;
    a.download = `bao-cao-tuyen-dung-${_anPeriod}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Xuất PDF (jsPDF) ─────────────────────────────────────────
function exportAnalyticsPDF() {
    if (!_anRawData.overview) {
        alert('Không có dữ liệu để xuất. Vui lòng tải thống kê trước.');
        return;
    }

    const btn = document.getElementById('an-btn-pdf');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xuất...'; }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const periodMap = { '7d': '7 ngay qua', '30d': '30 ngay qua', '3m': '3 thang qua' };

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text('BAO CAO THONG KE TUYEN DUNG', 148, 16, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Ky: ${periodMap[_anPeriod] || _anPeriod}   |   Xuat: ${new Date().toLocaleString('vi-VN')}`, 148, 23, { align: 'center' });

        let y = 30;

        // 1. Overview
        const d = _anRawData.overview;
        if (d) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(59, 130, 246);
            doc.text('1. TONG QUAN KY BAO CAO', 14, y); y += 3;
            doc.autoTable({
                startY: y,
                head: [['Chi so', 'Trong ky', '% So ky truoc', 'Tong']],
                body: [
                    ['Luot ung tuyen',   d.currentPeriodApplications, pctStrAn(d.applicationGrowthPct), d.totalApplications],
                    ['Tin dang moi',     d.currentPeriodJobs,         pctStrAn(d.jobGrowthPct),         d.activeJobs + ' (dang HĐ)'],
                    ['Ung vien PV',      d.interviewCount,            pctStrAn(d.interviewGrowthPct),   d.offeredCount + ' (de nghi)'],
                ],
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 },
            });
            y = doc.lastAutoTable.finalY + 8;
        }

        // 2. Job Performance
        if (_anRawData.perf?.length) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(59, 130, 246);
            doc.text('2. HIEU SUAT TUNG TIN DANG', 14, y); y += 3;
            doc.autoTable({
                startY: y,
                head: [['Vi tri', 'Loai hinh', 'Tong don', 'Sang loc', 'Phong van', 'De nghi', 'Ti le (%)']],
                body: _anRawData.perf.map(j => [
                    j.title.length > 35 ? j.title.slice(0, 35) + '...' : j.title,
                    j.jobType || '—',
                    j.totalApplications, j.screeningCount, j.interviewCount, j.offeredCount,
                    j.totalApplications > 0 ? Math.round(j.offeredCount / j.totalApplications * 100) + '%' : '0%',
                ]),
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 },
            });
        }

        const fileName = `bao-cao-tuyen-dung-${_anPeriod}-${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
    } catch (e) {
        alert('Khong the xuat PDF: ' + e.message);
        console.error(e);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Xuất PDF'; }
    }
}

function pctStrAn(val) {
    if (val == null) return '—';
    return (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
}

// ── Helper ───────────────────────────────────────────────────
function anEsc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateLastUpdated() {
    const el = document.getElementById('an-last-updated');
    if (el) el.textContent = 'Cập nhật lúc ' + new Date().toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });
}

// ── Hook vào switchTab ───────────────────────────────────────
(function patchSwitchTabAnalytics() {
    const _prev = window.switchTab;
    window.switchTab = function(tabName, element) {
        _prev(tabName, element);
        if (tabName === 'analytics') {
            // Dùng setTimeout để đảm bảo canvas đã visible trước khi vẽ
            setTimeout(loadAnalytics, 50);
        }
    };
})();
