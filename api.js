// api.js (NEW) — used by the new UI
const API_URL =
  "https://script.google.com/macros/s/AKfycby6JqMSNnX-K6DcAHydCaoZ9sgJxMfhlM1K98b7D9bGCG2qRcVJBBlnnvqFQKJTyyyaOQ/exec";

async function postForm(data) {
  // data should include: { action: "start_login", ... }
  const payload = JSON.stringify(data);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "payload=" + encodeURIComponent(payload),
  });

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error("Server returned invalid JSON");
  }

  if (!json.ok) {
    throw new Error(json.error || "Something went wrong.");
  }
  return json;
}

// expose globally (the React UI expects this)
window.postForm = postForm;
