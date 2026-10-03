---
paths:
  - "src/**/*.test.js"
  - "vite.config.js"
  - "eslint.config.js"
  - ".oxlintrc.json"
---

# Frontend testing rules

Applies when touching Vitest specs or the test/lint configuration.

## Layout

- Specs are **colocated** next to the code: `src/pages/LogPage.vue` is covered
  by `src/pages/LogPage.test.js`; same for `src/components/`, `src/stores/`,
  `src/services/` and `src/utils/`. Do not create a separate `tests/` tree.
- Runner config lives in the `test` block of `vite.config.js`
  (`environment: 'jsdom'`, `globals: true`). Coverage excludes
  `*.test.js`, `*.spec.js` and `src/**/icons/**` - keep that exclusion, icons are
  pure presentational SVG wrappers.
- `vite.config.js` also registers the `vitest-public-assets` plugin that maps
  root-relative URLs (`/favicon.ico`) onto `public/` during tests on Windows.
  Do not remove it to "simplify" config - suites that render those assets break
  without it.

## Writing a test

1. Use `@vue/test-utils` `mount()`; global stubs are per-file, not a shared
   setup file. Match the style of the neighbouring spec.
2. Mock the network at the service boundary (`vi.mock('@/services/...')` or the
   axios/fetch module the file already uses). Never hit a live backend.
3. For auth, seed `localStorage.setItem('accessToken', ...)` the way
   `src/utils/api.test.js` does, and assert the refreshed token is written back.
4. `globals: true` is on, so `describe`/`it`/`expect` need no import - stay
   consistent with existing files instead of mixing both styles.
5. Prefer user-visible assertions (rendered text, aria/state classes, emitted
   events) over internal instance state. Error-path tests assert the friendly
   retry copy, not a raw message.
6. Deterministic time and animation: fake timers or a pinned clock when the
   component is theme/time aware, otherwise the suite flickers.

## Running

```powershell
npm run test:unit -- src/pages/LogPage.test.js   # targeted, run first
npm run test:unit                                 # full suite
npm run lint                                     # oxlint + eslint, must be clean
```

There is no `npm test` script. Add a coverage run only when SonarQube asks for
it; `coverage/` is git-ignored.
