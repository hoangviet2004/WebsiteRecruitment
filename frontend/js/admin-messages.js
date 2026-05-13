'use strict';

let _convList = [];
let _activeUserId = null;
let _pollTimer = null;
let _pollLastMsgId = null;

const MSG_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#6366f1','#14b8a6'];
function _color(s){ let h=0; for(let c of (s||'')) h=c.charCodeAt(0)+((h<<5)-h); return MSG_COLORS[Math.abs(h)%MSG_COLORS.length]; }
function _init(n){ if(!n)return '?'; const p=n.trim().split(' '); return p.length===1?p[0].slice(0,2).toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase(); }
function _esc(s){ if(!s)return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function loadAdminMessages(){
    fetchConversations();
}

async function fetchConversations(){
    try {
        const res = await apiFetchAuth('/api/support-messaging/admin/conversations');
        const data = await safeJsonMsg(res);
        if(!res?.ok) throw new Error(data?.message || 'Lỗi tải danh sách');
        _convList = data?.data || [];
        renderConversations(_convList);
    } catch(e) {
        document.getElementById('msg-conv-list').innerHTML = `<div class="msg-empty-state" style="color:#ef4444;">${e.message}</div>`;
    }
}

function renderConversations(list){
    const el = document.getElementById('msg-conv-list');
    if(!list.length){
        el.innerHTML = '<div class="msg-empty-state">Chưa có yêu cầu hỗ trợ nào.</div>';
        return;
    }
    el.innerHTML = list.map(c => {
        const avatarHtml = c.candidateAvatar
            ? `<img src="${c.candidateAvatar}" class="msg-conv-avatar" alt="">`
            : `<span class="msg-conv-initials" style="background:${_color(c.candidateName)}">${_init(c.candidateName)}</span>`;

        const time = c.lastMessageAt ? _relTime(new Date(c.lastMessageAt)) : '';
        const preview = c.lastMessage ? _esc(c.lastMessage).slice(0,50) : '<em>Chưa có tin nhắn</em>';
        const isActive = c.candidateId === _activeUserId;

        return `<div class="msg-conv-item${isActive?' active':''}${c.hasUnread?' has-unread':''}"
                    data-user-id="${c.candidateId}"
                    onclick="openConversation('${c.candidateId}')">
            ${avatarHtml}
            <div class="msg-conv-body">
                <div class="msg-conv-top">
                    <span class="msg-conv-name">${_esc(c.candidateName)}</span>
                    <span class="msg-conv-time">${time}</span>
                </div>
                <div class="msg-conv-preview">${preview}</div>
            </div>
            ${c.unreadCount>0?`<span class="msg-unread-dot"></span>`:''}
        </div>`;
    }).join('');
}

async function openConversation(userId){
    _activeUserId = userId;
    stopMsgPolling();

    document.querySelectorAll('.msg-conv-item').forEach(el=>{
        el.classList.toggle('active', el.dataset.userId === userId);
    });

    document.getElementById('msg-thread-empty').style.display='none';
    document.getElementById('msg-thread-header').style.display='flex';
    document.getElementById('msg-input-wrap').style.display='block';
    document.getElementById('msg-info-empty').style.display='none';
    document.getElementById('msg-info-content').style.display='block';

    const conv = _convList.find(c => c.candidateId === userId);
    updateThreadHeader(conv);
    renderUserInfo(conv);

    await loadThread(userId);
    apiFetchAuth(`/api/support-messaging/admin/read/${userId}`, {method:'POST'}).catch(()=>{});
    startMsgPolling(userId);
}

function updateThreadHeader(c){
    if(!c) return;
    const avatarHtml = c.candidateAvatar
        ? `<img src="${c.candidateAvatar}" class="msg-thread-avatar" alt="">`
        : `<span class="msg-thread-initials" style="background:${_color(c.candidateName)}">${_init(c.candidateName)}</span>`;
    
    document.getElementById('msg-thread-candidate').innerHTML=`
        ${avatarHtml}
        <div>
            <div class="msg-thread-name">${_esc(c.candidateName)}</div>
            <div class="msg-thread-job">Hỗ trợ người dùng</div>
        </div>`;
}

function renderUserInfo(c){
    if(!c) return;
    const content = document.getElementById('msg-info-content');
    const avatarHtml = c.candidateAvatar
        ? `<img src="${c.candidateAvatar}" class="msg-info-avatar-lg" alt="">`
        : `<div class="msg-info-initials-lg" style="background:${_color(c.candidateName)}">${_init(c.candidateName)}</div>`;

    content.innerHTML = `
        <div class="msg-info-profile">
            ${avatarHtml}
            <div class="msg-info-name">${_esc(c.candidateName)}</div>
            <div class="msg-info-email">${_esc(c.candidateEmail)}</div>
            <div style="margin-top:8px;"><span class="msg-conv-tag" style="background:#f1f5f9;color:#475569;">Người dùng</span></div>
        </div>
        <div style="padding:16px; font-size:13px; color:#64748b; line-height:1.6;">
            Người dùng này đang yêu cầu hỗ trợ qua hệ thống. Vui lòng phản hồi sớm nhất có thể.
        </div>`;
}

async function loadThread(userId){
    document.getElementById('msg-bubbles').innerHTML = '<div class="msg-empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    try {
        const res = await apiFetchAuth(`/api/support-messaging/admin/thread/${userId}`);
        const data = await safeJsonMsg(res);
        if(!res?.ok) throw new Error(data?.message || 'Lỗi tải tin nhắn');
        renderThread(data?.data || []);
        _pollLastMsgId = (data?.data || []).at(-1)?.id || null;
    } catch(e) {
        document.getElementById('msg-bubbles').innerHTML = `<div class="msg-empty-state" style="color:#ef4444;">${e.message}</div>`;
    }
}

function renderThread(msgs){
    const myId = sessionStorage.getItem('userId');
    const bubbles = document.getElementById('msg-bubbles');

    let lastDate = '';
    bubbles.innerHTML = msgs.map(m => {
        const isMine = m.senderId === myId;
        const dateStr = new Date(m.sentAt).toLocaleDateString('vi-VN');
        const timeStr = new Date(m.sentAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});

        let sep = '';
        if(dateStr !== lastDate){ lastDate=dateStr; sep=`<div class="msg-date-sep">— ${dateStr} —</div>`; }

        const avatarHtml = m.senderAvatar
            ? `<img src="${m.senderAvatar}" class="msg-bubble-avatar" alt="">`
            : `<span class="msg-bubble-initials-sm" style="background:${_color(m.senderName)}">${_init(m.senderName)}</span>`;

        return `${sep}<div class="msg-bubble-wrap ${isMine?'me':''}">
            ${isMine?'':avatarHtml}
            <div>
                <div class="msg-bubble ${isMine?'me':'them'}">
                    ${_esc(m.content).replace(/\n/g,'<br>')}
                </div>
                <div class="msg-bubble-meta">${timeStr}</div>
            </div>
            ${isMine?avatarHtml:''}
        </div>`;
    }).join('');
    bubbles.scrollTop = bubbles.scrollHeight;
}

async function sendMessage(){
    const input = document.getElementById('msg-input');
    const content = input.value.trim();
    if(!content || !_activeUserId) return;

    try {
        const res = await apiFetchAuth('/api/support-messaging/admin/send', {
            method: 'POST',
            body: JSON.stringify({ targetUserId: _activeUserId, content })
        });
        if(!res?.ok) throw new Error('Lỗi gửi tin');
        input.value = '';
        loadThread(_activeUserId);
        fetchConversations();
    } catch(e){ alert(e.message); }
}

function handleMsgKey(e){
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault();
        sendMessage();
    }
}

function startMsgPolling(userId){
    stopMsgPolling();
    _pollTimer = setInterval(async ()=>{
        try {
            const res = await apiFetchAuth(`/api/support-messaging/admin/thread/${userId}`);
            const data = await safeJsonMsg(res);
            if(res?.ok){
                const msgs = data?.data || [];
                const lastId = msgs.at(-1)?.id;
                if(lastId && lastId !== _pollLastMsgId){
                    _pollLastMsgId = lastId;
                    renderThread(msgs);
                }
            }
        } catch(_){}
    }, 5000);
}

function stopMsgPolling(){
    if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
}

function filterConversations(q){
    const lower = q.toLowerCase().trim();
    const filtered = lower
        ? _convList.filter(c=>c.candidateName.toLowerCase().includes(lower)||c.candidateEmail.toLowerCase().includes(lower))
        : _convList;
    renderConversations(filtered);
}

function _relTime(date){
    const diff = Date.now()-date.getTime();
    const m=Math.floor(diff/60000), h=Math.floor(m/60), d=Math.floor(h/24);
    if(d>1) return date.toLocaleDateString('vi-VN');
    if(d===1) return 'Hôm qua';
    if(h>=1) return `${h} giờ`;
    if(m>=1) return `${m} phút`;
    return 'Vừa xong';
}

async function safeJsonMsg(res){
    try{ return await res.json(); }catch{ return null; }
}
