# OA Trainer — build notes

Static single-page app simulating a timed Amazon SDE Intern OA. Question content read verbatim
from `questions.json` (unchanged, still the source of truth).

## Files

| File | Role |
| --- | --- |
| `index.html` | Shell: topbar + logo mark, fixed timer widget, `#main` render target, footer |
| `styles.css` | All styling. Dark-first tokens, amber accent, Satoshi + JetBrains Mono |
| `app.core.js` | All logic (edit this, not `app.js`) |
| `questions.json` | Source of truth for content |
| `build.py` | Inlines `questions.json` + `app.core.js` → `app.js` (no `fetch()`) |
| `app.js` | **Generated.** Deployed bundle. Regenerate with `python3 build.py` |
| `qa/*.js`, `qa/*.png` | Playwright QA scripts and captured evidence |

## Implemented

- Landing: title, subtitle, section table (6 sections / 165 min total), full-mock button, per-section start buttons, strict-rules callout.
- Fixed timer: mm:ss remaining + elapsed/limit + progress bar. Amber under 5 min, red + pulse under 1 min, auto-submits at zero.
- Section UIs: `debug` (line-numbered mono code block, scrollable, free nav + palette), `coding` (statement, difficulty badge, suggested time, large autosaving textarea, collapsible hint, model-solution button disabled until submit), `corecs` (MCQ, free nav, answered/unanswered palette), `reasoning` (one-way — no Previous button, no palette), `worksim` (scenario + 4 options), `workstyle` (two large statement cards, unscored).
- Per-section results: score, %, answered, time used, and full review with user answer vs correct answer plus the `explain` text; green/red left border and badges. Coding results show submission side-by-side with model approach, complexity and full solution, labelled self-assess.
- Workstyles read-out: choices mapped to Leadership Principle leanings (12-item map in `WORKSTYLE_MAP`), bar read-out per principle, plus consistency-not-gaming reminder.
- Full-mock summary: per-section table, MCQ subtotal, coding attempted, total time, auto-submit flags, and honest calibration guidance (coding decides; MCQ does not compensate).
- Persistence: in-memory only. No localStorage/sessionStorage anywhere. Reset control in the topbar with confirm modal.
- Keyboard: 1–4 select options (1/2 for workstyle pairs), Enter / → advance or submit on the last item, ← previous where navigation is allowed.
- Accessibility: skip link, radiogroup/radio roles with `aria-checked`, labelled palette buttons, aria-live status, visible focus rings, dark/light toggle.
- Dev aid: append `?fast=SECONDS` to the URL to shorten every section timer (used to verify auto-submit).

## QA performed (Playwright, headless Chromium)

- 1280px and 375px, all six sections: no horizontal document overflow (`scrollWidth == innerWidth`), no clipped prompts, options, statements or scenario text.
- Debug flow: keyboard select, palette jump, submit modal, results (2/7, 29%, 7 review items).
- Coding: autosave counter, hint toggle, locked reveal button (`disabled` asserted), nav between both problems preserving text, results render both submissions + model solutions.
- Reasoning: no Previous button and no palette at any index — one-way confirmed.
- Workstyle: 12 pairs answered by keyboard, 8 LP rows in read-out.
- Timer: `?fast=6` run reached `is-crit` class, then auto-submitted with "Time expired — auto-submitted" heading and timer hidden.
- Full mock: all 6 sections answered and submitted in order, per-section results, then calibration report (6 rows, MCQ subtotal).
- Reset confirm flow returns to landing; timer never visible outside an active section (`[hidden]` display fix).

## Remaining step for the parent agent

`deploy_website` is not exposed to this subagent (`pplx-tool` reports `tool_not_allowed`).
Deploy with `project_path=/home/user/workspace/oa-mock`, suggested site name **oa-trainer-sde-intern-mock**.
The repo is initialised and committed (`b38296f`).
