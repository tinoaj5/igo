// auth.js
const AUTH_TOKEN_KEY = "igo_auth_token";
const PROFILE_KEY    = "igo_profile";

function getToken(){ return localStorage.getItem(AUTH_TOKEN_KEY); }
function setToken(t){ localStorage.setItem(AUTH_TOKEN_KEY, t); }

function getProfile(){
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); }
  catch(_){ return {}; }
}
function setProfile(p){ localStorage.setItem(PROFILE_KEY, JSON.stringify(p || {})); }

function signOut(){
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}
