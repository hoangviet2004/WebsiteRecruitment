/**
 * admin.js — Tổng Quan Dashboard
 * Phần 1: stat cards cơ bản (users/jobs/companies)
 * Phần 2: thống kê & phân tích (filter, overview cards %, 3 charts, top-jobs table)
 */

'use strict';

// ── State ────────────────────────────────────────────────────
let _ovRange  = { startDate: null, endDate: null };
let _ovCharts = {};
let _clientCache = new Map();
const CLIENT_TTL = 60_000;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();       // Phần 1: stat cards cơ bản
    ovSetFilter('30d');         // Phần 2: thống kê (default 30 ngày)
});

// ════════════════════════════════════════════════════════════
// PHẦN 1 — STAT CARDS CƠ BẢN
// ════════════════════════════════════════════════════════════
async function loadDashboardStats() {
    try {
        const usersRes  = await apiFetchAuth('/api/admin/users',     { method: 'GET' });
        const usersData = await usersRes.json();
        if (usersRes.ok && usersData.success) {
            const users = usersData.data || [];
            document.getElementById('stat-users').textContent     = users.length;
            document.getElementById('stat-candidates').textContent = users.filter(u => u.role === 'Candidate').length;
            document.getElementById('stat-pending-users').textContent = users.filter(u => u.isApproved === false).length;
        }
    } catch (e) { console.error('Lỗi load users stats:', e); }

    try {
        const jobsRes  = await apiFetchAuth('/api/admin/jobs', { method: 'GET' });
        const jobsData = await jobsRes.json();
        if (jobsRes.ok && jobsData.success) {
            const jobs = jobsData.data || [];
            document.getElementById('stat-jobs').textContent         = jobs.length;
            document.getElementById('stat-pending-jobs').textContent = jobs.filter(j => !j.isApproved).length;
        }
    } catch (e) { console.error('Lỗi load jobs stats:', e); }

    try {
        const companiesRes  = await apiFetchAuth('/api/admin/companies', { method: 'GET' });
        const companiesData = await companiesRes.json();
        if (companiesRes.ok && companiesData.success) {
            document.getElementById('stat-companies').textContent = (companiesData.data || []).length;
        }
    } catch (e) { console.error('Lỗi load companies stats:', e); }
}

// ════════════════════════════════════════════════════════════
// PHẦN 2 — THỐNG KÊ & PHÂN TÍCH
// ════════════════════════════════════════════════════════════

// ── Filter helpers ────────────────────────────────────────────
function ovSetFilter(preset) {
    const now = new Date();
    let start, end = new Date(now);

    ['today','7d','30d','3m','custom'].forEach(id =>
        document.getElementById(`ov-flt-${id}`)?.classList.remove('active'));
    document.getElementById(`ov-flt-${preset}`)?.classList.add('active');

    const customRange = document.getElementById('ov-custom-range');

    if      (preset === 'today')  { start = new Date(now); start.setHours(0,0,0,0); customRange.classList.add('hidden'); }
    else if (preset === '7d')     { start = new Date(now); start.setDate(now.getDate() - 6); customRange.classList.add('hidden'); }
    else if (preset === '30d')    { start = new Date(now); start.setDate(now.getDate() - 29); customRange.classList.add('hidden'); }
    else if (preset === '3m')     { start = new Date(now); start.setMonth(now.getMonth() - 3); customRange.classList.add('hidden'); }
    else if (preset === 'custom') {
        customRange.classList.remove('hidden');
        if (!document.getElementById('ov-date-from').value) {
            const defStart = new Date(now); defStart.setDate(now.getDate() - 29);
            document.getElementById('ov-date-from').value = defStart.toISOString().split('T')[0];
            document.getElementById('ov-date-to').value   = now.toISOString().split('T')[0];
        }
        return;
    }

    _ovRange = {
        startDate: start.toISOString().split('T')[0],
        endDate:   end.toISOString().split('T')[0],
    };

    // Update period label
    const labels = { today: 'hôm nay', '7d': '7 ngày gần nhất', '30d': '30 ngày gần nhất', '3m': '3 tháng gần nhất' };
    const lbl = document.getElementById('ov-period-label');
    if (lbl) lbl.textContent = labels[preset] || '30 ngày gần nhất';

    ovLoadAll();
}

function ovApplyCustomRange() {
    const from = document.getElementById('ov-date-from').value;
    const to   = document.getElementById('ov-date-to').value;
    if (from && to && from <= to) {
        _ovRange = { startDate: from, endDate: to };
        const lbl = document.getElementById('ov-period-label');
        if (lbl) lbl.textContent = `${from} → ${to}`;
        ovLoadAll();
    }
}

// ── Fetch with client cache ───────────────────────────────────
async function ovFetch(endpoint) {
    const params = new URLSearchParams(_ovRange).toString();
    const url    = `/api/admin/${endpoint}?${params}`;
    const cached = _clientCache.get(url);
    if (cached && Date.now() - cached.ts < CLIENT_TTL) return cached.data;

    const res  = await apiFetchAuth(url, { method: 'GET' });
    if (!res?.ok) throw new Error(`HTTP ${res?.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'API error');

    _clientCache.set(url, { ts: Date.now(), data: json.data });
    return json.data;
}

// ── Load all charts & tables ──────────────────────────────────
async function ovLoadAll() {
    document.getElementById('ov-last-updated').textContent = '';

    // Show loading
    ['timeseries','skills','jobtypes'].forEach(ovShowLoading);
    document.getElementById('ov-table-top-jobs').innerHTML =
        '<div class="empty-state" style="padding:32px;"><div class="spinner"></div><p style="margin-top:12px;">Đang tải...</p></div>';

    const [overview, timeseries, skills, jobtypes, topJobs] = await Promise.allSettled([
        ovFetch('statistics/overview'),
        ovFetch('statistics/timeseries'),
        ovFetch('statistics/top-skills'),
        ovFetch('statistics/job-types'),
        ovFetch('statistics/top-jobs'),
    ]);

    if (overview.status   === 'fulfilled') ovRenderOverview(overview.value);
    if (timeseries.status === 'fulfilled') ovRenderTimeSeries(timeseries.value);
    else ovHideLoading('timeseries', true);
    if (skills.status     === 'fulfilled') ovRenderSkills(skills.value);
    else ovHideLoading('skills', true);
    if (jobtypes.status   === 'fulfilled') ovRenderJobTypes(jobtypes.value);
    else ovHideLoading('jobtypes', true);
    if (topJobs.status    === 'fulfilled') ovRenderTopJobs(topJobs.value);
    else document.getElementById('ov-table-top-jobs').innerHTML =
        ovErrorState('Không thể tải danh sách tin tuyển dụng');

    document.getElementById('ov-last-updated').textContent =
        `Cập nhật: ${new Date().toLocaleTimeString('vi-VN')}`;
}

// ── Overview cards ────────────────────────────────────────────
function ovRenderOverview(d) {
    if (!d) return;
    ovAnimateCount('ov-val-users',     d.totalUsers);
    ovAnimateCount('ov-val-jobs',      d.totalActiveJobs);
    ovAnimateCount('ov-val-apps',      d.totalApplicationsEstimate);
    ovAnimateCount('ov-val-companies', d.totalCompanies);

    document.getElementById('ov-sub-users').textContent =
        `Ứng viên: ${d.totalCandidates} | NTD: ${d.totalRecruiters}`;
    document.getElementById('ov-sub-jobs').textContent      = `Tổng: ${d.totalJobs} tin`;
    document.getElementById('ov-sub-companies').textContent = `Mới trong kỳ: ${d.prevPeriodCompanies}`;

    ovRenderBadge('ov-badge-users',     d.userGrowthPct);
    ovRenderBadge('ov-badge-jobs',      d.jobGrowthPct);
    ovRenderBadge('ov-badge-apps',      d.applicationGrowthPct);
    ovRenderBadge('ov-badge-companies', d.companyGrowthPct);
}

function ovRenderBadge(elId, pct) {
    const el = document.getElementById(elId);
    if (!el) return;
    const val = pct ?? 0;
    if (val > 0) {
        el.className = 'card-badge up';
        el.innerHTML = `<i class="fa-solid fa-arrow-up"></i> +${val.toFixed(1)}%`;
    } else if (val < 0) {
        el.className = 'card-badge down';
        el.innerHTML = `<i class="fa-solid fa-arrow-down"></i> ${val.toFixed(1)}%`;
    } else {
        el.className = 'card-badge flat';
        el.innerHTML = `<i class="fa-solid fa-minus"></i> 0%`;
    }
}

function ovAnimateCount(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    const steps = 25, dur = 600;
    let i = 0, step = target / steps;
    const iv = setInterval(() => {
        i++;
        el.textContent = Math.round(step * i).toLocaleString('vi-VN');
        if (i >= steps) { clearInterval(iv); el.textContent = target.toLocaleString('vi-VN'); }
    }, dur / steps);
}

// ── Chart helpers ─────────────────────────────────────────────
const OV_PALETTE = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];

function ovShowLoading(name) {
    const el = document.getElementById(`ov-load-${name}`);
    if (el) el.style.display = 'flex';
}
function ovHideLoading(name, showErr = false) {
    const el = document.getElementById(`ov-load-${name}`);
    if (el) el.style.display = 'none';
    if (showErr) {
        const c = document.getElementById(`ov-chart-${name}`);
        c?.insertAdjacentHTML('afterend', '<div class="error-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Không thể tải dữ liệu</p></div>');
    }
}
function ovDestroyChart(name) {
    if (_ovCharts[name]) { _ovCharts[name].destroy(); _ovCharts[name] = null; }
}

// ── Line chart ────────────────────────────────────────────────
function ovRenderTimeSeries(data) {
    ovHideLoading('timeseries');
    ovDestroyChart('timeseries');
    const ctx = document.getElementById('ov-chart-timeseries').getContext('2d');
    _ovCharts.timeseries = new Chart(ctx, {
        type: 'line',
        data: {
            labels:   data.map(d => d.label),
            datasets: [
                {
                    label: 'Tài khoản mới',
                    data:  data.map(d => d.newUsers),
                    borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',
                    borderWidth: 2.5, pointBackgroundColor: '#3b82f6', pointRadius: 4,
                    fill: true, tension: 0.4,
                },
                {
                    label: 'Tin đăng mới',
                    data:  data.map(d => d.newJobs),
                    borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)',
                    borderWidth: 2.5, pointBackgroundColor: '#10b981', pointRadius: 4,
                    fill: true, tension: 0.4,
                },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 14, font: { family: 'Inter', size: 12 } } },
                tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 10, titleFont: { family: 'Inter', size: 13, weight: '600' }, bodyFont: { family: 'Inter', size: 12 } },
            },
            scales: {
                x: { grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { font: { family:'Inter', size:11 }, color:'#64748b', maxTicksLimit: 12 } },
                y: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { font: { family:'Inter', size:11 }, color:'#64748b', precision:0 } },
            },
        },
    });
}

// ── Bar chart: skills ─────────────────────────────────────────
function ovRenderSkills(data) {
    ovHideLoading('skills');
    ovDestroyChart('skills');
    const ctx = document.getElementById('ov-chart-skills').getContext('2d');
    _ovCharts.skills = new Chart(ctx, {
        type: 'bar',
        data: {
            labels:   data.map(d => d.skill),
            datasets: [{
                label: 'Số lượng',
                data:  data.map(d => d.count),
                backgroundColor: data.map((_, i) => OV_PALETTE[i % OV_PALETTE.length] + 'CC'),
                borderColor:     data.map((_, i) => OV_PALETTE[i % OV_PALETTE.length]),
                borderWidth: 1.5, borderRadius: 8, borderSkipped: false,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', padding: 10, cornerRadius: 10, titleFont: { family:'Inter', size:13, weight:'600' }, bodyFont: { family:'Inter', size:12 } },
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family:'Inter', size:10 }, color:'#64748b' } },
                y: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { font: { family:'Inter', size:11 }, color:'#64748b', precision:0 } },
            },
        },
    });
}

// ── Doughnut chart: job types ─────────────────────────────────
function ovRenderJobTypes(data) {
    ovHideLoading('jobtypes');
    ovDestroyChart('jobtypes');
    const ctx = document.getElementById('ov-chart-jobtypes').getContext('2d');
    _ovCharts.jobtypes = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels:   data.map(d => d.jobType),
            datasets: [{
                data:            data.map(d => d.count),
                backgroundColor: OV_PALETTE.slice(0, data.length),
                borderColor: '#fff', borderWidth: 3, hoverOffset: 8,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '58%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { family:'Inter', size:12 } } },
                tooltip: {
                    backgroundColor: '#0f172a', padding: 10, cornerRadius: 10,
                    titleFont: { family:'Inter', size:13, weight:'600' }, bodyFont: { family:'Inter', size:12 },
                    callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${data[ctx.dataIndex]?.percentage}%)` },
                },
            },
        },
    });
}

// ── Top jobs mini table ───────────────────────────────────────
function ovRenderTopJobs(data) {
    const el = document.getElementById('ov-table-top-jobs');
    if (!el) return;
    if (!data?.length) {
        el.innerHTML = '<div class="empty-state" style="padding:32px;"><i class="fa-solid fa-inbox" style="color:#cbd5e1;font-size:28px;"></i><p style="margin-top:8px;">Không có dữ liệu</p></div>';
        return;
    }

    const maxApp = Math.max(...data.map(d => d.applicationCount));
    el.innerHTML = `
    <div class="table-card-header">
        <h3><i class="fa-solid fa-fire"></i> Top tin tuyển dụng nổi bật</h3>
    </div>
    <div class="table-scroll">
    <table class="analytics-table">
      <thead><tr>
        <th>#</th><th>Tiêu đề</th><th>Công ty</th><th>Loại</th><th>Lượt ứng tuyển</th><th>Trạng thái</th>
      </tr></thead>
      <tbody>
        ${data.slice(0, 8).map((j, i) => `
          <tr>
            <td><span class="rank-badge rank-${i < 3 ? i+1 : 'n'}">${i+1}</span></td>
            <td><div class="job-title-cell">${escHtml(j.title)}</div></td>
            <td><span style="font-weight:600;color:#0f172a;">${escHtml(j.companyName)}</span></td>
            <td><span class="skill-tag">${escHtml(j.jobType || '—')}</span></td>
            <td>
              <div class="mini-bar-wrap">
                <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round(j.applicationCount*100/maxApp)}%"></div></div>
                <span class="mini-bar-val">${j.applicationCount}</span>
              </div>
            </td>
            <td><span class="status-dot ${j.isActive ? 'active':'inactive'}">${j.isActive ? 'Hoạt động' : 'Dừng'}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}

// ── Utilities ─────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '—';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function ovErrorState(msg) {
    return `<div class="error-state" style="padding:32px;">
        <i class="fa-solid fa-triangle-exclamation"></i><p>${escHtml(msg)}</p></div>`;
}
