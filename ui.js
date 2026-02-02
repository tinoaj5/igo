// ui.js
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

/* ---------- small helpers ---------- */
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]
  ));
}
function moneyCHF(x){
  const n = Number(x);
  return Number.isFinite(n) ? `${n.toFixed(0)} CHF` : (x ? `${x} CHF` : "");
}
function fmtStatus(s){
  return String(s || "").toUpperCase();
}
function roleFlags(prof){
  const role = String(prof?.role || '').toLowerCase();
  const isOwner  = prof?.is_owner === '1' || role.includes('owner');
  const isWalker = prof?.is_walker === '1' || role.includes('walker');
  return { isOwner, isWalker };
}

/* ---------- auth chip ---------- */
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

  const { isOwner } = roleFlags(prof);
  signinBtn.style.display = 'none';
  chip.style.display      = 'flex';

  const name = prof.name || prof.email || 'Account';
  const parts = [];
  parts.push(`<span class="user-chip-name">${esc(name)}</span>`);
  if (isOwner) parts.push(`<span class="dot">·</span><button type="button" onclick="openOwnerJobs()">My walks</button>`);
  parts.push(`<span class="dot">·</span><button type="button" onclick="openJobs()">Jobs</button>`);
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

/* ===== Sign in ===== */
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

/* ===== Profile ===== */
function prefillProfileForm(){
  const prof = getProfile();
  const form = document.getElementById('profileForm');
  if (!form) return;
  const map = (k)=> form.querySelector(`[name="${k}"]`);
  ['name','email','phone','address','city','pay_method','bio','role'].forEach(k=>{
    if (map(k) && prof[k]) map(k).value = prof[k];
  });
  const { isOwner, isWalker } = roleFlags(prof);
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

/* ===== Owner post walk ===== */
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
    showToast('Walk posted.');
    e.target.reset();
    closeDlg('ownerModal');
    // update owner list + jobs feed
    refreshOwnerJobs();
    refreshJobs();
  } else {
    showToast(res?.error || 'Could not post walk.');
  }
});

/* =========================================================
   JOBS: Open walks near you (jobsModal / #jobsList)
   ========================================================= */

function setEmptyState(listEl, emptyEl, isEmpty){
  if (listEl) listEl.style.display = isEmpty ? "none" : "block";
  if (emptyEl) emptyEl.style.display = isEmpty ? "block" : "none";
}

window.refreshJobs = async function refreshJobs(){
  const token = getToken();
  const list = document.getElementById("jobsList");
  const empty = document.getElementById("jobsEmpty");
  if (!list) return;

  list.innerHTML = `<div class="muted">Loading…</div>`;
  setEmptyState(list, empty, false);

  const res = await postForm({ action:"list_jobs", token, filter:{} });
  if (!res || !res.ok){
    list.innerHTML = `<div class="muted">Error: ${esc(res?.error || "failed")}</div>`;
    return;
  }

  const jobs = res.jobs || [];
  if (!jobs.length){
    list.innerHTML = "";
    setEmptyState(list, empty, true);
    return;
  }

  list.innerHTML = jobs.map(j => {
    const near = j.near === "1" ? `<div class="pill pill--accent">Near you</div>` : ``;
    const max = j.max_price ? ` • max ${moneyCHF(j.max_price)}` : ``;
    return `
      <div class="job-card">
        <div class="job-top">
          <div class="job-left">
            <div class="job-title">${esc(j.dog_name || "Dog")} • ${esc(j.city || "")}</div>
            <div class="job-meta">${esc(j.date || "")} ${esc(j.time || "")} • ${esc(j.duration || "")} min${max}</div>
            ${near}
          </div>
          <div class="job-right">
            <button class="btn btn-small btn-outline" type="button" onclick="openBid('${esc(j.job_id)}')">Bid</button>
          </div>
        </div>
        ${j.notes ? `<div class="job-notes">${esc(j.notes)}</div>` : ``}
      </div>
    `;
  }).join("");
};

// Bid flow: simple prompt modal-less (keeps your UI clean)
window.openBid = async function openBid(jobId){
  const token = getToken();
  if (!token){ showToast("Sign in first"); openDlg("signinModal"); return; }

  const amountStr = prompt("Your bid amount (CHF):", "25");
  if (amountStr == null) return;
  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount <= 0){ showToast("Invalid amount"); return; }

  const message = prompt("Optional message to owner:", "") || "";
  const res = await postForm({ action:"place_bid", token, job_id: jobId, bid:{ amount, message } });

  if (res && res.ok){
    showToast("Bid sent");
    refreshMyBids();
  } else {
    showToast(res?.error || "Could not send bid");
  }
};

/* =========================================================
   OWNER JOBS: My walk requests (ownerJobsModal / #ownerJobsList)
   ========================================================= */

window.refreshOwnerJobs = async function refreshOwnerJobs(){
  const token = getToken();
  const list = document.getElementById("ownerJobsList");
  const empty = document.getElementById("ownerJobsEmpty");
  if (!list) return;

  list.innerHTML = `<div class="muted">Loading…</div>`;
  setEmptyState(list, empty, false);

  const res = await postForm({ action:"owner_jobs", token });
  if (!res || !res.ok){
    list.innerHTML = `<div class="muted">Error: ${esc(res?.error || "failed")}</div>`;
    return;
  }

  const jobs = res.jobs || [];
  if (!jobs.length){
    list.innerHTML = "";
    setEmptyState(list, empty, true);
    return;
  }

  list.innerHTML = jobs.map(j => {
    const st = fmtStatus(j.status);
    const assigned = String(j.status||"").toLowerCase() === "assigned";
    return `
      <div class="job-card">
        <div class="job-top">
          <div class="job-left">
            <div class="job-title">${esc(j.dog_name || "Dog")} • ${esc(j.city || "")}</div>
            <div class="job-meta">${esc(j.date || "")} ${esc(j.time || "")} • ${esc(j.duration || "")} min</div>
            <div class="pill">${esc(st)}</div>
          </div>
          <div class="job-right" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn btn-small btn-outline" type="button" onclick="openBids('${esc(j.job_id)}')">Bids</button>
            ${assigned ? `<button class="btn btn-small btn-primary" type="button" onclick="markDone('${esc(j.job_id)}')">Mark done</button>` : ``}
            <button class="btn btn-small btn-ghost" type="button" onclick="openChatForJob('${esc(j.job_id)}')">Chat</button>
          </div>
        </div>
        ${assigned && j.assigned_walker_email ? `<div class="muted" style="margin-top:6px;">Walker: ${esc(j.assigned_walker_email)}</div>` : ``}
      </div>
    `;
  }).join("");
};

window.markDone = async function markDone(jobId){
  const token = getToken();
  const res = await postForm({ action:"mark_done", token, job_id: jobId });
  if (res && res.ok){
    showToast("Marked done ✅");
    refreshOwnerJobs();
    refreshCurrentWalks();
    refreshJobs();
  } else {
    showToast(res?.error || "Could not mark done");
  }
};

/* =========================================================
   BIDS: owner opens bids for one job (uses prompt-based UI)
   ========================================================= */

window.openBids = async function openBids(jobId){
  const token = getToken();
  if (!token){ showToast("Sign in first"); return; }

  const res = await postForm({ action:"list_bids", token, job_id: jobId });
  if (!res || !res.ok){
    showToast(res?.error || "Could not load bids");
    return;
  }
  const bids = res.bids || [];
  if (!bids.length){
    alert("No bids yet.");
    return;
  }

  // Show bids in a simple text picker
  const lines = bids.map((b, i)=> {
    const who = b.walker_name || b.walker_email || "walker";
    const amt = moneyCHF(b.amount);
    const st = fmtStatus(b.status);
    return `${i+1}) ${who} — ${amt} — ${st}`;
  }).join("\n");

  const pick = prompt(
    `Bids for job ${jobId}\n\n${lines}\n\nType number to ACCEPT, or leave blank to cancel:`,
    ""
  );
  if (!pick) return;
  const idx = Number(pick) - 1;
  if (!(idx >= 0 && idx < bids.length)){ showToast("Invalid selection"); return; }

  const chosen = bids[idx];
  const res2 = await postForm({ action:"accept_bid", token, job_id: jobId, bid_id: chosen.bid_id });
  if (res2 && res2.ok){
    showToast("Accepted ✅");
    refreshOwnerJobs();
    refreshJobs();
    refreshCurrentWalks();
  } else {
    showToast(res2?.error || "Could not accept");
  }

  // Optional counter offer flow
  const counter = prompt("Optional: counter-offer instead? Enter CHF amount or Cancel:", "");
  if (counter && counter.trim()){
    const amount = Number(counter);
    if (Number.isFinite(amount) && amount > 0){
      const r3 = await postForm({ action:"counter_bid", token, job_id: jobId, bid_id: chosen.bid_id, counter:{ amount } });
      showToast((r3 && r3.ok) ? "Counter sent" : (r3?.error || "Counter failed"));
    }
  }
};

/* =========================================================
   MY BIDS: walker history (myBidsModal / #myBidsList)
   ========================================================= */

window.refreshMyBids = async function refreshMyBids(){
  const token = getToken();
  const list = document.getElementById("myBidsList");
  const empty = document.getElementById("myBidsEmpty");
  if (!list) return;

  list.innerHTML = `<div class="muted">Loading…</div>`;
  setEmptyState(list, empty, false);

  const res = await postForm({ action:"my_bids", token });
  if (!res || !res.ok){
    list.innerHTML = `<div class="muted">Error: ${esc(res?.error || "failed")}</div>`;
    return;
  }

  const bids = res.bids || [];
  if (!bids.length){
    list.innerHTML = "";
    setEmptyState(list, empty, true);
    return;
  }

  list.innerHTML = bids.map(b => {
    return `
      <div class="job-card">
        <div class="job-top">
          <div class="job-left">
            <div class="job-title">Job: ${esc(b.job_id)}</div>
            <div class="job-meta">${moneyCHF(b.amount)} • ${esc(fmtStatus(b.status))}</div>
          </div>
          <div class="job-right">
            <button class="btn btn-small btn-ghost" type="button" onclick="openChatForJob('${esc(b.job_id)}')">Chat</button>
          </div>
        </div>
        ${b.message ? `<div class="job-notes">${esc(b.message)}</div>` : ``}
      </div>
    `;
  }).join("");
};

/* =========================================================
   CURRENT WALKS: assigned walks (currentWalksModal / #currentWalksList)
   ========================================================= */

window.refreshCurrentWalks = async function refreshCurrentWalks(){
  const token = getToken();
  const list = document.getElementById("currentWalksList");
  const empty = document.getElementById("currentWalksEmpty");
  if (!list) return;

  list.innerHTML = `<div class="muted">Loading…</div>`;
  setEmptyState(list, empty, false);

  const res = await postForm({ action:"current_walks", token });
  if (!res || !res.ok){
    list.innerHTML = `<div class="muted">Error: ${esc(res?.error || "failed")}</div>`;
    return;
  }

  const jobs = res.jobs || [];
  if (!jobs.length){
    list.innerHTML = "";
    setEmptyState(list, empty, true);
    return;
  }

  list.innerHTML = jobs.map(j => {
    return `
      <div class="job-card">
        <div class="job-top">
          <div class="job-left">
            <div class="job-title">${esc(j.dog_name || "Dog")} • ${esc(j.city || "")}</div>
            <div class="job-meta">${esc(j.date || "")} ${esc(j.time || "")} • ${esc(j.duration || "")} min</div>
          </div>
          <div class="job-right" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn btn-small btn-outline" type="button" onclick="openChatForJob('${esc(j.job_id)}')">Chat</button>
          </div>
        </div>
        <div class="muted" style="margin-top:6px;">Owner: ${esc(j.owner_email || "")}</div>
        <div class="muted">Walker: ${esc(j.assigned_walker_email || "")}</div>
      </div>
    `;
  }).join("");
};

/* =========================================================
   CHAT: chatModal + #chatMessages + #chatForm
   ========================================================= */

window.openChatForJob = async function openChatForJob(jobId){
  CURRENT_CHAT_JOB_ID = jobId;
  document.getElementById("chatHeader").textContent = `Chat for walk ${jobId}`;
  openDlg("chatModal");
  await loadChat();
};

window.loadChat = async function loadChat(){
  const token = getToken();
  const box = document.getElementById("chatMessages");
  if (!box) return;
  if (!CURRENT_CHAT_JOB_ID){
    box.innerHTML = `<div class="chat-empty">No chat selected.</div>`;
    return;
  }

  box.innerHTML = `<div class="chat-empty">Loading messages…</div>`;

  const res = await postForm({ action:"list_messages", token, job_id: CURRENT_CHAT_JOB_ID });
  if (!res || !res.ok){
    box.innerHTML = `<div class="chat-empty">Error: ${esc(res?.error || "failed")}</div>`;
    return;
  }

  const msgs = res.messages || [];
  if (!msgs.length){
    box.innerHTML = `<div class="chat-empty">No messages yet. Say hi 👋</div>`;
    return;
  }

  const me = String(getProfile()?.email || "").toLowerCase();

  box.innerHTML = msgs.map(m=>{
    const who = (String(m.sender_email||"").toLowerCase() === me) ? "me" : "them";
    const name = m.sender_name || m.sender_email || "user";
    const time = m.ts ? new Date(m.ts).toLocaleString() : "";
    return `
      <div class="chat-bubble ${who}">
        <div class="chat-meta">${esc(name)} ${time ? `· ${esc(time)}` : ""}</div>
        <div class="chat-body">${esc(m.body || "")}</div>
      </div>
    `;
  }).join("");

  // scroll to bottom
  box.scrollTop = box.scrollHeight;
};

document.getElementById('chatForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const token = getToken();
  if (!token){ showToast("Sign in first"); return; }
  if (!CURRENT_CHAT_JOB_ID){ showToast("No chat selected"); return; }

  const body = e.target.body.value.trim();
  if (!body) return;

  const res = await postForm({ action:"send_message", token, job_id: CURRENT_CHAT_JOB_ID, body });
  if (res && res.ok){
    e.target.body.value = "";
    await loadChat();
  } else {
    showToast(res?.error || "Could not send");
  }
});

/* init */
document.getElementById('yr').textContent = new Date().getFullYear();

(function init(){
  renderAuthUI();
  setDateMinToday();
})();
