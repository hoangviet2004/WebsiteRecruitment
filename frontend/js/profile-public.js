'use strict';
// profile-public.js — Trang hồ sơ công khai (read-only)

const LEVEL_MAP = {
    beginner:     { label: 'Mới bắt đầu', pct: 25 },
    intermediate: { label: 'Trung bình',  pct: 50 },
    advanced:     { label: 'Thành thạo',  pct: 75 },
    expert:       { label: 'Chuyên gia',  pct: 100 },
};

const STATUS_MAP = {
    Seeking:    { cls: 'seeking',    dot: 'seeking',    label: '🟢 Đang tìm kiếm' },
    Open:       { cls: 'open',       dot: 'open',       label: '🟡 Sẵn sàng nghe cơ hội' },
    NotSeeking: { cls: 'notseeking', dot: 'notseeking', label: '⚫ Không tìm kiếm' },
};

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof renderNavRight === 'function') renderNavRight();

    // Lấy userId từ URL ?id=xxx  hoặc sessionStorage (xem hồ sơ của chính mình)
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('id') || sessionStorage.getItem('userId');

    if (!userId) {
        showError();
        return;
    }

    try {
        const res  = await apiFetch(`/api/profile/public/${encodeURIComponent(userId)}`);
        const data = await res.json();

        if (!res.ok || !data?.data) { showError(); return; }

        render(data.data);
    } catch (e) {
        showError();
    }
});

function render(p) {
    // Avatar
    const name = p.displayName || 'Ứng viên';
    const avatarEl = document.getElementById('pub-avatar');
    avatarEl.src = p.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff&size=150`;
    avatarEl.onerror = () => {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff&size=150`;
    };

    // Name & title
    setText('pub-name', name);
    const expArr = safeJson(p.experience, []);
    const title  = expArr.length ? expArr[0].position : '';
    setText('pub-title', title);
    document.title = `${name} — TechList`;

    // Location
    if (p.location) {
        show('pub-location');
        setText('pub-location-text', p.location);
    }

    // Job status
    const st = STATUS_MAP[p.jobStatus] || STATUS_MAP.Seeking;
    const dot = document.getElementById('pub-status-dot');
    dot.className = `pub-status-dot ${st.dot}`;
    dot.title = st.label;

    const badge = document.getElementById('pub-status-badge');
    badge.className = `pub-seeking-badge ${st.cls}`;
    badge.textContent = st.label;
    badge.style.display = 'inline-flex';

    // CV button
    if (p.cvUrl) {
        const cvBtn = document.getElementById('pub-cv-btn');
        cvBtn.href = p.cvUrl;
        cvBtn.style.display = 'inline-flex';
    }

    // Bio
    if (p.bio?.trim()) {
        setText('pub-bio', p.bio.trim());
        show('pub-bio-card');
    }

    // Experience
    if (expArr.length) {
        document.getElementById('pub-exp-list').innerHTML = expArr.map(e => {
            const period = formatPeriod(e.from, e.current ? null : e.to, e.current);
            return `<div class="pub-timeline-item">
                <div class="pub-tl-icon"><i class="fa-solid fa-briefcase"></i></div>
                <div class="pub-tl-body">
                    <div class="pub-tl-title">${esc(e.position)}</div>
                    <div class="pub-tl-subtitle">${esc(e.company)}</div>
                    <div class="pub-tl-period">${period}</div>
                    ${e.desc ? `<div class="pub-tl-desc">${esc(e.desc).replace(/\n/g,'<br>')}</div>` : ''}
                </div>
            </div>`;
        }).join('');
        show('pub-exp-card');
    }

    // Education
    const eduArr = safeJson(p.education, []);
    if (eduArr.length) {
        document.getElementById('pub-edu-list').innerHTML = eduArr.map(e => {
            const period = e.from && e.to ? `${e.from} – ${e.to}` : (e.from || '');
            const gpa    = e.gpa ? ` • GPA ${esc(e.gpa)}` : '';
            return `<div class="pub-timeline-item">
                <div class="pub-tl-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                <div class="pub-tl-body">
                    <div class="pub-tl-title">${esc(e.degree)}</div>
                    <div class="pub-tl-subtitle">${esc(e.school)}</div>
                    <div class="pub-tl-period">${period}${gpa}</div>
                </div>
            </div>`;
        }).join('');
        show('pub-edu-card');
    }

    // Skills
    const skills = safeJson(p.skills, []);
    if (skills.length) {
        document.getElementById('pub-skills-list').innerHTML = skills.map(s => {
            const cfg = LEVEL_MAP[s.level] || LEVEL_MAP.intermediate;
            return `<div class="pub-skill-row">
                <span class="pub-skill-name">${esc(s.name)}</span>
                <span class="pub-skill-level">${cfg.label}</span>
                <div class="pub-skill-bar-track">
                    <div class="pub-skill-bar-fill" style="width:0" data-pct="${cfg.pct}"></div>
                </div>
            </div>`;
        }).join('');
        show('pub-skills-card');

        // Animate bars sau khi render
        requestAnimationFrame(() => {
            document.querySelectorAll('.pub-skill-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.pct + '%';
            });
        });
    }

    // Social links
    const social = safeJson(p.socialLinks, {});
    const links  = [
        social.linkedin  ? { cls: 'linkedin',  icon: 'fa-brands fa-linkedin-in',  label: 'LinkedIn',  href: normalizeUrl(social.linkedin) }  : null,
        social.github    ? { cls: 'github',    icon: 'fa-brands fa-github',        label: 'GitHub',    href: normalizeUrl(social.github) }    : null,
        social.portfolio ? { cls: 'portfolio', icon: 'fa-solid fa-globe',          label: 'Portfolio', href: normalizeUrl(social.portfolio) } : null,
    ].filter(Boolean);

    if (links.length) {
        document.getElementById('pub-social-list').innerHTML = links.map(l =>
            `<a href="${esc(l.href)}" target="_blank" rel="noopener" class="pub-social-link">
                <span class="pub-social-icon ${l.cls}"><i class="${l.icon}"></i></span>
                <span>${esc(displayUrl(l.href))}</span>
                <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto;font-size:11px;color:#94a3b8;"></i>
            </a>`
        ).join('');
        show('pub-social-card');
    }

    // Hiện content, ẩn skeleton
    document.getElementById('pub-skeleton').style.display = 'none';
    document.getElementById('pub-content').style.display  = 'block';
}

function showError() {
    document.getElementById('pub-skeleton').style.display = 'none';
    document.getElementById('pub-error').style.display    = 'flex';
}

function copyProfileLink() {
    const url = window.location.href;
    navigator.clipboard?.writeText(url)
        .then(() => showToast('Đã sao chép liên kết!'))
        .catch(() => showToast('Không thể sao chép!'));
}

// ── Helpers ───────────────────────────────────────────────────
function safeJson(str, fb) {
    if (!str?.trim()) return fb;
    try { return JSON.parse(str); } catch { return fb; }
}

function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt || ''; }
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }

function normalizeUrl(url) {
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}

function displayUrl(url) {
    return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function formatPeriod(from, to, current) {
    const fmt = d => {
        if (!d) return '';
        const [y, m] = d.split('-');
        return m ? `Th${parseInt(m).toString().padStart(2,'0')}/${y}` : y;
    };
    const s = fmt(from) || '';
    const e = current ? 'Hiện tại' : (fmt(to) || '');
    if (!s && !e) return '';
    if (!e) return s;
    if (!s) return e;

    let dur = '';
    if (from) {
        const [fy, fm = '1'] = from.split('-').map(Number);
        const end = current ? new Date() : (to ? new Date(to + '-01') : null);
        if (end) {
            const m = (end.getFullYear() - fy) * 12 + (end.getMonth() + 1) - fm;
            const y = Math.floor(m / 12), mo = m % 12;
            dur = ` (${y > 0 ? y + ' năm' : ''}${y > 0 && mo > 0 ? ' ' : ''}${mo > 0 ? mo + ' tháng' : ''})`;
        }
    }
    return `${s} – ${e}${dur}`;
}

let _toastTimer;
function showToast(msg) {
    const el = document.getElementById('pub-toast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.style.display = 'flex';
    _toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}
