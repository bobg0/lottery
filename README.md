# Habit Wheel

Habit Wheel is a local-first personal habit tracker and reward spinner built as a minimal PWA. Data is stored in the browser using `localStorage`. The running app lives in `artifacts/habit-wheel`.

## What this app does

- Tracks Practice and Workout 30-minute blocks.
- Tracks daily questions by +2 / -2 increments.
- Draws virtual paperclips from a finite bag for productive blocks.
- Converts spin results into 30-minute reward blocks.
- Allows spending reward blocks with a weekly cap warning.
- Provides export/import backup and reset with automatic backup download.
- Supports optional Supabase cloud backup/sync.
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

The deploy workflow passes optional Supabase secrets to Vite:

```yaml
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

If those secrets are missing, the app still builds and runs in local-only mode.

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

## Cloud Backup

Supabase cloud backup is optional. `localStorage` remains the primary working store, and the app still works without login or network access.

- Login uses email magic link / OTP, so password reset is not needed.
- Supabase stores one latest JSON state per user in `public.app_states`.
- Sync runs manually with `Sync Now` or once per day after app load when signed in and online.
- Progress date maps use max-merge so cumulative questions, practice, and workout data are preserved.
- Consumables use newer-state-wins so spent clips, spins, and reward blocks are not resurrected.
- Reward/spend records are unioned by stable ID when possible, and spent block IDs prevent available blocks from returning.

### Supabase setup

Create this table and RLS policy set in your Supabase project:

```sql
create table if not exists public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;

create policy "Users can read own app state"
on public.app_states
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own app state"
on public.app_states
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own app state"
on public.app_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

For local cloud testing, copy `artifacts/habit-wheel/.env.example` to `.env` in the same folder and set:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

For GitHub Pages, add the same names as GitHub Actions repository secrets. Then run:

```bash
pnpm install
pnpm dev
pnpm build
```

## Known limitations

- The running app is implemented in vanilla HTML/CSS/JS under `artifacts/habit-wheel`.
- Unused React/Tailwind files may exist in the workspace but are not part of the current app shell.
- Offline caching is best after the app has been loaded once.
