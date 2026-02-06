/* ui.js — UPDATED (privacy + user-friendly dates + better labels + directions)
   Key changes:
   - No longer shows owner/walker emails in Current Walks
   - Formats date/time nicely (fixes ISO + weird 1899 time objects)
   - Uses a readable “walk label” everywhere instead of raw job_id when possible
   - Adds a “Directions” button (Google Maps) for CURRENT walks (assigned)
   - Keeps buttons distinct (Open current ≠ Chat; no duplicate destinations)
*/

(function () {
  // prevent double boot if ui.js gets loaded twice by mistake
  if (window.__IGO_UI_BOOTED__) return;
  window.__IGO_UI_BOOTED__ = true;

  let CURRENT_CHAT_JOB_ID = null;

  // cache job summaries so My bids / Chat can show human-friendly labels
  const JOB_CACHE = new Map(); // job_id -> job object

  /* ============ small helpers ============ */
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));

  const money = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? `${n.toFixed(0)} CHF` : (x ? `${x} CHF` : "");
  };

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg || "Saved";
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 2200);
  }
  window.showToast = showToast;

  /* debug toggle */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      const dbg = document.getElementById("debug");
      if (!dbg) return;
      dbg.style.display = dbg.style.display === "none" ? "block" : "none";
    }
  });
  window.setDebug = function (msg) {
    const dbgpre = document.getElementById("dbgpre");
    if (!dbgpre) return;
    try {
      dbgpre.textContent = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
    } catch (_) {
      dbgpre.textContent = String(msg);
    }
  };

  /* dialogs */
  function supportsDialog() {
    try {
      return typeof HTMLDialogElement === "function" && !!document.createElement("dialog").showModal;
    } catch (_) {
      return false;
    }
  }
  function openDlg(id) {
    const d = document.getElementById(id);
    if (!d) return;
    try {
      supportsDialog() ? d.showModal() : d.setAttribute("open", "");
    } catch (_) {
      d.setAttribute("open", "");
    }
  }
  function closeDlg(id) {
    const d = document.getElementById(id);
    if (!d) return;
    try {
      supportsDialog() ? d.close() : d.removeAttribute("open");
    } catch (_) {}
  }

  /* ============ date/time formatting (fixes ISO + Sheets date objects) ============ */
  function toDateSafe(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

    // sometimes Apps Script returns {…} or numbers; string-ify then parse
    const s = String(v);
    // ISO?
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    return null;
  }

  function fmtDate(v) {
    // prefer “Thu 5 Feb” style
    const d = toDateSafe(v);
    if (!d) {
      // maybe already "YYYY-MM-DD"
      const s = String(v || "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      return s;
    }
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function fmtTime(v) {
    const d = toDateSafe(v);
    if (d) {
      // time-only Date objects often come back as 1899/1900 + time; keep only HH:MM
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    const s = String(v || "").trim();
    // already "HH:MM"
    if (/^\d{1,2}:\d{2}/.test(s)) return s;
    return s;
  }

  function fmtWhen(job) {
    const ds = fmtDate(job?.date);
    const ts = fmtTime(job?.time);
    const when = `${ds} ${ts}`.trim();
    return when || "";
  }

  function shortId(jobId) {
    const s = String(jobId || "");
    if (!s) return "";
    // job_xxxxx -> show last 6
    const tail = s.replace(/^job_/, "");
    return tail.length > 8 ? tail.slice(0, 8) : tail;
  }

  function jobLabel(jobOrId) {
    // If we have the job object, build a nice label.
    const job = typeof jobOrId === "string" ? (JOB_CACHE.get(jobOrId) || null) : jobOrId;
    if (job) {
      const dog = job.dog_name || "Dog";
      const city = job.city || "";
      const when = fmtWhen(job);
      // job_code is best if present
      const code = job.job_code ? `#${job.job_code}` : `#${shortId(job.job_id)}`;
      return `${dog} • ${city}${when ? " • " + when : ""} ${code ? " · " + code : ""}`.trim();
    }
    // fallback: compact id
    return `Walk #${shortId(jobOrId) || String(jobOrId || "")}`;
  }

  function cacheJobs(list) {
    (list || []).forEach((j) => {
      if (j && j.job_id) JOB_CACHE.set(String(j.job_id), j);
    });
  }

  /* ============ maps helpers ============ */
  function buildMapsLink(address, city) {
    const q = [address, city].filter(Boolean).join(", ");
    if (!q) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  window.openDirections = function (jobId) {
    const j = JOB_CACHE.get(String(jobId));
    const url = buildMapsLink(j?.address, j?.city);
    if (!url) return showToast("No address available yet.");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* expose open/close used by onclick */
  window.openSignin = () => openDlg("signinModal");
  window.closeSignin = () => closeDlg("signinModal");

  window.openOwnerModal = () => {
    openDlg("ownerModal");
    prefillOwnerFromProfile();
    setDateMinToday();
  };
  window.closeOwnerModal = () => closeDlg("ownerModal");

  window.openJobs = () => {
    openDlg("jobsModal");
    refreshJobs();
  };
  window.closeJobs = () => closeDlg("jobsModal");

  window.openOwnerJobs = () => {
    openDlg("ownerJobsModal");
    refreshOwnerJobs();
  };
  window.closeOwnerJobs = () => closeDlg("ownerJobsModal");

  window.openMyBids = () => {
    openDlg("myBidsModal");
    refreshMyBids();
  };
  window.closeMyBids = () => closeDlg("myBidsModal");

  window.openCurrentWalks = () => {
    openDlg("currentWalksModal");
    refreshCurrentWalks();
  };
  window.closeCurrentWalks = () => closeDlg("currentWalksModal");

  window.openProfile = () => {
    prefillProfileForm();
    openDlg("profileModal");
  };
  window.closeProfile = () => closeDlg("profileModal");

  window.closeChat = () => {
    closeDlg("chatModal");
    CURRENT_CHAT_JOB_ID = null;
  };

  /* dashboard switching */
  function showSignedInUI() {
    const dash = document.getElementById("dash");
    const marketing = document.getElementById("marketing");
    if (dash) dash.style.display = "block";
    if (marketing) marketing.style.display = "none";
  }
  function showSignedOutUI() {
    const dash = document.getElementById("dash");
    const marketing = document.getElementById("marketing");
    if (dash) dash.style.display = "none";
    if (marketing) marketing.style.display = "block";
  }

  function computeRoleFlags(prof) {
    const role = String(prof.role || "").toLowerCase();
    const isOwner = prof.is_owner === "1" || role.includes("owner");
    const isWalker = prof.is_walker === "1" || role.includes("walker");
    return { isOwner, isWalker };
  }

  /* auth chip */
  function renderAuthUI() {
    const token = getToken();
    const prof = getProfile() || {};
    const signinBtn = document.getElementById("signinBtn");
    const chip = document.getElementById("userChip");

    if (!token) {
      if (signinBtn) signinBtn.style.display = "inline-flex";
      if (chip) chip.style.display = "none";
      showSignedOutUI();
      return;
    }

    if (signinBtn) signinBtn.style.display = "none";
    if (chip) chip.style.display = "flex";
    showSignedInUI();

    const { isOwner, isWalker } = computeRoleFlags(prof);
    const name = prof.name || prof.email || "Account";

    const parts = [];
    parts.push(`<span class="user-chip-name">${esc(name)}</span>`);
    if (isOwner) parts.push(`<span class="dot">·</span><button type="button" onclick="openOwnerModal()">Post walk</button>`);
    if (isWalker) parts.push(`<span class="dot">·</span><button type="button" onclick="openJobs()">Open walks</button>`);
    parts.push(`<span class="dot">·</span><button type="button" onclick="openCurrentWalks()">Current</button>`);
    parts.push(`<span class="dot">·</span><button type="button" onclick="openMyBids()">My bids</button>`);
    parts.push(`<span class="dot">·</span><button type="button" onclick="openProfile()">Profile</button>`);
    parts.push(`<span class="dot">·</span><button type="button" onclick="doSignOut()">Sign out</button>`);
    chip.innerHTML = parts.join(" ");

    renderDash();
  }

  window.doSignOut = function () {
    signOut();
    renderAuthUI();
    showToast("Signed out");
  };

  /* ============ events ============ */
  function wireEvents() {
    // SIGN IN — critical to prevent refresh
    document.getElementById("signinBtn")?.addEventListener("click", () => openDlg("signinModal"));

    document.getElementById("signinForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = e.target.email.value.trim();
      const res = await postForm({ action: "start_login", email });
      window.setDebug(res);

      if (res && res.ok) {
        showToast("Code sent. Use 555555 for testing.");
        const cf = document.getElementById("codeForm");
        cf.style.display = "grid";
        cf.dataset.email = email;

        const resendBtn = document.getElementById("resendBtn");
        const resendT = document.getElementById("resendT");
        let secs = 30;
        resendBtn.disabled = true;
        resendT.textContent = secs;

        const iv = setInterval(() => {
          secs--;
          resendT.textContent = secs;
          if (secs <= 0) {
            clearInterval(iv);
            resendBtn.disabled = false;
          }
        }, 1000);

        resendBtn.onclick = async () => {
          resendBtn.disabled = true;
          secs = 30;
          resendT.textContent = secs;
          const r2 = await postForm({ action: "start_login", email });
          window.setDebug(r2);
          showToast(r2?.ok ? "Code re-sent." : "Could not resend.");
        };
      } else {
        showToast(res?.error || "Could not send code.");
      }
    });

    document.getElementById("codeForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = e.target.code.value.trim();
      const email = e.target.dataset.email || "";
      const res = await postForm({ action: "verify_code", email, code });
      window.setDebug(res);

      if (res && res.ok && res.token) {
        setToken(res.token);
        setProfile(res.profile || { email });
        showToast("Signed in");
        renderAuthUI();
        closeDlg("signinModal");
        setTimeout(() => window.openProfile(), 250);
      } else {
        showToast(res?.error || "Invalid or expired code.");
      }
    });

    // PROFILE
    document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());

      const isOwner = form.elements["is_owner"]?.checked;
      const isWalker = form.elements["is_walker"]?.checked;
      data.is_owner = isOwner ? "1" : "";
      data.is_walker = isWalker ? "1" : "";
      const roles = [];
      if (isOwner) roles.push("owner");
      if (isWalker) roles.push("walker");
      data.role = roles.join(",");

      const token = getToken();
      if (!token) return showToast("Sign in first");

      const res = await postForm({ action: "save_profile", token, role: data.role, profile: data });
      window.setDebug(res);

      if (res && res.ok) {
        setProfile(res.profile || data);
        renderAuthUI();
        showToast("Profile saved");
        closeDlg("profileModal");
      } else {
        showToast(res?.error || "Could not save profile");
      }
    });

    // OWNER POST WALK
    document.getElementById("ownerForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = getToken();
      if (!token) {
        showToast("Sign in first");
        closeDlg("ownerModal");
        openDlg("signinModal");
        return;
      }

      const job = Object.fromEntries(new FormData(e.target).entries());
      const res = await postForm({ action: "create_job", token, job });
      window.setDebug(res);

      if (res && res.ok) {
        showToast("Walk posted.");
        e.target.reset();
        closeDlg("ownerModal");

        await refreshOwnerLatestPreview();
        openDlg("ownerJobsModal");
        await refreshOwnerJobs();
      } else {
        showToast(res?.error || "Could not post walk.");
      }
    });

    // CHAT SEND
    document.getElementById("chatForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = getToken();
      if (!token) return showToast("Sign in first");
      if (!CURRENT_CHAT_JOB_ID) return showToast("No chat selected");

      const body = e.target.body.value.trim();
      if (!body) return;

      const res = await postForm({ action: "send_message", token, job_id: CURRENT_CHAT_JOB_ID, body });
      window.setDebug(res);

      if (!res?.ok) return showToast(res?.error || "Could not send");
      e.target.reset();
      await loadChat();
    });
  }

  /* ============ profile helpers ============ */
  function prefillProfileForm() {
    const prof = getProfile() || {};
    const form = document.getElementById("profileForm");
    if (!form) return;

    const map = (k) => form.querySelector(`[name="${k}"]`);
    ["name", "email", "phone", "address", "city", "pay_method", "bio", "role"].forEach((k) => {
      if (map(k) && prof[k]) map(k).value = prof[k];
    });

    const { isOwner, isWalker } = computeRoleFlags(prof);
    if (form.elements["is_owner"]) form.elements["is_owner"].checked = isOwner;
    if (form.elements["is_walker"]) form.elements["is_walker"].checked = isWalker;
  }

  function prefillOwnerFromProfile() {
    const prof = getProfile() || {};
    const form = document.getElementById("ownerForm");
    if (!form) return;
    if (prof.name) form.elements["name"].value = prof.name;
    if (prof.email) form.elements["email"].value = prof.email;
    if (prof.phone) form.elements["phone"].value = prof.phone;
    if (prof.city) form.elements["city"].value = prof.city;
    if (prof.address) form.elements["address"].value = prof.address;
  }

  function setDateMinToday() {
    const el = document.getElementById("date_owner");
    if (!el) return;
    const today = new Date().toISOString().slice(0, 10);
    el.min = today;
    if (!el.value) el.value = today;
  }

  /* ============ dashboard ============ */
  async function renderDash() {
    const prof = getProfile() || {};
    const { isOwner, isWalker } = computeRoleFlags(prof);

    const dashTitle = document.getElementById("dashTitle");
    const dashSub = document.getElementById("dashSub");

    if (dashTitle) dashTitle.textContent = `Welcome, ${prof.name || prof.email || "there"}.`;
    if (dashSub) {
      dashSub.textContent =
        isOwner && isWalker ? "Owner + Walker mode enabled. Pick what you want to do now." :
        isOwner ? "Owner mode: post a walk → review bids inside your walk." :
        isWalker ? "Walker mode: bid, then accept/decline counters from My bids." :
        "Complete your profile to unlock owner/walker features.";
    }

    const ownerLatestCard = document.getElementById("ownerLatestCard");
    const walkerHintCard = document.getElementById("walkerHintCard");

    if (ownerLatestCard) ownerLatestCard.style.display = isOwner ? "block" : "none";
    if (walkerHintCard) walkerHintCard.style.display = isWalker ? "block" : "none";

    if (isOwner) await refreshOwnerLatestPreview();
    if (isWalker) await refreshWalkerPanel().catch(() => {});

    const yr = document.getElementById("yr");
    if (yr) yr.textContent = new Date().getFullYear();
  }

  /* Owner: latest walk preview */
  async function refreshOwnerLatestPreview() {
    const token = getToken();
    if (!token) return;

    const res = await postForm({ action: "owner_jobs", token });
    window.setDebug(res);

    const jobs = res.jobs || [];
    cacheJobs(jobs);

    const body = document.getElementById("ownerLatestBody");
    const btn = document.getElementById("ownerLatestBidsBtn");
    if (!body || !btn) return;

    if (!jobs.length) {
      body.innerHTML = `<div class="muted">No walks posted yet.</div>`;
      btn.textContent = "Post first walk";
      btn.onclick = () => window.openOwnerModal();
      return;
    }

    const j = jobs[0];
    body.innerHTML = `
      <div style="font-weight:800;">${esc(j.dog_name || "Dog")} • ${esc(j.city || "")}</div>
      <div class="muted" style="font-size:12px;margin-top:4px;">
        ${esc(fmtWhen(j))} • ${esc(j.duration || "")} min • status: ${esc(j.status || "")}
      </div>
      ${j.notes ? `<div class="muted" style="font-size:12px;margin-top:6px;">${esc(j.notes)}</div>` : ``}
    `;

    btn.textContent = "View bids";
    btn.onclick = async () => {
      openDlg("ownerJobsModal");
      await refreshOwnerJobs();
    };
  }

  /* Walker panel (optional DOM ids; safe if missing) */
  async function refreshWalkerPanel() {
    const token = getToken();
    if (!token) return;

    const body = document.getElementById("walkerPanelBody");
    const actions = document.getElementById("walkerPanelActions");
    if (!body || !actions) return;

    // current walk first
    const cw = await postForm({ action: "current_walks", token });
    const current = (cw.jobs || [])[0];
    cacheJobs(cw.jobs || []);

    if (current) {
      body.innerHTML = `
        <div style="font-weight:800;">Current walk: ${esc(current.dog_name || "Dog")} • ${esc(current.city || "")}</div>
        <div class="muted" style="font-size:12px;margin-top:4px;">
          ${esc(fmtWhen(current))} • ${esc(current.duration || "")} min
        </div>
        ${current.notes ? `<div class="muted" style="font-size:12px;margin-top:6px;">${esc(current.notes)}</div>` : ``}
      `;

      actions.innerHTML = `
        <button class="btn btn-outline btn-small" type="button" onclick="openCurrentWalks()">Open current</button>
        <button class="btn btn-outline btn-small" type="button" onclick="openDirections('${esc(current.job_id)}')">Directions</button>
        <button class="btn btn-primary btn-small" type="button" onclick="openChat('${esc(current.job_id)}')">Chat</button>
      `;
      return;
    }

    // latest bid
    const mb = await postForm({ action: "my_bids", token });
    const bids = mb.bids || [];
    const b = bids[0];

    if (!b) {
      body.innerHTML = `<div class="muted">No bids yet. Browse open walks.</div>`;
      actions.innerHTML = `<button class="btn btn-outline btn-small" type="button" onclick="openJobs()">Open walks</button>`;
      return;
    }

    const st = String(b.status || "").toLowerCase();
    const counterLine = b.counter_amount ? `• Counter: <b>${money(b.counter_amount)}</b>` : "";

    body.innerHTML = `
      <div style="font-weight:800;">Latest bid</div>
      <div class="muted" style="font-size:12px;margin-top:4px;">${esc(jobLabel(b.job_id))}</div>
      <div class="muted" style="font-size:12px;margin-top:4px;">
        Your bid: <b>${money(b.amount)}</b> • status: <b>${esc(b.status)}</b> ${counterLine}
      </div>
    `;

    if (st === "countered" && b.counter_amount) {
      actions.innerHTML = `
        <button class="btn btn-primary btn-small" type="button" onclick="acceptCounter('${esc(b.job_id)}','${esc(b.bid_id)}')">Accept counter</button>
        <button class="btn btn-outline btn-small" type="button" onclick="declineCounter('${esc(b.job_id)}','${esc(b.bid_id)}')">Decline</button>
      `;
    } else {
      actions.innerHTML = `
        <button class="btn btn-outline btn-small" type="button" onclick="openMyBids()">Open “My bids”</button>
        <button class="btn btn-outline btn-small" type="button" onclick="openJobs()">Open walks</button>
      `;
    }
  }

  /* ============ jobs (walker) ============ */
  async function refreshJobs() {
    const token = getToken();
    if (!token) return;

    const list = document.getElementById("jobsList");
    const empty = document.getElementById("jobsEmpty");
    if (list) list.innerHTML = "";
    if (empty) empty.style.display = "none";

    const res = await postForm({ action: "list_jobs", token, filter: {} });
    window.setDebug(res);

    const jobs = res.jobs || [];
    cacheJobs(jobs);

    if (!jobs.length) {
      if (empty) empty.style.display = "block";
      return;
    }

    list.innerHTML = jobs.map((j) => `
      <div class="card" style="margin-bottom:10px;">
        <div class="card-inner">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:900;font-size:16px;">${esc(j.dog_name || "Dog")} • ${esc(j.city || "")}</div>
              <div class="muted" style="font-size:12px;margin-top:4px;">
                ${esc(fmtWhen(j))} • ${esc(j.duration || "")} min • max ${money(j.max_price)}
              </div>
              ${j.notes ? `<div class="muted" style="margin-top:8px;font-size:12px;">${esc(j.notes)}</div>` : ``}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button class="btn btn-primary btn-small" onclick="openBidSheet('${esc(j.job_id)}','${esc(j.max_price || "")}')">Bid</button>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  window.openBidSheet = function (jobId, maxPrice) {
    const v = prompt(`Your bid amount in CHF${maxPrice ? ` (max ${maxPrice})` : ""}:`);
    if (v == null) return;
    const amount = Number(v);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Invalid amount");
    placeBidQuick(jobId, amount);
  };

  async function placeBidQuick(jobId, amount) {
    const token = getToken();
    const res = await postForm({ action: "place_bid", token, job_id: jobId, bid: { amount, message: "" } });
    window.setDebug(res);

    if (!res?.ok) return alert(res?.error || "Could not bid");
    showToast("Bid sent");
    await refreshMyBids().catch(() => {});
    await refreshWalkerPanel().catch(() => {});
  }

  /* ============ owner jobs + embedded bids ============ */
  async function refreshOwnerJobs() {
    const token = getToken();
    if (!token) return;

    const list = document.getElementById("ownerJobsList");
    const empty = document.getElementById("ownerJobsEmpty");
    if (list) list.innerHTML = "";
    if (empty) empty.style.display = "none";

    const res = await postForm({ action: "owner_jobs", token });
    window.setDebug(res);

    const jobs = res.jobs || [];
    cacheJobs(jobs);

    if (!jobs.length) {
      if (empty) empty.style.display = "block";
      return;
    }

    list.innerHTML = jobs.map((j) => `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-inner">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:900;font-size:16px;">${esc(j.dog_name || "Dog")} • ${esc(j.city || "")}</div>
              <div class="muted" style="font-size:12px;margin-top:4px;">
                ${esc(fmtWhen(j))} • ${esc(j.duration || "")} min • status: <b>${esc(j.status || "")}</b>
              </div>
              ${j.notes ? `<div class="muted" style="margin-top:8px;font-size:12px;">${esc(j.notes)}</div>` : ``}
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button class="btn btn-outline btn-small" type="button" onclick="toggleBids('${esc(j.job_id)}')">Show bids</button>
              <button class="btn btn-primary btn-small" type="button" onclick="openChat('${esc(j.job_id)}')">Chat</button>
            </div>
          </div>

          <div id="bidsWrap_${esc(j.job_id)}" style="display:none;margin-top:12px;"></div>
        </div>
      </div>
    `).join("");
  }

  window.toggleBids = async function (jobId) {
    const wrap = document.getElementById(`bidsWrap_${jobId}`);
    if (!wrap) return;

    if (wrap.style.display === "none") {
      wrap.style.display = "block";
      wrap.innerHTML = `<div class="muted" style="font-size:12px;">Loading bids…</div>`;
      await renderBidsInto(jobId, wrap);
    } else {
      wrap.style.display = "none";
    }
  };

  async function renderBidsInto(jobId, wrap) {
    const token = getToken();
    const res = await postForm({ action: "list_bids", token, job_id: jobId });
    window.setDebug(res);

    if (!res?.ok) {
      wrap.innerHTML = `<div class="muted" style="font-size:12px;">${esc(res?.error || "Could not load bids")}</div>`;
      return;
    }

    const bids = res.bids || [];
    if (!bids.length) {
      wrap.innerHTML = `<div class="muted" style="font-size:12px;">No bids yet.</div>`;
      return;
    }

    wrap.innerHTML = bids.map((b) => {
      const initials = (b.walker_name || b.walker_email || "W").trim().slice(0, 1).toUpperCase();
      const status = String(b.status || "").toLowerCase();
      const counterInfo = b.counter_amount
        ? `<div class="muted" style="font-size:12px;margin-top:4px;">Counter proposed: <b>${money(b.counter_amount)}</b></div>`
        : "";

      // Privacy: do NOT show walker email here (only name + city)
      return `
        <div class="card" style="margin-top:10px;">
          <div class="card-inner">
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <div style="width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.12);font-weight:900;">
                ${esc(initials)}
              </div>

              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                  <div>
                    <div style="font-weight:900;">${esc(b.walker_name || "WALKER")}</div>
                    <div class="muted" style="font-size:12px;">
                      ${esc(b.walker_city || "")}
                    </div>
                  </div>
                  <div style="font-weight:900;font-size:16px;">${money(b.amount)}</div>
                </div>

                <div class="muted" style="font-size:12px;margin-top:6px;">Status: <b>${esc(b.status)}</b></div>
                ${counterInfo}

                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                  <button class="btn btn-primary btn-small" type="button"
                    ${status === "accepted" ? "disabled" : ""}
                    onclick="acceptBidUI('${esc(jobId)}','${esc(b.bid_id)}')">Accept</button>

                  <button class="btn btn-outline btn-small" type="button"
                    ${status === "accepted" ? "disabled" : ""}
                    onclick="toggleCounterUI('${esc(jobId)}','${esc(b.bid_id)}')">Counter</button>

                  <button class="btn btn-outline btn-small" type="button"
                    onclick="openChat('${esc(jobId)}')">Chat</button>
                </div>

                <div id="counterBox_${esc(b.bid_id)}" style="display:none;margin-top:10px;">
                  <div class="muted" style="font-size:12px;margin-bottom:6px;">Counter offer (CHF)</div>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <input id="counterVal_${esc(b.bid_id)}" type="number" min="1" step="1" placeholder="e.g. 30"
                      style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.15);color:inherit;">
                    <button class="btn btn-primary btn-small" type="button"
                      onclick="confirmCounterUI('${esc(jobId)}','${esc(b.bid_id)}')">Yes, counter</button>
                    <button class="btn btn-ghost btn-small" type="button"
                      onclick="toggleCounterUI('${esc(jobId)}','${esc(b.bid_id)}')">No</button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  window.toggleCounterUI = function (jobId, bidId) {
    const box = document.getElementById(`counterBox_${bidId}`);
    if (!box) return;
    box.style.display = box.style.display === "none" ? "block" : "none";
  };

  window.confirmCounterUI = async function (jobId, bidId) {
    const token = getToken();
    const inp = document.getElementById(`counterVal_${bidId}`);
    const amount = Number(inp?.value);
    if (!Number.isFinite(amount) || amount <= 0) return showToast("Invalid counter amount");

    const res = await postForm({ action: "counter_bid", token, job_id: jobId, bid_id: bidId, counter: { amount } });
    window.setDebug(res);

    if (!res?.ok) return showToast(res?.error || "Could not counter");
    showToast("Counter sent");

    const wrap = document.getElementById(`bidsWrap_${jobId}`);
    if (wrap) await renderBidsInto(jobId, wrap);
    await refreshMyBids().catch(() => {});
    await refreshWalkerPanel().catch(() => {});
  };

  window.acceptBidUI = async function (jobId, bidId) {
    const token = getToken();
    const res = await postForm({ action: "accept_bid", token, job_id: jobId, bid_id: bidId });
    window.setDebug(res);

    if (!res?.ok) return showToast(res?.error || "Could not accept");
    showToast("Accepted");
    await refreshOwnerJobs();
    await refreshOwnerLatestPreview();
    // also refresh current list so owner sees it move to “Current”
    await refreshCurrentWalks().catch(() => {});
  };

  /* ============ my bids (walker) ============ */
  async function refreshMyBids() {
    const token = getToken();
    if (!token) return;

    const list = document.getElementById("myBidsList");
    const empty = document.getElementById("myBidsEmpty");
    if (list) list.innerHTML = "";
    if (empty) empty.style.display = "none";

    const res = await postForm({ action: "my_bids", token });
    window.setDebug(res);

    const bids = res.bids || [];
    if (!bids.length) {
      if (empty) empty.style.display = "block";
      await refreshWalkerPanel().catch(() => {});
      return;
    }

    list.innerHTML = bids.map((b) => {
      const st = String(b.status || "").toLowerCase();
      const hasCounter = st === "countered" && b.counter_amount;

      return `
        <div class="card" style="margin-bottom:12px;">
          <div class="card-inner">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <div style="flex:1;">
                <div style="font-weight:900;">${esc(jobLabel(b.job_id))}</div>
                <div class="muted" style="font-size:12px;margin-top:4px;">
                  Your bid: <b>${money(b.amount)}</b> • status: <b>${esc(b.status)}</b>
                </div>
                ${hasCounter ? `<div class="muted" style="font-size:12px;margin-top:6px;">Owner counter: <b>${money(b.counter_amount)}</b></div>` : ``}
              </div>

              ${hasCounter ? `
                <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
                  <button class="btn btn-primary btn-small" type="button" onclick="acceptCounter('${esc(b.job_id)}','${esc(b.bid_id)}')">Accept counter</button>
                  <button class="btn btn-outline btn-small" type="button" onclick="declineCounter('${esc(b.job_id)}','${esc(b.bid_id)}')">Decline</button>
                </div>
              ` : ``}
            </div>
          </div>
        </div>
      `;
    }).join("");

    await refreshWalkerPanel().catch(() => {});
  }

  window.acceptCounter = async function (jobId, bidId) {
    const token = getToken();
    const res = await postForm({ action: "accept_counter", token, job_id: jobId, bid_id: bidId });
    window.setDebug(res);

    if (!res?.ok) return showToast(res?.error || "Could not accept counter");
    showToast("Counter accepted");
    await refreshMyBids();
    await refreshCurrentWalks().catch(() => {});
  };

  window.declineCounter = async function (jobId, bidId) {
    const token = getToken();
    const res = await postForm({ action: "decline_counter", token, job_id: jobId, bid_id: bidId });
    window.setDebug(res);

    if (!res?.ok) return showToast(res?.error || "Could not decline counter");
    showToast("Declined");
    await refreshMyBids();
  };

  /* ============ current walks ============ */
  async function refreshCurrentWalks() {
    const token = getToken();
    if (!token) return;

    const list = document.getElementById("currentWalksList");
    const empty = document.getElementById("currentWalksEmpty");
    if (list) list.innerHTML = "";
    if (empty) empty.style.display = "none";

    const res = await postForm({ action: "current_walks", token });
    window.setDebug(res);

    const jobs = res.jobs || [];
    cacheJobs(jobs);

    if (!jobs.length) {
      if (empty) empty.style.display = "block";
      await refreshWalkerPanel().catch(() => {});
      return;
    }

    list.innerHTML = jobs.map((j) => `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-inner">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:900;">${esc(j.dog_name || "Dog")} • ${esc(j.city || "")}</div>
              <div class="muted" style="font-size:12px;margin-top:4px;">
                ${esc(fmtWhen(j))} • ${esc(j.duration || "")} min
              </div>
              ${j.notes ? `<div class="muted" style="font-size:12px;margin-top:6px;">${esc(j.notes)}</div>` : ``}
              <div class="muted" style="font-size:11px;margin-top:6px;">
                ${esc(j.job_code ? `Walk ${j.job_code}` : `Walk ${shortId(j.job_id)}`)}
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button class="btn btn-outline btn-small" type="button" onclick="openDirections('${esc(j.job_id)}')">Directions</button>
              <button class="btn btn-primary btn-small" type="button" onclick="openChat('${esc(j.job_id)}')">Chat</button>
            </div>
          </div>
        </div>
      </div>
    `).join("");

    await refreshWalkerPanel().catch(() => {});
  }

  /* ============ chat ============ */
  window.openChat = async function (jobId) {
    CURRENT_CHAT_JOB_ID = jobId;

    const head = document.getElementById("chatHeader");
    if (head) {
      head.textContent = `Chat • ${jobLabel(jobId)}`;
    }

    openDlg("chatModal");
    await loadChat();
  };

  window.loadChat = async function () {
    const token = getToken();
    if (!token) return;
    if (!CURRENT_CHAT_JOB_ID) return;

    const box = document.getElementById("chatMessages");
    if (!box) return;

    box.innerHTML = `<div class="chat-empty">Loading messages…</div>`;
    const res = await postForm({ action: "list_messages", token, job_id: CURRENT_CHAT_JOB_ID });
    window.setDebug(res);

    if (!res?.ok) {
      box.innerHTML = `<div class="chat-empty">${esc(res?.error || "Could not load messages")}</div>`;
      return;
    }

    const msgs = res.messages || [];
    if (!msgs.length) {
      box.innerHTML = `<div class="chat-empty">No messages yet.</div>`;
      return;
    }

    box.innerHTML = msgs.map((m) => `
      <div class="chat-msg">
        <div class="chat-meta"><b>${esc(m.sender_name || "User")}</b> · <span>${esc(new Date(m.ts).toLocaleString())}</span></div>
        <div class="chat-body">${esc(m.body)}</div>
      </div>
    `).join("");

    box.scrollTop = box.scrollHeight;
  };

  /* ============ init ============ */
  function waitForModalsThenInit() {
    // This ensures all modal DOM exists before attaching listeners
    const ok =
      document.getElementById("signinForm") &&
      document.getElementById("codeForm") &&
      document.getElementById("profileForm") &&
      document.getElementById("ownerForm");

    if (!ok) {
      setTimeout(waitForModalsThenInit, 30);
      return;
    }

    wireEvents();
    setDateMinToday();
    renderAuthUI();

    const yr = document.getElementById("yr");
    if (yr) yr.textContent = new Date().getFullYear();
  }

  waitForModalsThenInit();

  // expose refresh functions used by modal open buttons
  window.refreshJobs = refreshJobs;
  window.refreshOwnerJobs = refreshOwnerJobs;
  window.refreshMyBids = refreshMyBids;
  window.refreshCurrentWalks = refreshCurrentWalks;

  window.renderDash = renderDash;
})();
