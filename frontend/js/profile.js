'use strict';
// ============================================================
// profile.js — Candidate Profile Page
// ============================================================

// ── In-memory state ──────────────────────────────────────────
let _skills = [];   // [{name, level}]
let _hasPassword = true;
let _exp    = [];   // [{id,position,company,from,to,current,desc}]
let _edu    = [];   // [{id,degree,school,from,to,gpa}]

const LEVEL_CONFIG = {
    beginner:     { label: 'Mới bắt đầu', pct: 25 },
    intermediate: { label: 'Trung bình',  pct: 50 },
    advanced:     { label: 'Thành thạo',  pct: 75 },
    expert:       { label: 'Chuyên gia',  pct: 100 }
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    if (!user.token) { window.location.href = 'auth.html#login'; return; }

    // Điền email (readonly)
    const emailEl = document.getElementById('pf-email');
    if (emailEl) emailEl.value = user.email || '';

    // Avatar upload
    const avatarInput = document.getElementById('pf-avatar-input');
    if (avatarInput) avatarInput.addEventListener('change', handleAvatarUpload);

    // CV upload — click chỉ trên zone background, không phải button con
    const cvInput = document.getElementById('pf-cv-input');
    if (cvInput) cvInput.addEventListener('change', handleCvUpload);
    const cvZone = document.getElementById('pf-cv-zone');
    if (cvZone) cvZone.addEventListener('click', (ev) => {
        // Bỏ qua nếu click vào button bên trong (button tự xử lý)
        if (ev.target.closest('button, a')) return;
        cvInput?.click();
    });

    // Skill level picker
    initLevelPicker();

    const isRecruiter = (sessionStorage.getItem('role') || '') === 'Recruiter';
    if (isRecruiter) applyRecruiterMode();

    // Gắn inline counter cho tất cả các trường có giới hạn ký tự
    ['pf-phone', 'pf-location', 'pf-linkedin', 'pf-github', 'pf-portfolio',
     'skill-name', 'exp-position', 'exp-company', 'exp-desc',
     'edu-degree', 'edu-school', 'edu-gpa'
    ].forEach(id => attachInlineCounter(document.getElementById(id)));
    if (!isRecruiter) attachInlineCounter(document.getElementById('pf-bio'));

    await loadProfile();
    initScrollHighlight();
});

function applyRecruiterMode() {
    // ── 1. Ẩn toàn bộ sidebar ──────────────────────────────
    const sidebar = document.querySelector('.pf-sidebar');
    if (sidebar) sidebar.style.display = 'none';

    // ── 2. Bỏ margin-left của main (sidebar đã ẩn) ─────────
    const main = document.querySelector('.pf-main');
    if (main) main.style.marginLeft = '0';

    // ── 3. Di chuyển avatar vào banner, căn giữa ──────────
    const avatarWrap = document.querySelector('.pf-avatar-wrap');
    const banner     = document.querySelector('.pf-banner');
    if (avatarWrap && banner) {
        avatarWrap.style.cssText = 'border-bottom:none; padding-bottom:0; width:auto;';

        const ring = avatarWrap.querySelector('.pf-avatar-ring');
        const img  = avatarWrap.querySelector('#pf-avatar-img');
        if (ring) { ring.style.width = '110px'; ring.style.height = '110px'; }
        if (img)  { img.style.width  = '110px'; img.style.height  = '110px'; }

        const nameEl = avatarWrap.querySelector('#pf-header-name');
        if (nameEl) {
            nameEl.style.fontSize   = '22px';
            nameEl.style.fontWeight = '800';
            nameEl.style.marginTop  = '10px';
        }

        banner.insertBefore(avatarWrap, banner.firstChild);
        Object.assign(banner.style, {
            flexDirection: 'column',
            alignItems:    'center',
            textAlign:     'center',
            padding:       '32px 24px',
        });
    }

    // Ẩn pf-banner-left (tên đã hiện trong avatar wrap)
    const bannerLeft = document.querySelector('.pf-banner-left');
    if (bannerLeft) bannerLeft.style.display = 'none';

    // Chuyển form đổi mật khẩu và button xuống dưới cùng của main
    const bannerRight = document.querySelector('.pf-banner-right');
    const chpwCard    = document.getElementById('pf-chpw-card');
    if (bannerRight && main) {
        Object.assign(bannerRight.style, {
            justifyContent: 'flex-end',
            paddingTop:     '8px',
        });
        if (chpwCard) main.appendChild(chpwCard);
        main.appendChild(bannerRight);
    }

    // ── 4. Ẩn các section không cần cho recruiter ──────────
    ['sec-skills', 'sec-exp', 'sec-edu', 'sec-social', 'sec-cv'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // ── 5. Ẩn trường Trạng thái tìm việc & Địa chỉ ────────
    const jobStatusField = document.getElementById('pf-jobstatus')?.closest('.pf-field');
    if (jobStatusField) jobStatusField.style.display = 'none';

    const locationField = document.getElementById('pf-location')?.closest('.pf-field');
    if (locationField) locationField.style.display = 'none';

    // ── 6. Đổi trường Bio → Chức danh / Vị trí ────────────
    const bio = document.getElementById('pf-bio');
    if (bio) {
        const bioField = bio.closest('.pf-field');
        if (bioField) {
            bioField.classList.remove('pf-field-full');
            const lbl = bioField.querySelector('label');
            if (lbl) lbl.textContent = 'CHỨC DANH / VỊ TRÍ';
            const ctr = bioField.querySelector('.pf-counter');
            if (ctr) ctr.style.display = 'none';
        }
        bio.placeholder = 'VD: HR Manager, Talent Acquisition';
        bio.maxLength   = 100;
        bio.rows        = 1;
        bio.style.resize   = 'none';
        bio.style.overflow = 'hidden';

        // Khớp chiều cao với các input khác
        const refInput = document.getElementById('pf-phone');
        if (refInput) {
            const h = refInput.offsetHeight + 'px';
            bio.style.height    = h;
            bio.style.minHeight = h;
        }

        attachInlineCounter(bio, { inputStyle: true });
    }
}

// ── Load profile from API ────────────────────────────────────
async function loadProfile() {
    try {
        const res  = await apiFetchAuth('/api/profile/me');
        if (!res?.ok) return;
        const data = await res.json();
        const p    = data?.data;
        if (!p) return;

        // Basic info
        setVal('pf-fullname', p.displayName || '');
        updateNameCounter(document.getElementById('pf-fullname'));
        setVal('pf-phone',    p.phone || '');
        setVal('pf-location', p.location || '');
        setVal('pf-bio',      p.bio || '');

        // Cập nhật inline counters sau khi load dữ liệu
        ['pf-phone', 'pf-location', 'pf-bio', 'pf-linkedin', 'pf-github', 'pf-portfolio']
            .forEach(id => document.getElementById(id)?.dispatchEvent(new Event('input')));

        const statusEl = document.getElementById('pf-jobstatus');
        if (statusEl) statusEl.value = p.jobStatus || 'Seeking';

        // Header + banner
        const name  = p.displayName || getCurrentUser().fullName || 'Ứng viên';
        const title = buildSubtitle(p);
        setText('pf-header-name', name);
        setText('pf-banner-name', name);
        setText('pf-banner-title', title);

        // Avatar
        if (p.avatarUrl) {
            document.getElementById('pf-avatar-img').src = p.avatarUrl;
        } else {
            document.getElementById('pf-avatar-img').src =
                `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff&size=150`;
        }

        // Social links
        const social = safeParseJSON(p.socialLinks, {});
        setVal('pf-linkedin',  social.linkedin  || '');
        setVal('pf-github',    social.github    || '');
        setVal('pf-portfolio', social.portfolio || '');

        // Skills
        _skills = safeParseJSON(p.skills, []);
        renderSkills();

        // Experience
        _exp = safeParseJSON(p.experience, []);
        renderExp();

        // Education
        _edu = safeParseJSON(p.education, []);
        renderEdu();

        // CV
        if (p.cvUrl) await showCurrentCv(p.cvUrl);

        // Trạng thái mật khẩu (OAuth vs email)
        _hasPassword = p.hasPassword !== false;

    } catch (e) {
        console.error('Lỗi load profile:', e);
    }
}

function buildSubtitle(p) {
    if ((sessionStorage.getItem('role') || '') === 'Recruiter') {
        return p.bio || 'Nhà tuyển dụng';
    }
    const parts = [];
    if (p.experience) {
        try {
            const exps = JSON.parse(p.experience);
            if (exps?.length) parts.push(exps[0].position || '');
        } catch (_) {}
    }
    if (p.location) parts.push(p.location);
    return parts.filter(Boolean).join(' • ') || 'Cập nhật thông tin của bạn';
}

// ── Save profile ─────────────────────────────────────────────
async function saveProfile() {
    const isRecruiter = (sessionStorage.getItem('role') || '') === 'Recruiter';
    const btn = document.getElementById('pf-save-btn');
    const name = (document.getElementById('pf-fullname')?.value || '').trim();
    if (!name) { showToast('Vui lòng nhập họ và tên!', 'error'); return; }

    const bio = document.getElementById('pf-bio')?.value || '';
    const bioMax = isRecruiter ? 100 : 500;
    if (bio.length > bioMax) {
        showToast(isRecruiter ? 'Chức danh tối đa 100 ký tự!' : 'Giới thiệu tối đa 500 ký tự!', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    const social = {
        linkedin:  (document.getElementById('pf-linkedin')?.value  || '').trim(),
        github:    (document.getElementById('pf-github')?.value    || '').trim(),
        portfolio: (document.getElementById('pf-portfolio')?.value || '').trim(),
    };

    const payload = {
        displayName: name,
        bio,
        phone:       (document.getElementById('pf-phone')?.value    || '').trim(),
        location:    (document.getElementById('pf-location')?.value || '').trim(),
        jobStatus:   document.getElementById('pf-jobstatus')?.value || (isRecruiter ? 'NotSeeking' : 'Seeking'),
        skills:      JSON.stringify(_skills),
        experience:  JSON.stringify(_exp),
        education:   JSON.stringify(_edu),
        socialLinks: JSON.stringify(social),
    };

    try {
        const res  = await apiFetchAuth('/api/profile/me', { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res?.json();

        if (res?.ok) {
            sessionStorage.setItem('fullName', name);
            showToast('Lưu hồ sơ thành công!', 'success');

            const title = isRecruiter ? bio : buildSubtitle({ experience: payload.experience, location: payload.location });
            setText('pf-header-name', name);
            setText('pf-banner-name', name);
            setText('pf-banner-title', title);

            if (typeof renderNavRight === 'function') renderNavRight();
        } else {
            showToast('Lỗi: ' + (data?.message || 'Không thể lưu hồ sơ'), 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Lưu thay đổi';
    }
}

// ── Bio counter ───────────────────────────────────────────────
function updateBioCounter() {
    const el  = document.getElementById('pf-bio');
    const cnt = document.getElementById('pf-bio-count');
    const ctr = el?.parentElement?.querySelector('.pf-counter');
    if (!el || !cnt) return;
    const len = el.value.length;
    const max = parseInt(el.maxLength) || 500;
    cnt.textContent = len;
    if (ctr) {
        ctr.className = 'pf-counter' + (len > max ? ' over' : len > max * 0.84 ? ' warn' : '');
    }
}

// ── Skills ────────────────────────────────────────────────────
function renderSkills() {
    const el = document.getElementById('pf-skills-list');
    if (!el) return;
    if (!_skills.length) {
        el.innerHTML = '<p class="pf-empty-hint">Chưa có kỹ năng nào. Nhấn "+ Thêm kỹ năng" để bắt đầu.</p>';
        return;
    }
    el.innerHTML = _skills.map((s, i) => {
        const cfg = LEVEL_CONFIG[s.level] || LEVEL_CONFIG.intermediate;
        return `<div class="pf-skill-row">
            <span class="pf-skill-name">${esc(s.name)}</span>
            <span class="pf-skill-level-label">${cfg.label}</span>
            <div class="pf-skill-bar-wrap">
                <div class="pf-skill-bar" style="width:${cfg.pct}%;"></div>
            </div>
            <div class="pf-skill-actions">
                <button class="pf-icon-btn" onclick="openSkillModal(${i})" title="Sửa">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="pf-icon-btn del" onclick="deleteSkill(${i})" title="Xóa">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

function openSkillModal(editIndex) {
    const isEdit = editIndex !== undefined;
    document.getElementById('skill-modal-title').textContent = isEdit ? 'Chỉnh sửa kỹ năng' : 'Thêm kỹ năng';
    document.getElementById('skill-edit-index').value = isEdit ? editIndex : '';

    const s = isEdit ? _skills[editIndex] : null;
    setVal('skill-name', s?.name || '');
    setLevelPicker(s?.level || 'beginner');

    document.getElementById('skill-name')?.dispatchEvent(new Event('input'));
    document.getElementById('modal-skill').classList.add('show');
    document.getElementById('skill-name').focus();
}

function saveSkill() {
    const name  = (document.getElementById('skill-name')?.value || '').trim();
    if (!name) { showToast('Vui lòng nhập tên kỹ năng!', 'error'); return; }

    const level = document.querySelector('#skill-level-picker .pf-level-btn.active')?.dataset.value || 'intermediate';
    const idx   = document.getElementById('skill-edit-index').value;

    if (idx !== '') {
        _skills[parseInt(idx)] = { name, level };
    } else {
        if (_skills.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            showToast('Kỹ năng này đã tồn tại!', 'error'); return;
        }
        _skills.push({ name, level });
    }

    renderSkills();
    closeModal('modal-skill');
}

function deleteSkill(i) {
    _skills.splice(i, 1);
    renderSkills();
}

// Level picker
function initLevelPicker() {
    document.querySelectorAll('#skill-level-picker .pf-level-btn').forEach(btn => {
        btn.addEventListener('click', () => setLevelPicker(btn.dataset.value));
    });
}

function setLevelPicker(level) {
    document.querySelectorAll('#skill-level-picker .pf-level-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === level);
    });
    const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.intermediate;
    const preview = document.getElementById('skill-level-preview');
    if (preview) preview.innerHTML = `<div class="pf-level-preview-fill" style="width:${cfg.pct}%;"></div>`;
}

// ── Work Experience ───────────────────────────────────────────
function renderExp() {
    const el = document.getElementById('pf-exp-list');
    if (!el) return;
    if (!_exp.length) {
        el.innerHTML = '<p class="pf-empty-hint">Chưa có kinh nghiệm làm việc.</p>';
        return;
    }
    el.innerHTML = _exp.map((e, i) => {
        const period = formatPeriod(e.from, e.current ? null : e.to, e.current);
        return `<div class="pf-timeline-item">
            <div class="pf-timeline-icon"><i class="fa-solid fa-briefcase"></i></div>
            <div class="pf-timeline-body">
                <div class="pf-timeline-title">${esc(e.position)}</div>
                <div class="pf-timeline-subtitle">${esc(e.company)}</div>
                <div class="pf-timeline-period">${period}</div>
                ${e.desc ? `<div class="pf-timeline-desc">${esc(e.desc).replace(/\n/g,'<br>')}</div>` : ''}
            </div>
            <div class="pf-timeline-actions">
                <button class="pf-icon-btn" onclick="openExpModal(${i})"><i class="fa-solid fa-pen"></i></button>
                <button class="pf-icon-btn del" onclick="deleteExp(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function openExpModal(editIndex) {
    const isEdit = editIndex !== undefined;
    document.getElementById('exp-modal-title').textContent = isEdit ? 'Chỉnh sửa kinh nghiệm' : 'Thêm kinh nghiệm';
    document.getElementById('exp-edit-index').value = isEdit ? editIndex : '';

    const e = isEdit ? _exp[editIndex] : null;
    setVal('exp-position', e?.position || '');
    setVal('exp-company',  e?.company  || '');
    setVal('exp-from',     e?.from     || '');
    setVal('exp-to',       e?.to       || '');
    setVal('exp-desc',     e?.desc     || '');
    ['exp-position', 'exp-company', 'exp-desc'].forEach(id =>
        document.getElementById(id)?.dispatchEvent(new Event('input')));
    const cur = document.getElementById('exp-current');
    if (cur) { cur.checked = !!e?.current; toggleExpCurrent(cur); }

    document.getElementById('modal-exp').classList.add('show');
    document.getElementById('exp-position').focus();
}

function toggleExpCurrent(cb) {
    const toEl = document.getElementById('exp-to');
    if (toEl) { toEl.disabled = cb.checked; if (cb.checked) toEl.value = ''; }
}

function saveExp() {
    const position = (document.getElementById('exp-position')?.value || '').trim();
    const company  = (document.getElementById('exp-company')?.value  || '').trim();
    if (!position || !company) { showToast('Vui lòng nhập Chức vụ và Công ty!', 'error'); return; }

    const current  = !!document.getElementById('exp-current')?.checked;
    const entry = {
        id:       Date.now().toString(),
        position,
        company,
        from:     document.getElementById('exp-from')?.value || '',
        to:       current ? null : (document.getElementById('exp-to')?.value || ''),
        current,
        desc:     (document.getElementById('exp-desc')?.value || '').trim(),
    };

    const idx = document.getElementById('exp-edit-index').value;
    if (idx !== '') { entry.id = _exp[parseInt(idx)].id; _exp[parseInt(idx)] = entry; }
    else _exp.unshift(entry);

    renderExp();
    closeModal('modal-exp');
}

function deleteExp(i) {
    if (!confirm('Xóa kinh nghiệm này?')) return;
    _exp.splice(i, 1);
    renderExp();
}

// ── Education ─────────────────────────────────────────────────
function renderEdu() {
    const el = document.getElementById('pf-edu-list');
    if (!el) return;
    if (!_edu.length) {
        el.innerHTML = '<p class="pf-empty-hint">Chưa có thông tin học vấn.</p>';
        return;
    }
    el.innerHTML = _edu.map((e, i) => {
        const period = e.from && e.to ? `${e.from} – ${e.to}` : (e.from || '');
        const gpa    = e.gpa ? ` • GPA ${esc(e.gpa)}` : '';
        return `<div class="pf-timeline-item">
            <div class="pf-timeline-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <div class="pf-timeline-body">
                <div class="pf-timeline-title">${esc(e.degree)}</div>
                <div class="pf-timeline-subtitle">${esc(e.school)}</div>
                <div class="pf-timeline-period">${period}${gpa}</div>
            </div>
            <div class="pf-timeline-actions">
                <button class="pf-icon-btn" onclick="openEduModal(${i})"><i class="fa-solid fa-pen"></i></button>
                <button class="pf-icon-btn del" onclick="deleteEdu(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function openEduModal(editIndex) {
    const isEdit = editIndex !== undefined;
    document.getElementById('edu-modal-title').textContent = isEdit ? 'Chỉnh sửa học vấn' : 'Thêm học vấn';
    document.getElementById('edu-edit-index').value = isEdit ? editIndex : '';

    const e = isEdit ? _edu[editIndex] : null;
    setVal('edu-degree', e?.degree || '');
    setVal('edu-school', e?.school || '');
    setVal('edu-from',   e?.from   || '');
    setVal('edu-to',     e?.to     || '');
    setVal('edu-gpa',    e?.gpa    || '');
    ['edu-degree', 'edu-school', 'edu-gpa'].forEach(id =>
        document.getElementById(id)?.dispatchEvent(new Event('input')));

    document.getElementById('modal-edu').classList.add('show');
    document.getElementById('edu-degree').focus();
}

function saveEdu() {
    const degree = (document.getElementById('edu-degree')?.value || '').trim();
    const school = (document.getElementById('edu-school')?.value || '').trim();
    if (!degree || !school) { showToast('Vui lòng nhập Bằng cấp và Trường học!', 'error'); return; }

    const entry = {
        id:     Date.now().toString(),
        degree,
        school,
        from:   document.getElementById('edu-from')?.value || '',
        to:     document.getElementById('edu-to')?.value   || '',
        gpa:    (document.getElementById('edu-gpa')?.value || '').trim(),
    };

    const idx = document.getElementById('edu-edit-index').value;
    if (idx !== '') { entry.id = _edu[parseInt(idx)].id; _edu[parseInt(idx)] = entry; }
    else _edu.unshift(entry);

    renderEdu();
    closeModal('modal-edu');
}

function deleteEdu(i) {
    if (!confirm('Xóa thông tin học vấn này?')) return;
    _edu.splice(i, 1);
    renderEdu();
}

// ── Avatar upload ─────────────────────────────────────────────
async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Preview ngay lập tức
    const reader = new FileReader();
    reader.onload = ev => { document.getElementById('pf-avatar-img').src = ev.target.result; };
    reader.readAsDataURL(file);

    const loading = document.getElementById('pf-avatar-loading');
    loading.style.display = 'block';

    const fd = new FormData();
    fd.append('file', file);

    try {
        const token = sessionStorage.getItem('token');
        const res   = await fetch(`${API_URL}/api/profile/avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        const data = await res.json();
        if (res.ok && data.data?.avatarUrl) {
            sessionStorage.setItem('avatarUrl', data.data.avatarUrl);
            if (typeof renderNavRight === 'function') renderNavRight();
            showToast('Cập nhật ảnh đại diện thành công!', 'success');
        } else {
            showToast('Lỗi tải ảnh: ' + (data.message || ''), 'error');
        }
    } catch (_) {
        showToast('Lỗi kết nối khi tải ảnh!', 'error');
    } finally {
        loading.style.display = 'none';
        e.target.value = '';
    }
}

// ── CV upload ─────────────────────────────────────────────────
async function handleCvUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') { showToast('Chỉ hỗ trợ file PDF!', 'error'); return; }
    if (file.size > 5 * 1024 * 1024)    { showToast('File tối đa 5MB!', 'error'); return; }

    showCvLoading(true);
    const fd = new FormData();
    fd.append('file', file);

    let success = false;
    try {
        const token = sessionStorage.getItem('token');
        const res   = await fetch(`${API_URL}/api/profile/cv`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        const data = await res.json();
        if (res.ok && data.data?.cvUrl) {
            showCurrentCv(data.data.cvUrl, file.name);
            showToast('Tải lên CV thành công!', 'success');
            success = true;
        } else {
            showToast('Lỗi tải CV: ' + (data.message || ''), 'error');
        }
    } catch (_) {
        showToast('Lỗi kết nối khi tải CV!', 'error');
    } finally {
        // Chỉ hiện lại empty state khi upload thất bại
        if (!success) showCvLoading(false);
        else document.getElementById('pf-cv-loading').style.display = 'none';
        e.target.value = '';
    }
}

function handleCvDrop(e) {
    e.preventDefault();
    document.getElementById('pf-cv-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    const inp = document.getElementById('pf-cv-input');
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
}

function showCvLoading(on) {
    const zone = document.getElementById('pf-cv-zone');
    document.getElementById('pf-cv-empty').style.display    = on ? 'none' : 'block';
    document.getElementById('pf-cv-loading').style.display  = on ? 'block' : 'none';
    if (zone) zone.style.pointerEvents = on ? 'none' : 'auto';
}

async function showCurrentCv(url, filename) {
    document.getElementById('pf-cv-empty').style.display   = 'none';
    document.getElementById('pf-cv-loading').style.display = 'none';
    const cur = document.getElementById('pf-cv-current');
    if (!cur) return;
    cur.style.display = 'block';

    // Hiển thị tên file
    const fn = document.getElementById('pf-cv-filename');
    if (fn) {
        let name = filename;
        if (!name && url) {
            try {
                const parts = new URL(url).pathname.split('/');
                name = decodeURIComponent(parts[parts.length - 1]) || 'CV.pdf';
            } catch { name = 'CV.pdf'; }
        }
        fn.textContent = name || 'CV.pdf';
    }

    const meta = document.getElementById('pf-cv-updated');
    if (meta) meta.textContent = 'Cập nhật ' + new Date().toLocaleDateString('vi-VN');

    // Pre-fetch view URL rồi gán thẳng vào href — tránh hoàn toàn window.open và popup blocker
    const link = document.getElementById('pf-cv-link');
    if (link) {
        link.removeAttribute('href');
        link.onclick = null;
        try {
            const token = sessionStorage.getItem('token');
            const res   = await fetch(`${API_URL}/api/profile/cv/view`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.data?.url) {
                link.href   = data.data.url;
                link.target = '_blank';
                link.rel    = 'noopener noreferrer';
            }
        } catch {
            link.onclick = (e) => { e.preventDefault(); showToast('Lỗi kết nối khi tải link CV', 'error'); };
        }
    }

    // Download — fetch khi click rồi trigger anchor (không phải window.open, không bị chặn)
    const download = document.getElementById('pf-cv-download');
    if (download) {
        download.removeAttribute('href');
        download.onclick = async (e) => {
            e.preventDefault();
            try {
                const token = sessionStorage.getItem('token');
                const res   = await fetch(`${API_URL}/api/profile/cv/download`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.data?.url) {
                    const a = document.createElement('a');
                    a.href     = data.data.url;
                    a.download = fn?.textContent || 'CV.pdf';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    showToast('Không thể lấy link tải CV', 'error');
                }
            } catch {
                showToast('Lỗi kết nối khi tải CV', 'error');
            }
        };
    }
}

// ── Navigation scroll ─────────────────────────────────────────
function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return false;
}

function openPublicProfile() {
    const userId = sessionStorage.getItem('userId');
    if (!userId) { showToast('Không tìm thấy thông tin người dùng!', 'error'); return; }
    window.open(`profile-public.html?id=${encodeURIComponent(userId)}`, '_blank');
}

function copyPublicLink() {
    const userId = sessionStorage.getItem('userId');
    const base   = window.location.origin + '/pages/profile-public.html';
    const url    = userId ? `${base}?id=${encodeURIComponent(userId)}` : base;
    navigator.clipboard?.writeText(url)
        .then(() => showToast('Đã sao chép liên kết hồ sơ công khai!', 'success'))
        .catch(() => showToast('Không thể sao chép!', 'error'));
}

// ── Đổi mật khẩu ─────────────────────────────────────────────
function updateNameCounter(input) {
    const counter = document.getElementById('pf-name-counter');
    if (!counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/50`;
    counter.style.color = len >= 45 ? '#ef4444' : '#94a3b8';
}

function updateCounter(input, counterId) {
    const el  = document.getElementById(counterId);
    if (!el) return;
    const max = parseInt(input.maxLength) || 0;
    const len = input.value.length;
    el.textContent = len;
    el.style.color = len >= max * 0.9 ? '#ef4444' : '';
}

function togglePasswordForm() {
    const card = document.getElementById('pf-chpw-card');
    const isHidden = card.style.display === 'none';

    if (isHidden && !_hasPassword) {
        // Tài khoản OAuth — chỉ hiện thông báo, không hiện form
        card.innerHTML = `
            <div class="pf-chpw-oauth-notice">
                <div class="pf-chpw-oauth-icon"><i class="fa-brands fa-google"></i><i class="fa-brands fa-github"></i></div>
                <div>
                    <div class="pf-chpw-oauth-title">Không thể đổi mật khẩu</div>
                    <div class="pf-chpw-oauth-desc">Tài khoản của bạn đang đăng nhập qua <strong>Google</strong> hoặc <strong>GitHub</strong> và không có mật khẩu riêng. Vui lòng quản lý bảo mật trực tiếp trên nền tảng đó.</div>
                </div>
                <button class="pf-chpw-oauth-close" onclick="togglePasswordForm()" title="Đóng"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    card.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('pf-pw-current').focus();
    } else {
        document.getElementById('pf-pw-current').value = '';
        document.getElementById('pf-pw-new').value = '';
        document.getElementById('pf-pw-confirm').value = '';
        document.getElementById('pf-pw-strength').style.display = 'none';
    }
}

function togglePwVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
}

function checkPwStrength(val) {
    const bar   = document.getElementById('pf-pw-strength-bar');
    const label = document.getElementById('pf-pw-strength-label');
    const wrap  = document.getElementById('pf-pw-strength');
    if (!val) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
        { cls: 'weak',   text: 'Yếu' },
        { cls: 'weak',   text: 'Yếu' },
        { cls: 'fair',   text: 'Trung bình' },
        { cls: 'good',   text: 'Khá' },
        { cls: 'strong', text: 'Mạnh' },
        { cls: 'strong', text: 'Rất mạnh' },
    ];
    const lv = levels[score];
    bar.className = `pf-pw-strength-bar ${lv.cls}`;
    label.textContent = lv.text;
    label.className = lv.cls;
}

async function changePassword() {
    const current  = document.getElementById('pf-pw-current').value.trim();
    const newPw    = document.getElementById('pf-pw-new').value;
    const confirm  = document.getElementById('pf-pw-confirm').value;

    if (!current || !newPw || !confirm) { showToast('Vui lòng điền đầy đủ thông tin.', 'error'); return; }
    if (newPw.length < 6)               { showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error'); return; }
    if (newPw !== confirm)              { showToast('Mật khẩu xác nhận không khớp.', 'error'); return; }

    const btn = document.getElementById('pf-chpw-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    try {
        const res  = await apiFetchAuth('/api/profile/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword: current, newPassword: newPw })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi đổi mật khẩu');

        showToast('Đổi mật khẩu thành công!', 'success');
        togglePasswordForm();
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Xác nhận đổi mật khẩu';
    }
}

// ── Modal helpers ─────────────────────────────────────────────
function closeModal(id, e) {
    if (e && e.target !== document.getElementById(id)) return;
    document.getElementById(id)?.classList.remove('show');
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'success') {
    const el = document.getElementById('pf-toast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.className = `pf-toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msg}`;
    el.style.display = 'flex';
    _toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ── Utilities ─────────────────────────────────────────────────
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function esc(s) { if (!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function safeParseJSON(str, fallback) {
    if (!str || !str.trim()) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

function formatPeriod(from, to, current) {
    const fmt = d => {
        if (!d) return '';
        const [y, m] = d.split('-');
        const months = ['','Th01','Th02','Th03','Th04','Th05','Th06','Th07','Th08','Th09','Th10','Th11','Th12'];
        return m ? `${months[parseInt(m)] || m}/${y}` : y;
    };
    const start = fmt(from) || 'N/A';
    const end   = current ? 'Hiện tại' : (fmt(to) || '');

    if (!end) return start;

    // Tính thời lượng
    let dur = '';
    if (from) {
        const [fy, fm = '1'] = from.split('-').map(Number);
        const toDate = current ? new Date() : (to ? new Date(to + '-01') : null);
        if (toDate) {
            const months = (toDate.getFullYear() - fy) * 12 + (toDate.getMonth() + 1) - fm;
            const y = Math.floor(months / 12), m = months % 12;
            dur = ` (${y > 0 ? y + ' năm ' : ''}${m > 0 ? m + ' tháng' : ''})`;
        }
    }

    return `${start} – ${end}${dur}`;
}

function initScrollHighlight() {
    const observerOptions = {
        root: null,
        rootMargin: '-100px 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                document.querySelectorAll('.pf-nav-link').forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === '#' + id);
                });
            }
        });
    }, observerOptions);

    document.querySelectorAll('section.pf-card').forEach(section => {
        observer.observe(section);
    });
}
