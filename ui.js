/* ui.js — STABLE FIX (friendly labels + ISO date/time cleanup + robust autofill)
   Drop-in replacement.
*/
(function () {
  if (window.__IGO_UI_BOOTED__) return;
  window.__IGO_UI_BOOTED__ = true;

  let CURRENT_CHAT_JOB_ID = null;

  /* ============ helpers ============ */
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

  const pad2 = (n) => String(n).padStart(2, "0");

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg || "Saved";
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 2200);
  }
  window.showToast = showToast;

  // Debug toggle
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

  /* ============ dialog helpers ============ */
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

  /* ============ date/time normalization ============ */
  function isYmd(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
  }
  function isHm(s) {
    return /^\d{2}:\d{2}/.test(String(s || "").trim());
  }

  function normalizeDate(value) {
    const s = String(value || "").trim();
    if (!s) return "";
    if (isYmd(s)) return s;

    if (s.includes("T")) {
      const d = new Date(s);
      if (Number.isFinite(d.getTime())) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      }
      const left = s.split("T")[0];
      return isYmd(left) ? left : "";
    }

    const d = new Date(s);
    if (Number.isFinite(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    return "";
  }

  function normalizeTime(value) {
    const s = String(value || "").trim();
    if (!s) return "";
    if (isHm(s)) return s.slice(0, 5);

    if (s.startsWith("1899-12-30") && s.includes("T")) {
      const t = s.split("T")[1] || "";
      const hhmm = t.slice(0, 5);
      return isHm(hhmm) ? hhmm : "";
    }

    if (s.includes("T")) {
      const d = new Date(s);
      if (Number.isFinite(d.getTime())) {
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      }
      const t = s.split("T")[1] || "";
      const hhmm = t.slice(0, 5);
      return isHm(hhmm) ? hhmm : "";
    }

    if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 5);

    const d = new Date(s);
    if (Number.isFinite(d.getTime())) {
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
    return "";
  }

  function shortWhen(job) {
    const d = normalizeDate(job?.date);
    const t = normalizeTime(job?.time);
    if (!d && !t) return "";

    // nicer date label (Thu 06 Feb)
    if (d) {
      const [Y, M, D] = d.split("-").map(Number);
      const dt = new Date(Y, (M || 1) - 1, D || 1);
      const dNice = dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
      return `${dNice}${t ? ` • ${t}` : ""}`;
    }
    return t;
  }

  // ✅ Friendly title shown to users (NO #CODE)
  function jobTitle(job) {
    const dog = job?.dog_name ? String(job.dog_name) : "Dog";
    const city = job?.city ? String(job.city) : "";
    const when = shortWhen(job);
    return [dog, city, when].filter(Boolean).join(" • ");
  }

  // ✅ Small optional reference (never part of title)
  function jobRef(job) {
    const code = job?.job_code ? String(job.job_code).trim() : "";
    return code ? `Ref: ${code}` : "";
  }

  /* ============ maps helper ============ */
  function mapsSearchLink(query) {
    const q = String(query || "").trim();
    if (!q) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }

  /* ============ time helpers (posting guard) ============ */
  function isoToday() {
    return new Date().toISOString().slice(0, 10);
  }
  function roundUpToNextMinutes(step) {
    const d = new Date();
    const ms = d.getTime();
    const stepMs = step * 60 * 1000;
    const rounded = new Date(Math.ceil(ms / stepMs) * stepMs);
    return `${pad2(rounded.getHours())}:${pad2(rounded.getMinutes())}`;
  }
  function minutesUntil(dateStr, timeStr) {
    const d = normalizeDate(dateStr);
    const t = normalizeTime(timeStr);
    if (!d || !t) return NaN;
    const dt = new Date(`${d}T${t}:00`);
    const ms = dt.getTime();
    if (!Number.isFinite(ms)) return NaN;
    return (ms - Date.now()) / 60000;
  }

  /* ============ robust form field setter (autofill) ============ */
  function setField(form, keys, value, { onlyIfEmpty = true } = {}) {
    if (!form || value == null) return false;
    const val = String(value).trim();
    if (!val) return false;

    const tryOne = (k) => {
      const elByName = form.elements?.[k];
      if (elByName && typeof elByName.value !== "undefined") {
        if (!onlyIfEmpty || !String(elByName.value || "").trim()) elByName.value = val;
        return true;
      }
      const elById = document.getElementById(k);
      if (elById && typeof elById.value !== "undefined") {
        if (!onlyIfEmpty || !String(elById.value || "").trim()) elById.value = val;
        return true;
      }
      const elQS = form.querySelector?.(`[name="${k}"], #${CSS.escape(k)}`);
      if (elQS && typeof elQS.value !== "undefined") {
        if (!onlyIfEmpty || !String(elQS.value || "").trim()) elQS.value = val;
        return true;
      }
      return false;
    };

    for (const k of keys) {
      if (tryOne(k)) return true;
    }
    return false;
  }

  /* ============ expose open/close used by onclick ============ */
  window.openSignin = () => openDlg("signinModal");
  window.closeSignin = () => closeDlg("signinModal");

  window.openOwnerModal = () => {
    openDlg("ownerModal");
    prefillOwnerFromProfile();
    setDateMinTodayAndDefaultTime();
  };
  window.closeOwnerModal = () => closeDlg("ownerModal");

  window.openJobs = () => { openDlg("jobsModal"); refreshJobs(); };
  window.closeJobs = () => closeDlg("jobsModal");

  window.openOwnerJobs = () => { openDlg("ownerJobsModal"); refreshOwnerJobs(); };
  window.closeOwnerJobs = () => closeDlg("ownerJobsModal");

  window.openMyBids = () => { openDlg("myBidsModal"); refreshMyBids(); };
  window.closeMyBids = () => closeDlg("myBidsModal");

  window.openCurrentWalks = () => { openDlg("currentWalksModal"); refreshCurrentWalks(); };
  window.closeCurrentWalks = () => closeDlg("currentWalksModal");

  window.openProfile = () => { prefillProfileForm(); openDlg("profileModal"); };
  window.closeProfile = () => closeDlg("profileModal");

  window.closeChat = () => { closeDlg("chatModal"); CURRENT_CHAT_JOB_ID = null; };

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
    const name = prof.name || "Account";

    const parts = [];
    parts.push(`<span class="user-chip-name">${esc(name)}</span>`);
    if (isOwner) parts.push(`<span class="dot">·</span><button type="button" onclick="openOwnerModal()">Post walk</button>`);
    if (isWalker) parts.push(`<span class="dot">·</span><button type="button" onclick="openJobs()">Open walks</button>`);
    parts.push(`<span class="dot">·</span><button type="button" onclick="openCurrentWalks()">Current</button>`);
    if (isWalker) parts.push(`<span class="dot">·</span><button type="button" onclick="openMyBids()">My bids</button>`);
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
    document.getElementById("signinBtn")?.addEventListener("click", () => openDlg("signinModal"));

    // SIGN IN
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

    // OWNER POST WALK (UI time rule)
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

      const mins = minutesUntil(job.date, job.time);
      if (!Number.isFinite(mins)) return showToast("Please choose valid date + time.");
      if (mins <= 0) return showToast("This time is in the past.");
      if (mins > 240) return showToast("You can post only within 4 hours before start.");

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

    const set = (k, v) => setField(form, [k], v, { onlyIfEmpty: false });

    ["name", "email", "phone", "address", "city", "pay_method", "bio", "role"].forEach((k) => {
      if (prof[k]) set(k, prof[k]);
    });

    const { isOwner, isWalker } = computeRoleFlags(prof);
    if (form.elements["is_owner"]) form.elements["is_owner"].checked = isOwner;
    if (form.elements["is_walker"]) form.elements["is_walker"].checked = isWalker;
  }

  // Robust autofill
  function prefillOwnerFromProfile() {
    const prof = getProfile() || {};
    const form = document.getElementById("ownerForm");
    if (!form) return;

    setField(form, ["name", "owner_name"], prof.name);
    setField(form, ["phone", "owner_phone"], prof.phone);
    setField(form, ["email", "owner_email"], prof.email);
    setField(form, ["city"], prof.city);
    setField(form, ["address"], prof.address);
    setField(form, ["pay_method", "payment", "payment_method"], prof.pay_method);

    setField(form, ["dog_name"], prof.dog_name);
    setField(form, ["dog_size"], prof.dog_size);
    setField(form, ["temperament"], prof.temperament);
  }

  function setDateMinTodayAndDefaultTime() {
    const form = document.getElementById("ownerForm");
    const today = isoToday();

    const dateEl =
      document.getElementById("date_owner") ||
      form?.elements?.["date_owner"] ||
      form?.elements?.["date"];
    if (dateEl) {
      dateEl.min = today;
      if (!String(dateEl.value || "").trim()) dateEl.value = today;
    }

    const timeEl =
      document.getElementById("time_owner") ||
      form?.elements?.["time_owner"] ||
      form?.elements?.["time"];
    if (timeEl) {
      if (!String(timeEl.value || "").trim()) timeEl.value = roundUpToNextMinutes(15);
    }
  }

  /* ============ dashboard ============ */
  async function renderDash() {
    const prof = getProfile() || {};
    const { isOwner, isWalker } = computeRoleFlags(prof);

    const dashTitle = document.getElementById("dashTitle");
    if (dashTitle) dashTitle.textContent = `Welcome, ${prof.name || "there"}.`;

    const dashSub = document.getElementById("dashSub");
    if (dashSub) {
      dashSub.textContent =
        isOwner && isWalker ? "Owner + Walker mode enabled. Pick what you want to do now." :
        isOwner ? "Owner mode: post a walk → review bids." :
        isWalker ? "Walker mode: bid → accept/decline counters." :
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

  async function refreshOwnerLatestPreview() {
    const token = getToken();
    if (!token) return;

    const res = await postForm({ action: "owner_jobs", token });
    window.setDebug(res);

    const jobs = res.jobs || [];
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
      <div style="font-weight:900;font-size:16px;">${esc(jobTitle(j))}</div>
      <div class="muted" style="font-size:12px;margin-top:6px;">
        ${esc(j.duration || "")} min • status: <b>${esc(j.status || "")}</b>
        ${jobRef(j) ? ` • ${esc(jobRef(j))}` : ``}
      </div>
      ${j.notes ? `<div class="muted" style="font-size:12px;margin-top:6px;">${esc(j.notes)}</div>` : ``}
    `;

    btn.textContent = "View bids";
    btn.onclick = async () => {
      openDlg("ownerJobsModal");
      await refreshOwnerJobs();
    };
  }

  async function refreshWalkerPanel() {
    const token = getToken();
    if (!token) return;

    const body = document.getElementById("walkerPanelBody");
    const actions = document.getElementById("walkerPanelActions");
    if (!body || !actions) return;

    const cw = await postForm({ action: "current_walks", token });
    const current = (cw.jobs || [])[0];

    if (current) {
      body.innerHTML = `
        <div style="font-weight:900;">Current walk</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">
          ${esc(jobTitle(current))}${jobRef(current) ? ` • ${esc(jobRef(current))}` : ``}
        </div>
      `;
      actions.innerHTML = `
        <button class="btn btn-outline btn-small" type="button" onclick="openCurrentWalks()">Open</button>
        <button class="btn btn-primary btn-small" type="button" onclick="openChat('${esc(current.job_id)}')">Chat</button>
      `;
      return;
    }

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
      <div style="font-weight:900;">Latest bid</div>
      <div class="muted" style="font-size:12px;margin-top:6px;">
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
        <button class="btn btn-outline btn-small" type="button" onclick="openMyBids()">My bids</button>
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
    if (!jobs.length) {
      if (empty) empty.style.display = "block";
      return;
    }

    list.innerHTML = jobs.map((j) => {
      const approxLink = j.approx_maps_link || mapsSearchLink(j.city);
      return `
      <div class="card" style="margin-bottom:10px;">
        <div class="card-inner">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:900;font-size:16px;">${esc(jobTitle(j))}</div>
              <div class="muted" style="font-size:12px;margin-top:6px;">
                ${esc(j.duration || "")} min • max ${money(j.max_price)}
                ${jobRef(j) ? ` • ${esc(jobRef(j))}` : ``}
              </div>
              ${j.dog_size ? `<div class="muted" style="font-size:12px;margin-top:6px;">Dog size: <b>${esc(j.dog_size)}</b></div>` : ``}
              ${j.notes ? `<div class="muted" style="margin-top:8px;font-size:12px;">${esc(j.notes)}</div>` : ``}
              <div style="margin-top:10px;">
                <a class="btn btn-outline btn-small" href="${esc(approxLink)}" target="_blank" rel="noopener">Approx area</a>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button class="btn btn-primary btn-small" onclick="openBidSheet('${esc(j.job_id)}','${esc(j.max_price || "")}')">Bid</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join("");
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
    if (!jobs.length) {
      if (empty) empty.style.display = "block";
      return;
    }

    list.innerHTML = jobs.map((j) => `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-inner">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:900;font-size:16px;">${esc(jobTitle(j))}</div>
              <div class="muted" style="font-size:12px;margin-top:6px;">
                Duration: ${esc(j.duration || "")} min • Status: <b>${esc(j.status || "")}</b>
                ${jobRef(j) ? ` • ${esc(jobRef(j))}` : ``}
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
      const initials = (b.walker_name || "W").trim().slice(0, 1).toUpperCase();
      const status = String(b.status || "").toLowerCase();
      const counterInfo = b.counter_amount
        ? `<div class="muted" style="font-size:12px;margin-top:4px;">Counter proposed: <b>${money(b.counter_amount)}</b></div>`
        : "";

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
                    <div style="font-weight:900;">${esc(b.walker_name || "Walker")}</div>
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
                      onclick="confirmCounterUI('${esc(jobId)}','${esc(b.bid_id)}')">Send</button>
                    <button class="btn btn-ghost btn-small" type="button"
                      onclick="toggleCounterUI('${esc(jobId)}','${esc(b.bid_id)}')">Cancel</button>
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
    await refreshCurrentWalks().catch(()=>{});
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
    if (!jobs.length) {
      if (empty) empty.style.display = "block";
      return;
    }

    list.innerHTML = jobs.map((j) => {
      const mapLink = j.maps_link || mapsSearchLink([j.address, j.city].filter(Boolean).join(", "));
      return `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-inner">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:900;font-size:16px;">${esc(jobTitle(j))}</div>
              <div class="muted" style="font-size:12px;margin-top:6px;">
                ${esc(j.duration || "")} min
                ${jobRef(j) ? ` • ${esc(jobRef(j))}` : ``}
              </div>
              ${j.notes ? `<div class="muted" style="font-size:12px;margin-top:8px;">${esc(j.notes)}</div>` : ``}
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                <a class="btn btn-outline btn-small" href="${esc(mapLink)}" target="_blank" rel="noopener">Directions</a>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button class="btn btn-primary btn-small" type="button" onclick="openChat('${esc(j.job_id)}')">Chat</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  /* ============ chat ============ */
  window.openChat = async function (jobId) {
    CURRENT_CHAT_JOB_ID = jobId;
    const head = document.getElementById("chatHeader");
    if (head) head.textContent = `Chat`;
    openDlg("chatModal");
    await loadChat();
  };

  window.loadChat = async function () {
    const token = getToken();
    if (!token || !CURRENT_CHAT_JOB_ID) return;

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
    setDateMinTodayAndDefaultTime();
    renderAuthUI();

    const yr = document.getElementById("yr");
    if (yr) yr.textContent = new Date().getFullYear();
  }

  waitForModalsThenInit();

  window.refreshJobs = refreshJobs;
  window.refreshOwnerJobs = refreshOwnerJobs;
  window.refreshCurrentWalks = refreshCurrentWalks;
  window.renderDash = renderDash;
})();
