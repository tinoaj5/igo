# DogWalkr — Switzerland + Accounts (GitHub Pages)
Files:
- `index.html` — CH-only address validation + email-code sign-in (accounts).
- `terms.html`, `privacy.html`
- `.nojekyll`
- `README.md`

## Deploy
1) Upload to your GitHub repo root.
2) Settings → Pages → Deploy from a branch → main → / (root).

## Backend (Apps Script)
This site expects these payloads to your Web App URL:
- `{"action":"start_login","email":"..."}` → sends 6-digit code via MailApp.
- `{"action":"verify_code","email":"...","code":"123456"}` → returns `{ok:true, token, profile}`.
- `{"action":"get_profile","token":"..."}` → returns `{ok:true, profile}`.
- `{"action":"save_profile","token":"...","role":"owner|walker","profile":{...}}`
- Existing form submits: `{kind:"owner"|"walker","data":{...,"_token":"..."?}}`
