'use strict';
// ============================================================
// recruiterMessaging.js — Tab Tin nhắn trong recruiter.html
// ============================================================

// ── State ────────────────────────────────────────────────────
let _convList        = [];        // toàn bộ conversations
let _activeAppId     = null;      // applicationId đang mở
let _msgType         = 'message'; // 'message' | 'email'
let _pollTimer       = null;      // setInterval handle
let _pollLastMsgId   = null;      // ID tin nhắn cuối để detect tin mới
let _msgLoaded       = false;

// ── Màu avatar ───────────────────────────────────────────────
const MSG_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#6366f1','#14b8a6'];
function _color(s){ let h=0; for(let c of (s||'')) h=c.charCodeAt(0)+((h<<5)-h); return MSG_COLORS[Math.abs(h)%MSG_COLORS.length]; }
function _init(n){ if(!n)return '?'; const p=n.trim().split(' '); return p.length===1?p[0].slice(0,2).toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase(); }
function _avatarHtml(name,url,cls='msg-conv-avatar msg-conv-initials'){ return url?`<img src="${url}" class="${cls.split(' ')[0]}" alt="">`: `<span class="${cls.split(' ')[1]}" style="background:${_color(name)}">${_init(name)}</span>`; }

// ── Templates tin nhắn/email ─────────────────────────────────
const MSG_TEMPLATES = {
    invite: {
        type: 'email',
        text: `Chào [Tên ứng viên],

Cảm ơn bạn đã ứng tuyển vào vị trí [Vị trí] tại công ty chúng tôi.

Chúng tôi rất vui được thông báo rằng hồ sơ của bạn đã vượt qua vòng sơ loại. Chúng tôi muốn mời bạn tham dự buổi phỏng vấn vào thời gian sẽ được thông báo riêng qua lịch.

Vui lòng xác nhận sự tham gia của bạn.

Trân trọng,
Phòng Nhân sự`
    },
    offer: {
        type: 'email',
        text: `Chào [Tên ứng viên],

Chúng tôi rất vui mừng thông báo rằng bạn đã được chọn để gia nhập đội ngũ của chúng tôi tại vị trí [Vị trí].

Chúng tôi đánh giá cao năng lực và kinh nghiệm của bạn. Chúng tôi sẽ liên hệ để thảo luận về các điều khoản hợp đồng trong thời gian sớm nhất.

Chúc mừng và chào đón bạn!

Trân trọng,
Phòng Nhân sự`
    },
    reject: {
        type: 'email',
        text: `Chào [Tên ứng viên],

Cảm ơn bạn đã dành thời gian ứng tuyển và tham gia quá trình tuyển dụng tại công ty chúng tôi.

Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng vị trí này hiện tại chưa phù hợp với định hướng của công ty. Tuy nhiên, chúng tôi rất ấn tượng với hồ sơ của bạn và sẽ lưu lại để xem xét trong các cơ hội tương lai.

Chúc bạn thành công trong sự nghiệp!

Trân trọng,
Phòng Nhân sự`
    },
    followup: {
        type: 'message',
        text: `Chào bạn, để hoàn thiện hồ sơ ứng tuyển, chúng tôi cần bổ sung thêm một số thông tin:\n\n• [Thông tin cần bổ sung]\n\nVui lòng phản hồi sớm nhất có thể. Xin cảm ơn!`
    },
    confirm: {
        type: 'message',
        text: `Xin chào! Chúng tôi đã nhận được hồ sơ ứng tuyển của bạn cho vị trí [Vị trí]. Cảm ơn bạn đã quan tâm đến cơ hội này. Chúng tôi sẽ liên hệ lại trong thời gian sớm nhất sau khi xem xét hồ sơ.`
    }
};

// ── Status tags ──────────────────────────────────────────────
const APP_STATUS_TAGS = {
    Applied:   { label: 'Mới nộp',   bg: '#eff6ff', color: '#3b82f6' },
    Screening: { label: 'Sàng lọc',  bg: '#fef9c3', color: '#ca8a04' },
    Interview: { label: 'Phỏng vấn', bg: '#f0fdf4', color: '#16a34a' },
    Offered:   { label: 'Đề nghị',   bg: '#ecfdf5', color: '#059669' },
    OnHold:    { label: 'Tạm giữ',   bg: '#fef3c7', color: '#d97706' },
    Rejected:  { label: 'Từ chối',   bg: '#fef2f2', color: '#dc2626' }
};

function _statusTag(status){
    const c=APP_STATUS_TAGS[status]||{label:status,bg:'#f1f5f9',color:'#475569'};
    return `<span class="msg-conv-tag" style="background:${c.bg};color:${c.color};">${c.label}</span>`;
}

// ── Khởi tạo khi chuyển sang tab ─────────────────────────────
function loadMessaging(){
    if(!currentCompanyId){
        document.getElementById('msg-conv-list').innerHTML=
            '<div class="msg-empty-state"><i class="fa-solid fa-circle-info" style="color:#f59e0b;"></i> Tạo Hồ sơ Công ty trước.</div>';
        return;
    }
    fetchConversations();
    startPollingUnread();
}

// ── Danh sách hội thoại ──────────────────────────────────────
async function fetchConversations(){
    try {
        const res  = await apiFetchAuth(`/api/messaging/conversations?companyId=${currentCompanyId}`);
        const data = await safeJsonMsg(res);
        if(!res?.ok) throw new Error(data?.message||'Lỗi tải danh sách');
        _convList = data?.data || [];
        
        // --- ADDED: Load Admin Support ---
        try {
            const adminRes = await apiFetchAuth('/api/support-messaging/conversation-info');
            const adminData = await safeJsonMsg(adminRes);
            if(adminRes?.ok && adminData?.data){
                // Luôn ở đầu
                _convList = [adminData.data, ..._convList];
            }
        } catch(e){ console.error('Lỗi tải support:', e); }
        // ---------------------------------

        renderConversations(_convList);
    } catch(e) {
        document.getElementById('msg-conv-list').innerHTML=
            `<div class="msg-empty-state" style="color:#ef4444;"><i class="fa-solid fa-circle-exclamation"></i> ${e.message}</div>`;
    }
}

function renderConversations(list){
    const el = document.getElementById('msg-conv-list');
    if(!list.length){
        el.innerHTML='<div class="msg-empty-state">Chưa có hội thoại nào.<br><small>Ứng viên nộp đơn sẽ xuất hiện ở đây.</small></div>';
        return;
    }
    el.innerHTML = list.map(c => {
        const avatarHtml = c.candidateAvatar
            ? `<img src="${c.candidateAvatar}" class="msg-conv-avatar" alt="">`
            : `<span class="msg-conv-initials" style="background:${_color(c.candidateName)}">${_init(c.candidateName)}</span>`;

        const time = c.lastMessageAt ? _relTime(new Date(c.lastMessageAt)) : '';
        const preview = c.lastMessage
            ? (c.lastMessageType==='email'?'📧 ':'') + _esc(c.lastMessage).slice(0,50)
            : '<em>Chưa có tin nhắn</em>';
        const isActive = c.applicationId === _activeAppId;

        return `<div class="msg-conv-item${isActive?' active':''}${c.hasUnread?' has-unread':''}"
                    data-app-id="${c.applicationId}"
                    data-is-support="${c.applicationId === '00000000-0000-0000-0000-000000000000'}"
                    onclick="openConversation('${c.applicationId}')">
            ${avatarHtml}
            <div class="msg-conv-body">
                <div class="msg-conv-top">
                    <span class="msg-conv-name">${_esc(c.candidateName)}</span>
                    <span class="msg-conv-time">${time}</span>
                </div>
                <div class="msg-conv-preview">${preview}</div>
                <div class="msg-conv-meta">
                    ${_statusTag(c.applicationStatus)}
                    <span style="font-size:10px;color:#94a3b8;">${_esc(c.jobTitle.slice(0,24))}${c.jobTitle.length>24?'…':''}</span>
                </div>
            </div>
            ${c.unreadCount>0?`<span class="msg-unread-dot" title="${c.unreadCount} tin chưa đọc"></span>`:''}
        </div>`;
    }).join('');
}

function filterConversations(q){
    const lower = q.toLowerCase().trim();
    const filtered = lower
        ? _convList.filter(c=>c.candidateName.toLowerCase().includes(lower)||c.candidateEmail.toLowerCase().includes(lower))
        : _convList;
    renderConversations(filtered);
}

// ── Mở hội thoại ─────────────────────────────────────────────
async function openConversation(appId){
    _activeAppId = appId;
    stopMsgPolling();

    // Highlight active
    document.querySelectorAll('.msg-conv-item').forEach(el=>{
        el.classList.toggle('active', el.dataset.appId === appId);
    });

    // Hiện header + input
    document.getElementById('msg-thread-empty').style.display='none';
    document.getElementById('msg-thread-header').style.display='flex';
    document.getElementById('msg-input-wrap').style.display='block';
    document.getElementById('msg-info-empty').style.display='none';
    document.getElementById('msg-info-content').style.display='block';

    await Promise.all([
        loadThread(appId),
        loadCandidateInfo(appId)
    ]);

    // Mark read
    if(appId === '00000000-0000-0000-0000-000000000000'){
        apiFetchAuth('/api/support-messaging/read', {method:'POST'}).catch(()=>{});
    } else {
        apiFetchAuth(`/api/messaging/thread/${appId}/read`, {method:'POST'}).catch(()=>{});
    }
    
    // Cập nhật badge unread
    fetchConversations();

    // Bắt đầu polling tin mới mỗi 5 giây
    startMsgPolling(appId);
}

// ── Load thread ───────────────────────────────────────────────
async function loadThread(appId){
    document.getElementById('msg-bubbles').innerHTML=
        '<div class="msg-empty-state"><i class="fa-solid fa-spinner fa-spin" style="color:#3b82f6;"></i></div>';

    try {
        const isSupport = appId === '00000000-0000-0000-0000-000000000000';
        const url = isSupport ? '/api/support-messaging/thread' : `/api/messaging/thread/${appId}`;
        
        const res  = await apiFetchAuth(url);
        const data = await safeJsonMsg(res);
        if(!res?.ok) throw new Error(data?.message||'Lỗi tải tin nhắn');
        renderThread(data?.data || []);
        _pollLastMsgId = (data?.data || []).at(-1)?.id || null;
    } catch(e) {
        document.getElementById('msg-bubbles').innerHTML=
            `<div class="msg-empty-state" style="color:#ef4444;">${e.message}</div>`;
    }
}

function renderThread(msgs){
    const myId  = sessionStorage.getItem('userId') || '';
    const me    = sessionStorage.getItem('email')  || '';
    const bubbles = document.getElementById('msg-bubbles');

    if(!msgs.length){
        bubbles.innerHTML='<div class="msg-empty-state">Chưa có tin nhắn nào. Hãy gửi tin đầu tiên!</div>';
        return;
    }

    let lastDate = '';
    bubbles.innerHTML = msgs.map(m => {
        const isMine  = m.senderId === myId;
        const dateStr = new Date(m.sentAt).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
        const timeStr = new Date(m.sentAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
        const isEmail = m.type === 'email';

        let sep = '';
        if(dateStr !== lastDate){ lastDate=dateStr; sep=`<div class="msg-date-sep">— ${dateStr} —</div>`; }

        const avatarHtml = m.senderAvatar
            ? `<img src="${m.senderAvatar}" class="msg-bubble-avatar" alt="">`
            : `<span class="msg-bubble-initials-sm" style="background:${_color(m.senderName)}">${_init(m.senderName)}</span>`;

        const emailBadge = isEmail ? `<span style="font-size:10px;opacity:.8;">📧 Email</span> · ` : '';
        const readMark   = isMine && m.isRead ? ' · <i class="fa-solid fa-check-double" style="font-size:10px;"></i>' : '';

        return `${sep}<div class="msg-bubble-wrap ${isMine?'me':''}">
            ${isMine?'':avatarHtml}
            <div>
                ${!isMine?`<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;padding-left:2px;">${_esc(m.senderName)}</div>`:''}
                <div class="msg-bubble ${isMine?'me':'them'} ${isEmail?'email-bubble':''}">
                    ${_esc(m.content).replace(/\n/g,'<br>')}
                </div>
                <div class="msg-bubble-meta">${emailBadge}${timeStr}${readMark}</div>
            </div>
            ${isMine?avatarHtml:''}
        </div>`;
    }).join('');

    // Scroll xuống cuối
    bubbles.scrollTop = bubbles.scrollHeight;
}

// ── Load candidate info (cột phải) ───────────────────────────
async function loadCandidateInfo(appId){
    const content = document.getElementById('msg-info-content');
    content.innerHTML='<div class="msg-empty-state"><i class="fa-solid fa-spinner fa-spin" style="color:#3b82f6;"></i></div>';

    try {
        const isSupport = appId === '00000000-0000-0000-0000-000000000000';
        if(isSupport){
            const adminConv = _convList.find(c => c.applicationId === appId);
            renderAdminInfo(adminConv);
            updateThreadHeader(adminConv);
            return;
        }

        const res  = await apiFetchAuth(`/api/messaging/candidate-info/${appId}`);
        const data = await safeJsonMsg(res);
        if(!res?.ok) throw new Error(data?.message||'Lỗi');
        renderCandidateInfo(data?.data);

        // Cập nhật thread header
        updateThreadHeader(data?.data);
    } catch(e){
        content.innerHTML=`<p style="padding:16px;color:#ef4444;font-size:13px;">${e.message}</p>`;
    }
}

function updateThreadHeader(d){
    if(!d) return;
    const avatarHtml = (d.candidateAvatar || d.avatarUrl)
        ? `<img src="${d.candidateAvatar || d.avatarUrl}" class="msg-thread-avatar" alt="">`
        : `<span class="msg-thread-initials" style="background:${_color(d.candidateName)}">${_init(d.candidateName)}</span>`;
    
    document.getElementById('msg-thread-candidate').innerHTML=`
        ${avatarHtml}
        <div>
            <div class="msg-thread-name">${_esc(d.candidateName)}</div>
            <div class="msg-thread-job">${_esc(d.jobTitle)}</div>
        </div>`;
}

function renderAdminInfo(d){
    if(!d) return;
    const content = document.getElementById('msg-info-content');

    const avatarHtml = d.candidateAvatar
        ? `<img src="${d.candidateAvatar}" class="msg-info-avatar-lg" alt="">`
        : `<div class="msg-info-initials-lg" style="background:${_color(d.candidateName)}">${_init(d.candidateName)}</div>`;

    content.innerHTML = `
        <div class="msg-info-profile">
            ${avatarHtml}
            <div class="msg-info-name">${_esc(d.candidateName)}</div>
            <div class="msg-info-email">${_esc(d.candidateEmail)}</div>
            <div style="margin-top:8px;"><span class="msg-conv-tag" style="background:#eff6ff;color:#3b82f6;">Hỗ trợ viên</span></div>
        </div>
        <div style="padding:16px; font-size:13px; color:#64748b; line-height:1.6;">
            Chào bạn! Đây là kênh hỗ trợ trực tiếp từ đội ngũ Quản trị viên TechList. 
            Nếu bạn gặp bất kỳ vấn đề gì về tài khoản, tin tuyển dụng hoặc thanh toán, hãy để lại tin nhắn tại đây.
        </div>`;
}

function renderCandidateInfo(d){
    if(!d) return;
    const content = document.getElementById('msg-info-content');

    const avatarHtml = d.candidateAvatar
        ? `<img src="${d.candidateAvatar}" class="msg-info-avatar-lg" alt="">`
        : `<div class="msg-info-initials-lg" style="background:${_color(d.candidateName)}">${_init(d.candidateName)}</div>`;

    const interviewHtml = d.upcomingInterview ? renderInterviewCard(d.upcomingInterview) : '';

    const skillsHtml = d.candidateSkills
        ? `<div class="msg-info-section-title">Kỹ năng</div>
           <div class="msg-skills-wrap">
             ${d.candidateSkills.split(/[,;|]/).map(s=>`<span class="msg-skill-tag">${_esc(s.trim())}</span>`).join('')}
           </div>`
        : '';

    const cvHtml = d.cvUrl
        ? `<a href="javascript:void(0)" onclick="openSignedCvView('${d.candidateId}')" class="msg-cv-btn" style="margin-top:16px;cursor:pointer;">
               <i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> Xem / Tải CV
           </a>` : '';

    content.innerHTML = `
        <div class="msg-info-profile">
            ${avatarHtml}
            <div class="msg-info-name">${_esc(d.candidateName)}</div>
            <div class="msg-info-email">${_esc(d.candidateEmail)}</div>
            <div style="margin-top:8px;">${_statusTag(d.applicationStatus)}</div>
        </div>

        <div class="msg-info-actions">
            <button class="msg-info-btn primary" onclick="openScheduleModal()">
                <i class="fa-regular fa-calendar-plus"></i> Lên lịch phỏng vấn
            </button>
            <button class="msg-info-btn success" onclick="quickAction('offer')">
                <i class="fa-solid fa-handshake"></i> Gửi Offer
            </button>
            <button class="msg-info-btn danger" onclick="quickAction('reject')">
                <i class="fa-solid fa-xmark"></i> Từ chối
            </button>
        </div>

        ${interviewHtml}
        ${cvHtml}
        ${skillsHtml}`;
}

function renderInterviewCard(iv){
    const dt  = new Date(iv.scheduledAt);
    const date = dt.toLocaleDateString('vi-VN',{day:'2-digit',month:'long',year:'numeric'});
    const time = dt.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    const dur  = `${time} · ${iv.durationMinutes} phút`;
    const link = iv.meetingLink
        ? `<a href="${iv.meetingLink}" target="_blank" class="msg-interview-link">
               <i class="fa-solid fa-video"></i> Tham gia Meeting
           </a>` : '';
    return `<div class="msg-interview-card">
        <div class="msg-interview-title"><i class="fa-solid fa-calendar-check"></i> Lịch phỏng vấn sắp tới</div>
        <div class="msg-interview-date">${date}</div>
        <div class="msg-interview-time"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${dur}</div>
        ${link}
    </div>`;
}

// ── Gửi tin nhắn ─────────────────────────────────────────────
async function sendMessage(){
    const input = document.getElementById('msg-input');
    const content = input.value.trim();
    if(!content || !_activeAppId) return;

    const btn = document.querySelector('.msg-send-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const isSupport = _activeAppId === '00000000-0000-0000-0000-000000000000';
        const url = isSupport ? '/api/support-messaging/send' : '/api/messaging/send';
        const body = isSupport ? { content } : { applicationId: _activeAppId, content, type: _msgType };

        const res  = await apiFetchAuth(url, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        const data = await safeJsonMsg(res);
        if(!res?.ok) throw new Error(data?.message||'Lỗi gửi tin');

        input.value = '';
        autoResizeTextarea(input);
        // Reload thread để hiện tin mới
        await loadThread(_activeAppId);
        // Cập nhật conversation list (last message)
        fetchConversations();
    } catch(e){
        alert('Lỗi gửi tin: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
}

function handleMsgKey(e){
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault();
        sendMessage();
    }
}

function autoResizeTextarea(el){
    el.style.height = 'auto';
    el.style.height = Math.max(42, el.scrollHeight) + 'px';
}

// ── Áp dụng template ─────────────────────────────────────────
function applyTemplate(key){
    if(!key) return;
    const tpl = MSG_TEMPLATES[key];
    if(!tpl) return;

    // Tìm tên ứng viên và vị trí từ conversation hiện tại
    const conv = _convList.find(c=>c.applicationId===_activeAppId);
    let text = tpl.text;
    if(conv){
        text = text.replace(/\[Tên ứng viên\]/g, conv.candidateName);
        text = text.replace(/\[Vị trí\]/g, conv.jobTitle);
    }

    const ta = document.getElementById('msg-input');
    ta.value = text;
    _msgType = tpl.type;
    document.getElementById('msg-template-sel').value = '';
    autoResizeTextarea(ta);
    ta.focus();
}

// ── Quick action (Offer / Reject) ─────────────────────────────
function quickAction(action){
    applyTemplate(action);
    // Scroll xuống input
    document.getElementById('msg-input-wrap').scrollIntoView({behavior:'smooth'});
    document.getElementById('msg-input').focus();
}

// ── Lịch phỏng vấn ───────────────────────────────────────────
function openScheduleModal(){
    if(!_activeAppId){ alert('Vui lòng chọn một ứng viên trước.'); return; }
    const conv = _convList.find(c=>c.applicationId===_activeAppId);
    if(conv){
        document.getElementById('schedule-candidate-info').innerHTML=`
            <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Ứng viên</div>
            <div style="font-weight:700;color:#0f172a;">${_esc(conv.candidateName)}</div>
            <div style="font-size:13px;color:#475569;margin-top:2px;">${_esc(conv.jobTitle)}</div>`;
    }

    // Mặc định ngày mai 10:00
    const dt = new Date(); dt.setDate(dt.getDate()+1); dt.setHours(10,0,0,0);
    document.getElementById('sch-datetime').value = dt.toISOString().slice(0,16);
    document.getElementById('sch-link').value = '';
    document.getElementById('sch-location').value = '';
    document.getElementById('sch-notes').value = '';

    document.getElementById('schedule-modal').classList.add('show');
}

function closeScheduleModal(){
    document.getElementById('schedule-modal').classList.remove('show');
}

async function submitSchedule(){
    const dt  = document.getElementById('sch-datetime').value;
    if(!dt){ alert('Vui lòng chọn ngày giờ phỏng vấn.'); return; }

    const payload = {
        applicationId:   _activeAppId,
        scheduledAt:     new Date(dt).toISOString(),
        durationMinutes: parseInt(document.getElementById('sch-duration').value),
        meetingLink:     document.getElementById('sch-link').value || null,
        location:        document.getElementById('sch-location').value || null,
        notes:           document.getElementById('sch-notes').value || null
    };

    try {
        const res  = await apiFetchAuth('/api/messaging/interviews', { method:'POST', body: JSON.stringify(payload) });
        const data = await safeJsonMsg(res);
        if(!res?.ok) throw new Error(data?.message||'Lỗi lên lịch');

        closeScheduleModal();
        alert('Đã lên lịch phỏng vấn thành công! Trạng thái ứng viên đã chuyển sang Phỏng vấn.');

        // Gửi tin nhắn thông báo tự động
        const iv = data.data;
        const dtStr = new Date(iv.scheduledAt).toLocaleString('vi-VN',{dateStyle:'full',timeStyle:'short'});
        const autoMsg = `📅 Lịch phỏng vấn đã được lên lịch!\n\n🗓 Thời gian: ${dtStr}\n⏱ Thời lượng: ${iv.durationMinutes} phút${iv.meetingLink?`\n🔗 Link: ${iv.meetingLink}`:''}${iv.location?`\n📍 Địa điểm: ${iv.location}`:''}${iv.notes?`\n📝 Ghi chú: ${iv.notes}`:''}`;
        await apiFetchAuth('/api/messaging/send', {
            method:'POST',
            body: JSON.stringify({ applicationId: _activeAppId, content: autoMsg, type: 'message' })
        });

        await loadThread(_activeAppId);
        await loadCandidateInfo(_activeAppId);
        fetchConversations();
    } catch(e){
        alert('Lỗi: ' + e.message);
    }
}

// ── Polling tin nhắn mới (5 giây) ────────────────────────────
function startMsgPolling(appId){
    stopMsgPolling();
    _pollTimer = setInterval(async ()=>{
        if(!_activeAppId) return;
        try {
            const isSupport = _activeAppId === '00000000-0000-0000-0000-000000000000';
            const url = isSupport ? '/api/support-messaging/thread' : `/api/messaging/thread/${_activeAppId}`;
            
            const res  = await apiFetchAuth(url);
            const data = await safeJsonMsg(res);
            if(!res?.ok) return;
            const msgs = data?.data || [];
            const lastId = msgs.at(-1)?.id;
            if(lastId && lastId !== _pollLastMsgId){
                _pollLastMsgId = lastId;
                renderThread(msgs);
            }
        } catch(_){}
    }, 5000);
}

function stopMsgPolling(){
    if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
}

// ── Polling unread count cho badge sidebar ────────────────────
function startPollingUnread(){
    setInterval(async ()=>{
        if(!currentCompanyId) return;
        try {
            const [res, supportRes] = await Promise.all([
                apiFetchAuth(`/api/messaging/unread-count?companyId=${currentCompanyId}`),
                apiFetchAuth('/api/support-messaging/unread-count')
            ]);
            const [data, supportData] = await Promise.all([
                safeJsonMsg(res),
                safeJsonMsg(supportRes)
            ]);
            const count = (data?.data ?? 0) + (supportData?.data ?? 0);
            const badge = document.getElementById('msg-unread-badge');
            if(badge) badge.style.display = count>0?'inline-block':'none';
        } catch(_){}
    }, 15000);
}

// ── Utilities ─────────────────────────────────────────────────
function _esc(s){ if(!s)return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _relTime(date){
    const diff = Date.now()-date.getTime();
    const m=Math.floor(diff/60000), h=Math.floor(m/60), d=Math.floor(h/24);
    if(d>1) return date.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
    if(d===1) return 'Hôm qua';
    if(h>=1) return `${h} giờ`;
    if(m>=1) return `${m} phút`;
    return 'Vừa xong';
}

async function safeJsonMsg(res){
    if(!res) return null;
    const text = await res.text();
    if(!text?.trim()) return null;
    try{ return JSON.parse(text); }catch{ return null; }
}

// ── Hook vào switchTab ────────────────────────────────────────
(function patchSwitchTabMsg(){
    const _prev = window.switchTab;
    window.switchTab = function(tabName, element){
        _prev(tabName, element);
        if(tabName === 'messages'){
            setTimeout(()=>{
                if(!_msgLoaded){ _msgLoaded=true; loadMessaging(); }
                else { fetchConversations(); }
            }, 50);
        } else {
            stopMsgPolling();
        }
    };
})();
