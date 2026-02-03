// ui.js — igo front-end logic (modal-based, role-aware)
// Depends on: api.js (postForm), auth.js (getToken/setToken/getProfile/setProfile/signOut)

let CURRENT_CHAT_JOB_ID = null;

/* ---------------- Debug panel ---------------- */
const dbg    = document.getElementById('debug');
const dbgpre = document.getElementById('dbgpre');

window.setDebug = function setDebug(msg){
  try{ dbgpre.textContent = (typeof msg === 'string') ? msg : JSON.stringify(msg,null,2); }
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

/* ---------------- Dialog helpers ---------------- */
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
window.openSignin      = ()=> openDlg('signinModal');
window.closeSignin     = ()=> closeDlg('signinModal');
window.openOwnerModal  = ()=> { openDlg('ownerModal'); prefillOwnerFromProfile(); setDateMinToday(); };
window.closeOwnerModal = ()=> closeDlg('ownerModal');
window.openJobs        = ()=> { openDlg('jobsModal'); refreshJobs(); };
window.closeJobs       = ()=> closeDlg('jobsModal');
window.openOwnerJobs   = ()=> { openDlg('ownerJobsModal'); refreshOwnerJobs(); };
window.closeOwnerJobs  = ()=> closeDlg('ownerJobsModal');
window.openMyBids      = ()=> { openDlg('myBidsModal'); refreshMyBids(); };
window.closeMyBids     = ()=> closeDlg('myBidsModal');
window.openCurrentWalks= ()=> { openDlg('currentWalksModal'); refreshCurrentWalks(); };
window.closeCurrentWalks=()=> closeDlg('currentWalksModal');
window.openProfile     = ()=> { prefillProfileForm(); openDlg('profileModal'); };
window.closeProfile    = ()=> closeDlg('profileModal');

window.closeChat = ()=> { closeDlg('chatModal'); CURRENT_CHAT_JOB_ID = null; };

/* ---------------- Small utils ---------------- */
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function money(x){
  const n = Number(x);
  if (!Number.isFinite(n)) return x ? `${esc(x)} CHF` : '';
  return `${Math.round(n)} CHF`;
}
function normCity(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
function fmtWhen(j){
  const d = String(j.date||'').trim();
  const t = String(j.time||'').trim();
  return [d,t].filter(Boolean).join(' ');
}
function statusBadge(status){
  const s = String(status||'').toLowerCase();
  if (s === 'open') return `<span class="badge">OPEN</span>`;
  if (s === 'assigned') return `<span class="badge badge-purple">ASSIGNED</span>`;
  if (s === 'done') return `<span class="badge badge-green">DONE</span>`;
  return `<span class="badge">${esc(String(status||'').toUpperCase())}</span>`;
}
function bidStatusBadge(status){
  const s = String(status||'').toLowerCase();
  if (s === 'accepted') return `<span class="badge badge-green">ACCEPTED</span>`;
  if (s === 'countered') return `<span class="badge badge-purple">COUNTER</span>`;
  if (s === 'rejected') return `<span class="badge">REJECTED</span>`;
  return `<span class="badge">ACTIVE</span>`;
}

function computeRoleFlags(prof){
  const role = String(prof.role || '').toLowerCase();
  const isOwner  = prof.is_owner === '1' || role.includes('owner');
  const isWalker = prof.is_walker === '1' || role.includes('walker');
  return { isOwner, isWalker };
}

/* ---------------- Dynamic dialogs (Bid + Bids) ---------------- */
function ensureDynamicDialog(id, title){
  let d = document.getElementById(id);
  if (d) return d;

  d = document.createElement('dialog');
  d.id = id;
  d.innerHTML = `
    <div class="modal-head">
      <span>${esc(title || '')}</span>
      <button class="btn btn-ghost btn-small" data-close>✕</button>
    </div>
    <div class="modal-body" id="${id}Body"></div>
  `;
  document.body.appendChild(d);
  d.querySelector('[data-close]')?.addEventListener('click', ()=> closeDlg(id));
  return d;
}

function openBidModal(job){
  ensureDynamicDialog('bidModal', 'Place a bid');
  const body = document.getElementById('bidModalBody');
  const maxP = job?.max_price ? Number(job.max_price) : NaN;
  const suggested = Number.isFinite(maxP) && maxP > 0 ? Math.round(maxP) : '';
  body.innerHTML = `
    <form id="bidForm" class="grid">
      <div class="job-card">
        <div class="job-title">${esc(job.dog_name || 'Dog')} • ${esc(job.city || '')}</div>
        <div class="job-meta">${esc(fmtWhen(job))}${job.duration ? ` • ${esc(job.duration)} min` : ''}${job.max_price ? ` • max ${money(job.max_price)}` : ''}</div>
        ${job.notes ? `<div class="job-notes">${esc(job.notes)}</div>` : ''}
      </div>

      <div class="row">
        <div>
          <label>Amount (CHF)</label>
          <input name="amount" type="number" min="1" step="1" placeholder="${suggested ? `e.g. ${suggested}` : 'e.g. 25'}" value="${suggested}">
        </div>
        <div>
          <label>Quick note (optional)</label>
          <input name="message" type="text" placeholder="Anything the owner should know?">
        </div>
      </div>

      <button class="btn btn-primary" type="submit">Send bid</button>
      <p class="muted" style="font-size:11px;margin-top:4px;">Tip: keep it simple. The owner can accept or counter in one tap.</p>
    </form>
  `;
  body.querySelector('#bidForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const token = getToken();
    if (!token){ showToast('Sign in first'); closeDlg('bidModal'); openDlg('signinModal'); return; }
    const fd = new FormData(e.target);
    const amount = Number(fd.get('amount') || '');
    const message = String(fd.get('message') || '');
    const res = await postForm({ action:'place_bid', token, job_id: job.job_id, bid:{ amount, message } });
    if (res?.ok){
      showToast('Bid sent');
      closeDlg('bidModal');
      refreshMyBids();
    } else {
      showToast(res?.error || 'Could not send bid');
    }
  });

  openDlg('bidModal');
}

async function openBidsModal(job){
  ensureDynamicDialog('bidsModal', 'Bids');
  const body = document.getElementById('bidsModalBody');

  body.innerHTML = `<div class="job-card">Loading bids…</div>`;
  openDlg('bidsModal');

  const token = getToken();
  const res = await postForm({ action:'list_bids', token, job_id: job.job_id });
  const bids = (res && res.ok && Array.isArray(res.bids)) ? res.bids : [];

  const head = `
    <div class="job-card">
      <div class="job-header">
        <div>
          <div class="job-title">${esc(job.dog_name || 'Dog')} • ${esc(job.city || '')}</div>
          <div class="job-meta">${esc(fmtWhen(job))}${job.duration ? ` • ${esc(job.duration)} min` : ''}</div>
        </div>
        <div>${statusBadge(job.status)}</div>
      </div>
      ${job.max_price ? `<div class="job-meta" style="margin-top:6px;">Max price: <b>${money(job.max_price)}</b></div>` : ''}
    </div>
  `;

  if (!bids.length){
    body.innerHTML = head + `<div class="job-card"><div class="job-meta">No bids yet. Walkers are being notified.</div></div>`;
    return;
  }

  const cards = bids.map(b=>{
    const name = b.walker_name || b.walker_email || 'Walker';
    const amountText = (b.amount != null && String(b.amount) !== '') ? money(b.amount) : '';
    const msg = String(b.message || '');

    const counterPrefill = (String(b.status||'').toLowerCase()==='countered' && msg.startsWith('COUNTER:'))
      ? msg.replace('COUNTER:','').trim()
      : '';

    const canAct = String(job.status||'').toLowerCase()==='open';

    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">${esc(name)} ${amountText ? `• ${amountText}` : ''}</div>
            <div class="job-meta">${bidStatusBadge(b.status)} • ${esc(String(b.created_at || ''))}</div>
          </div>
          ${canAct ? `
            <button class="btn btn-primary btn-small" type="button" data-accept="${esc(b.bid_id)}">Accept</button>
          ` : ''}
        </div>

        ${msg && !msg.startsWith('COUNTER:') ? `<div class="job-notes">${esc(msg)}</div>` : ''}

        ${canAct ? `
          <div class="row" style="margin-top:10px;">
            <div>
              <label>Counter (CHF)</label>
              <input type="number" min="1" step="1" value="${esc(counterPrefill)}" placeholder="e.g. 22" data-counter="${esc(b.bid_id)}">
            </div>
            <div style="display:flex;align-items:flex-end;gap:8px;">
              <button class="btn btn-outline btn-small" type="button" data-sendcounter="${esc(b.bid_id)}">Send counter</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  body.innerHTML = head + cards;

  body.querySelectorAll('[data-accept]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const bid_id = btn.getAttribute('data-accept');
      btn.disabled = true;
      const token = getToken();
      const r = await postForm({ action:'accept_bid', token, job_id: job.job_id, bid_id });
      if (r?.ok){
        showToast('Accepted');
        closeDlg('bidsModal');
        await refreshOwnerJobs();
        await refreshJobs();
        await refreshCurrentWalks();
      } else {
        btn.disabled = false;
        showToast(r?.error || 'Could not accept');
      }
    });
  });

  body.querySelectorAll('[data-sendcounter]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const bid_id = btn.getAttribute('data-sendcounter');
      const input = body.querySelector(`[data-counter="${CSS.escape(bid_id)}"]`);
      const amount = Number(input?.value || '');
      const token = getToken();
      btn.disabled = true;
      const r = await postForm({ action:'counter_bid', token, job_id: job.job_id, bid_id, counter:{ amount } });
      if (r?.ok){
        showToast('Counter sent');
        await openBidsModal(job);
      } else {
        btn.disabled = false;
        showToast(r?.error || 'Could not counter');
      }
    });
  });
}

/* ---------------- Auth chip + role-aware labels ---------------- */
function renderAuthUI(){
  const token = getToken();
  const prof  = getProfile();
  const signinBtn = document.getElementById('signinBtn');
  const chip      = document.getElementById('userChip');

  if (!token){
    signinBtn.style.display = 'inline-flex';
    chip.style.display      = 'none';
    return;
  }

  const { isOwner, isWalker } = computeRoleFlags(prof);
  signinBtn.style.display = 'none';
  chip.style.display      = 'flex';

  const name = prof.name || prof.email || 'Account';
  const parts = [];
  parts.push(`<span class="user-chip-name">${esc(name)}</span>`);
  if (isOwner)  parts.push(`<span class="dot">·</span><button type="button" onclick="openOwnerJobs()">Owner</button>`);
  if (isWalker) parts.push(`<span class="dot">·</span><button type="button" onclick="openJobs()">Walker</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openCurrentWalks()">Current</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openMyBids()">My bids</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openProfile()">Profile</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="doSignOut()">Sign out</button>`);
  chip.innerHTML = parts.join(' ');
}
window.doSignOut = function(){
  signOut();
  renderAuthUI();
  showToast('Signed out');
};

/* ======================== Sign in ======================== */
document.getElementById('signinBtn').onclick = ()=> openDlg('signinModal');

document.getElementById('signinForm').addEventListener('submit', async (e)=>{
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

document.getElementById('codeForm').addEventListener('submit', async (e)=>{
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

/* ======================== Profile ======================== */
function prefillProfileForm(){
  const prof = getProfile();
  const form = document.getElementById('profileForm');
  if (!form) return;

  const map = (k)=> form.querySelector(`[name="${k}"]`);
  ['name','email','phone','address','city','pay_method','bio','role'].forEach(k=>{
    if (map(k) && prof[k]) map(k).value = prof[k];
  });

  const { isOwner, isWalker } = computeRoleFlags(prof);
  form.elements['is_owner'].checked  = isOwner;
  form.elements['is_walker'].checked = isWalker;
}

document.getElementById('profileForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  const isOwner  = form.elements['is_owner'].checked;
  const isWalker = form.elements['is_walker'].checked;
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

/* ======================== Owner post walk ======================== */
function prefillOwnerFromProfile(){
  const prof = getProfile();
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

document.getElementById('ownerForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const token = getToken();
  if (!token){ showToast('Sign in first'); closeDlg('ownerModal'); openDlg('signinModal'); return; }

  const job = Object.fromEntries(new FormData(e.target).entries());
  const res = await postForm({ action:'create_job', token, job });

  if (res && res.ok){
    showToast('Walk posted');
    e.target.reset();
    closeDlg('ownerModal');
    openDlg('ownerJobsModal');
    refreshOwnerJobs();
  } else {
    showToast(res?.error || 'Could not post walk');
  }
});

/* ======================== Jobs feed (walker) ======================== */
async function refreshJobs(){
  const list = document.getElementById('jobsList');
  const empty = document.getElementById('jobsEmpty');
  if (!list) return;

  list.innerHTML = `<div class="job-card"><div class="job-meta">Loading walks…</div></div>`;
  if (empty) empty.style.display = 'none';

  const token = getToken();
  if (!token){
    list.innerHTML = `<div class="job-card"><div class="job-meta">Please sign in to see jobs.</div></div>`;
    return;
  }

  const res = await postForm({ action:'list_jobs', token, filter:{} });
  const jobs = (res && res.ok && Array.isArray(res.jobs)) ? res.jobs : [];

  if (!jobs.length){
    list.innerHTML = ``;
    if (empty) empty.style.display = 'block';
    return;
  }

  const meCity = normCity(getProfile()?.city || '');

  list.innerHTML = jobs.map(j=>{
    const near = (meCity && normCity(j.city) === meCity) ? '1' : (j.near || '');
    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">${esc(j.dog_name || 'Dog')} • ${esc(j.city || '')} ${near ? `<span class="badge" style="margin-left:6px;">NEAR YOU</span>` : ''}</div>
            <div class="job-meta">${esc(fmtWhen(j))}${j.duration ? ` • ${esc(j.duration)} min` : ''}${j.max_price ? ` • max ${money(j.max_price)}` : ''}</div>
          </div>
          <button class="btn btn-outline btn-small" type="button" data-bid="${esc(j.job_id)}">Bid</button>
        </div>
        ${j.notes ? `<div class="job-notes">${esc(j.notes)}</div>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-bid]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-bid');
      const job = jobs.find(x=> String(x.job_id) === String(id));
      if (job) openBidModal(job);
    });
  });
}
window.refreshJobs = refreshJobs;

/* ======================== Owner jobs ======================== */
async function refreshOwnerJobs(){
  const list = document.getElementById('ownerJobsList');
  const empty = document.getElementById('ownerJobsEmpty');
  if (!list) return;

  list.innerHTML = `<div class="job-card"><div class="job-meta">Loading your walks…</div></div>`;
  if (empty) empty.style.display = 'none';

  const token = getToken();
  if (!token){
    list.innerHTML = `<div class="job-card"><div class="job-meta">Please sign in.</div></div>`;
    return;
  }

  const res = await postForm({ action:'owner_jobs', token });
  const jobs = (res && res.ok && Array.isArray(res.jobs)) ? res.jobs : [];

  if (!jobs.length){
    list.innerHTML = ``;
    if (empty) empty.style.display = 'block';
    return;
  }

  list.innerHTML = jobs.map(j=>{
    const st = String(j.status||'').toLowerCase();
    const buttons = st === 'open'
      ? `<button class="btn btn-outline btn-small" type="button" data-bids="${esc(j.job_id)}">Bids</button>`
      : st === 'assigned'
        ? `
          <button class="btn btn-outline btn-small" type="button" data-chat="${esc(j.job_id)}">Chat</button>
          <button class="btn btn-primary btn-small" type="button" data-done="${esc(j.job_id)}">Mark done</button>
        `
        : `<button class="btn btn-outline btn-small" type="button" data-bids="${esc(j.job_id)}">Bids</button>`;

    const assignedLine = st === 'assigned'
      ? `<div class="job-meta" style="margin-top:6px;">Walker: <b>${esc(j.assigned_walker_email || '')}</b></div>`
      : '';

    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">${esc(j.dog_name || 'Dog')} • ${esc(j.city || '')}</div>
            <div class="job-meta">${esc(fmtWhen(j))}${j.duration ? ` • ${esc(j.duration)} min` : ''}${j.max_price ? ` • max ${money(j.max_price)}` : ''}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${statusBadge(j.status)}
            ${buttons}
          </div>
        </div>
        ${j.notes ? `<div class="job-notes">${esc(j.notes)}</div>` : ''}
        ${assignedLine}
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-bids]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-bids');
      const job = jobs.find(x=> String(x.job_id) === String(id));
      if (job) openBidsModal(job);
    });
  });

  list.querySelectorAll('[data-done]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-done');
      btn.disabled = true;
      const token = getToken();
      const r = await postForm({ action:'mark_done', token, job_id: id });
      if (r?.ok){
        showToast('Marked done');
        await refreshOwnerJobs();
        await refreshCurrentWalks();
      } else {
        btn.disabled = false;
        showToast(r?.error || 'Could not mark done');
      }
    });
  });

  list.querySelectorAll('[data-chat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-chat');
      openChatForJob(id);
    });
  });
}
window.refreshOwnerJobs = refreshOwnerJobs;

/* ======================== My bids ======================== */
async function refreshMyBids(){
  const list = document.getElementById('myBidsList');
  const empty = document.getElementById('myBidsEmpty');
  if (!list) return;

  list.innerHTML = `<div class="job-card"><div class="job-meta">Loading…</div></div>`;
  if (empty) empty.style.display = 'none';

  const token = getToken();
  if (!token){
    list.innerHTML = `<div class="job-card"><div class="job-meta">Please sign in.</div></div>`;
    return;
  }

  const res = await postForm({ action:'my_bids', token });
  const bids = (res && res.ok && Array.isArray(res.bids)) ? res.bids : [];

  if (!bids.length){
    list.innerHTML = ``;
    if (empty) empty.style.display = 'block';
    return;
  }

  list.innerHTML = bids.map(b=>{
    const jobId = String(b.job_id||'');
    const msg = String(b.message||'');
    const counter = (String(b.status||'').toLowerCase()==='countered' && msg.startsWith('COUNTER:'))
      ? msg.replace('COUNTER:','').trim()
      : '';

    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">Bid • ${money(b.amount)} ${counter ? `<span class="badge badge-purple" style="margin-left:6px;">Counter ${esc(counter)} CHF</span>` : ''}</div>
            <div class="job-meta">${bidStatusBadge(b.status)} • ${esc(jobId)}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-outline btn-small" type="button" onclick="openJobs()">Open walks</button>
            <button class="btn btn-outline btn-small" type="button" onclick="openCurrentWalks()">Current</button>
          </div>
        </div>
        ${msg && !msg.startsWith('COUNTER:') ? `<div class="job-notes">${esc(msg)}</div>` : ''}
      </div>
    `;
  }).join('');
}
window.refreshMyBids = refreshMyBids;

/* ======================== Current walks ======================== */
async function refreshCurrentWalks(){
  const list = document.getElementById('currentWalksList');
  const empty = document.getElementById('currentWalksEmpty');
  if (!list) return;

  list.innerHTML = `<div class="job-card"><div class="job-meta">Loading…</div></div>`;
  if (empty) empty.style.display = 'none';

  const token = getToken();
  if (!token){
    list.innerHTML = `<div class="job-card"><div class="job-meta">Please sign in.</div></div>`;
    return;
  }

  const res = await postForm({ action:'current_walks', token });
  const jobs = (res && res.ok && Array.isArray(res.jobs)) ? res.jobs : [];

  if (!jobs.length){
    list.innerHTML = ``;
    if (empty) empty.style.display = 'block';
    return;
  }

  const me = String(getProfile()?.email || '').trim().toLowerCase();

  list.innerHTML = jobs.map(j=>{
    const isOwner = String(j.owner_email||'').toLowerCase() === me;
    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">${esc(j.dog_name || 'Dog')} • ${esc(j.city || '')}</div>
            <div class="job-meta">${esc(fmtWhen(j))}${j.duration ? ` • ${esc(j.duration)} min` : ''}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${statusBadge(j.status)}
            <button class="btn btn-outline btn-small" type="button" data-chat="${esc(j.job_id)}">Chat</button>
            ${isOwner ? `<button class="btn btn-primary btn-small" type="button" data-done="${esc(j.job_id)}">Mark done</button>` : ``}
          </div>
        </div>
        <div class="job-meta" style="margin-top:6px;">
          Owner: <b>${esc(j.owner_email || '')}</b><br>
          Walker: <b>${esc(j.assigned_walker_email || '')}</b>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-chat]').forEach(btn=>{
    btn.addEventListener('click', ()=> openChatForJob(btn.getAttribute('data-chat')));
  });

  list.querySelectorAll('[data-done]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-done');
      btn.disabled = true;
      const token = getToken();
      const r = await postForm({ action:'mark_done', token, job_id: id });
      if (r?.ok){
        showToast('Marked done');
        await refreshCurrentWalks();
        await refreshOwnerJobs();
      } else {
        btn.disabled = false;
        showToast(r?.error || 'Could not mark done');
      }
    });
  });
}
window.refreshCurrentWalks = refreshCurrentWalks;

/* ======================== Chat ======================== */
function openChatForJob(job_id){
  CURRENT_CHAT_JOB_ID = job_id;
  const h = document.getElementById('chatHeader');
  if (h) h.textContent = `Chat for this walk • ${job_id}`;
  openDlg('chatModal');
  loadChat();
}
window.openChatForJob = openChatForJob;

async function loadChat(){
  const msgBox = document.getElementById('chatMessages');
  if (!msgBox) return;

  const token = getToken();
  if (!token || !CURRENT_CHAT_JOB_ID){
    msgBox.innerHTML = `<div class="chat-empty">Open a walk chat first.</div>`;
    return;
  }

  const res = await postForm({ action:'list_messages', token, job_id: CURRENT_CHAT_JOB_ID });
  const messages = (res && res.ok && Array.isArray(res.messages)) ? res.messages : [];

  if (!messages.length){
    msgBox.innerHTML = `<div class="chat-empty">No messages yet.</div>`;
    return;
  }

  const me = String(getProfile()?.email || '').trim().toLowerCase();

  msgBox.innerHTML = messages.map(m=>{
    const mine = String(m.sender_email||'').trim().toLowerCase() === me;
    const cls = mine ? 'me' : 'other';
    const ts = m.ts ? new Date(m.ts).toLocaleString() : '';
    return `
      <div class="chat-bubble ${cls}">
        <div>${esc(m.body || '')}</div>
        <div class="chat-meta">${esc(m.sender_name || m.sender_email || '')}${ts ? ` · ${esc(ts)}` : ''}</div>
      </div>
    `;
  }).join('');

  msgBox.scrollTop = msgBox.scrollHeight;
}
window.loadChat = loadChat;

document.getElementById('chatForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const token = getToken();
  if (!token || !CURRENT_CHAT_JOB_ID){ showToast('Open a chat first'); return; }

  const body = e.target.body.value.trim();
  if (!body) return;

  const res = await postForm({ action:'send_message', token, job_id: CURRENT_CHAT_JOB_ID, body });
  if (res?.ok){
    e.target.body.value = '';
    await loadChat();
  } else {
    showToast(res?.error || 'Could not send');
  }
});

/* ======================== Init ======================== */
document.getElementById('yr').textContent = new Date().getFullYear();

(function init(){
  renderAuthUI();
  setDateMinToday();
})();
