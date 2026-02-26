// auth.js (NEW)
(function () {
  const TK = "igoToken";
  const PF = "igoProfile";

  function getToken() {
    return localStorage.getItem(TK) || "";
  }
  function setToken(t) {
    localStorage.setItem(TK, t || "");
  }
  function getProfile() {
    try {
      return JSON.parse(localStorage.getItem(PF) || "{}");
    } catch {
      return {};
    }
  }
  function setProfile(p) {
    localStorage.setItem(PF, JSON.stringify(p || {}));
  }
  function signOut() {
    localStorage.removeItem(TK);
    localStorage.removeItem(PF);
  }

  window.getToken = getToken;
  window.setToken = setToken;
  window.getProfile = getProfile;
  window.setProfile = setProfile;
  window.signOut = signOut;
})();
