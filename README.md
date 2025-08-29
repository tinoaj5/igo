# DogWalkr — Accounts + Profile (CH) — EXEC baked in
- `index.html` — uses your Apps Script Web App URL
- Swiss address autocomplete (Google Places), profile modal, resend code timer.
- `.nojekyll`, `terms.html`, `privacy.html`

## Connect to Apps Script
Already set in this build via `const FORM_ENDPOINT_URL`.

## Deploy
1) Upload files to your GitHub repo root (replace old files).
2) GitHub → Settings → Pages → Deploy from branch → `main` → root.
3) Visit your site, Sign in → Send code (wait 30–120s on first send), then complete profile.
