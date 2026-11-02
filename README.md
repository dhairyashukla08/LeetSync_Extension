# LeetSync

A browser extension that commits every **Accepted** LeetCode submission to your own GitHub repository, with a README, your notes, and a commit message that describes the approach.

Works in Chrome and other Chromium browsers (tested in Brave).

## Features

- **Sync on Accepted**: reads your code, runtime and memory and commits the solution plus a README.
- **Connect GitHub with a code**: uses GitHub's device flow, so there is no token to paste. Pick or create the repo in the popup.
- **AI commit messages** (optional): bring your own Gemini API key. If the AI call fails, the normal message is used.
- **Folder templates**: `{id}`, `{slug}`, `{difficulty}`, `{topic}`, `{lang}` with a live path preview.
- **Retry queue**: failed syncs are saved and retried automatically, or by hand from the Log tab.
- **Streak reminders**: warns you on a day you have not solved anything, using your LeetCode submission calendar.
- **Notes, timer and review reminders**, plus a "best submission only" mode.

## Install (from source)

```bash
cd extension/popup
npm install
npm run build
```

The build writes the finished extension to `dist/` at the repo root.

1. Open `chrome://extensions` (or `brave://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `dist` folder.
3. Open the LeetSync popup, go to **Setup**, log in to LeetCode, and connect GitHub.

## Use your own GitHub login (required for forks and self-builds)

The extension signs in through a GitHub OAuth App.

1. On GitHub go to **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Any name; use `https://github.com` for the homepage and callback URL.
3. After creating it, tick **Enable Device Flow** and save.
4. Copy the **Client ID** into `GITHUB_CLIENT_ID` in `extension/background/service-worker.js`, then rebuild.

The client ID is public. No client secret is used.

## Project layout

```
extension/   popup (React + Vite), background service worker, content scripts, manifest, icons
landing/     marketing site (React + Vite)
```

Landing page: `cd landing && npm install && npm run dev`

## Privacy

- There is no LeetSync server. Settings, your GitHub login and queued solutions are kept in the browser's extension storage on your computer.
- Your solution code is sent to GitHub (your repo). It is sent to Google only if you turn on AI commit messages.
- The extension only checks that you are logged in to LeetCode. It never sees your password.

## Contributing

Issues and pull requests are welcome.

## License

MIT, see [LICENSE](LICENSE).