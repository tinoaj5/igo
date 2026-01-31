function showToast(msg) {
  alert(msg); // keep simple; your existing toast system can replace this
}

/* ---------- SIGN IN FLOW ---------- */

function openSignin() {
  document.getElementById("signinModal").classList.add("open");
}

function closeSignin() {
  document.getElementById("signinModal").classList.remove("open");
}

async function onSendCodeClick() {
  const emailInput = document.getElementById("signinEmail");
  const email = emailInput.value.trim();

  if (!email) {
    showToast("Please enter your email.");
    return;
  }

  showToast("Sending code…");

  const res = await sendLoginCode(email);

  if (res && res.ok) {
    showToast("Code sent. Use 555555 for testing.");
    document.getElementById("codeStep").style.display = "block";
  } else {
    showToast(res?.error || "Could not send code.");
  }
}

async function onVerifyCodeClick() {
  const email = document.getElementById("signinEmail").value.trim();
  const code = document.getElementById("signinCode").value.trim();

  if (!code || code.length !== 6) {
    showToast("Enter the 6-digit code.");
    return;
  }

  showToast("Verifying…");

  const res = await verifyLoginCode(email, code);

  if (res && res.ok) {
    closeSignin();
    document.getElementById("appRoot").style.display = "block";
    showToast("Welcome to igo.");
  } else {
    showToast(res?.error || "Invalid code.");
  }
}

/* ---------- AUTO LOGIN ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  if (token) {
    document.getElementById("signinModal").style.display = "none";
    document.getElementById("appRoot").style.display = "block";
  } else {
    openSignin();
  }
});
