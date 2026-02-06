// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/AKfycbxMmD4GM4MR8C58OfgfvCCS_u3RfzEgr-YPQ3OUkABATnKTsXQRvnvK7Jeqadgn-crtVQ/exec"; // <-- put your Apps Script URL here

// ====== GLOBAL STATE ======
const state = {
  token: null,
  profile: null,
  lastResponse: null,
  ownerJobs: [],
  currentJobs: [],
};

// ====== DOM SHORTCUTS ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ====== BASIC HELPERS ======
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
    }, 2800);
  });
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset._origText = btn.textContent;
    btn.textContent = "Working…";
    btn.disabled = true;
  } else {
    if (btn.dataset._origText) btn.textContent = btn.dataset._origText;
    btn.disabled = false;
  }
}

function jobHuman(job) {
  const code = job.job_code ? `#${job.job_code}` : "";
  const dog = job.dog_name || "Dog";
  const city = job.city || "";
  const when = (job.date || "") + (job.time ? " " + job.time : "");
  return [code, dog, city, when].filter(Boolean).join(" · ");
}

// ====== API WRAPPER (matches backend doPost signature) ======
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
    showToast("Could not parse server response.", { error: true });
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

// ====== VIEW SWITCHING & NAV ======
function showView(id) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  const el = document.getElementById("view-" + id);
  if (el) el.classList.add("active");

  // nav active classes
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
  $("#login-modal").classList.remove("hidden");
  $("#login-step-email").classList.remove("hidden");
  $("#login-step-code").classList.add("hidden");
  $("#login-email-status").textContent = "";
  $("#login-code-status").textContent = "";
  $("#login-email").focus();
}

function closeLoginModal() {
  $("#login-modal").classList.add("hidden");
}

function goToLoginCodeStep() {
  $("#login-step-email").classList.add("hidden");
  $("#login-step-code").classList.remove("hidden");
  $("#login-code").focus();
}

// ====== PROFILE LOAD/SAVE ======
async function refreshProfile() {
  if (!state.token) return;
  const res = await api("get_profile", { token: state.token });
  state.profile = res.profile || {};
  fillProfileForm();
  updateDashboardHeader();
}

function fillProfileForm() {
  if (!state.profile) return;
  $("#profile-email").value = state.profile.email || "";
  $("#profile-name").value = state.profile.name || "";
  $("#profile-phone").value = state.profile.phone || "";
  $("#profile-city").value = state.profile.city || "";
  $("#profile-address").value = state.profile.address || "";
  $("#profile-pay").value = state.profile.pay_method || "";
  $("#profile-bio").value = state.profile.bio || "";
  const role = state.profile.role || "";
  $("#profile-role").value = role.toLowerCase().includes("owner") && role.toLowerCase().includes("walker")
    ? "owner, walker"
    : role.toLowerCase().includes("owner")
    ? "owner"
    : role.toLowerCase().includes("walker")
    ? "walker"
    : "";
  const label = $("#role-label");
  if (label) {
    const parts = [];
    if (String(state.profile.is_owner) === "1") parts.push("Owner");
    if (String(state.profile.is_walker) === "1") parts.push("Walker");
    label.textContent = parts.length ? parts.join(" · ") : "No roles selected yet.";
  }
}

async function saveProfileFromForm(e) {
  e.preventDefault();
  if (!state.token) return;
  const btn = e.submitter;
  setLoading(btn, true);
  $("#profile-status").textContent = "";
  try {
    const profile = {
      name: $("#profile-name").value.trim(),
      phone: $("#profile-phone").value.trim(),
      city: $("#profile-city").value.trim(),
      address: $("#profile-address").value.trim(),
      pay_method: $("#profile-pay").value.trim(),
      bio: $("#profile-bio").value.trim(),
    };
    const role = $("#profile-role").value;
    const res = await api("save_profile", { token: state.token, role, profile });
    state.profile = res.profile;
    fillProfileForm();
    updateDashboardHeader();
    $("#profile-status").textContent = "Saved.";
    showToast("Profile saved ✔️");
  } catch (err) {
    $("#profile-status").textContent = "Could not save.";
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
  } catch (_) {
    // handled via toast
  }
}

function updateDashboardHeader() {
  const sub = $("#dashboard-subtitle");
  if (!sub) return;
  const name = state.profile?.name || "";
  const email = state.profile?.email || "";
  const who = name || email || "";
  sub.textContent = who ? `Welcome back, ${who}.` : "Welcome back.";
}

function renderLatestOwner() {
  const container = $("#latest-owner-content");
  if (!container) return;
  const jobs = state.ownerJobs;
  if (!jobs || !jobs.length) {
    container.classList.add("empty-state");
    container.innerHTML = "<span>– No walks yet. Post your first walk.</span>";
    return;
  }
  const latest = [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  container.classList.remove("empty-state");
  container.innerHTML = `
    <div>
      <div class="job-header">
        <div>
          <div class="job-title">${jobHuman(latest)}</div>
          <div class="job-meta">
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
        <button class="btn btn-small btn-ghost" id="latest-owner-all">All my walks</button>
      </div>
    </div>
  `;

  container.querySelector("[data-owner-job-id]").addEventListener("click", (e) => {
    openOwnerJob(e.target.dataset.ownerJobId);
  });
  container.querySelector("#latest-owner-all").addEventListener("click", () => {
    // Just ensure owner jobs loaded; could add a dedicated view later.
    showToast("Scroll dashboard to see your latest walks.");
  });
}

function renderDashboardCurrent() {
  const container = $("#dashboard-current-content");
  if (!container) return;
  const jobs = state.currentJobs;
  if (!jobs || !jobs.length) {
    container.classList.add("empty-state");
    container.innerHTML = "<span>– Nothing active right now.</span>";
    return;
  }

  const job = jobs[0];
  container.classList.remove("empty-state");
  const mapsLink = job.maps_link;
  container.innerHTML = `
    <div>
      <div class="job-header">
        <div>
          <div class="job-title">${jobHuman(job)}</div>
          <div class="job-meta">
            <span>${job.duration || "?"} min</span>
            <span>${job.pay_method || ""}</span>
          </div>
        </div>
        <span class="badge badge-status-assigned">Assigned</span>
      </div>
      <div class="job-actions">
        ${mapsLink ? `<a class="btn btn-small btn-outline" href="${mapsLink}" target="_blank" rel="noopener">Open in Maps</a>` : ""}
        <button class="btn btn-small btn-outline" data-current-open="${job.job_id}">Open details</button>
      </div>
    </div>
  `;

  container.querySelector("[data-current-open]").addEventListener("click", async () => {
    await loadCurrentView();
  });
}

// ====== POST WALK ======
async function submitPostWalk(e) {
  e.preventDefault();
  if (!state.token) return;
  const btn = e.submitter;
  setLoading(btn, true);
  $("#post-status").textContent = "";
  try {
    const job = {
      dog_name: $("#post-dog-name").value.trim(),
      dog_size: $("#post-dog-size").value.trim(),
      temperament: $("#post-temperament").value.trim(),
      city: $("#post-city").value.trim(),
      address: $("#post-address").value.trim(),
      date: $("#post-date").value,
      time: $("#post-time").value,
      duration: $("#post-duration").value,
      max_price: $("#post-max-price").value,
      mode: $("#post-mode").value,
      notes: $("#post-notes").value.trim(),
      extra: $("#post-extra").value.trim(),
      pay_method: $("#post-pay-method").value.trim(),
    };
    const res = await api("create_job", { token: state.token, job });
    $("#post-status").textContent = "Walk posted ✔️";
    showToast("Walk posted ✔️");
    // reload owner jobs & dashboard
    const ownerRes = await api("owner_jobs", { token: state.token });
    state.ownerJobs = ownerRes.jobs || [];
    await loadDashboard();
  } catch (err) {
    $("#post-status").textContent = "Could not post walk.";
  } finally {
    setLoading(btn, false);
  }
}

// ====== OPEN JOBS (LIST + BID) ======
async function loadOpenJobsView() {
  if (!state.token) return;
  showView("open-jobs");
  const list = $("#open-jobs-list");
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
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="job-header">
          <div>
            <div class="job-title">${jobHuman(job)}</div>
            <div class="job-meta">
              <span>${job.duration || "?"} min</span>
              <span>${job.max_price ? job.max_price + " CHF max" : "Owner decides with bids"}</span>
            </div>
          </div>
          <div class="badge-group">
            ${
              job.near === "1"
                ? `<span class="badge badge-near">Near you</span>`
                : `<span class="badge badge-status-open">Open</span>`
            }
          </div>
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
      form.addEventListener("submit", (e) => submitBid(e, job.job_id));
    });
  } catch (_) {
    list.innerHTML =
      "<div class='empty-state'>Could not load open walks. Try again.</div>";
  }
}

async function submitBid(e, jobId) {
  e.preventDefault();
  if (!state.token) return;
  const form = e.target;
  const [amountInput, msgInput] = form.querySelectorAll("input");
  const btn = form.querySelector("button[type=submit]");
  const amount = parseFloat(amountInput.value);
  const message = (msgInput.value || "").trim();
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
    amountInput.value = "";
    msgInput.value = "";
  } catch (_) {
    // toast already shown
  } finally {
    setLoading(btn, false);
  }
}

// ====== CURRENT WALKS + CHAT + MARK DONE ======
async function loadCurrentView() {
  if (!state.token) return;
  showView("current");
  const list = $("#current-list");
  list.innerHTML = "<div class='empty-state'>Loading…</div>";

  try {
    const res = await api("current_walks", { token: state.token });
    const jobs = res.jobs || [];
    state.currentJobs = jobs;
    if (!jobs.length) {
      list.innerHTML = "<div class='empty-state'>Nothing active right now.</div>";
      return;
    }
    list.innerHTML = "";
    jobs.forEach((job) => {
      const isOwner =
        state.profile &&
        state.profile.email &&
        String(job.owner_email || "").toLowerCase() ===
          String(state.profile.email).toLowerCase();

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="job-header">
          <div>
            <div class="job-title">${jobHuman(job)}</div>
            <div class="job-meta">
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
          <div class="chat-messages" id="chat-messages-${job.job_id}">
            <!-- messages -->
          </div>
          <form class="chat-form" data-chat-form="${job.job_id}">
            <input type="text" maxlength="1500" placeholder="Type a message…" />
            <button class="btn btn-small btn-primary" type="submit">Send</button>
          </form>
        </div>
      `;
      list.appendChild(card);

      const doneBtn = card.querySelector("[data-done]");
      if (doneBtn) {
        doneBtn.addEventListener("click", () => markWalkDone(job.job_id, doneBtn));
      }
      const chatBtn = card.querySelector("[data-chat]");
      chatBtn.addEventListener("click", () => toggleChat(job.job_id));
      const chatForm = card.querySelector("[data-chat-form]");
      chatForm.addEventListener("submit", (e) => submitChat(e, job.job_id));
    });
  } catch (_) {
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
  } catch (_) {
    // toast handled
  } finally {
    setLoading(btn, false);
  }
}

function toggleChat(jobId) {
  const container = document.querySelector(`[data-chat-container="${jobId}"]`);
  if (!container) return;
  const isVisible = container.style.display !== "none";
  if (isVisible) {
    container.style.display = "none";
  } else {
    container.style.display = "block";
    loadMessages(jobId);
  }
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
  } catch (_) {
    box.innerHTML =
      "<div class='small-label'>Could not load messages.</div>";
  }
}

async function submitChat(e, jobId) {
  e.preventDefault();
  if (!state.token) return;
  const form = e.target;
  const input = form.querySelector("input");
  const btn = form.querySelector("button[type=submit]");
  const text = input.value.trim();
  if (!text) return;
  setLoading(btn, true);
  try {
    await api("send_message", { token: state.token, job_id: jobId, body: text });
    input.value = "";
    await loadMessages(jobId);
  } catch (_) {
    // toast handled
  } finally {
    setLoading(btn, false);
  }
}

// ====== OWNER JOB VIEW (BIDS) ======
async function openOwnerJob(jobId) {
  if (!state.token) return;
  const job =
    state.ownerJobs.find((j) => String(j.job_id) === String(jobId)) ||
    state.currentJobs.find((j) => String(j.job_id) === String(jobId));
  if (!job) {
    showToast("Walk not found.", { error: true });
    return;
  }
  $("#owner-job-title").textContent = jobHuman(job);
  $("#owner-job-sub").textContent =
    (job.notes || job.temperament || "").slice(0, 140);

  const meta = $("#owner-job-meta");
  meta.innerHTML = `
    <div class="job-meta" style="margin-bottom:0.4rem;">
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

  showView("owner-job");
  try {
    const res = await api("list_bids", { token: state.token, job_id: jobId });
    const bids = res.bids || [];
    renderOwnerBids(job, bids);
  } catch (_) {
    $("#owner-job-bids").innerHTML =
      "<div class='empty-state'>Could not load bids.</div>";
  }
}

function renderOwnerBids(job, bids) {
  const container = $("#owner-job-bids");
  if (!bids.length) {
    container.innerHTML =
      "<div class='empty-state'>No bids yet. You’ll receive an email when someone bids.</div>";
    return;
  }
  container.innerHTML = "";
  bids.forEach((b) => {
    const row = document.createElement("div");
    const status = String(b.status || "active").toLowerCase();
    row.className = "bid-row";
    row.innerHTML = `
      <div class="bid-main">
        <div><strong>${b.walker_name || "Walker"}</strong></div>
        <div class="bid-meta">
          <span>Bid: ${b.amount ? b.amount + " CHF" : "–"}</span>
          ${
            b.counter_amount
              ? `<span>Counter: ${b.counter_amount} CHF</span>`
              : ""
          }
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
      acceptBtn.addEventListener("click", () =>
        acceptBid(job.job_id, acceptBtn.dataset.accept, acceptBtn)
      );
    }
    const counterBtn = row.querySelector("[data-counter]");
    if (counterBtn) {
      counterBtn.addEventListener("click", () =>
        promptCounter(job.job_id, counterBtn.dataset.counter)
      );
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
    // refresh owner job bids
    await openOwnerJob(jobId);
  } catch (_) {
    // handled by toast
  } finally {
    setLoading(btn, false);
  }
}

async function promptCounter(jobId, bidId) {
  const raw = prompt("Counter amount (CHF):");
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
  } catch (_) {
    // toast handled
  }
}

// ====== MY BIDS (WALKER SIDE) ======
async function loadMyBidsView() {
  if (!state.token) return;
  showView("my-bids");
  const list = $("#my-bids-list");
  list.innerHTML = "<div class='empty-state'>Loading…</div>";
  try {
    const res = await api("my_bids", { token: state.token });
    const bids = res.bids || [];
    if (!bids.length) {
      list.innerHTML =
        "<div class='empty-state'>You have no bids yet.</div>";
      return;
    }
    list.innerHTML = "";
    bids.forEach((b) => {
      const status = String(b.status || "active").toLowerCase();
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="job-header">
          <div class="job-title">Bid on ${b.job_id}</div>
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
        acceptBtn.addEventListener("click", () =>
          acceptCounter(b.job_id, b.bid_id, acceptBtn)
        );
      }
      const declineBtn = card.querySelector("[data-decline-counter]");
      if (declineBtn) {
        declineBtn.addEventListener("click", () =>
          declineCounter(b.job_id, b.bid_id, declineBtn)
        );
      }
    });
  } catch (_) {
    list.innerHTML =
      "<div class='empty-state'>Could not load your bids.</div>";
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
  } catch (_) {
    // toast handled
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
  } catch (_) {
    // toast handled
  } finally {
    setLoading(btn, false);
  }
}

// ====== AUTH FLOW ======
async function handleLoginEmail(e) {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  if (!email) return;
  const btn = e.submitter;
  setLoading(btn, true);
  $("#login-email-status").textContent = "";
  try {
    await api("start_login", { email });
    $("#login-email-status").textContent = "Code sent. Check your inbox.";
    goToLoginCodeStep();
  } catch (_) {
    $("#login-email-status").textContent = "Could not send code.";
  } finally {
    setLoading(btn, false);
  }
}

async function handleLoginCode(e) {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const code = $("#login-code").value.trim();
  if (!email || !code) return;
  const btn = e.submitter;
  setLoading(btn, true);
  $("#login-code-status").textContent = "";
  try {
    const res = await api("verify_code", { email, code });
    state.token = res.token;
    state.profile = res.profile || {};
    localStorage.setItem("igoToken", state.token);
    closeLoginModal();
    updateAuthNav();
    await loadDashboard();
    showToast("Signed in ✔️");
  } catch (_) {
    $("#login-code-status").textContent = "Invalid or expired code.";
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

// ====== INIT & EVENT BINDING ======
function bindEvents() {
  // Landing
  $("#btn-landing-signin").addEventListener("click", openLoginModal);
  $("#btn-landing-learn").addEventListener("click", () => showView("landing"));

  // Nav buttons
  $$(".nav-btn").forEach((btn) => {
    const target = btn.dataset.nav;
    if (!target) return;
    btn.addEventListener("click", async () => {
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
      } else {
        showView(target);
      }
    });
  });

  $("#btn-open-login").addEventListener("click", openLoginModal);
  $("#btn-logout").addEventListener("click", logout);

  // Login modal
  $("#login-close").addEventListener("click", closeLoginModal);
  $("#login-back").addEventListener("click", () => {
    $("#login-step-code").classList.add("hidden");
    $("#login-step-email").classList.remove("hidden");
  });
  $("#form-login-email").addEventListener("submit", handleLoginEmail);
  $("#form-login-code").addEventListener("submit", handleLoginCode);

  // Profile form
  $("#form-profile").addEventListener("submit", saveProfileFromForm);
  $("#btn-go-profile").addEventListener("click", () => {
    if (!state.token) return;
    showView("profile");
    fillProfileForm();
  });

  // Quick actions
  $("#btn-go-post").addEventListener("click", () => showView("post"));
  $("#btn-go-open-jobs").addEventListener("click", loadOpenJobsView);
  $("#btn-go-current").addEventListener("click", loadCurrentView);
  $("#btn-go-my-bids").addEventListener("click", loadMyBidsView);

  // Post form
  $("#form-post").addEventListener("submit", submitPostWalk);

  // Owner-job back
  $("#btn-owner-job-back").addEventListener("click", () => {
    showView("dashboard");
  });

  // Debug toggle & keyboard shortcut
  $("#debug-toggle").addEventListener("click", () => {
    const panel = $("#debug-panel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const panel = $("#debug-panel");
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    }
  });
}

async function boot() {
  bindEvents();
  updateAuthNav();
  updateDebugPanel();

  const savedToken = localStorage.getItem("igoToken");
  if (savedToken) {
    state.token = savedToken;
    updateAuthNav();
    try {
      await refreshProfile();
      await loadDashboard();
    } catch (_) {
      // token invalid
      logout();
    }
  } else {
    showView("landing");
  }
}

document.addEventListener("DOMContentLoaded", boot);
