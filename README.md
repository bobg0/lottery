# Habit Wheel

Habit Wheel is a local-first personal habit tracker and reward spinner built as a minimal PWA. Data is stored in the browser using `localStorage`. The running app lives in `artifacts/habit-wheel`.

## What this app does

- Tracks Practice and Workout 30-minute blocks.
- Tracks daily questions by +2 / -2 increments.
- Uses one shared token inventory for spins.
- Converts spin results into 30-minute reward blocks.
- Allows spending reward blocks with a weekly cap warning.
- Provides export/import backup and reset with automatic backup download.
- Works offline after first load via service worker caching.

## Run locally

From the repository root:

```bash
pnpm install
pnpm dev
```

Open the URL shown in the terminal (default `http://localhost:4173`).

## Build and preview

```bash
pnpm build
pnpm preview
```

Then open the preview URL shown in the terminal.

## PWA / offline testing

1. Build and preview locally with `pnpm preview`.
2. Open the local preview URL in a supported browser.
3. Load the app once so the service worker installs.
4. Refresh the page or disconnect the network to verify the shell still loads.

> Service workers usually require `localhost` or HTTPS.

## GitHub Pages deployment

This repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

On push to `main`, the workflow:

1. installs dependencies,
2. computes a `BASE_PATH` for repo subpath deployment,
3. builds the app from `artifacts/habit-wheel`,
4. deploys `artifacts/habit-wheel/dist/public` to `gh-pages`.

If your repository is `USERNAME.github.io`, the app deploys to root. Otherwise, the workflow sets `BASE_PATH` to `/<repo-name>/`.

## BASE_PATH for GitHub Pages

The Vite config now supports optional `BASE_PATH`.

- Local development uses `/` by default.
- GitHub Actions sets it automatically.
- For manual builds in a repo subpath, run:

```bash
cd artifacts/habit-wheel
BASE_PATH=/REPO_NAME/ pnpm run build
```

## Backup / import / reset behavior

- `Export backup` downloads a timestamped JSON file.
- `Import backup` validates structure before replacing app state.
- `Reset app` downloads a timestamped backup first, then clears local state.
- State remains stored under the localStorage key `habit_wheel_v2`.

## Known limitations

- The running app is implemented in vanilla HTML/CSS/JS under `artifacts/habit-wheel`.
- Unused React/Tailwind files may exist in the workspace but are not part of the current app shell.
- Offline caching is best after the app has been loaded once.
