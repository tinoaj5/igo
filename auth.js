const AUTH_TOKEN_KEY = "igo_token";

async function sendLoginCode(email) {
  return apiCall({
    action: "start_login",
    email
  });
}

async function verifyLoginCode(email, code) {
  const res = await apiCall({
    action: "verify_code",
    email,
    code
  });

  if (res.ok && res.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, res.token);
  }

  return res;
}

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  location.reload();
}
