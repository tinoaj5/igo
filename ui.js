let CURRENT_CHAT_JOB_ID = null;

const dbg    = document.getElementById('debug');
const dbgpre = document.getElementById('dbgpre');

window.setDebug = function setDebug(msg){
  try{ dbgpre.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg,null,2); }
  catch(_){ dbgpre.textContent = String(msg); }
};

document.addEventListener('keydown', (e)=>{
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd'){
    dbg.style.display = dbg.style.display === 'none' ? 'block' : 'none';
  }
});

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg || 'Saved';
  t.style.display = 'block';
  setTimeout(()=> t.style.display='none', 2200);
}
window.showToast = showToast;

/* ✅ global esc helper (use everywhere) */
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/* dialogs */
function supportsDialog(){
  try { return typeof HTMLDialogElement === 'function' && !!document.createElement('dialog').showModal; }
  catch(_){ return false; }
}
function openDlg(id){
  const d = document.getElementById(id);
  if (!d) return;
  try{ supportsDialog() ? d.showModal() : d.setAttribute('open',''); }
  catch(_){ d.setAttribute('open',''); }
}
function closeDlg(id){
  const d = document.getElementById(id);
  if (!d) return;
  try{ supportsDialog() ? d.close() : d.removeAttribute('open'); }
  catch(_){}
}

/* expose open/close used by onclick in HTML */
window.openSignin = ()=> openDlg('signinModal');
window.closeSignin = ()=> closeDlg('signinModal');

window.openOwnerModal = ()=> { openDlg('ownerModal'); prefillOwnerFromProfile(); setDateMinToday(); };
window.closeOwnerModal = ()=> closeDlg('ownerModal');

window.openJobs = ()=> { openDlg('jobsModal'); refreshJobs(); };
window.closeJobs = ()=> closeDlg('jobsModal');

window.openOwnerJobs = ()=> { openDlg('ownerJobsModal'); refreshOwnerJobs(); };
window.closeOwnerJobs = ()=> closeDlg('ownerJobsModal');

window.openMyBids = ()=> { openDlg('myBidsModal'); refreshMyBids(); };
window.closeMyBids = ()=> closeDlg('myBidsModal');

window.openCurrentWalks = ()=> { openDlg('currentWalksModal'); refreshCurrentWalks(); };
window.closeCurrentWalks = ()=> closeDlg('currentWalksModal');

window.openProfile = ()=> { prefillProfileForm(); openDlg('profileModal'); };
window.closeProfile = ()=> closeDlg('profileModal');

window.closeChat = ()=> { closeDlg('chatModal'); CURRENT_CHAT_JOB_ID = null; };

/* ✅ bids modal */
window.openBids = ()=> openDlg('bidsModal');
window.closeBids = ()=> closeDlg('bidsModal');

/* ===== Dashboard switching ===== */
function showSignedInUI(){
  const dash = document.getElementById('dash');
  const marketing = document.getElementById('marketing');
  if (dash) dash.style.display = 'block';
  if (marketing) marketing.style.display = 'none';
}
function showSignedOutUI(){
  const dash = document.getElementById('dash');
  const marketing = document.getElementById('marketing');
  if (dash) dash.style.display = 'none';
  if (marketing) marketing.style.display = 'block';
}

function computeRoleFlags(prof){
  const role = String(prof.role || '').toLowerCase();
  const isOwner  = prof.is_owner === '1' || role.includes('owner');
  const isWalker = prof.is_walker === '1' || role.includes('walker');
  return { isOwner, isWalker };
}

function renderDash(){
  const prof  = getProfile() || {};
  const { isOwner, isWalker } = computeRoleFlags(prof);

  const dashTitle = document.getElementById('dashTitle');
  const dashSub   = document.getElementById('dashSub');
  const ownerLatestCard = document.getElementById('ownerLatestCard');
  const walkerHintCard  = document.getElementById('walkerHintCard');

  if (dashTitle) dashTitle.textContent = `Welcome, ${prof.name || prof.email || 'there'}.`;
  if (dashSub) {
    dashSub.textContent =
      isOwner && isWalker ? 'Owner + Walker mode enabled. Pick what you want to do now.' :
      isOwner ? 'Owner mode: post a walk, then manage bids in one click.' :
      isWalker ? 'Walker mode: browse open walks and bid fast.' :
      'Complete your profile to unlock owner/walker features.';
  }

  if (ownerLatestCard) ownerLatestCard.style.display = isOwner ? 'block' : 'none';
  if (walkerHintCard)  walkerHintCard.style.display  = isWalker ? 'block' : 'none';

  if (isOwner) refreshOwnerLatestPreview().catch(()=>{});
}

/* render auth chip */
function renderAuthUI(){
  const token = getToken();
  const prof  = getProfile() || {};
  const signinBtn = document.getElementById('signinBtn');
  const chip      = document.getElementById('userChip');

  if (!token){
    if (signinBtn) signinBtn.style.display = 'inline-flex';
    if (chip) chip.style.display      = 'none';
    showSignedOutUI();
    return;
  }

  if (signinBtn) signinBtn.style.display = 'none';
  if (chip) chip.style.display      = 'flex';

  showSignedInUI();

  const { isOwner } = computeRoleFlags(prof);
  const name = prof.name || prof.email || 'Account';

  const parts = [];
  parts.push(`<span class="user-chip-name">${esc(name)}</span>`);
  if (isOwner) parts.push(`<span class="dot">·</span><button type="button" onclick="openOwnerModal()">Post walk</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openJobs()">Open walks</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openCurrentWalks()">Current</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openMyBids()">My bids</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openProfile()">Profile</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="doSignOut()">Sign out</button>`);
  chip.innerHTML = parts.join(' ');

  renderDash();
}

window.doSignOut = function(){
  signOut();
  renderAuthUI();
  showToast('Signed out');
};

/* ===== Sign in ===== */
document.getElementById('signinBtn')?.addEventListener('click', ()=> openDlg('signinModal'));

document.getElementById('signinForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = e.target.email.value.trim();
  const res   = await postForm({ action:'start_login', email });
  if (res && res.ok){
    showToast('Code sent. Use 555555 for testing.');
    const cf = document.getElementById('codeForm');
    cf.style.display = 'grid';
    cf.dataset.email = email;

    const resendBtn = document.getElementById('resendBtn');
    const resendT   = document.getElementById('resendT');
    let secs = 30;
    resendBtn.disabled = true;
    resendT.textContent = secs;

    const iv = setInterval(()=>{
      secs--;
      resendT.textContent = secs;
      if (secs <= 0){
        clearInterval(iv);
        resendBtn.disabled = false;
      }
    }, 1000);

    resendBtn.onclick = async ()=>{
      resendBtn.disabled = true;
      secs = 30;
      resendT.textContent = secs;
      const r2 = await postForm({ action:'start_login', email });
      showToast((r2 && r2.ok) ? 'Code re-sent.' : 'Could not resend.');
    };
  } else {
    showToast(res?.error || 'Could not send code.');
  }
});

document.getElementById('codeForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const code  = e.target.code.value.trim();
  const email = e.target.dataset.email || '';
  const res   = await postForm({ action:'verify_code', email, code });
  if (res && res.ok && res.token){
    setToken(res.token);
    setProfile(res.profile || { email });
    showToast('Signed in');
    renderAuthUI();
    closeDlg('signinModal');
    setTimeout(()=> window.openProfile(), 250);
  } else {
    showToast(res?.error || 'Invalid or expired code.');
  }
});

/* ===== Profile ===== */
function prefillProfileForm(){
  const prof = getProfile() || {};
  const form = document.getElementById('profileForm');
  if (!form) return;

  const map = (k)=> form.querySelector(`[name="${k}"]`);
  ['name','email','phone','address','city','pay_method','bio','role'].forEach(k=>{
    if (map(k) && prof[k]) map(k).value = prof[k];
  });

  const { isOwner, isWalker } = computeRoleFlags(prof);
  if (form.elements['is_owner']) form.elements['is_owner'].checked  = isOwner;
  if (form.elements['is_walker']) form.elements['is_walker'].checked = isWalker;
}

document.getElementById('profileForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  const isOwner  = form.elements['is_owner']?.checked;
  const isWalker = form.elements['is_walker']?.checked;
  data.is_owner  = isOwner ? '1' : '';
  data.is_walker = isWalker ? '1' : '';
  const roles = [];
  if (isOwner) roles.push('owner');
  if (isWalker) roles.push('walker');
  data.role = roles.join(',');

  const token = getToken();
  if (!token){ showToast('Sign in first'); return; }

  const res = await postForm({ action:'save_profile', token, role:data.role, profile:data });
  if (res && res.ok){
    setProfile(res.profile || data);
    renderAuthUI();
    showToast('Profile saved');
    closeDlg('profileModal');
  } else {
    showToast(res?.error || 'Could not save profile');
  }
});

/* ===== Owner post walk ===== */
function prefillOwnerFromProfile(){
  const prof = getProfile() || {};
  const form = document.getElementById('ownerForm');
  if (!form) return;
  if (prof.name) form.elements['name'].value = prof.name;
  if (prof.email) form.elements['email'].value = prof.email;
  if (prof.phone) form.elements['phone'].value = prof.phone;
  if (prof.city) form.elements['city'].value = prof.city;
  if (prof.address) form.elements['address'].value = prof.address;
}

function setDateMinToday(){
  const el = document.getElementById('date_owner');
  if (!el) return;
  const today = new Date().toISOString().slice(0,10);
  el.min = today;
  if (!el.value) el.value = today;
}

document.getElementById('ownerForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const token = getToken();
  if (!token){ showToast('Sign in first'); closeDlg('ownerModal'); openDlg('signinModal'); return; }

  const job = Object.fromEntries(new FormData(e.target).entries());
  const res = await postForm({ action:'create_job', token, job });
  if (res && res.ok){
    showToast('Walk posted.');
    e.target.reset();
    closeDlg('ownerModal');

    await refreshOwnerLatestPreview();
    openDlg('ownerJobsModal');
    await refreshOwnerJobs();
  } else {
    showToast(res?.error || 'Could not post walk.');
  }
});

/* ===== Jobs feed (walker) ===== */
async function refreshJobs(){
  const token = getToken();
  if (!token) return;

  const list = document.getElementById('jobsList');
  const empty = document.getElementById('jobsEmpty');
  if (list) list.innerHTML = '';
  if (empty) empty.style.display = 'none';

  const res = await postForm({ action:'list_jobs', token, filter:{} });
  const jobs = res.jobs || [];

  if (!jobs.length){
    if (empty) empty.style.display = 'block';
    return;
  }

  const money = (x)=> {
    const n = Number(x);
    return Number.isFinite(n) ? `${n.toFixed(0)} CHF` : (x ? `${x} CHF` : '');
  };

  list.innerHTML = jobs.map(j=>`
    <div class="card" style="margin-bottom:10px;">
      <div class="card-inner">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:800;">${esc(j.dog_name || 'Dog')} • ${esc(j.city || '')}</div>
            <div class="muted" style="font-size:12px;">
              ${esc(j.date||'')} ${esc(j.time||'')} • ${esc(j.duration||'')} min • max ${money(j.max_price)}
            </div>
          </div>
          <button class="btn btn-outline btn-small" onclick="openBidModal('${esc(j.job_id)}')">Bid</button>
        </div>
        ${j.notes ? `<div class="muted" style="margin-top:8px;font-size:12px;">${esc(j.notes)}</div>` : ``}
      </div>
    </div>
  `).join('');
}

window.openBidModal = function(jobId){
  const v = prompt('Your bid amount in CHF:');
  if (v == null) return;
  const amount = Number(v);
  if (!Number.isFinite(amount) || amount <= 0) return alert('Invalid amount');
  placeBidQuick(jobId, amount);
};

async function placeBidQuick(jobId, amount){
  const token = getToken();
  const res = await postForm({ action:'place_bid', token, job_id: jobId, bid:{ amount, message:'' } });
  if (!res.ok) return alert(res.error || 'Could not bid');
  showToast('Bid sent');
}

/* ===== Owner jobs + actions ===== */
async function refreshOwnerJobs(){
  const token = getToken();
  if (!token) return;

  const list = document.getElementById('ownerJobsList');
  const empty = document.getElementById('ownerJobsEmpty');
  if (list) list.innerHTML = '';
  if (empty) empty.style.display = 'none';

  const res = await postForm({ action:'owner_jobs', token });
  const jobs = res.jobs || [];

  if (!jobs.length){
    if (empty) empty.style.display = 'block';
    return;
  }

  list.innerHTML = jobs.map(j=>{
    const isAssigned = String(j.status||'').toLowerCase() === 'assigned';
    return `
      <div class="card" style="margin-bottom:10px;">
        <div class="card-inner">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div>
              <div style="font-weight:800;">${esc(j.dog_name || 'Dog')} • ${esc(j.city || '')}</div>
              <div class="muted" style="font-size:12px;">
                ${esc(j.date||'')} ${esc(j.time||'')} • ${esc(j.duration||'')} min • status: ${esc(j.status||'')}
              </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              <button class="btn btn-primary btn-small" onclick="openBidsForJob('${esc(j.job_id)}')">
                Manage bids
              </button>
              ${isAssigned ? `
                <button class="btn btn-outline btn-small" onclick="openChatForJob('${esc(j.job_id)}')">Chat</button>
                <button class="btn btn-outline btn-small" onclick="markDoneUI('${esc(j.job_id)}')">Mark done</button>
              ` : ``}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== Bids modal (real list + counter multiple) ===== */
window.openBidsForJob = async function(jobId){
  const token = getToken();
  if (!token) return;

  openDlg('bidsModal');

  const title = document.getElementById('bidsTitle');
  const list  = document.getElementById('bidsList');
  const empty = document.getElementById('bidsEmpty');

  if (title) title.textContent = `Bids for ${jobId}`;
  if (list) list.innerHTML = `<div class="card"><div class="card-inner">Loading bids…</div></div>`;
  if (empty) empty.style.display = 'none';

  const res = await postForm({ action:'list_bids', token, job_id: jobId });
  if (!res.ok){
    if (list) list.innerHTML = `<div class="card"><div class="card-inner">Error: ${esc(res.error || 'Could not load bids')}</div></div>`;
    return;
  }

  const bids = res.bids || [];
  if (!bids.length){
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  list.innerHTML = bids.map(b => {
    const name = b.walker_name || b.walker_email || 'Walker';
    const status = (b.status || '').toUpperCase();
    const amount = (b.amount != null && String(b.amount) !== '') ? `${esc(b.amount)} CHF` : '—';
    const bio = (b.message || '').startsWith('COUNTER:') ? '' : (b.message || '');

    return `
      <div class="card" style="margin-bottom:10px;">
        <div class="card-inner">
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:18px;">
              👤
            </div>

            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div style="min-width:0;">
                  <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(name)}</div>
                  <div class="muted" style="font-size:12px;margin-top:2px;">
                    <span style="font-weight:800;">${amount}</span>
                    ${status ? ` · ${esc(status)}` : ``}
                  </div>
                </div>
                <div class="muted" style="font-size:11px;opacity:.85;">⭐ reviews soon</div>
              </div>

              ${bio ? `<div class="muted" style="font-size:12px;margin-top:8px;">${esc(bio)}</div>` : ``}
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
            <button class="btn btn-primary btn-small" type="button"
              onclick="acceptBidUI('${esc(jobId)}','${esc(b.bid_id)}')">
              Accept
            </button>

            <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:220px;">
              <input id="counter_${esc(b.bid_id)}" type="number" min="1" step="1"
                     placeholder="Counter CHF"
                     style="flex:1; min-width:120px;">
              <button class="btn btn-outline btn-small" type="button"
                onclick="counterBidUI('${esc(jobId)}','${esc(b.bid_id)}')">
                Yes, counter
              </button>
              <button class="btn btn-ghost btn-small" type="button"
                onclick="clearCounterUI('${esc(b.bid_id)}')">
                No
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.clearCounterUI = function(bidId){
  const el = document.getElementById(`counter_${bidId}`);
  if (el) el.value = '';
  showToast('Counter cleared');
};

window.counterBidUI = async function(jobId, bidId){
  const token = getToken();
  const el = document.getElementById(`counter_${bidId}`);
  const amount = Number(el?.value || '');
  if (!Number.isFinite(amount) || amount <= 0){
    alert('Enter a valid counter amount.');
    return;
  }

  const res = await postForm({
    action:'counter_bid',
    token,
    job_id: jobId,
    bid_id: bidId,
    counter: { amount }
  });

  if (!res.ok){
    alert(res.error || 'Could not counter');
    return;
  }

  showToast('Counter sent');
  await window.openBidsForJob(jobId);
};

window.acceptBidUI = async function(jobId, bidId){
  const token = getToken();
  const res = await postForm({ action:'accept_bid', token, job_id: jobId, bid_id: bidId });
  if (!res.ok){
    alert(res.error || 'Could not accept');
    return;
  }

  showToast('Walker accepted ✅');
  closeDlg('bidsModal');
  await refreshJobs();
  await refreshOwnerJobs();
  await refreshCurrentWalks();
  await refreshOwnerLatestPreview();
};

window.markDoneUI = async function(jobId){
  const token = getToken();
  const res = await postForm({ action:'mark_done', token, job_id: jobId });
  if (!res.ok){
    alert(res.error || 'Could not mark done');
    return;
  }
  showToast('Walk completed ✅');
  await refreshOwnerJobs();
  await refreshJobs();
  await refreshCurrentWalks();
};

/* ===== My bids (walker history) ===== */
async function refreshMyBids(){
  const token = getToken();
  if (!token) return;

  const list = document.getElementById('myBidsList');
  const empty = document.getElementById('myBidsEmpty');
  if (list) list.innerHTML = '';
  if (empty) empty.style.display = 'none';

  const res = await postForm({ action:'my_bids', token });
  const bids = res.bids || [];

  if (!bids.length){
    if (empty) empty.style.display = 'block';
    return;
  }

  list.innerHTML = bids.map(b=>`
    <div class="card" style="margin-bottom:10px;">
      <div class="card-inner">
        <div style="font-weight:800;">${esc(b.job_id)}</div>
        <div class="muted" style="font-size:12px;">${esc(b.amount)} CHF • ${esc(b.status)}</div>
      </div>
    </div>
  `).join('');
}

/* ===== Current walks (owner + walker) + Chat button ===== */
async function refreshCurrentWalks(){
  const token = getToken();
  if (!token) return;

  const list = document.getElementById('currentWalksList');
  const empty = document.getElementById('currentWalksEmpty');
  if (list) list.innerHTML = '';
  if (empty) empty.style.display = 'none';

  const res = await postForm({ action:'current_walks', token });
  const jobs = res.jobs || [];

  if (!jobs.length){
    if (empty) empty.style.display = 'block';
    return;
  }

  list.innerHTML = jobs.map(j=>`
    <div class="card" style="margin-bottom:10px;">
      <div class="card-inner">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:800;">${esc(j.dog_name||'Dog')} • ${esc(j.city||'')}</div>
            <div class="muted" style="font-size:12px;">${esc(j.date||'')} ${esc(j.time||'')} • ${esc(j.duration||'')} min</div>
            <div class="muted" style="font-size:12px;margin-top:8px;">Owner: ${esc(j.owner_email||'')}</div>
            <div class="muted" style="font-size:12px;">Walker: ${esc(j.assigned_walker_email||'')}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn btn-outline btn-small" onclick="openChatForJob('${esc(j.job_id)}')">Chat</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ===== Chat (works with your backend) ===== */
window.openChatForJob = async function(jobId){
  CURRENT_CHAT_JOB_ID = jobId;
  openDlg('chatModal');
  await loadChat();
};

window.loadChat = async function(){
  const token = getToken();
  if (!token || !CURRENT_CHAT_JOB_ID) return;

  const box = document.getElementById('chatMessages');
  const header = document.getElementById('chatHeader');
  if (header) header.textContent = `Chat for walk ${CURRENT_CHAT_JOB_ID}`;

  if (box) box.innerHTML = `<div class="chat-empty">Loading messages…</div>`;

  const res = await postForm({ action:'list_messages', token, job_id: CURRENT_CHAT_JOB_ID });
  if (!res.ok){
    if (box) box.innerHTML = `<div class="chat-empty">Error: ${esc(res.error || 'Could not load messages')}</div>`;
    return;
  }

  const msgs = res.messages || [];
  if (!msgs.length){
    if (box) box.innerHTML = `<div class="chat-empty">No messages yet. Say hi 👋</div>`;
    return;
  }

  const me = (getProfile()?.email || '').toLowerCase();

  if (box) {
    box.innerHTML = msgs.map(m=>{
      const mine = String(m.sender_email||'').toLowerCase() === me;
      return `
        <div style="display:flex;justify-content:${mine ? 'flex-end' : 'flex-start'};margin:6px 0;">
          <div style="max-width:85%;padding:10px 12px;border-radius:14px;
                      background:${mine ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.06)'};">
            <div class="muted" style="font-size:11px;margin-bottom:3px;">
              ${esc(m.sender_name || m.sender_email || 'User')}
            </div>
            <div style="white-space:pre-wrap;">${esc(m.body || '')}</div>
          </div>
        </div>
      `;
    }).join('');

    box.scrollTop = box.scrollHeight;
  }
};

document.getElementById('chatForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const token = getToken();
  if (!token || !CURRENT_CHAT_JOB_ID) return;

  const body = (e.target.body.value || '').trim();
  if (!body) return;

  const res = await postForm({ action:'send_message', token, job_id: CURRENT_CHAT_JOB_ID, body });
  if (!res.ok){
    alert(res.error || 'Could not send');
    return;
  }
  e.target.body.value = '';
  await loadChat();
});

/* ===== Latest owner walk preview on dashboard ===== */
async function refreshOwnerLatestPreview(){
  const token = getToken();
  if (!token) return;

  const res = await postForm({ action:'owner_jobs', token });
  const jobs = res.jobs || [];
  const card = document.getElementById('ownerLatestCard');
  const body = document.getElementById('ownerLatestBody');
  const bidsBtn = document.getElementById('ownerLatestBidsBtn');

  if (!card || !body || !bidsBtn) return;

  if (!jobs.length){
    body.textContent = 'No walks posted yet.';
    bidsBtn.onclick = ()=> openOwnerModal();
    bidsBtn.textContent = 'Post first walk';
    return;
  }

  const j = jobs[0];

  body.innerHTML = `
    <div style="font-weight:800;">${esc(j.dog_name||'Dog')} • ${esc(j.city||'')}</div>
    <div class="muted" style="font-size:12px;margin-top:4px;">
      ${esc(j.date||'')} ${esc(j.time||'')} • ${esc(j.duration||'')} min • status: ${esc(j.status||'')}
    </div>
  `;

  bidsBtn.textContent = 'Manage bids';
  bidsBtn.onclick = async ()=>{
    openDlg('ownerJobsModal');
    await refreshOwnerJobs();
    setTimeout(()=> window.openBidsForJob(j.job_id), 120);
  };
}

/* init */
document.getElementById('yr') && (document.getElementById('yr').textContent = new Date().getFullYear());

(function init(){
  renderAuthUI();
  setDateMinToday();
})();
