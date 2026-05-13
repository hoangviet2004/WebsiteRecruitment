// ============================================================
// recruiterCalendar.js — Lịch phỏng vấn (tab-calendar)
// ============================================================

let _rcalYear, _rcalMonth, _rcalInterviews = [];

const _RCAL_MONTHS     = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const _RCAL_MONTHS_SHT = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

async function loadRecruiterCalendar() {
    if (!currentCompanyId) {
        document.getElementById('rcal-grid').innerHTML =
            '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#94a3b8;">Vui lòng tạo hồ sơ công ty trước.</div>';
        document.getElementById('rcal-upcoming-list').innerHTML =
            '<div class="rcal-empty"><i class="fa-solid fa-building" style="font-size:28px;"></i><p>Chưa có công ty.</p></div>';
        return;
    }

    document.getElementById('rcal-upcoming-list').innerHTML =
        '<div class="rcal-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    if (!_rcalYear) {
        const now = new Date();
        _rcalYear  = now.getFullYear();
        _rcalMonth = now.getMonth();
    }

    try {
        const res  = await apiFetchAuth(`/api/messaging/interviews/all?companyId=${currentCompanyId}`);
        const data = await res?.json();
        _rcalInterviews = data?.success ? (data.data || []) : [];
    } catch {
        _rcalInterviews = [];
    }

    _rcalRenderCalendar();
    _rcalRenderUpcoming();
}

function _rcalRenderCalendar() {
    document.getElementById('rcal-nav-label').textContent =
        `${_RCAL_MONTHS_SHT[_rcalMonth]} ${_rcalYear}`;

    const today       = new Date();
    const firstDay    = new Date(_rcalYear, _rcalMonth, 1).getDay();
    const daysInMonth = new Date(_rcalYear, _rcalMonth + 1, 0).getDate();
    const daysInPrev  = new Date(_rcalYear, _rcalMonth, 0).getDate();

    const ivByDay = {};
    _rcalInterviews.forEach(iv => {
        const d = new Date(iv.scheduledAt);
        if (d.getFullYear() === _rcalYear && d.getMonth() === _rcalMonth) {
            (ivByDay[d.getDate()] = ivByDay[d.getDate()] || []).push(iv);
        }
    });

    let html = '';

    for (let i = firstDay - 1; i >= 0; i--)
        html += `<div class="rcal-cell other-month"><div class="rcal-day">${daysInPrev - i}</div></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getDate() === d && today.getMonth() === _rcalMonth && today.getFullYear() === _rcalYear;
        const events  = ivByDay[d] || [];
        const MAX_SHOW = 2;
        const shown    = events.slice(0, MAX_SHOW);
        const overflow = events.length - MAX_SHOW;

        const evHtml = shown.map(iv =>
            `<div class="rcal-event" title="${_escRcal(iv.candidateName)} — ${_escRcal(iv.jobTitle)}">
                <i class="fa-solid fa-user-tie"></i> ${_escRcal(iv.candidateName)}
            </div>`
        ).join('');

        const moreHtml = overflow > 0
            ? `<div class="rcal-more" onclick="rcalShowDay(${_rcalYear},${_rcalMonth},${d})">+${overflow} khác</div>`
            : '';

        html += `<div class="rcal-cell${isToday ? ' today' : ''}${events.length ? ' has-event' : ''}">
            <div class="rcal-day">${d}</div>
            ${evHtml}${moreHtml}
        </div>`;
    }

    const total = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (let d = 1; d <= total - firstDay - daysInMonth; d++)
        html += `<div class="rcal-cell other-month"><div class="rcal-day">${d}</div></div>`;

    document.getElementById('rcal-grid').innerHTML = html;
}

function _rcalRenderUpcoming() {
    const now      = new Date();
    const upcoming = _rcalInterviews
        .filter(iv => new Date(iv.scheduledAt) >= now)
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
        .slice(0, 10);

    const list = document.getElementById('rcal-upcoming-list');

    if (!upcoming.length) {
        list.innerHTML = '<div class="rcal-empty"><i class="fa-regular fa-calendar-xmark"></i><p>Không có lịch phỏng vấn sắp tới.</p></div>';
        return;
    }

    list.innerHTML = upcoming.map(iv => {
        const d       = new Date(iv.scheduledAt);
        const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const joinBtn = iv.meetingLink
            ? `<a href="${_escRcal(iv.meetingLink)}" target="_blank" class="rcal-join-btn"><i class="fa-solid fa-video"></i> Tham gia</a>`
            : `<span class="rcal-join-btn disabled">Không có link</span>`;
        return `
            <div class="rcal-upcoming-item">
                <div class="rcal-upcoming-icon"><i class="fa-solid fa-user-tie"></i></div>
                <div class="rcal-upcoming-info">
                    <div class="rcal-upcoming-name">${_escRcal(iv.candidateName)}</div>
                    <div class="rcal-upcoming-job">${_escRcal(iv.jobTitle)}</div>
                    <div class="rcal-upcoming-time"><i class="fa-regular fa-clock"></i> ${dateStr}, ${timeStr} · ${iv.durationMinutes} phút</div>
                </div>
                ${joinBtn}
            </div>`;
    }).join('');
}

function rcalPrev() {
    if (--_rcalMonth < 0) { _rcalMonth = 11; _rcalYear--; }
    _rcalRenderCalendar();
}

function rcalNext() {
    if (++_rcalMonth > 11) { _rcalMonth = 0; _rcalYear++; }
    _rcalRenderCalendar();
}

function rcalShowDay(year, month, day) {
    const events = _rcalInterviews.filter(iv => {
        const d = new Date(iv.scheduledAt);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    }).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    document.getElementById('rcal-popover-overlay')?.remove();

    const dateLabel = new Date(year, month, day).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const items = events.map(iv => {
        const t = new Date(iv.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `<div class="rcal-pop-item">
            <div class="rcal-pop-time">${t}</div>
            <div class="rcal-pop-info">
                <div class="rcal-pop-name">${_escRcal(iv.candidateName)}</div>
                <div class="rcal-pop-job">${_escRcal(iv.jobTitle)}</div>
            </div>
            ${iv.meetingLink
                ? `<a href="${_escRcal(iv.meetingLink)}" target="_blank" class="rcal-pop-join"><i class="fa-solid fa-video"></i></a>`
                : ''}
        </div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'rcal-popover-overlay';
    overlay.className = 'rcal-pop-overlay';
    overlay.innerHTML = `
        <div class="rcal-popover">
            <div class="rcal-pop-header">
                <span>${dateLabel}</span>
                <button onclick="document.getElementById('rcal-popover-overlay').remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="rcal-pop-list">${items}</div>
        </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

function _escRcal(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Hook vào switchTab
(function patchSwitchTabCalendar() {
    const _orig = window.switchTab;
    window.switchTab = function(tabName, element) {
        _orig(tabName, element);
        if (tabName === 'calendar') loadRecruiterCalendar();
    };
})();
