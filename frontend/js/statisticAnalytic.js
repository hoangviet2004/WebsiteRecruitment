/**
 * statisticAnalytic.js
 * Dashboard Thống kê & Báo cáo — Admin
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let _currentRange = { startDate: null, endDate: null };
let _charts       = {};     // { timeseries, skills, jobtypes, companies }
let _data         = {};     // raw data cache (client-side, 60s)
let _clientCache  = new Map();  // key → { ts, data }
const CLIENT_TTL  = 60_000;    // 60 seconds

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    setFilter('30d');   // default → triggers loadAll
});

// ═══════════════════════════════════════════════════════════════
// FILTER / DATE RANGE
// ═══════════════════════════════════════════════════════════════
function setFilter(preset) {
    const now   = new Date();
    let start, end = new Date(now);

    // Reset all buttons
    ['today','7d','30d','3m','custom'].forEach(id => {
        document.getElementById(`flt-${id}`)?.classList.remove('active');
    });
    document.getElementById(`flt-${preset}`)?.classList.add('active');

    const customRange = document.getElementById('custom-range');

    if (preset === 'today') {
        start = new Date(now); start.setHours(0,0,0,0);
        customRange.classList.add('hidden');
    } else if (preset === '7d') {
        start = new Date(now); start.setDate(now.getDate() - 6);
        customRange.classList.add('hidden');
    } else if (preset === '30d') {
        start = new Date(now); start.setDate(now.getDate() - 29);
        customRange.classList.add('hidden');
    } else if (preset === '3m') {
        start = new Date(now); start.setMonth(now.getMonth() - 3);
        customRange.classList.add('hidden');
    } else if (preset === 'custom') {
        customRange.classList.remove('hidden');
        // Initialize date inputs if empty
        if (!document.getElementById('date-from').value) {
            const defStart = new Date(now); defStart.setDate(now.getDate() - 29);
            document.getElementById('date-from').value = defStart.toISOString().split('T')[0];
            document.getElementById('date-to').value   = now.toISOString().split('T')[0];
        }
        return; // wait for applyCustomRange
    }

    _currentRange = {
        startDate: start.toISOString().split('T')[0],
        endDate:   end.toISOString().split('T')[0],
    };
    loadAll();
}

function applyCustomRange() {
    const from = document.getElementById('date-from').value;
    const to   = document.getElementById('date-to').value;
    if (from && to && from <= to) {
        _currentRange = { startDate: from, endDate: to };
        loadAll();
    }
}

// ═══════════════════════════════════════════════════════════════
// API FETCH WITH CLIENT CACHE
// ═══════════════════════════════════════════════════════════════
async function fetchStats(endpoint) {
    const params = new URLSearchParams(_currentRange).toString();
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

// ═══════════════════════════════════════════════════════════════
// LOAD ALL
// ═══════════════════════════════════════════════════════════════
async function loadAll() {
    document.getElementById('last-updated').textContent = '';

    // Show loading overlays
    ['timeseries','skills','jobtypes','companies'].forEach(showChartLoading);

    // Run all fetches in parallel
    const [overview, timeseries, skills, jobtypes, companies, topJobs, recruiters, candidates] =
        await Promise.allSettled([
            fetchStats('statistics/overview'),
            fetchStats('statistics/timeseries'),
            fetchStats('statistics/top-skills'),
            fetchStats('statistics/job-types'),
            fetchStats('statistics/top-companies'),
            fetchStats('statistics/top-jobs'),
            fetchStats('statistics/active-recruiters'),
            fetchStats('statistics/candidate-stats'),
        ]);

    // Store raw data
    _data = { overview, timeseries, skills, jobtypes, companies, topJobs, recruiters, candidates };

    // Render
    if (overview.status === 'fulfilled')     renderOverview(overview.value);
    if (timeseries.status === 'fulfilled')   renderTimeSeries(timeseries.value);
    else                                     hideChartLoading('timeseries', true);
    if (skills.status === 'fulfilled')       renderSkillsChart(skills.value);
    else                                     hideChartLoading('skills', true);
    if (jobtypes.status === 'fulfilled')     renderJobTypesChart(jobtypes.value);
    else                                     hideChartLoading('jobtypes', true);
    if (companies.status === 'fulfilled')    renderCompaniesChart(companies.value);
    else                                     hideChartLoading('companies', true);
    if (topJobs.status === 'fulfilled')      renderTopJobsTable(topJobs.value);
    else                                     renderTableError('table-top-jobs');
    if (recruiters.status === 'fulfilled')   renderRecruitersTable(recruiters.value);
    else                                     renderTableError('table-recruiters');
    if (candidates.status === 'fulfilled')   renderCandidatesTable(candidates.value);
    else                                     renderTableError('table-candidates');

    document.getElementById('last-updated').textContent = `Cập nhật: ${new Date().toLocaleTimeString('vi-VN')}`;
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW CARDS
// ═══════════════════════════════════════════════════════════════
function renderOverview(d) {
    if (!d) return;

    animateCount('val-users',     d.totalUsers,     0);
    animateCount('val-jobs',      d.totalActiveJobs,0);
    animateCount('val-apps',      d.totalApplicationsEstimate, 0);
    animateCount('val-companies', d.totalCompanies, 0);

    document.getElementById('sub-users').textContent =
        `Ứng viên: ${d.totalCandidates} | Nhà tuyển dụng: ${d.totalRecruiters}`;
    document.getElementById('sub-jobs').textContent =
        `Tổng: ${d.totalJobs} tin`;
    document.getElementById('sub-companies').textContent =
        `Mới trong kỳ: ${d.prevPeriodCompanies}`;

    renderGrowthBadge('badge-users',     d.userGrowthPct);
    renderGrowthBadge('badge-jobs',      d.jobGrowthPct);
    renderGrowthBadge('badge-apps',      d.applicationGrowthPct);
    renderGrowthBadge('badge-companies', d.companyGrowthPct);
}

function renderGrowthBadge(elId, pct) {
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

function animateCount(elId, target, from = 0) {
    const el = document.getElementById(elId);
    if (!el) return;
    const duration = 700;
    const steps    = 30;
    const step     = (target - from) / steps;
    let current    = from;
    let i          = 0;
    const interval = setInterval(() => {
        i++;
        current += step;
        el.textContent = Math.round(current).toLocaleString('vi-VN');
        if (i >= steps) {
            clearInterval(interval);
            el.textContent = target.toLocaleString('vi-VN');
        }
    }, duration / steps);
}

// ═══════════════════════════════════════════════════════════════
// CHART HELPERS
// ═══════════════════════════════════════════════════════════════
function showChartLoading(name) {
    const el = document.getElementById(`load-${name}`);
    if (el) { el.style.display = 'flex'; }
}
function hideChartLoading(name, showError = false) {
    const el = document.getElementById(`load-${name}`);
    if (el) el.style.display = 'none';
    if (showError) {
        const canvas = document.getElementById(`chart-${name}`);
        if (canvas) {
            canvas.insertAdjacentHTML('afterend', `
                <div class="error-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Không thể tải dữ liệu biểu đồ</p>
                </div>`);
        }
    }
}
function destroyChart(name) {
    if (_charts[name]) { _charts[name].destroy(); _charts[name] = null; }
}

const PALETTE = [
    '#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444',
    '#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1'
];

// ═══════════════════════════════════════════════════════════════
// LINE CHART — TIME SERIES
// ═══════════════════════════════════════════════════════════════
function renderTimeSeries(data) {
    hideChartLoading('timeseries');
    destroyChart('timeseries');
    const ctx = document.getElementById('chart-timeseries').getContext('2d');
    _charts.timeseries = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.label),
            datasets: [
                {
                    label: 'Tài khoản mới',
                    data:  data.map(d => d.newUsers),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.08)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4,
                },
                {
                    label: 'Tin đăng mới',
                    data:  data.map(d => d.newJobs),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 16, font: { family: 'Inter', size: 12 } } },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont:  { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 10,
                },
            },
            scales: {
                x: {
                    grid: { color: 'rgba(226,232,240,0.6)' },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b', maxTicksLimit: 12 },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(226,232,240,0.6)' },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b', precision: 0 },
                },
            },
        },
    });
}

// ═══════════════════════════════════════════════════════════════
// BAR CHART — TOP SKILLS
// ═══════════════════════════════════════════════════════════════
function renderSkillsChart(data) {
    hideChartLoading('skills');
    destroyChart('skills');
    const ctx = document.getElementById('chart-skills').getContext('2d');
    _charts.skills = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.skill),
            datasets: [{
                label: 'Số lượng',
                data:  data.map(d => d.count),
                backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length] + 'CC'),
                borderColor:     data.map((_, i) => PALETTE[i % PALETTE.length]),
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    callbacks: { label: ctx => ` ${ctx.raw} profile` },
                    padding: 10, cornerRadius: 10,
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont:  { family: 'Inter', size: 12 },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(226,232,240,0.6)' },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b', precision: 0 },
                },
            },
        },
    });
}

// ═══════════════════════════════════════════════════════════════
// PIE CHART — JOB TYPES
// ═══════════════════════════════════════════════════════════════
function renderJobTypesChart(data) {
    hideChartLoading('jobtypes');
    destroyChart('jobtypes');
    const ctx = document.getElementById('chart-jobtypes').getContext('2d');
    _charts.jobtypes = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.jobType),
            datasets: [{
                data:            data.map(d => d.count),
                backgroundColor: PALETTE.slice(0, data.length),
                borderColor:     '#fff',
                borderWidth: 3,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 12, font: { family: 'Inter', size: 12 } },
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.raw} (${data[ctx.dataIndex]?.percentage}%)`,
                    },
                    padding: 10, cornerRadius: 10,
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont:  { family: 'Inter', size: 12 },
                },
            },
        },
    });
}

// ═══════════════════════════════════════════════════════════════
// HORIZONTAL BAR — TOP COMPANIES
// ═══════════════════════════════════════════════════════════════
function renderCompaniesChart(data) {
    hideChartLoading('companies');
    destroyChart('companies');
    const ctx = document.getElementById('chart-companies').getContext('2d');
    _charts.companies = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.companyName),
            datasets: [
                {
                    label: 'Tổng tin',
                    data:  data.map(d => d.jobCount),
                    backgroundColor: 'rgba(59,130,246,0.75)',
                    borderColor:     '#3b82f6',
                    borderWidth: 1.5,
                    borderRadius: 8,
                },
                {
                    label: 'Đang hoạt động',
                    data:  data.map(d => d.activeJobCount),
                    backgroundColor: 'rgba(16,185,129,0.75)',
                    borderColor:     '#10b981',
                    borderWidth: 1.5,
                    borderRadius: 8,
                },
            ],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 14, font: { family: 'Inter', size: 12 } } },
                tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 10, cornerRadius: 10,
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont:  { family: 'Inter', size: 12 },
                },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(226,232,240,0.6)' },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b', precision: 0 },
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter', size: 12, weight: '600' }, color: '#0f172a' },
                },
            },
        },
    });
}

// ═══════════════════════════════════════════════════════════════
// TABLE: TOP JOBS
// ═══════════════════════════════════════════════════════════════
function renderTopJobsTable(data) {
    const el = document.getElementById('table-top-jobs');
    if (!data?.length) { el.innerHTML = emptyState('Không có dữ liệu tin tuyển dụng'); return; }
    const maxApp = Math.max(...data.map(d => d.applicationCount));
    el.innerHTML = `
    <table class="analytics-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Tiêu đề</th>
          <th>Công ty</th>
          <th>Loại</th>
          <th>Địa điểm</th>
          <th>Lượt ứng tuyển</th>
          <th>Trạng thái</th>
          <th>Ngày đăng</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((j, i) => `
          <tr>
            <td><span class="rank-badge rank-${i < 3 ? i+1 : 'n'}">${i+1}</span></td>
            <td><div class="job-title-cell">${escHtml(j.title)}</div></td>
            <td><span style="font-weight:600;color:var(--text-primary)">${escHtml(j.companyName)}</span></td>
            <td><span class="skill-tag">${escHtml(j.jobType || '—')}</span></td>
            <td>${escHtml(j.location || '—')}</td>
            <td>
              <div class="mini-bar-wrap">
                <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round(j.applicationCount*100/maxApp)}%"></div></div>
                <span class="mini-bar-val">${j.applicationCount}</span>
              </div>
            </td>
            <td><span class="status-dot ${j.isActive ? 'active' : 'inactive'}">${j.isActive ? 'Hoạt động' : 'Dừng'}</span></td>
            <td style="white-space:nowrap">${formatDate(j.createdAt)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ═══════════════════════════════════════════════════════════════
// TABLE: ACTIVE RECRUITERS
// ═══════════════════════════════════════════════════════════════
function renderRecruitersTable(data) {
    const el = document.getElementById('table-recruiters');
    if (!data?.length) { el.innerHTML = emptyState('Không có dữ liệu nhà tuyển dụng'); return; }
    const maxJobs = Math.max(...data.map(d => d.totalJobs));
    el.innerHTML = `
    <table class="analytics-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Họ tên</th>
          <th>Email</th>
          <th>Công ty</th>
          <th>Tổng tin</th>
          <th>Đang hoạt động</th>
          <th>Lần đăng gần nhất</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((r, i) => `
          <tr>
            <td><span class="rank-badge rank-${i < 3 ? i+1 : 'n'}">${i+1}</span></td>
            <td style="font-weight:600;color:var(--text-primary)">${escHtml(r.fullName || '—')}</td>
            <td style="font-size:12px;color:var(--text-secondary)">${escHtml(r.email)}</td>
            <td>${escHtml(r.companyName)}</td>
            <td>
              <div class="mini-bar-wrap">
                <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round(r.totalJobs*100/maxJobs)}%"></div></div>
                <span class="mini-bar-val">${r.totalJobs}</span>
              </div>
            </td>
            <td><span class="trend-up">${r.activeJobs}</span></td>
            <td style="white-space:nowrap">${formatDate(r.lastPostedAt)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ═══════════════════════════════════════════════════════════════
// TABLE: CANDIDATE STATS
// ═══════════════════════════════════════════════════════════════
function renderCandidatesTable(data) {
    const el = document.getElementById('table-candidates');
    if (!data?.length) { el.innerHTML = emptyState('Không có dữ liệu ứng viên'); return; }
    const maxCount = Math.max(...data.map(d => d.count));
    el.innerHTML = `
    <table class="analytics-table">
      <thead>
        <tr>
          <th>Phân loại</th>
          <th>Giá trị</th>
          <th>Số lượng</th>
          <th>Tỉ lệ</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(d => `
          <tr>
            <td><span class="category-tag ${d.category === 'Kỹ năng' ? 'skill' : 'exp'}">${escHtml(d.category)}</span></td>
            <td style="font-weight:600;color:var(--text-primary)">${escHtml(d.value)}</td>
            <td>
              <div class="mini-bar-wrap">
                <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round(d.count*100/maxCount)}%"></div></div>
                <span class="mini-bar-val">${d.count}</span>
              </div>
            </td>
            <td style="font-weight:600;color:var(--primary)">${d.percentage > 0 ? d.percentage + '%' : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT EXCEL
// ═══════════════════════════════════════════════════════════════
function exportExcel() {
    const btn = document.getElementById('btn-export-excel');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xuất...';

    try {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Overview
        if (_data.overview?.value) {
            const d = _data.overview.value;
            const overviewData = [
                ['Chỉ số', 'Giá trị', '% Tăng/Giảm'],
                ['Tổng tài khoản',        d.totalUsers,               pctStr(d.userGrowthPct)],
                ['Ứng viên',              d.totalCandidates,          '—'],
                ['Nhà tuyển dụng',        d.totalRecruiters,          '—'],
                ['Tin tuyển dụng hoạt động', d.totalActiveJobs,       pctStr(d.jobGrowthPct)],
                ['Tổng tin tuyển dụng',   d.totalJobs,                '—'],
                ['Doanh nghiệp',          d.totalCompanies,           pctStr(d.companyGrowthPct)],
                ['Lượt ứng tuyển (ước tính)', d.totalApplicationsEstimate, pctStr(d.applicationGrowthPct)],
            ];
            wb.SheetNames.push('Tổng quan');
            wb.Sheets['Tổng quan'] = XLSX.utils.aoa_to_sheet(overviewData);
        }

        // Sheet 2: Top Jobs
        if (_data.topJobs?.value?.length) {
            const rows = [['#','Tiêu đề','Công ty','Loại','Địa điểm','Lượt ứng tuyển','Trạng thái','Ngày đăng']];
            _data.topJobs.value.forEach((j,i) => rows.push([
                i+1, j.title, j.companyName, j.jobType, j.location,
                j.applicationCount, j.isActive ? 'Hoạt động' : 'Dừng', formatDate(j.createdAt)
            ]));
            wb.SheetNames.push('Top Tin tuyển dụng');
            wb.Sheets['Top Tin tuyển dụng'] = XLSX.utils.aoa_to_sheet(rows);
        }

        // Sheet 3: Active Recruiters
        if (_data.recruiters?.value?.length) {
            const rows = [['#','Họ tên','Email','Công ty','Tổng tin','Đang hoạt động','Lần đăng gần nhất']];
            _data.recruiters.value.forEach((r,i) => rows.push([
                i+1, r.fullName, r.email, r.companyName,
                r.totalJobs, r.activeJobs, formatDate(r.lastPostedAt)
            ]));
            wb.SheetNames.push('Nhà tuyển dụng');
            wb.Sheets['Nhà tuyển dụng'] = XLSX.utils.aoa_to_sheet(rows);
        }

        // Sheet 4: Top Skills
        if (_data.skills?.value?.length) {
            const rows = [['Kỹ năng', 'Số lượng']];
            _data.skills.value.forEach(s => rows.push([s.skill, s.count]));
            wb.SheetNames.push('Kỹ năng IT');
            wb.Sheets['Kỹ năng IT'] = XLSX.utils.aoa_to_sheet(rows);
        }

        // Sheet 5: Job Types
        if (_data.jobtypes?.value?.length) {
            const rows = [['Loại công việc', 'Số lượng', 'Tỉ lệ (%)']];
            _data.jobtypes.value.forEach(jt => rows.push([jt.jobType, jt.count, jt.percentage]));
            wb.SheetNames.push('Phân loại tin');
            wb.Sheets['Phân loại tin'] = XLSX.utils.aoa_to_sheet(rows);
        }

        const fileName = `BaoCao_TuyenDung_${_currentRange.startDate}_${_currentRange.endDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch (e) {
        alert('Không thể xuất Excel: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Xuất Excel';
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT PDF
// ═══════════════════════════════════════════════════════════════
function exportPdf() {
    const btn = document.getElementById('btn-export-pdf');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xuất...';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text('BAO CAO THONG KE & PHAN TICH TUYEN DUNG', 148, 18, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Tu: ${_currentRange.startDate}   Den: ${_currentRange.endDate}   |   Xuat: ${new Date().toLocaleString('vi-VN')}`, 148, 26, { align: 'center' });

        let y = 34;

        // Overview table
        if (_data.overview?.value) {
            const d = _data.overview.value;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(59, 130, 246);
            doc.text('1. TONG QUAN HE THONG', 14, y);
            y += 4;

            doc.autoTable({
                startY: y,
                head: [['Chi so', 'Gia tri', '% Tang/Giam']],
                body: [
                    ['Tong tai khoan',             d.totalUsers,             pctStr(d.userGrowthPct)],
                    ['Ung vien',                   d.totalCandidates,        '—'],
                    ['Nha tuyen dung',             d.totalRecruiters,        '—'],
                    ['Tin tuyen dung hoat dong',   d.totalActiveJobs,        pctStr(d.jobGrowthPct)],
                    ['Doanh nghiep',               d.totalCompanies,         pctStr(d.companyGrowthPct)],
                    ['Luot ung tuyen (uoc tinh)',  d.totalApplicationsEstimate, pctStr(d.applicationGrowthPct)],
                ],
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 },
            });
            y = doc.lastAutoTable.finalY + 8;
        }

        // Top jobs table
        if (_data.topJobs?.value?.length) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(59, 130, 246);
            doc.text('2. TOP TIN TUYEN DUNG', 14, y);
            y += 4;

            doc.autoTable({
                startY: y,
                head: [['#', 'Tieu de', 'Cong ty', 'Loai', 'Luot ung tuyen', 'Trang thai']],
                body: _data.topJobs.value.map((j, i) => [
                    i+1, truncate(j.title, 35), truncate(j.companyName, 25), j.jobType || '—',
                    j.applicationCount, j.isActive ? 'Hoat dong' : 'Dung'
                ]),
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 },
            });
            y = doc.lastAutoTable.finalY + 8;
        }

        // Active recruiters table
        if (_data.recruiters?.value?.length && y < 180) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(59, 130, 246);
            doc.text('3. NHA TUYEN DUNG TICH CUC NHAT', 14, y);
            y += 4;

            doc.autoTable({
                startY: y,
                head: [['#', 'Ho ten', 'Email', 'Cong ty', 'Tong tin', 'Hoat dong']],
                body: _data.recruiters.value.map((r, i) => [
                    i+1, truncate(r.fullName, 25), truncate(r.email, 30),
                    truncate(r.companyName, 25), r.totalJobs, r.activeJobs
                ]),
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 },
            });
        }

        const fileName = `BaoCao_TuyenDung_${_currentRange.startDate}_${_currentRange.endDate}.pdf`;
        doc.save(fileName);
    } catch (e) {
        alert('Khong the xuat PDF: ' + e.message);
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Xuất PDF';
    }
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function escHtml(str) {
    if (!str) return '—';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function pctStr(val) {
    if (val == null) return '—';
    return (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
}
function truncate(str, len) {
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '…' : str;
}
function emptyState(msg) {
    return `<div class="empty-state" style="padding:32px;">
        <i class="fa-solid fa-inbox" style="color:#cbd5e1;"></i>
        <p>${escHtml(msg)}</p>
    </div>`;
}
function renderTableError(elId) {
    const el = document.getElementById(elId);
    if (el) el.innerHTML = `<div class="error-state" style="padding:32px;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Không thể tải dữ liệu</p>
    </div>`;
}
