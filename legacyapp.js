// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/AKfycby6JqMSNnX-K6DcAHydCaoZ9sgJxMfhlM1K98b7D9bGCG2qRcVJBBlnnvqFQKJTyyyaOQ/exec"; // <-- put your Apps Script URL here

// ====== GLOBAL STATE ======
const state = {
  token: null,
  profile: null,
  lastResponse: null,
  ownerJobs: [],
  currentJobs: [],
};

// ====== DOM HELPERS ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const on = (id, ev, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(ev, handler);
};

function getSubmitButton(e) {
  const form = e.target;
  if (!form || !form.querySelector) return null;
  return form.querySelector('button[type="submit"]');
}

// ====== UI HELPERS ======
function showToast(message, { error = false } = {}) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "error");
  if (error) el.classList.add("error");
  requestAnimationFrame(() => {
    el.classList.add("show");
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.classList.add("hidden"), 250);
    }, 2600);
  });
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset._origText) btn.dataset._origText = btn.textContent;
    btn.textContent = "Working…";
    btn.disabled = true;
  } else {
    if (btn.dataset._origText) btn.textContent = btn.dataset._origText;
    btn.disabled = false;
  }
}

// ---- Pretty date formatting for jobs ----
function formatJobWhen(job) {
  let dateText = "";
  let timeText = "";

  if (job.date) {
    const d = new Date(job.date);
    if (!isNaN(d.getTime())) {
      // e.g. "05 Feb 2026"
      dateText = d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } else {
      dateText = String(job.date);
    }
  }

  if (job.time) {
    const t = new Date(job.time);
    if (!isNaN(t.getTime())) {
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      timeText = `${hh}:${mm}`;
    } else {
      timeText = String(job.time);
    }
  }

  return [dateText, timeText].filter(Boolean).join(" · ");
}

// **NEW** short title (no code)
function jobTitle(job) {
  const dog = job.dog_name || "Dog";
  const city = job.city || "";
  const title = [dog, city].filter(Boolean).join(" · ");
  return title || "Walk";
}

// **Existing** full label with code, used in meta or emails if needed
function jobHuman(job) {
  const code = job.job_code ? `#${job.job_code}` : "";
  const dog = job.dog_name || "Dog";
  const city = job.city || "";
  const when = formatJobWhen(job);
  return [code, dog, city, when].filter(Boolean).join(" · ");
}

// **NEW** for the small "ID #CODE" meta bit
function jobIdLabel(job) {
  return job.job_code ? `ID #${job.job_code}` : "";
}

// ====== API WRAPPER ======
async function api(action, data = {}) {
  const payload = JSON.stringify({ action, ...data });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "payload=" + encodeURIComponent(payload),
  });

  let json;
  try {
    json = await res.json();
  } catch (e) {
    console.error("Error parsing JSON from server", e);
    showToast("Server error. Try again.", { error: true });
    throw e;
  }

  state.lastResponse = json;
  updateDebugPanel();

  if (!json.ok) {
    const msg = json.error || "Something went wrong.";
    showToast(msg, { error: true });
    throw new Error(msg);
  }
  return json;
}

// ====== VIEW / NAV ======
function showView(id) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  const el = document.getElementById("view-" + id);
  if (el) el.classList.add("active");

  $$(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === id);
  });
}

function updateAuthNav() {
  const isAuthed = !!state.token;
  $$(".nav-auth-only").forEach((el) => {
    el.style.display = isAuthed ? "inline-flex" : "none";
  });
  $$(".nav-guest-only").forEach((el) => {
    el.style.display = isAuthed ? "none" : "inline-flex";
  });
}

// ====== DEBUG PANEL ======
function updateDebugPanel() {
  const pre = $("#debug-content");
  if (!pre) return;
  if (!state.lastResponse) {
    pre.textContent = "–";
  } else {
    pre.textContent = JSON.stringify(state.lastResponse, null, 2);
  }
}

// ====== LOGIN MODAL ======
function openLoginModal() {
  const modal = $("#login-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  const stepEmail = $("#login-step-email");
  const stepCode = $("#login-step-code");
  if (stepEmail && stepCode) {
    stepEmail.classList.remove("hidden");
    stepCode.classList.add("hidden");
  }
  const status1 = $("#login-email-status");
  const status2 = $("#login-code-status");
  if (status1) status1.textContent = "";
  if (status2) status2.textContent = "";
  const emailInput = $("#login-email");
  if (emailInput) emailInput.focus();
}

function closeLoginModal() {
  const modal = $("#login-modal");
  if (modal) modal.classList.add("hidden");
}

function goToLoginCodeStep() {
  const stepEmail = $("#login-step-email");
  const stepCode = $("#login-step-code");
  if (stepEmail && stepCode) {
    stepEmail.classList.add("hidden");
    stepCode.classList.remove("hidden");
  }
  const codeInput = $("#login-code");
  if (codeInput) codeInput.focus();
}

// ====== PROFILE ======
async function refreshProfile() {
  if (!state.token) return;
  const res = await api("get_profile", { token: state.token });
  state.profile = res.profile || {};
  fillProfileForm();
  updateDashboardHeader();
}

function fillProfileForm() {
  const p = state.profile || {};
  const emailEl = $("#profile-email");
  if (emailEl) emailEl.value = p.email || "";

  const nameEl = $("#profile-name");
  if (nameEl) nameEl.value = p.name || "";

  const phoneEl = $("#profile-phone");
  if (phoneEl) phoneEl.value = p.phone || "";

  const cityEl = $("#profile-city");
  if (cityEl) cityEl.value = p.city || "";

  const addrEl = $("#profile-address");
  if (addrEl) addrEl.value = p.address || "";

  const payEl = $("#profile-pay");
  if (payEl) payEl.value = p.pay_method || "";

  const bioEl = $("#profile-bio");
  if (bioEl) bioEl.value = p.bio || "";

  const roleEl = $("#profile-role");
  if (roleEl) {
    const role = p.role || "";
    const lower = role.toLowerCase();
    if (lower.includes("owner") && lower.includes("walker")) {
      roleEl.value = "owner, walker";
    } else if (lower.includes("owner")) {
      roleEl.value = "owner";
    } else if (lower.includes("walker")) {
      roleEl.value = "walker";
    } else {
      roleEl.value = "";
    }
  }

  const label = $("#role-label");
  if (label) {
    const parts = [];
    if (String(p.is_owner) === "1") parts.push("Owner");
    if (String(p.is_walker) === "1") parts.push("Walker");
    label.textContent = parts.length ? parts.join(" · ") : "No roles selected yet.";
  }
}

async function saveProfileFromForm(e) {
  e.preventDefault();
  if (!state.token) return;
  const btn = getSubmitButton(e);
  setLoading(btn, true);
  const statusEl = $("#profile-status");
  if (statusEl) statusEl.textContent = "";

  try {
    const profile = {
      name: ($("#profile-name")?.value || "").trim(),
      phone: ($("#profile-phone")?.value || "").trim(),
      city: ($("#profile-city")?.value || "").trim(),
      address: ($("#profile-address")?.value || "").trim(),
      pay_method: ($("#profile-pay")?.value || "").trim(),
      bio: ($("#profile-bio")?.value || "").trim(),
    };
    const roleEl = $("#profile-role");
    const role = roleEl ? roleEl.value : "";
    const res = await api("save_profile", { token: state.token, role, profile });
    state.profile = res.profile;
    fillProfileForm();
    updateDashboardHeader();
    if (statusEl) statusEl.textContent = "Saved.";
    showToast("Profile saved ✔️");
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Could not save.";
  } finally {
    setLoading(btn, false);
  }
}

// ====== DASHBOARD ======
async function loadDashboard() {
  if (!state.token) return;
  showView("dashboard");
  updateDashboardHeader();
  try {
    const [ownerRes, currentRes] = await Promise.all([
      api("owner_jobs", { token: state.token }),
      api("current_walks", { token: state.token }),
    ]);
    state.ownerJobs = ownerRes.jobs || [];
    state.currentJobs = currentRes.jobs || [];
    renderLatestOwner();
    renderDashboardCurrent();
    setHowDashboardMode("owner");
  } catch (e) {
    console.error(e);
  }
}

function updateDashboardHeader() {
  const sub = $("#dashboard-subtitle");
  if (!sub) return;
  const p = state.profile || {};
  const who = p.name || p.email || "";
  sub.textContent = who ? `Welcome back, ${who}.` : "Welcome back.";
}

function renderLatestOwner() {
  const container = $("#latest-owner-content");
  if (!container) return;
  const jobs = state.ownerJobs || [];
  if (!jobs.length) {
    container.classList.add("empty-state");
    container.innerHTML = "<span>– No walks yet. Post your first walk.</span>";
    return;
  }
  const latest = [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  container.classList.remove("empty-state");
  const when = formatJobWhen(latest);
  const codeLabel = jobIdLabel(latest);

  container.innerHTML = `
    <div>
      <div class="job-header">
        <div>
          <div class="job-title">${jobTitle(latest)}</div>
          <div class="job-meta">
            ${codeLabel ? `<span>${codeLabel}</span>` : ""}
            ${when ? `<span>${when}</span>` : ""}
            <span>${latest.duration || "?"} min</span>
            <span>${latest.max_price ? latest.max_price + " CHF max" : "No max set"}</span>
          </div>
        </div>
        <span class="badge badge-status-${String(latest.status || "open").toLowerCase()}">
          ${latest.status || "open"}
        </span>
      </div>
      <div class="job-actions">
        <button class="btn btn-small btn-outline" data-owner-job-id="${latest.job_id}">View bids</button>
      </div>
    </div>
  `;

  const btn = container.querySelector("[data-owner-job-id]");
  if (btn) {
    btn.addEventListener("click", function () {
      openOwnerJob(btn.dataset.ownerJobId);
    });
  }
}

function renderDashboardCurrent() {
  const container = $("#dashboard-current-content");
  if (!container) return;
  const jobs = state.currentJobs || [];
  if (!jobs.length) {
    container.classList.add("empty-state");
    container.innerHTML = "<span>– Nothing active right now.</span>";
    return;
  }

  const job = jobs[0];
  container.classList.remove("empty-state");
  const mapsLink = job.maps_link;
  const when = formatJobWhen(job);
  const codeLabel = jobIdLabel(job);

  container.innerHTML = `
    <div>
      <div class="job-header">
        <div>
          <div class="job-title">${jobTitle(job)}</div>
          <div class="job-meta">
            ${codeLabel ? `<span>${codeLabel}</span>` : ""}
            ${when ? `<span>${when}</span>` : ""}
            <span>${job.duration || "?"} min</span>
            <span>${job.pay_method || ""}</span>
          </div>
        </div>
        <span class="badge badge-status-assigned">Assigned</span>
      </div>
      <div class="job-meta">
        ${job.city ? `<span>${job.city}</span>` : ""}
        ${
          mapsLink
            ? `<a href="${mapsLink}" target="_blank" rel="noopener">Open in Maps</a>`
            : ""
        }
      </div>
      <div class="job-actions">
        <button class="btn btn-small btn-outline" data-current-open="${job.job_id}">Open details</button>
      </div>
    </div>
  `;

  const btn = container.querySelector("[data-current-open]");
  if (btn) {
    btn.addEventListener("click", function () {
      loadCurrentView();
    });
  }
}

// ====== "How it works" explainer in dashboard ======
function setHowDashboardMode(mode) {
  const textEl = $("#how-text");
  const ownerBtn = $("#btn-how-owner");
  const walkerBtn = $("#btn-how-walker");
  if (!textEl || !ownerBtn || !walkerBtn) return;

  if (mode === "owner") {
    ownerBtn.classList.add("btn-primary");
    ownerBtn.classList.remove("btn-outline");
    walkerBtn.classList.add("btn-outline");
    walkerBtn.classList.remove("btn-primary");

    textEl.innerHTML = `
      <p><strong>As an owner, you:</strong></p>
      <ul class="bullet-list">
        <li>Set up your profile with city, contact and how you prefer to pay.</li>
        <li>Post a walk with date, time, duration, max price and dog info.</li>
        <li>Walkers in your city get an email and can place bids.</li>
        <li>You see all bids, can accept one directly or send a counter offer.</li>
        <li>When you accept, that walker gets your exact address and a chat opens.</li>
        <li>After the walk, you mark it as <strong>done</strong>. That frees the walker for another job.</li>
      </ul>
    `;
  } else {
    walkerBtn.classList.add("btn-primary");
    walkerBtn.classList.remove("btn-outline");
    ownerBtn.classList.add("btn-outline");
    ownerBtn.classList.remove("btn-primary");

    textEl.innerHTML = `
      <p><strong>As a walker, you:</strong></p>
      <ul class="bullet-list">
        <li>Create a profile with your city, contact and how you like to be paid.</li>
        <li>Get emails when new walks are posted in your city.</li>
        <li>See only approximate location first (city-level map), not the exact address.</li>
        <li>Place a bid with your price and a short message.</li>
        <li>If the owner counters, you can accept or decline the counter.</li>
        <li>Once a bid is accepted, you see the exact address + chat and can organise details.</li>
        <li>You can only have one active walk at a time, so you don’t overbook yourself.</li>
      </ul>
    `;
  }
}

// ====== POST WALK ======
async function submitPostWalk(e) {
  e.preventDefault();
  if (!state.token) return;
  const btn = getSubmitButton(e);
  setLoading(btn, true);
  const statusEl = $("#post-status");
  if (statusEl) statusEl.textContent = "";
  try {
    const job = {
      dog_name: ($("#post-dog-name")?.value || "").trim(),
      dog_size: ($("#post-dog-size")?.value || "").trim(),
      temperament: ($("#post-temperament")?.value || "").trim(),
      city: ($("#post-city")?.value || "").trim(),
      address: ($("#post-address")?.value || "").trim(),
      date: $("#post-date")?.value || "",
      time: $("#post-time")?.value || "",
      duration: $("#post-duration")?.value || "",
      max_price: $("#post-max-price")?.value || "",
      mode: $("#post-mode")?.value || "",
      notes: ($("#post-notes")?.value || "").trim(),
      extra: ($("#post-extra")?.value || "").trim(),
      pay_method: ($("#post-pay-method")?.value || "").trim(),
    };
    await api("create_job", { token: state.token, job });
    if (statusEl) statusEl.textContent = "Walk posted ✔️";
    showToast("Walk posted ✔️");

    // small speed improvement: just reload dashboard once
    await loadDashboard();
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Could not post walk.";
  } finally {
    setLoading(btn, false);
  }
}

// ====== OPEN JOBS + BIDDING ======
async function loadOpenJobsView() {
  if (!state.token) return;
  showView("open-jobs");
  const list = $("#open-jobs-list");
  if (!list) return;
  list.innerHTML = "<div class='empty-state'>Loading walks…</div>";
  try {
    const res = await api("list_jobs", { token: state.token, filter: {} });
    const jobs = res.jobs || [];
    if (!jobs.length) {
      list.innerHTML = "<div class='empty-state'>No open walks right now.</div>";
      return;
    }
    list.innerHTML = "";
    jobs.forEach((job) => {
      const when = formatJobWhen(job);
      const codeLabel = jobIdLabel(job);

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="job-header">
          <div>
            <div class="job-title">${jobTitle(job)}</div>
            <div class="job-meta">
              ${codeLabel ? `<span>${codeLabel}</span>` : ""}
              ${when ? `<span>${when}</span>` : ""}
              <span>${job.duration || "?"} min</span>
              <span>${job.max_price ? job.max_price + " CHF max" : "Owner decides with bids"}</span>
            </div>
          </div>
          ${
            job.near === "1"
              ? `<span class="badge badge-near">Near you</span>`
              : `<span class="badge badge-status-open">Open</span>`
          }
        </div>
        ${
          job.temperament || job.notes
            ? `<p class="small-label">${
                [job.temperament, job.notes].filter(Boolean).join(" • ")
              }</p>`
            : ""
        }
        <div class="job-meta" style="margin-top:0.3rem;">
          ${job.city ? `<span>${job.city}</span>` : ""}
          ${
            job.approx_maps_link
              ? `<a href="${job.approx_maps_link}" target="_blank" rel="noopener">View area on Maps</a>`
              : ""
          }
        </div>
        <div class="job-actions">
          <form class="form bid-form" data-bid-job="${job.job_id}">
            <input type="number" min="1" step="0.5" required placeholder="Your price (CHF)" />
            <input type="text" maxlength="140" placeholder="Short message (optional)" />
            <button class="btn btn-small btn-primary" type="submit">Place bid</button>
          </form>
        </div>
      `;
      list.appendChild(card);

      const form = card.querySelector(".bid-form");
      if (form) {
        form.addEventListener("submit", function (ev) {
          submitBid(ev, job.job_id);
        });
      }
    });
  } catch (err) {
    console.error(err);
    list.innerHTML =
      "<div class='empty-state'>Could not load open walks. Try again.</div>";
  }
}

async function submitBid(e, jobId) {
  e.preventDefault();
  if (!state.token) return;
  const form = e.target;
  const inputs = form.querySelectorAll("input");
  const amountInput = inputs[0];
  const msgInput = inputs[1];
  const btn = form.querySelector('button[type="submit"]');
  const amount = parseFloat((amountInput?.value || "").trim());
  const message = (msgInput?.value || "").trim();
  if (!amount || amount <= 0) {
    showToast("Enter a valid amount.", { error: true });
    return;
  }
  setLoading(btn, true);
  try {
    await api("place_bid", {
      token: state.token,
      job_id: jobId,
      bid: { amount, message },
    });
    showToast("Bid placed ✔️");
    if (amountInput) amountInput.value = "";
    if (msgInput) msgInput.value = "";
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

// ====== CURRENT WALKS + CHAT ======
async function loadCurrentView() {
  if (!state.token) return;
  showView("current");
  const list = $("#current-list");
  if (!list) return;
  list.innerHTML = "<div class='empty-state'>Loading…</div>";
  try {
    const res = await api("current_walks", { token: state.token });
    const jobs = res.jobs || [];
    state.currentJobs = jobs;
    if (!jobs.length) {
      list.innerHTML =
        "<div class='empty-state'>Nothing active right now.</div>";
      return;
    }
    list.innerHTML = "";
    jobs.forEach((job) => {
      const isOwner =
        state.profile &&
        state.profile.email &&
        String(job.owner_email || "").toLowerCase() ===
          String(state.profile.email).toLowerCase();

      const when = formatJobWhen(job);
      const codeLabel = jobIdLabel(job);

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="job-header">
          <div>
            <div class="job-title">${jobTitle(job)}</div>
            <div class="job-meta">
              ${codeLabel ? `<span>${codeLabel}</span>` : ""}
              ${when ? `<span>${when}</span>` : ""}
              <span>${job.duration || "?"} min</span>
              <span>${job.pay_method || ""}</span>
            </div>
          </div>
          <span class="badge badge-status-assigned">Assigned</span>
        </div>
        <div class="job-meta">
          ${job.city ? `<span>${job.city}</span>` : ""}
          ${
            job.maps_link
              ? `<a href="${job.maps_link}" target="_blank" rel="noopener">Open in Maps</a>`
              : ""
          }
        </div>
        <div class="job-actions">
          ${
            isOwner
              ? `<button class="btn btn-small btn-outline" data-done="${job.job_id}">Mark done</button>`
              : ""
          }
          <button class="btn btn-small btn-ghost" data-chat="${job.job_id}">Open chat</button>
        </div>
        <div class="chat" data-chat-container="${job.job_id}" style="display:none;">
          <div class="small-label">Chat</div>
          <div class="chat-messages" id="chat-messages-${job.job_id}"></div>
          <form class="chat-form" data-chat-form="${job.job_id}">
            <input type="text" maxlength="1500" placeholder="Type a message…" />
            <button class="btn btn-small btn-primary" type="submit">Send</button>
          </form>
        </div>
      `;
      list.appendChild(card);

      const doneBtn = card.querySelector("[data-done]");
      if (doneBtn) {
        doneBtn.addEventListener("click", function () {
          markWalkDone(job.job_id, doneBtn);
        });
      }

      const chatBtn = card.querySelector("[data-chat]");
      if (chatBtn) {
        chatBtn.addEventListener("click", function () {
          toggleChat(job.job_id);
        });
      }

      const chatForm = card.querySelector("[data-chat-form]");
      if (chatForm) {
        chatForm.addEventListener("submit", function (ev) {
          submitChat(ev, job.job_id);
        });
      }
    });
  } catch (err) {
    console.error(err);
    list.innerHTML =
      "<div class='empty-state'>Could not load current walks.</div>";
  }
}

async function markWalkDone(jobId, btn) {
  if (!state.token) return;
  setLoading(btn, true);
  try {
    await api("mark_done", { token: state.token, job_id: jobId });
    showToast("Walk marked as done ✔️");
    await loadCurrentView();
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

function toggleChat(jobId) {
  const container = document.querySelector(`[data-chat-container="${jobId}"]`);
  if (!container) return;
  const isVisible = container.style.display !== "none";
  container.style.display = isVisible ? "none" : "block";
  if (!isVisible) loadMessages(jobId);
}

async function loadMessages(jobId) {
  if (!state.token) return;
  const box = document.getElementById("chat-messages-" + jobId);
  if (!box) return;
  box.innerHTML = "<div class='small-label'>Loading…</div>";
  try {
    const res = await api("list_messages", { token: state.token, job_id: jobId });
    const msgs = res.messages || [];
    if (!msgs.length) {
      box.innerHTML = "<div class='small-label'>No messages yet.</div>";
      return;
    }
    box.innerHTML = "";
    msgs.forEach((m) => {
      const div = document.createElement("div");
      div.className = "chat-message";
      const ts = m.ts ? new Date(m.ts).toLocaleString() : "";
      div.innerHTML = `<strong>${m.sender_name || "User"}</strong> · <span style="opacity:0.7;font-size:0.74rem;">${ts}</span><br>${m.body}`;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    console.error(err);
    box.innerHTML =
      "<div class='small-label'>Could not load messages.</div>";
  }
}

async function submitChat(e, jobId) {
  e.preventDefault();
  if (!state.token) return;
  const form = e.target;
  const input = form.querySelector("input");
  const btn = form.querySelector('button[type="submit"]');
  const text = (input?.value || "").trim();
  if (!text) return;
  setLoading(btn, true);
  try {
    await api("send_message", { token: state.token, job_id: jobId, body: text });
    if (input) input.value = "";
    await loadMessages(jobId);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

// ====== OWNER JOB VIEW (BIDS) ======
async function openOwnerJob(jobId) {
  if (!state.token) return;
  const jobsAll = (state.ownerJobs || []).concat(state.currentJobs || []);
  const job = jobsAll.find((j) => String(j.job_id) === String(jobId));
  if (!job) {
    showToast("Walk not found.", { error: true });
    return;
  }
  const titleEl = $("#owner-job-title");
  if (titleEl) titleEl.textContent = jobTitle(job);

  const when = formatJobWhen(job);
  const codeLabel = jobIdLabel(job);
  const subEl = $("#owner-job-sub");
  if (subEl) {
    const parts = [];
    if (codeLabel) parts.push(codeLabel);
    if (when) parts.push(when);
    if (job.notes || job.temperament) {
      parts.push((job.notes || job.temperament).slice(0, 80));
    }
    subEl.textContent = parts.join(" · ");
  }

  const meta = $("#owner-job-meta");
  if (meta) {
    meta.innerHTML = `
      <div class="job-meta" style="margin-bottom:0.4rem;">
        ${codeLabel ? `<span>${codeLabel}</span>` : ""}
        ${when ? `<span>${when}</span>` : ""}
        <span>${job.city || ""}</span>
        <span>${job.duration || "?"} min</span>
        <span>${job.max_price ? job.max_price + " CHF max" : "No max set"}</span>
      </div>
      ${
        job.maps_link
          ? `<p class="small-label"><a href="${job.maps_link}" target="_blank" rel="noopener">Open exact location in Maps</a></p>`
          : ""
      }
      <p class="small-label">Status: <strong>${job.status}</strong></p>
    `;
  }

  showView("owner-job");
  try {
    const res = await api("list_bids", { token: state.token, job_id: jobId });
    const bids = res.bids || [];
    renderOwnerBids(job, bids);
  } catch (err) {
    console.error(err);
    const container = $("#owner-job-bids");
    if (container) {
      container.innerHTML =
        "<div class='empty-state'>Could not load bids.</div>";
    }
  }
}

function renderOwnerBids(job, bids) {
  const container = $("#owner-job-bids");
  if (!container) return;
  if (!bids.length) {
    container.innerHTML =
      "<div class='empty-state'>No bids yet. You’ll receive an email when someone bids.</div>";
    return;
  }
  container.innerHTML = "";
  bids.forEach((b) => {
    const status = String(b.status || "active").toLowerCase();
    const row = document.createElement("div");
    row.className = "bid-row";
    row.innerHTML = `
      <div class="bid-main">
        <div><strong>${b.walker_name || "Walker"}</strong></div>
        <div class="bid-meta">
          <span>Bid: ${b.amount ? b.amount + " CHF" : "–"}</span>
          ${b.counter_amount ? `<span>Counter: ${b.counter_amount} CHF</span>` : ""}
        </div>
        ${
          b.message
            ? `<div class="small-label">“${b.message.slice(0, 80)}${b.message.length > 80 ? "…" : ""}”</div>`
            : ""
        }
      </div>
      <div class="small-label">
        <span class="badge badge-status-${status}">${b.status}</span>
      </div>
      <div class="bid-actions">
        ${
          status === "active"
            ? `<button class="btn btn-tiny btn-primary" data-accept="${b.bid_id}" data-job="${job.job_id}">Accept</button>
               <button class="btn btn-tiny btn-outline" data-counter="${b.bid_id}" data-job="${job.job_id}">Counter</button>`
            : ""
        }
      </div>
    `;
    container.appendChild(row);

    const acceptBtn = row.querySelector("[data-accept]");
    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () {
        acceptBid(job.job_id, acceptBtn.dataset.accept, acceptBtn);
      });
    }
    const counterBtn = row.querySelector("[data-counter]");
    if (counterBtn) {
      counterBtn.addEventListener("click", function () {
        promptCounter(job.job_id, counterBtn.dataset.counter);
      });
    }
  });
}

async function acceptBid(jobId, bidId, btn) {
  if (!state.token) return;
  setLoading(btn, true);
  try {
    await api("accept_bid", { token: state.token, job_id: jobId, bid_id: bidId });
    showToast("Bid accepted ✔️");
    await loadCurrentView();
    await openOwnerJob(jobId);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

async function promptCounter(jobId, bidId) {
  const raw = window.prompt("Counter amount (CHF):");
  if (raw == null) return;
  const amount = parseFloat(raw);
  if (!amount || amount <= 0) {
    showToast("Enter a valid amount.", { error: true });
    return;
  }
  try {
    await api("counter_bid", {
      token: state.token,
      job_id: jobId,
      bid_id: bidId,
      counter: { amount },
    });
    showToast("Counter sent ✔️");
    await openOwnerJob(jobId);
  } catch (err) {
    console.error(err);
  }
}

// ====== MY BIDS (WALKER) ======
async function loadMyBidsView() {
  if (!state.token) return;
  showView("my-bids");
  const list = $("#my-bids-list");
  if (!list) return;
  list.innerHTML = "<div class='empty-state'>Loading…</div>";
  try {
    const res = await api("my_bids", { token: state.token });
    const bids = res.bids || [];
    if (!bids.length) {
      list.innerHTML = "<div class='empty-state'>You have no bids yet.</div>";
      return;
    }
    list.innerHTML = "";
    bids.forEach((b) => {
      const status = String(b.status || "active").toLowerCase();
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="job-header">
          <div class="job-title">Bid on ${jobIdLabel(b) || b.job_id}</div>
          <span class="badge badge-status-${status}">${b.status}</span>
        </div>
        <div class="job-meta">
          <span>Amount: ${b.amount ? b.amount + " CHF" : "–"}</span>
          ${b.counter_amount ? `<span>Counter: ${b.counter_amount} CHF</span>` : ""}
        </div>
        ${
          b.message
            ? `<p class="small-label">“${b.message.slice(0, 120)}${b.message.length > 120 ? "…" : ""}”</p>`
            : ""
        }
        <div class="job-actions">
          ${
            status === "countered"
              ? `<button class="btn btn-small btn-primary" data-accept-counter="${b.bid_id}" data-job="${b.job_id}">Accept counter</button>
                 <button class="btn btn-small btn-outline" data-decline-counter="${b.bid_id}" data-job="${b.job_id}">Decline counter</button>`
              : ""
          }
        </div>
      `;
      list.appendChild(card);

      const acceptBtn = card.querySelector("[data-accept-counter]");
      if (acceptBtn) {
        acceptBtn.addEventListener("click", function () {
          acceptCounter(b.job_id, b.bid_id, acceptBtn);
        });
      }
      const declineBtn = card.querySelector("[data-decline-counter]");
      if (declineBtn) {
        declineBtn.addEventListener("click", function () {
          declineCounter(b.job_id, b.bid_id, declineBtn);
        });
      }
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<div class='empty-state'>Could not load your bids.</div>";
  }
}

async function acceptCounter(jobId, bidId, btn) {
  if (!state.token) return;
  setLoading(btn, true);
  try {
    await api("accept_counter", {
      token: state.token,
      job_id: jobId,
      bid_id: bidId,
    });
    showToast("Counter accepted ✔️");
    await loadMyBidsView();
    await loadCurrentView();
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

async function declineCounter(jobId, bidId, btn) {
  if (!state.token) return;
  setLoading(btn, true);
  try {
    await api("decline_counter", {
      token: state.token,
      job_id: jobId,
      bid_id: bidId,
    });
    showToast("Counter declined.");
    await loadMyBidsView();
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

// ====== AUTH FLOW ======
async function handleLoginEmail(e) {
  e.preventDefault();
  const emailInput = $("#login-email");
  const email = (emailInput?.value || "").trim();
  if (!email) return;
  const btn = getSubmitButton(e);
  setLoading(btn, true);
  const statusEl = $("#login-email-status");
  if (statusEl) statusEl.textContent = "";
  try {
    await api("start_login", { email });
    if (statusEl) statusEl.textContent = "Code sent. Check your inbox.";
    goToLoginCodeStep();
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Could not send code.";
  } finally {
    setLoading(btn, false);
  }
}

async function handleLoginCode(e) {
  e.preventDefault();
  const email = ($("#login-email")?.value || "").trim();
  const code = ($("#login-code")?.value || "").trim();
  if (!email || !code) return;
  const btn = getSubmitButton(e);
  setLoading(btn, true);
  const statusEl = $("#login-code-status");
  if (statusEl) statusEl.textContent = "";
  try {
    const res = await api("verify_code", { email, code });
    state.token = res.token;
    state.profile = res.profile || {};
    localStorage.setItem("igoToken", state.token);
    closeLoginModal();
    updateAuthNav();
    await loadDashboard();
    showToast("Signed in ✔️");
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Invalid or expired code.";
  } finally {
    setLoading(btn, false);
  }
}

function logout() {
  state.token = null;
  state.profile = null;
  state.ownerJobs = [];
  state.currentJobs = [];
  localStorage.removeItem("igoToken");
  updateAuthNav();
  showView("landing");
  showToast("Logged out.");
}

// ====== INIT & EVENTS ======
function bindEvents() {
  // Landing
  on("btn-landing-signin", "click", openLoginModal);
  on("btn-landing-learn", "click", function () {
    showView("landing");
  });

  // Nav
  $$(".nav-btn").forEach((btn) => {
    const target = btn.dataset.nav;
    if (!target) return;
    btn.addEventListener("click", async function () {
      if (target === "landing") {
        showView("landing");
        return;
      }
      if (!state.token) {
        openLoginModal();
        return;
      }
      if (target === "dashboard") await loadDashboard();
      else if (target === "open-jobs") await loadOpenJobsView();
      else if (target === "current") await loadCurrentView();
      else if (target === "my-bids") await loadMyBidsView();
      else if (target === "profile") {
        showView("profile");
        fillProfileForm();
      } else if (target === "post") {
        showView("post");
      } else {
        showView(target);
      }
    });
  });

  on("btn-open-login", "click", openLoginModal);
  on("btn-logout", "click", logout);

  // Login modal
  on("login-close", "click", closeLoginModal);
  on("login-back", "click", function () {
    const stepEmail = $("#login-step-email");
    const stepCode = $("#login-step-code");
    if (stepEmail && stepCode) {
      stepCode.classList.add("hidden");
      stepEmail.classList.remove("hidden");
    }
  });

  const formLoginEmail = $("#form-login-email");
  if (formLoginEmail) {
    formLoginEmail.addEventListener("submit", handleLoginEmail);
  }

  const formLoginCode = $("#form-login-code");
  if (formLoginCode) {
    formLoginCode.addEventListener("submit", handleLoginCode);
  }

  // Profile
  const formProfile = $("#form-profile");
  if (formProfile) {
    formProfile.addEventListener("submit", saveProfileFromForm);
  }
  on("btn-go-profile", "click", function () {
    if (!state.token) return;
    showView("profile");
    fillProfileForm();
  });

  // Quick actions
  on("btn-go-post", "click", function () {
    showView("post");
  });
  on("btn-go-open-jobs", "click", function () {
    loadOpenJobsView();
  });
  on("btn-go-current", "click", function () {
    loadCurrentView();
  });
  on("btn-go-my-bids", "click", function () {
    loadMyBidsView();
  });

  // Post form
  const formPost = $("#form-post");
  if (formPost) {
    formPost.addEventListener("submit", submitPostWalk);
  }

  // Owner job back
  on("btn-owner-job-back", "click", function () {
    showView("dashboard");
  });

  // How it works box
  on("btn-how-owner", "click", function () {
    setHowDashboardMode("owner");
  });
  on("btn-how-walker", "click", function () {
    setHowDashboardMode("walker");
  });

  // Debug toggle
  on("debug-toggle", "click", function () {
    const panel = $("#debug-panel");
    if (!panel) return;
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const panel = $("#debug-panel");
      if (!panel) return;
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    }
  });
}

async function boot() {
  bindEvents();
  updateAuthNav();
  updateDebugPanel();
  showView("landing");

  const savedToken = localStorage.getItem("igoToken");
  if (savedToken) {
    state.token = savedToken;
    updateAuthNav();
    try {
      await refreshProfile();
      await loadDashboard();
    } catch (err) {
      console.error(err);
      logout();
    }
  }
}

document.addEventListener("DOMContentLoaded", boot);
