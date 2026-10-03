---
paths:
  - "docs/diagrams/**"
---

# Diagram rules (`docs/diagrams/`)

Applies when working on the system design diagram.

## What lives here

| File | Role |
| --- | --- |
| `build.ps1` | Generates the outputs; source of truth for the layout |
| `system-design.svg` | Committed, self-contained (brand icons embedded as `<symbol>`) |
| `system-design.jpg` | Committed, 2x raster for docs and slides |
| `.icon-cache/` | Downloaded Simple Icons - disposable, git-ignored, never commit |

## Working rules

1. Never hand-edit `system-design.svg` or `system-design.jpg`. Change
   `build.ps1` and regenerate:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\docs\diagrams\build.ps1
   ```

2. The build is **idempotent** - a rerun with no source change must produce zero
   `git diff`. If it does not, fix the generator (timestamps, random ids,
   ordering) before committing anything.
3. Pipeline is `svg -> headless Chrome screenshot (PNG) -> JPEG (System.Drawing)`.
   Headless Chrome writes warnings on stderr; `build.ps1` deliberately tolerates
   that instead of aborting. Keep that tolerance - do not turn stderr noise into
   a hard failure.
4. Keep the PNG intermediate unless `-KeepPng` is passed.
5. New brand icon: add its Simple Icons slug to `$ICONS` in `build.ps1` rather
   than pasting path data into the SVG by hand.
6. Generated artifacts are only committed when the diagram content genuinely
   changed; commit `.svg` and `.jpg` as separate one-file commits.
7. `.icon-cache/` must stay ignored (nested `.gitignore`); if it ever shows up
   in `git status`, add the ignore rule instead of deleting the cache.
