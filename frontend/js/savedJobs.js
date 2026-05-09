// ============================================================
// savedJobs.js – Lưu & Quản lý Việc Làm Yêu Thích (Candidate)
// ============================================================

let allSavedJobs = [];     // raw data từ API
let currentTab  = 'all';   // tab hiện tại
let compareSet  = new Set(); // Set<savedJobId> đang so sánh (tối đa 2)
let searchQuery = '';

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
async function initSavedJobs() {
  setupSearch();
  await loadSavedJobs();
}



function setupSearch() {
  const input = document.getElementById('sj-search-input');
  if (!input) return;
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = input.value.trim().toLowerCase();
      renderCards();
    }, 250);
  });
}

// ─────────────────────────────────────────────────────────────
// DATA – Load từ API (1 request)
// ─────────────────────────────────────────────────────────────
async function loadSavedJobs() {
  showSkeletons(3);
  try {
    const res  = await apiFetchAuth('/api/saved-jobs');
    if (!res) return;
    const data = await res.json();
    if (res.ok && data.success) {
      allSavedJobs = data.data || [];
    } else {
      allSavedJobs = [];
      showToast('Không thể tải danh sách yêu thích.', 'error');
    }
  } catch {
    allSavedJobs = [];
    showToast('Lỗi kết nối máy chủ.', 'error');
  }
  updateCounts();
  checkExpiringJobs();
  renderCards();
}

// ─────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────
function getFilteredJobs() {
  let list = currentTab === 'all'
    ? allSavedJobs
    : allSavedJobs.filter(j => j.collection === currentTab);

  if (searchQuery) {
    list = list.filter(j =>
      j.title.toLowerCase().includes(searchQuery) ||
      j.companyName.toLowerCase().includes(searchQuery) ||
      j.location.toLowerCase().includes(searchQuery)
    );
  }
  return list;
}

function renderCards() {
  const grid  = document.getElementById('sj-grid');
  const empty = document.getElementById('sj-empty');
  const jobs  = getFilteredJobs();

  grid.innerHTML = '';

  if (jobs.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';

  jobs.forEach(job => {
    const card = buildCard(job);
    grid.appendChild(card);
  });
}

function buildCard(job) {
  const div = document.createElement('div');
  div.className = 'sj-card';
  div.dataset.savedJobId = job.savedJobId;
  if (isExpiringSoon(job.expiresAt)) div.dataset.expiring = 'true';

  const logoHtml = job.companyLogo
    ? `<img src="${job.companyLogo}" alt="${escHtml(job.companyName)}">`
    : `<span>${getInitials(job.companyName)}</span>`;

  const salaryText = formatSalary(job.minSalary, job.maxSalary);
  const deadlineText = formatDeadline(job.expiresAt);
  const isUrgent = isExpiringSoon(job.expiresAt);
  const isChecked = compareSet.has(job.savedJobId);

  const collectionTagClass = {
    'Muốn apply':    'sj-tag-muon-apply',
    'Đang cân nhắc': 'sj-tag-dang-can-nhac',
    'Tất cả':        'sj-tag-tat-ca'
  }[job.collection] || 'sj-tag-tat-ca';

  // Parse skills từ requirements (lấy tối đa 3 từ đầu)
  const skillTags = parseSkills(job.requirements).slice(0, 3)
    .map(s => `<span class="sj-tag sj-tag-skill">${escHtml(s)}</span>`).join('');

  div.innerHTML = `
    <div class="sj-card-top">
      <div class="sj-company-row">
        <div class="sj-logo">${logoHtml}</div>
        <div class="sj-job-info">
          <div class="sj-job-title">${escHtml(job.title)}</div>
          <div class="sj-company-name">${escHtml(job.companyName)} • ${escHtml(job.location)}</div>
        </div>
      </div>
      <div class="sj-card-compare">
        <span class="sj-compare-label">So sánh</span>
        <input type="checkbox" class="sj-compare-checkbox" title="Chọn để so sánh"
          ${isChecked ? 'checked' : ''}
          onchange="toggleCompare('${job.savedJobId}', this)">
      </div>
    </div>

    <div class="sj-meta">
      <div class="sj-meta-item sj-salary">
        <i class="fa-solid fa-money-bill-wave"></i> ${salaryText}
      </div>
      <div class="sj-meta-item sj-deadline ${isUrgent ? 'urgent' : ''}">
        <i class="fa-regular fa-clock"></i> ${deadlineText}
      </div>
    </div>

    <div class="sj-tags">
      <span class="sj-tag ${collectionTagClass}">${escHtml(job.collection)}</span>
      ${skillTags}
    </div>

    <div class="sj-card-footer">
      <button class="sj-btn-apply" onclick="applyJob('${job.savedJobId}')">
        <i class="fa-solid fa-paper-plane"></i> Ứng tuyển ngay
      </button>
      <div class="sj-btn-icon sj-btn-collection" title="Chuyển nhóm"
           onclick="toggleCollectionDropdown(event, '${job.savedJobId}')">
        <i class="fa-solid fa-tag"></i>
        <div class="sj-collection-dropdown" id="cd-${job.savedJobId}">
          <button class="sj-dropdown-item" onclick="changeCollection(event,'${job.savedJobId}','Tất cả')">
            <span class="dot dot-tat-ca"></span> Tất cả
          </button>
          <button class="sj-dropdown-item" onclick="changeCollection(event,'${job.savedJobId}','Muốn apply')">
            <span class="dot dot-muon-apply"></span> Muốn apply
          </button>
          <button class="sj-dropdown-item" onclick="changeCollection(event,'${job.savedJobId}','Đang cân nhắc')">
            <span class="dot dot-dang-can-nhac"></span> Đang cân nhắc
          </button>
        </div>
      </div>
      <button class="sj-btn-icon sj-btn-remove" title="Bỏ lưu" onclick="removeSaved('${job.savedJobId}')">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;
  return div;
}

function showSkeletons(n) {
  const grid = document.getElementById('sj-grid');
  grid.innerHTML = Array(n).fill('<div class="sj-skeleton"></div>').join('');
  document.getElementById('sj-empty').style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.sj-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
}

function updateCounts() {
  const total     = allSavedJobs.length;
  const muon      = allSavedJobs.filter(j => j.collection === 'Muốn apply').length;
  const canNhac   = allSavedJobs.filter(j => j.collection === 'Đang cân nhắc').length;
  document.getElementById('count-all').textContent          = `(${total})`;
  document.getElementById('count-muon-apply').textContent   = `(${muon})`;
  document.getElementById('count-dang-can-nhac').textContent = `(${canNhac})`;
}

// ─────────────────────────────────────────────────────────────
// EXPIRY ALERT
// ─────────────────────────────────────────────────────────────
function checkExpiringJobs() {
  const expiring = allSavedJobs.filter(j => isExpiringSoon(j.expiresAt));
  const banner = document.getElementById('sj-expiry-alert');
  const badge  = document.getElementById('sj-bell-badge');

  if (expiring.length === 0) {
    banner.style.display = 'none';
    badge.style.display  = 'none';
    return;
  }

  badge.textContent    = expiring.length;
  badge.style.display  = 'flex';
  banner.style.display = 'flex';

  const names = expiring.slice(0, 2).map(j => `<strong>${escHtml(j.title)}</strong>`).join(', ');
  document.getElementById('sj-alert-title').innerHTML =
    `Cảnh báo: ${expiring.length} công việc sắp hết hạn ứng tuyển!`;
  document.getElementById('sj-alert-desc').innerHTML =
    `${names}${expiring.length > 2 ? ` và ${expiring.length - 2} vị trí khác` : ''} sẽ đóng đơn trong vòng 3 ngày tới.`;
}

function isExpiringSoon(expiresAt) {
  const days = (new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 3;
}

function scrollToExpiring() {
  const first = document.querySelector('[data-expiring="true"]');
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─────────────────────────────────────────────────────────────
// REMOVE SAVED JOB
// ─────────────────────────────────────────────────────────────
async function removeSaved(savedJobId) {
  if (!confirm('Bỏ lưu tin tuyển dụng này?')) return;
  try {
    const res = await apiFetchAuth(`/api/saved-jobs/${savedJobId}`, { method: 'DELETE' });
    if (!res) return;
    if (res.ok) {
      allSavedJobs = allSavedJobs.filter(j => j.savedJobId !== savedJobId);
      compareSet.delete(savedJobId);
      updateCounts();
      checkExpiringJobs();
      updateCompareBar();
      renderCards();
      showToast('Đã bỏ lưu tin tuyển dụng.', 'info');
    } else {
      const d = await res.json();
      showToast(d.message || 'Không thể bỏ lưu.', 'error');
    }
  } catch {
    showToast('Lỗi kết nối.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// CHANGE COLLECTION
// ─────────────────────────────────────────────────────────────
function toggleCollectionDropdown(e, savedJobId) {
  e.stopPropagation();
  document.querySelectorAll('.sj-collection-dropdown').forEach(d => {
    if (d.id !== `cd-${savedJobId}`) d.classList.remove('open');
  });
  document.getElementById(`cd-${savedJobId}`)?.classList.toggle('open');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.sj-collection-dropdown').forEach(d => d.classList.remove('open'));
});

async function changeCollection(e, savedJobId, collection) {
  e.stopPropagation();
  document.querySelectorAll('.sj-collection-dropdown').forEach(d => d.classList.remove('open'));

  try {
    const res = await apiFetchAuth(`/api/saved-jobs/${savedJobId}`, {
      method: 'PUT',
      body: JSON.stringify({ collection })
    });
    if (!res) return;
    if (res.ok) {
      const job = allSavedJobs.find(j => j.savedJobId === savedJobId);
      if (job) job.collection = collection;
      updateCounts();
      renderCards();
      showToast(`Đã chuyển sang nhóm "${collection}".`, 'success');
    } else {
      const d = await res.json();
      showToast(d.message || 'Không thể cập nhật nhóm.', 'error');
    }
  } catch {
    showToast('Lỗi kết nối.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// APPLY (navigate to job detail)
// ─────────────────────────────────────────────────────────────
function applyJob(savedJobId) {
  const job = allSavedJobs.find(j => j.savedJobId === savedJobId);
  if (job) window.location.href = `job-detail.html?id=${job.jobPostId}`;
}

// ─────────────────────────────────────────────────────────────
// COMPARE
// ─────────────────────────────────────────────────────────────
function toggleCompare(savedJobId, checkbox) {
  if (checkbox.checked) {
    if (compareSet.size >= 2) {
      checkbox.checked = false;
      showToast('Chỉ có thể so sánh tối đa 2 vị trí cùng lúc.', 'info');
      return;
    }
    compareSet.add(savedJobId);
  } else {
    compareSet.delete(savedJobId);
  }
  updateCompareBar();
}

function updateCompareBar() {
  const bar = document.getElementById('sj-compare-bar');
  const cnt = document.getElementById('sj-compare-count');
  if (compareSet.size > 0) {
    bar.classList.add('visible');
    cnt.textContent = `${compareSet.size} vị trí được chọn`;
  } else {
    bar.classList.remove('visible');
  }
}

function clearCompare() {
  compareSet.clear();
  updateCompareBar();
  document.querySelectorAll('.sj-compare-checkbox').forEach(cb => cb.checked = false);
}

function openCompareModal() {
  if (compareSet.size < 2) {
    showToast('Hãy chọn ít nhất 2 vị trí để so sánh.', 'info');
    return;
  }
  const jobs = [...compareSet].map(id => allSavedJobs.find(j => j.savedJobId === id)).filter(Boolean);
  buildCompareTable(jobs);
  document.getElementById('sj-compare-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCompareModal() {
  document.getElementById('sj-compare-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function handleModalBackdrop(e) {
  if (e.target === document.getElementById('sj-compare-modal')) closeCompareModal();
}

function buildCompareTable(jobs) {
  const table = document.getElementById('sj-compare-table');

  const jobHeaders = jobs.map(j => {
    const logoHtml = j.companyLogo
      ? `<img src="${j.companyLogo}" alt="${escHtml(j.companyName)}">`
      : `<span>${getInitials(j.companyName)}</span>`;
    return `
      <th class="sj-compare-job-header">
        <div class="sj-compare-job-thumb">
          <div class="logo-sm">${logoHtml}</div>
          <strong>${escHtml(j.title)}</strong>
          <span>${escHtml(j.companyName)}</span>
        </div>
      </th>`;
  }).join('');

  const salaryRow = jobs.map(j =>
    `<td class="sj-salary-cell">${formatSalary(j.minSalary, j.maxSalary)}</td>`
  ).join('');

  const skillsRow = jobs.map(j => {
    const tags = parseSkills(j.requirements).slice(0, 5)
      .map(s => `<span class="sj-skill-tag">${escHtml(s)}</span>`).join('');
    return `<td><div class="sj-skill-tags">${tags || '<span style="color:#94a3b8">—</span>'}</div></td>`;
  }).join('');

  const benefitRow = jobs.map(j => {
    const items = parseBullets(j.benefits).slice(0, 4)
      .map(b => `<li>${escHtml(b)}</li>`).join('');
    return `<td><ul class="sj-benefit-list">${items || '<li style="color:#94a3b8">—</li>'}</ul></td>`;
  }).join('');

  const locationRow = jobs.map(j =>
    `<td>${escHtml(j.location)}</td>`
  ).join('');

  const deadlineRow = jobs.map(j => {
    const urgent = isExpiringSoon(j.expiresAt);
    return `<td style="color:${urgent ? '#dc2626' : '#475569'};font-weight:${urgent ? 700 : 400}">
      ${formatDeadline(j.expiresAt)}</td>`;
  }).join('');

  const applyRow = jobs.map(j =>
    `<td><button class="sj-btn-apply" style="max-width:180px" onclick="applyJob('${j.savedJobId}')">
      <i class="fa-solid fa-paper-plane"></i> Ứng tuyển
    </button></td>`
  ).join('');

  table.innerHTML = `
    <thead><tr>
      <th style="width:140px">Tiêu chí</th>
      ${jobHeaders}
    </tr></thead>
    <tbody>
      <tr><td>Mức lương</td>${salaryRow}</tr>
      <tr><td>Kỹ năng yêu cầu</td>${skillsRow}</tr>
      <tr><td>Phúc lợi</td>${benefitRow}</tr>
      <tr><td>Địa điểm</td>${locationRow}</tr>
      <tr><td>Hết hạn</td>${deadlineRow}</tr>
      <tr><td></td>${applyRow}</tr>
    </tbody>
  `;
}

// ─────────────────────────────────────────────────────────────
// SORT
// ─────────────────────────────────────────────────────────────
let sortAsc = false;
function toggleSort() {
  sortAsc = !sortAsc;
  allSavedJobs.sort((a, b) => {
    const da = new Date(a.expiresAt), db = new Date(b.expiresAt);
    return sortAsc ? da - db : db - da;
  });
  renderCards();
  showToast(sortAsc ? 'Sắp xếp: sắp hết hạn lên đầu' : 'Sắp xếp: mới lưu lên đầu', 'info');
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: saveJobFromDetail – gọi từ trang job-detail
// ─────────────────────────────────────────────────────────────
async function saveJobFromDetail(jobPostId, collection = 'Tất cả') {
  const res = await apiFetchAuth('/api/saved-jobs', {
    method: 'POST',
    body: JSON.stringify({ jobPostId, collection })
  });
  if (!res) return { ok: false };
  const data = await res.json();
  return { ok: res.ok, data, message: data.message };
}

async function unsaveJobFromDetail(savedJobId) {
  const res = await apiFetchAuth(`/api/saved-jobs/${savedJobId}`, { method: 'DELETE' });
  if (!res) return { ok: false };
  return { ok: res.ok };
}

async function checkJobSaved(jobPostId) {
  const res = await apiFetchAuth(`/api/saved-jobs/check/${jobPostId}`);
  if (!res) return null;
  const data = await res.json();
  return data?.data;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function formatSalary(min, max) {
  if (!min && !max) return 'Thỏa thuận';
  const fmt = v => {
    if (v >= 1000) return `$${(v/1000).toFixed(v%1000===0?0:1)}k`;
    return `$${v}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min)        return `Từ ${fmt(min)}`;
  return `Đến ${fmt(max)}`;
}

function formatDeadline(expiresAt) {
  const d    = new Date(expiresAt);
  const days = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0)  return 'Đã hết hạn';
  if (days === 0) return 'Hết hạn hôm nay';
  if (days <= 3)  return `${days} ngày nữa`;
  return `${d.getDate()} Th${d.getMonth()+1}, ${d.getFullYear()}`;
}

function parseSkills(requirements) {
  if (!requirements) return [];
  // Tách theo dấu phẩy, xuống dòng hoặc dấu chấm phẩy
  return requirements.split(/[,;\n•\-]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
}

function parseBullets(text) {
  if (!text) return [];
  return text.split(/[;\n•\-]/).map(s => s.trim()).filter(s => s.length > 2);
}

function getInitials(name) {
  if (!name) return '?';
  const w = name.trim().split(' ').filter(x => x);
  if (w.length === 1) return w[0][0].toUpperCase();
  return (w[0][0] + w[w.length-1][0]).toUpperCase();
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('sj-toast');
  if (!t) return;
  const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  t.className = `sj-toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${escHtml(msg)}`;
  t.style.display = 'flex';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}
