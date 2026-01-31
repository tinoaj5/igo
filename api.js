const API_URL =
  "https://script.google.com/macros/s/AKfycbxJt4eX1PVzvlyvy6Y-KzNy0imENU0oQ7dbf-Z1vsfJ/dev";

async function apiCall(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "payload=" + encodeURIComponent(JSON.stringify(payload))
  });

  return res.json();
}
