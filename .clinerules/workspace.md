# Powerbind frontend - workspace rules

Always-on rules for this repository. The git rules in "Commit discipline" below
are enforced automatically by `.clinerules/hooks/PreToolUse.ps1`. Two
conditional rules add detail for specific paths: `testing.md` (tests) and
`diagrams.md` (`docs/diagrams/`).

## Facts about this repo

| Item | Value |
| --- | --- |
| App | Vue 3 single-page app (`frontend`), Composition API with `<script setup>` |
| Build | Vite (`vite.config.js`), Tailwind CSS v4 through `@tailwindcss/vite` |
| State / routing | Pinia (`src/stores/`), Vue Router (`src/router/index.js`) |
| Backend | `VITE_API_URL` or fallback `http://localhost:8045` (`src/utils/api.js`) |
| Tests | Vitest + `@vue/test-utils` on `jsdom`, 30 colocated `*.test.js` |
| Quality | oxlint + ESLint + oxfmt; SonarQube via `.\run-sonar-frontend.ps1` |
| Line style | 2 spaces, LF, max width 100 (`.editorconfig`, `.gitattributes`) |

## Commands

Use the scripts in `package.json` as written - there is **no `test` script**.

```powershell
npm run dev          # dev server on http://localhost:5173
npm run lint         # oxlint --fix then eslint --fix (run-s "lint:*")
npm run format       # oxfmt src/
npm run build        # production build into dist/
npm run test:unit    # single run; add `-- src/pages/LogPage.test.js` to narrow
npm run test:unit:watch
```

Chain commands with `;`, never `&&` - the shell here is Windows PowerShell.

## Working rules

1. Read the current version of a file before editing it. Make the smallest
   change that solves the request; no drive-by refactors, renames or reformat.
2. Keep the existing layout: pages in `src/pages/`, components in
   `src/components/` (icons in `components/icons/`), Pinia stores per domain in
   `src/stores/`, HTTP calls per domain in `src/services/`, shared axios
   instance and token refresh in `src/utils/api.js`.
3. Do not hardcode auth headers in a component. Build them with the service's
   own `getHeaders()` and read the token through `localStorage.getItem('accessToken')`.
4. New routes are registered in `src/router/index.js` with
   `meta: { requiresAuth: true }`; admin views also need `requiresAdmin: true`
   (the guard checks the JWT role claim).
5. Styling stays Tailwind utility classes in the template. Time/weather-aware
   theming follows the existing `computed()`/`ref()` pattern in
   `DashboardPage.vue` and `AgentPage.vue` - reuse it instead of inventing a
   new theme system.
6. User-facing failure states use friendly, retryable copy in Indonesian, the
   way `AgentPage.vue` and `DashboardPage.vue` already do ("... Coba lagi").
   Never surface a raw exception, stack trace or HTTP status text.
7. A page that talks to the backend must survive the backend being down: show
   the error state, keep the shell rendered, and offer a retry.
8. Anything found wrong outside the current scope is reported, not silently fixed.

## Secrets and public hygiene

- `.env` is ignored and stays local; today it only holds Sonar settings. Public
  build-time values must use the `VITE_` prefix and be documented in
  `.env.example` with placeholders, never real values.
- Never paste the content of `.env`, tokens or passwords into chat, commits,
  logs or test fixtures.
- Keep `README.md` and the GitHub repository description simple and public-safe:
  no credentials, no internal endpoints beyond documented public API shape, no
  details of rate limits, lockout thresholds or JWT handling.

## Commit discipline (hook-enforced)

One file per commit. These are blocked by `PreToolUse.ps1` and will fail:

- `git add .`, `git add -A`, `git add --all`
- `git commit -a`, `git commit -am <msg>`, `git commit --all`, `git commit .`
- any `git commit` while **more than one file** is staged

The guard counts `git diff --cached --name-only`, so a pathspec does not bypass
it - `git commit -m "..." -- some/file` is still blocked while the index holds
two files. Work strictly one file at a time:

```powershell
git add src/pages/LogPage.vue
git commit -m "fix(logs): keep the panel rendered when Loki is unreachable"
git status --short          # index must be empty before the next add
```

- Message format: `type(scope): summary`, imperative, no trailing period.
- Show the user the summary the hook writes to `logs/commit-log.txt`, then wait for
  the user's approval before running the commit. The hook only injects the summary
  as context - it does not block a valid single-file commit, so the pause is ours.
- Approval covers one commit only. After it, stage, commit and check that one file,
  then show the summary again before the next file.
- The `git-workflows` skill says to run `git add .`. The hook is stricter and
  wins: always stage the explicit path.
- Hook logs under `.clinerules/hooks/logs/` stay untracked (nested `.gitignore`);
  the root `.gitignore` also ignores any path named `logs`.

## Runtime expectations

- The dev server assumes the backend on `:8045` plus its dependencies are
  already running. Check with `docker compose ps` / `Invoke-WebRequest` before
  starting anything; do not spin up containers as a side effect of a task.
- Verify UI work the cheap way first: targeted `npm run test:unit`, then
  `npm run lint`, and only then a full run or `npm run build`.

## Done means

Targeted tests pass, `npm run lint` is clean, the change is committed one file
at a time, `git status` is clean, and nothing generated (coverage, dist,
`.scannerwork/`, repomix bundles, stray `hs_err_pid*.log`) got committed.
