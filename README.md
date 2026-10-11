# Safe

A private savings and investing tracker that runs as a web app on the iPhone Home Screen.

- **Your data stays on your device.** Everything is stored locally (IndexedDB). Nothing is sent to a server, and this repository contains code only — no personal numbers.
- **Backups** are JSON files you download yourself (Settings → Download backup) and restore from (Settings → Restore from backup file).
- **Works offline** once it has been opened.

## Install on iPhone

1. Open the app in Safari: https://dareios03-oss.github.io/safe/
2. Tap **Share** → **Add to Home Screen**.
3. Open Safe from the Home Screen and follow the setup.

Set Safe up from the Home Screen icon: an installed web app keeps its own data, separate from Safari.

## Tech

Plain HTML, CSS and JavaScript — no build step, no external libraries. Hosted with GitHub Pages.

| File | Purpose |
| --- | --- |
| `index.html` | App shell |
| `app.css` | Liquid-glass design, light and dark mode |
| `app.js` | Screens, check-in, history, goals, setup, backup, demo mode |
| `store.js` | Local storage on the device (IndexedDB) |
| `sw.js` | Offline cache (bump `CACHE` on every release) |
| `manifest.webmanifest`, `icons/` | Home Screen app name and icon |
