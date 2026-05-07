'use strict';
// ============================================================
// candidate-messages.js — Candidate chat portal
// ============================================================

// ── State ─────────────────────────────────────────────────────
let _convs       = [];
let _activeAppId = null;
let _pollTimer   = null;
let _lastMsgId   = null;

// Pending decline context
let _declinePending = null; // { type: 'interview'|'offer', id: Guid }

const COLORS = ['#1d4ed8','#7c3aed','#db2777','#d97706','#059669','#dc2626'];
const _color = s => { let h=0; for(const c of (s||'')) h=c.charCodeAt(0)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length]; };
const _init  = n => { if(!n) return '?'; const p=n.trim().split(' '); return p.length===1?p[0].slice(0,2).toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase(); };

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('token');
    const role  = sessionStorage.getItem('role');
    if (!token || role !== 'Candidate') { window.location.href = 'auth.html#login'; return; }

    renderUserCard();
    loadConversations();
    pollUnread();
});

function renderUserCard() {
    const name = sessionStorage.getItem('fullName') || 'Ứng viên';
    const mail = sessionStorage.getItem('email') || '';
    const av   = sessionStorage.getItem('avatarUrl');
    const el   = document.getElementById('cm-user-card');
    el.innerHTML = av
        ? `<img src="${av}" alt=""><div><div class="cm-user-name">${esc(name)}</div><div class="cm-user-email">${esc(mail)}</div></div>`
        : `<div class="cm-conv-initials" style="background:${_color(name)};width:28px;height:28px;font-size:10px;">${_init(name)}</div>
           <div><div class="cm-user-name">${esc(name)}</div><div class="cm-user-email">${esc(mail)}</div></div>`;
}

// ── Conversations ───────────────────────────────────────────────
async function loadConversations() {
    try {
        const res  = await apiFetchAuth('/api/candidate/messages/conversations');
        const data = await safeJson(res);
        if (!res?.ok) throw new Error(data?.message || 'Lỗi');
        _convs = data?.data || [];
        renderConvList(_convs);
    } catch(e) {
        document.getElementById('cm-conv-list').innerHTML =
            `<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px;">${esc(e.message)}</div>`;
    }
}

function renderConvList(list) {
    const el = document.getElementById('cm-conv-list');
    if (!list.length) {
        el.innerHTML = `<div style="padding:40px 16px;text-align:center;color:#94a3b8;font-size:13px;">
            <i class="fa-regular fa-comments" style="font-size:36px;margin-bottom:12px;display:block;color:#cbd5e1;"></i>
            Chưa có tin nhắn nào.<br>Ứng tuyển để bắt đầu trò chuyện!
        </div>`;
        return;
    }
    el.innerHTML = list.map(c => {
        const isActive = c.applicationId === _activeAppId;
        const avHtml   = c.recruiterAvatar
            ? `<img src="${c.recruiterAvatar}" class="cm-conv-avatar" alt="">`
            : `<div class="cm-conv-initials" style="background:${_color(c.recruiterName)}">${_init(c.recruiterName)}</div>`;
        const time    = c.lastMessageAt ? relTime(new Date(c.lastMessageAt)) : '';
        const preview = previewText(c.lastMessage, c.lastMessageType);
        return `<div class="cm-conv-item ${isActive?'active':''} ${c.hasUnread?'unread':''}"
                     onclick="openConv('${c.applicationId}')"
                     id="citem-${c.applicationId}">
            ${avHtml}
            <div class="cm-conv-body">
                <div class="cm-conv-top">
                    <span class="cm-conv-name">${esc(c.recruiterName)}</span>
                    <span class="cm-conv-time">${time}</span>
                </div>
                <div class="cm-conv-job">${esc(c.jobTitle.slice(0,32))}${c.jobTitle.length>32?'…':''}</div>
                <div class="cm-conv-preview ${c.hasUnread?'unread-preview':''}">${preview}</div>
            </div>
            ${c.unreadCount > 0 ? '<span class="cm-unread-dot"></span>' : ''}
        </div>`;
    }).join('');
}

function filterConvs(q) {
    const lower = q.toLowerCase().trim();
    const list  = lower ? _convs.filter(c =>
        c.recruiterName.toLowerCase().includes(lower) ||
        c.jobTitle.toLowerCase().includes(lower) ||
        c.companyName.toLowerCase().includes(lower)
    ) : _convs;
    renderConvList(list);
}

function previewText(msg, type) {
    if (!msg) return '<em style="color:#94a3b8;">Chưa có tin nhắn</em>';
    if (type === 'interview_invite') return '📅 Lời mời phỏng vấn';
    if (type === 'offer')           return '🎉 Thư mời nhận việc';
    if (type === 'system_notify')   return '🔔 ' + msg.slice(0,50);
    return esc(msg.slice(0,60)) + (msg.length>60?'…':'');
}

// ── Open conversation ───────────────────────────────────────────
async function openConv(appId) {
    _activeAppId = appId;
    stopPoll();

    // Highlight active
    document.querySelectorAll('.cm-conv-item').forEach(el => {
        el.classList.toggle('active', el.id === `citem-${appId}`);
    });

    // Show thread UI
    document.getElementById('cm-thread-empty').style.display  = 'none';
    document.getElementById('cm-thread-header').style.display = 'flex';
    document.getElementById('cm-input-wrap').style.display    = 'block';
    document.getElementById('cm-panel-col').style.display     = 'flex';
    document.getElementById('cm-panel-col').style.flexDirection = 'column';

    await Promise.all([loadThread(appId), loadPanel(appId)]);
    apiFetchAuth(`/api/candidate/messages/thread/${appId}/read`, { method: 'POST' }).catch(()=>{});
    loadConversations();
    startPoll(appId);
}

// ── Load thread ─────────────────────────────────────────────────
async function loadThread(appId) {
    document.getElementById('cm-bubbles').innerHTML =
        '<div style="flex:1;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-spinner fa-spin" style="color:#3b82f6;font-size:20px;"></i></div>';

    try {
        const res  = await apiFetchAuth(`/api/candidate/messages/thread/${appId}`);
        const data = await safeJson(res);
        if (!res?.ok) throw new Error(data?.message || 'Lỗi');
        renderThread(data?.data || []);
        _lastMsgId = (data?.data || []).at(-1)?.id || null;
    } catch(e) {
        document.getElementById('cm-bubbles').innerHTML =
            `<div style="text-align:center;color:#ef4444;padding:24px;">${esc(e.message)}</div>`;
    }
}

function renderThread(msgs) {
    const myId    = sessionStorage.getItem('userId') || '';
    const bubbles = document.getElementById('cm-bubbles');

    if (!msgs.length) {
        bubbles.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#94a3b8;">
            <i class="fa-regular fa-comments" style="font-size:32px;color:#cbd5e1;"></i>
            <span style="font-size:13px;">Hãy gửi tin nhắn đầu tiên!</span></div>`;
        return;
    }

    let lastDate = '';
    bubbles.innerHTML = msgs.map(m => {
        const isMe  = m.isFromMe;
        const date  = new Date(m.sentAt).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
        const time  = new Date(m.sentAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
        let sep = '';
        if (date !== lastDate) { lastDate = date; sep = `<div class="cm-date-sep">${date}</div>`; }

        // Special types
        if (m.type === 'system_notify') {
            return `${sep}<div class="cm-system-msg"><i class="fa-solid fa-circle-info" style="color:#3b82f6;margin-right:5px;"></i>${esc(m.content)}</div>`;
        }
        if (m.type === 'interview_invite' && m.interviewCard) {
            return `${sep}${renderInterviewCard(m.interviewCard)}`;
        }
        if (m.type === 'offer' && m.offerCard) {
            return `${sep}${renderOfferCard(m.offerCard)}`;
        }

        // Normal bubble
        const avHtml = m.senderAvatar
            ? `<img src="${m.senderAvatar}" class="cm-bav" alt="">`
            : `<div class="cm-bav-init" style="background:${_color(m.senderName)}">${_init(m.senderName)}</div>`;

        const readMark = isMe && m.isRead ? ' <i class="fa-solid fa-check-double" style="color:#60a5fa;font-size:9px;"></i>' : '';
        const emailTag = m.type === 'email' ? '<i class="fa-regular fa-envelope" style="font-size:10px;margin-right:4px;opacity:.7;"></i>' : '';

        return `${sep}<div class="cm-bw ${isMe?'me':''}">
            ${isMe ? '' : avHtml}
            <div>
                ${!isMe ? `<div style="font-size:10px;color:#94a3b8;margin-bottom:3px;padding-left:2px;">${esc(m.senderName)}</div>` : ''}
                <div class="cm-bubble ${isMe?'me':'them'}">${emailTag}${esc(m.content).replace(/\n/g,'<br>')}</div>
                <div class="cm-bubble-meta">${time}${readMark}</div>
            </div>
            ${isMe ? avHtml : ''}
        </div>`;
    }).join('');

    bubbles.scrollTop = bubbles.scrollHeight;
}

// ── Interview card ──────────────────────────────────────────────
function renderInterviewCard(iv) {
    const dt      = new Date(iv.scheduledAt);
    const dateStr = dt.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const timeStr = dt.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    const dur     = `${timeStr} · ${iv.durationMinutes} phút`;
    const isPending = iv.candidateResponse === 'Pending' && iv.scheduleStatus === 'Scheduled';

    const btns = isPending
        ? `<div class="cm-card-btns">
               <button class="cm-btn-accept" onclick="respondInterview('${iv.scheduleId}','Accepted')">
                   <i class="fa-solid fa-check"></i> Xác nhận
               </button>
               <button class="cm-btn-decline" onclick="promptDecline('interview','${iv.scheduleId}')">
                   <i class="fa-solid fa-xmark"></i> Từ chối
               </button>
           </div>`
        : `<div class="cm-card-responded ${iv.candidateResponse === 'Accepted' ? 'accepted' : 'declined'}">
               <i class="fa-solid fa-${iv.candidateResponse === 'Accepted' ? 'check-circle' : 'times-circle'}"></i>
               ${iv.candidateResponse === 'Accepted' ? 'Bạn đã xác nhận tham gia' : 'Bạn đã từ chối'}
           </div>`;

    const linkHtml = iv.meetingLink
        ? `<div class="cm-card-row"><i class="fa-solid fa-video"></i>
               <a href="${iv.meetingLink}" target="_blank" style="color:#3b82f6;font-size:13px;font-weight:600;">Tham gia Meeting</a>
           </div>` : '';

    return `<div style="display:flex;${iv.isFromMe?'justify-content:flex-end;':''}">
        <div class="cm-interview-card">
            <div class="cm-card-header">
                <div class="cm-card-header-icon"><i class="fa-solid fa-calendar-check"></i></div>
                📅 Lời mời phỏng vấn
            </div>
            <div class="cm-card-rows">
                <div class="cm-card-row"><i class="fa-solid fa-briefcase"></i>${esc(iv.jobTitle)}</div>
                <div class="cm-card-row"><i class="fa-solid fa-calendar"></i>${dateStr}</div>
                <div class="cm-card-row"><i class="fa-regular fa-clock"></i>${dur}</div>
                ${iv.location ? `<div class="cm-card-row"><i class="fa-solid fa-location-dot"></i>${esc(iv.location)}</div>` : ''}
                ${linkHtml}
                ${iv.notes ? `<div class="cm-card-row"><i class="fa-solid fa-note-sticky"></i>${esc(iv.notes)}</div>` : ''}
            </div>
            ${btns}
        </div>
    </div>`;
}

// ── Offer card ──────────────────────────────────────────────────
function renderOfferCard(offer) {
    const salary   = offer.salary ? offer.salary.toLocaleString('vi-VN') + ' VNĐ/tháng' : 'Thỏa thuận';
    const start    = offer.startDate ? new Date(offer.startDate).toLocaleDateString('vi-VN') : 'Thỏa thuận';
    const deadline = offer.responseDeadline ? new Date(offer.responseDeadline).toLocaleDateString('vi-VN') : '';
    const isPending = offer.status === 'Pending';

    const btns = isPending
        ? `<div class="cm-card-btns" style="flex-wrap:wrap;gap:6px;">
               <button class="cm-btn-offer-accept" onclick="respondOffer('${offer.offerId}','Accepted')">
                   <i class="fa-solid fa-check"></i> Chấp nhận
               </button>
               <button class="cm-btn-decline" onclick="promptDecline('offer','${offer.offerId}')">
                   <i class="fa-solid fa-xmark"></i> Từ chối
               </button>
               <button class="cm-btn-negotiate" onclick="respondOffer('${offer.offerId}','Negotiating')">
                   <i class="fa-regular fa-comments"></i> Thương lượng
               </button>
           </div>`
        : `<div class="cm-card-responded ${offer.status === 'Accepted' ? 'accepted' : 'declined'}">
               <i class="fa-solid fa-${offer.status === 'Accepted' ? 'check-circle' : offer.status === 'Negotiating' ? 'comments' : 'times-circle'}"></i>
               ${{ Accepted:'Bạn đã chấp nhận offer', Declined:'Bạn đã từ chối', Negotiating:'Đang thương lượng' }[offer.status] || offer.status}
           </div>`;

    return `<div style="display:flex;">
        <div class="cm-offer-card">
            <div class="cm-card-header">
                <div class="cm-card-header-icon"><i class="fa-solid fa-gift"></i></div>
                🎉 Thư mời nhận việc
            </div>
            <div class="cm-card-rows">
                <div class="cm-card-row"><i class="fa-solid fa-briefcase"></i>${esc(offer.jobTitle)} · ${esc(offer.companyName)}</div>
                <div class="cm-card-row"><i class="fa-solid fa-money-bill-wave"></i><strong style="color:#059669;">${salary}</strong></div>
                <div class="cm-card-row"><i class="fa-regular fa-calendar"></i>Ngày bắt đầu: ${start}</div>
                ${deadline ? `<div class="cm-card-row"><i class="fa-solid fa-hourglass-half"></i>Hạn phản hồi: ${deadline}</div>` : ''}
                ${offer.notes ? `<div class="cm-card-row"><i class="fa-solid fa-note-sticky"></i>${esc(offer.notes)}</div>` : ''}
            </div>
            ${btns}
        </div>
    </div>`;
}

// ── Load right panel ────────────────────────────────────────────
async function loadPanel(appId) {
    const panel = document.getElementById('cm-panel-col');
    panel.innerHTML = '<div style="padding:40px 16px;text-align:center;"><i class="fa-solid fa-spinner fa-spin" style="color:#3b82f6;font-size:20px;"></i></div>';

    try {
        const res  = await apiFetchAuth(`/api/candidate/messages/recruiter-panel/${appId}`);
        const data = await safeJson(res);
        if (!res?.ok) throw new Error();
        renderPanel(data?.data);
    } catch {
        panel.innerHTML = '';
    }
}

function renderPanel(d) {
    if (!d) return;
    const panel = document.getElementById('cm-panel-col');

    // Update thread header
    const thLeft = document.getElementById('cm-th-left');
    const avHtml = d.recruiterAvatar
        ? `<img src="${d.recruiterAvatar}" class="cm-th-avatar" alt="">`
        : `<div class="cm-th-initials" style="background:${_color(d.recruiterName)}">${_init(d.recruiterName)}</div>`;
    thLeft.innerHTML = `${avHtml}
        <div>
            <div class="cm-th-name">${esc(d.recruiterName)}</div>
            <div class="cm-th-sub">${esc(d.companyName)}</div>
        </div>`;

    const avLg = d.recruiterAvatar
        ? `<img src="${d.recruiterAvatar}" class="cm-recruiter-avatar" alt="">`
        : `<div class="cm-recruiter-initials" style="background:${_color(d.recruiterName)}">${_init(d.recruiterName)}</div>`;

    const status = `<span class="cm-app-status ${d.applicationStatus}">${statusLabel(d.applicationStatus)}</span>`;

    const ivSection = d.upcomingInterview ? `
        <div class="cm-panel-section">
            <div class="cm-panel-label"><i class="fa-solid fa-calendar-check" style="color:#3b82f6;margin-right:4px;"></i>Lịch phỏng vấn sắp tới</div>
            <div class="cm-iv-panel">
                <div class="cm-iv-label"><i class="fa-solid fa-calendar"></i>PHỎNG VẤN</div>
                <div class="cm-iv-date">${new Date(d.upcomingInterview.scheduledAt).toLocaleDateString('vi-VN',{day:'2-digit',month:'long',year:'numeric'})}</div>
                <div class="cm-iv-time"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${new Date(d.upcomingInterview.scheduledAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} · ${d.upcomingInterview.durationMinutes} phút</div>
                ${d.upcomingInterview.meetingLink ? `<a href="${d.upcomingInterview.meetingLink}" target="_blank" class="cm-iv-link"><i class="fa-brands fa-google" style="color:#ea4335;"></i>Tham gia cuộc họp <i class="fa-solid fa-arrow-right"></i></a>` : ''}
            </div>
        </div>` : '';

    const offerSection = d.pendingOffer ? `
        <div class="cm-panel-section">
            <div class="cm-panel-label">🎉 OFFER ĐANG CHỜ PHẢN HỒI</div>
            <div style="font-size:13px;color:#059669;font-weight:700;margin-bottom:6px;">
                ${d.pendingOffer.salary ? d.pendingOffer.salary.toLocaleString('vi-VN') + ' VNĐ/tháng' : 'Mức lương thỏa thuận'}
            </div>
            <div class="cm-panel-btns">
                <button class="cm-panel-btn primary" onclick="respondOffer('${d.pendingOffer.offerId}','Accepted')">
                    <i class="fa-solid fa-check"></i> Chấp nhận offer
                </button>
                <button class="cm-panel-btn ghost" onclick="respondOffer('${d.pendingOffer.offerId}','Negotiating')">
                    <i class="fa-regular fa-comments"></i> Thương lượng
                </button>
            </div>
        </div>` : '';

    panel.innerHTML = `
        <div class="cm-panel-section" style="background:linear-gradient(135deg,#f8fafc,#eff6ff);">
            <div class="cm-recruiter-card">
                ${avLg}
                <div>
                    <div class="cm-recruiter-name">${esc(d.recruiterName)}</div>
                    <div class="cm-recruiter-company">${esc(d.companyName)}</div>
                    <div class="cm-verified-badge"><i class="fa-solid fa-circle-check"></i> Xác minh</div>
                </div>
            </div>
            <div style="margin-bottom:10px;">${status}</div>
            <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">Vị trí ứng tuyển</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${esc(d.jobTitle)}</div>
        </div>
        ${ivSection}
        ${offerSection}
        <div class="cm-panel-section">
            <div class="cm-panel-label">HỒ SƠ NGƯỜI TUYỂN DỤNG</div>
            <div class="cm-recruiter-quote">"Chúng tôi tìm kiếm những ứng viên có đam mê và tư duy sáng tạo để cùng phát triển."</div>
            ${d.companyWebsite ? `<a href="${d.companyWebsite}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#3b82f6;font-weight:600;margin-top:10px;text-decoration:none;"><i class="fa-solid fa-globe"></i>Xem trang công ty</a>` : ''}
        </div>`;
}

// ── Send message ────────────────────────────────────────────────
async function sendMsg() {
    const ta    = document.getElementById('cm-input');
    const btn   = document.getElementById('cm-send-btn');
    const text  = ta.value.trim();
    if (!text || !_activeAppId) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res  = await apiFetchAuth('/api/candidate/messages/send', {
            method: 'POST',
            body: JSON.stringify({ applicationId: _activeAppId, content: text, type: 'message' })
        });
        const data = await safeJson(res);
        if (!res?.ok) throw new Error(data?.message || 'Lỗi');
        ta.value = '';
        ta.style.height = 'auto';
        await loadThread(_activeAppId);
        loadConversations();
    } catch(e) {
        showToast('Không gửi được tin nhắn: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
}

function handleKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendMsg();
    }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ── Interview response ──────────────────────────────────────────
async function respondInterview(scheduleId, response, reason) {
    try {
        const res  = await apiFetchAuth(`/api/candidate/messages/interviews/${scheduleId}/respond`, {
            method: 'POST',
            body: JSON.stringify({ response, declineReason: reason || null })
        });
        const data = await safeJson(res);
        if (!res?.ok) throw new Error(data?.message || 'Lỗi');
        showToast(response === 'Accepted' ? '✅ Đã xác nhận tham gia phỏng vấn!' : '❌ Đã từ chối lịch phỏng vấn', response === 'Accepted' ? 'success' : 'info');
        await loadThread(_activeAppId);
        loadPanel(_activeAppId);
    } catch(e) {
        showToast('Lỗi: ' + e.message, 'error');
    }
}

// ── Offer response ──────────────────────────────────────────────
async function respondOffer(offerId, response, reason) {
    try {
        const res  = await apiFetchAuth(`/api/candidate/messages/offers/${offerId}/respond`, {
            method: 'POST',
            body: JSON.stringify({ response, declineReason: reason || null })
        });
        const data = await safeJson(res);
        if (!res?.ok) throw new Error(data?.message || 'Lỗi');
        const msgs = { Accepted: '🎉 Chúc mừng! Bạn đã chấp nhận offer!', Declined: '❌ Đã từ chối offer', Negotiating: '💬 Yêu cầu thương lượng đã được gửi!' };
        showToast(msgs[response] || 'Đã phản hồi', response === 'Accepted' ? 'success' : 'info');
        await loadThread(_activeAppId);
        loadPanel(_activeAppId);
    } catch(e) {
        showToast('Lỗi: ' + e.message, 'error');
    }
}

// ── Decline modal ───────────────────────────────────────────────
function promptDecline(type, id) {
    _declinePending = { type, id };
    const titles = { interview: 'Từ chối lịch phỏng vấn', offer: 'Từ chối offer' };
    document.getElementById('cm-decline-title').textContent = titles[type] || 'Từ chối';
    document.getElementById('cm-decline-reason').value = '';
    document.getElementById('cm-decline-modal').classList.add('show');
}

function closeDeclineModal(e) {
    if (e && e.target !== document.getElementById('cm-decline-modal')) return;
    document.getElementById('cm-decline-modal').classList.remove('show');
    _declinePending = null;
}

async function confirmDecline() {
    if (!_declinePending) return;
    const reason = document.getElementById('cm-decline-reason').value.trim() || null;
    document.getElementById('cm-decline-modal').classList.remove('show');

    const { type, id } = _declinePending;
    _declinePending = null;

    if (type === 'interview') await respondInterview(id, 'Declined', reason);
    else await respondOffer(id, 'Declined', reason);
}

// ── Polling ─────────────────────────────────────────────────────
function startPoll(appId) {
    stopPoll();
    _pollTimer = setInterval(async () => {
        if (!_activeAppId) return;
        try {
            const res  = await apiFetchAuth(`/api/candidate/messages/thread/${_activeAppId}`);
            const data = await safeJson(res);
            if (!res?.ok) return;
            const msgs  = data?.data || [];
            const lastId = msgs.at(-1)?.id;
            if (lastId && lastId !== _lastMsgId) {
                _lastMsgId = lastId;
                renderThread(msgs);
                apiFetchAuth(`/api/candidate/messages/thread/${_activeAppId}/read`, { method: 'POST' }).catch(()=>{});
            }
        } catch (_) {}
    }, 5000);
}

function stopPoll() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function pollUnread() {
    setInterval(async () => {
        try {
            const res  = await apiFetchAuth('/api/candidate/messages/unread-count');
            const data = await safeJson(res);
            const cnt  = data?.data ?? 0;
            const badge = document.getElementById('cm-unread-badge');
            if (badge) {
                badge.textContent = cnt > 0 ? cnt : '';
                badge.style.display = cnt > 0 ? 'inline' : 'none';
            }
        } catch (_) {}
    }, 15000);
}

// ── Helpers ─────────────────────────────────────────────────────
function statusLabel(s) {
    return { Applied:'Mới nộp', Screening:'Sàng lọc', Interview:'Phỏng vấn', Offered:'Đề nghị', Rejected:'Từ chối', OnHold:'Tạm giữ' }[s] || s;
}

function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function relTime(date) {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
    if (d > 1) return date.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
    if (d === 1) return 'Hôm qua';
    if (h >= 1)  return `${h} giờ`;
    if (m >= 1)  return `${m} phút`;
    return 'Vừa xong';
}

async function safeJson(res) {
    if (!res) return null;
    const t = await res.text();
    try { return JSON.parse(t); } catch { return null; }
}

let _toastT;
function showToast(msg, type = 'success') {
    const el = document.getElementById('cm-toast');
    if (!el) return;
    clearTimeout(_toastT);
    const icons = { success:'fa-circle-check', error:'fa-circle-exclamation', info:'fa-circle-info' };
    el.className = `cm-toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type]||'fa-circle-check'}"></i> ${msg}`;
    el.style.display = 'flex';
    _toastT = setTimeout(() => { el.style.display = 'none'; }, 3500);
}
