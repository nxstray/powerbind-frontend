# Powerbind frontend - workspace rules

Always-on rules for this repository. Git discipline below is enforced by
`.clinerules/hooks/PreToolUse.ps1`. Conditional rules add detail per path:
`testing.md` (tests) and `diagrams.md` (`docs/diagrams/`).

## Facts about this repo

| Item | Value |
| --- | --- |
| App | Vue 3 single-page app (`frontend`), Composition API with `<script setup>` |
| Build | Vite (`vite.config.js`), Tailwind CSS v4 through `@tailwindcss/vite` |
| State / routing | Pinia (`src/stores/`), Vue Router (`src/router/index.js`) |
| Backend | `VITE_API_URL` or fallback `http://localhost:8045` (`src/utils/api.js`) |
| Tests | Vitest + `@vue/test-utils`; layout, jsdom config and coverage exclusions live in `testing.md` |
| Quality | oxlint + ESLint + oxfmt; SonarQube via `.\run-sonar-frontend.ps1` |

## Commands

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

1. User-facing failure states use friendly, retryable copy in Indonesian, the
   way `AgentPage.vue` and `DashboardPage.vue` already do ("... Coba lagi").
   Never surface a raw exception, stack trace or HTTP status text.
2. A page that talks to the backend must survive the backend being down: show
   the error state, keep the shell rendered, and offer a retry.

## Sumber kebenaran

- Konvensi kode (Vue): skill `code-standards`.
- Perubahan sekecil mungkin, laporkan temuan di luar scope: skill `minimal-change-policy`.
- Secrets: ikuti skill `env-and-secrets`.
- Lanjutan sesi lama: baca `docs/progress.md` dulu, jangan explore ulang dari nol
  (protokolnya di `progress.md`).

## Public hygiene

- `.env` is ignored and stays local; today it only holds Sonar settings. Public
  build-time values must use the `VITE_` prefix and be documented in
  `.env.example` with placeholders, never real values.
- Keep `README.md` and the GitHub repository description simple and public-safe:
  no credentials, no internal endpoints beyond documented public API shape, no
  details of rate limits, lockout thresholds or JWT handling.

## Commit discipline

Satu file per commit; bulk staging diblokir hook `PreToolUse.ps1`. Stage path
spesifik, jangan `git add .` / `-A` / `commit -a`. Format pesan
`type(scope): summary`, imperatif, tanpa titik. Commit hanya jika diminta. Sebelum commit, tampilkan SATU ringkasan batch di chat (tanpa ask_question per file): daftar file + `git diff --stat` + 1 kalimat isi tiap diff, diakhiri kalimat: bilang 'commit' jika sudah selesai reviewnya. Tunggu kata `commit` eksplisit sebelum `git add`/`commit` apapun; satu persetujuan hanya untuk batch yang diringkas itu.

## Runtime expectations

Backend `:8045` and its dependencies must already be running (`docker compose
ps` first; never start containers as a side effect). Verify UI work cheaply:
targeted `npm run test:unit`, then `npm run lint`, only then a full build.

## Done means

Targeted tests pass, `npm run lint` is clean, the change is committed one file
at a time, `git status` is clean, and nothing generated (coverage, dist,
`.scannerwork/`, repomix bundles, stray `hs_err_pid*.log`) got committed.
