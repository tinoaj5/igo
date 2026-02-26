// utils/backend.js
// Bridge between your new React UI and your existing backend (api.js + auth.js).
// Requires global: postForm, getToken, setToken, getProfile, setProfile, signOut

(function () {
  "use strict";

  function requireAuthed() {
    const token = getToken();
    if (!token) {
      const err = new Error("Not signed in");
      err.code = "AUTH_REQUIRED";
      throw err;
    }
    return token;
  }

  async function startLogin(email) {
    return await postForm({ action: "start_login", email });
  }

  async function verifyCode(email, code) {
    const res = await postForm({ action: "verify_code", email, code });
    if (res?.ok && res?.token) {
      setToken(res.token);
      setProfile(res.profile || { email });
    }
    return res;
  }

  async function saveProfile(profile) {
    const token = requireAuthed();
    const role = String(profile?.role || "");
    const res = await postForm({ action: "save_profile", token, role, profile });
    if (res?.ok) setProfile(res.profile || profile || {});
    return res;
  }

  async function listJobs(filter = {}) {
    const token = requireAuthed();
    return await postForm({ action: "list_jobs", token, filter });
  }

  async function placeBid(job_id, bid) {
    const token = requireAuthed();
    return await postForm({ action: "place_bid", token, job_id, bid });
  }

  async function listMessages(job_id) {
    const token = requireAuthed();
    return await postForm({ action: "list_messages", token, job_id });
  }

  async function sendMessage(job_id, body) {
    const token = requireAuthed();
    return await postForm({ action: "send_message", token, job_id, body });
  }

  async function currentWalks() {
    const token = requireAuthed();
    return await postForm({ action: "current_walks", token });
  }

  function niceError(e, fallback = "Something went wrong") {
    if (e?.code === "AUTH_REQUIRED") return "Please sign in first.";
    return e?.message || fallback;
  }

  window.Backend = {
    startLogin,
    verifyCode,
    saveProfile,
    listJobs,
    placeBid,
    listMessages,
    sendMessage,
    currentWalks,
    niceError,
  };
})();
