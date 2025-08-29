# DogWalkr — GitHub Pages Bundle
Files:
- `index.html` (Google Sheets hooked via your Web App URL)
- `terms.html`, `privacy.html`
- `.nojekyll`
- `README.md`

## Deploy on GitHub Pages
1) Create a new GitHub repo and upload these files to the repo root.
2) Go to **Settings → Pages** → Source: *Deploy from a branch*; Branch: **main**; Folder: **/** → **Save**.
3) Open the Pages URL after ~1 minute.

**Update your Web App URL**: If you redeploy Apps Script and get a new `/exec`, edit `index.html` and change the `FORM_ENDPOINT_URL` constant.
