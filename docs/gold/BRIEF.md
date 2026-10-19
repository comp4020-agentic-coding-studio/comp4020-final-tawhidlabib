# Brief for every developer on the "gold" round (read fully before starting)

You are one Opus developer on a team led by an Opus lead who reviews every diff before it merges.
Project: "Hangout", an Astro 7 server-rendered app (Node adapter), SQLite (better-sqlite3 + Drizzle),
SSE live updates, deployed on Fly. Read CLAUDE.md first: it is the rulebook, and the lead will reject
work that breaks it. Then read docs/hd-audit-2026-10-19.md (the audit) for the items you own.

## Setup
- You are in your own git worktree, branched from `main`. FIRST run: `git merge --ff-only gold`
  (the integration branch; it adds docs/hd-audit-2026-10-19.md and docs/audit-evidence/). Confirm the
  audit file exists before going on.
- `mise exec -- pnpm install --frozen-lockfile` if node_modules is missing (or after a dependency change).
- Build and serve on YOUR port only (given in your task): `mise exec -- pnpm build` then
  `(PORT=<port> DATABASE_PATH=$PWD/.data/app.db mise exec -- node ./dist/server/entry.mjs > /tmp/gold-<port>.log 2>&1 &)`.
  Tests: `APP_URL=http://localhost:<port> mise exec -- pnpm vitest run spec/<file>.test.ts`;
  full gate: `APP_URL=http://localhost:<port> mise exec -- pnpm check`.
  NOTE: spec/activity.test.ts reads DATABASE_PATH (default ./.data/app.db) — run tests with the same
  DATABASE_PATH your server uses, i.e. from your worktree root.
- Stop your server BY PORT ONLY: `lsof -ti tcp:<port> | xargs kill`. NEVER `pkill`/`killall` anything.
- Rebuild and restart after every source change: tests hit the built server, not the source.
- Real Chrome for browser tests: spec/browser.ts finds it (macOS path). spec/holds-up.test.ts shows how.

## How to work (non-negotiable)
1. Red test first: write the check, run it, see it fail FOR THE RIGHT REASON, commit as `spec: ...`.
2. Fix, see it pass, commit `fix:`/`feat:`/`harness:`. Commit bodies must say cause, what changed and
   the red→green evidence (the marker reads commit bodies; one-line bodies are a known weakness).
3. Prove the check can fail: take the fix out once, rebuild, confirm red, restore. Say so in the body.
4. Never edit an existing passing test to make it pass. If your change legitimately changes expected
   output, say exactly which assertion and why in your report.
5. Every state change must publish() its topic, notify() whom it concerns, and logActivity() (with
   groupRef()/eventRef(), never raw group ids or share ids). Refusals through refuse()/deny().
6. The blind grid (ADR 10) is sacred: nothing may reveal others' hours, counts or names to someone who
   hasn't answered for that week.
7. Match surrounding code: comment density, naming, idiom. No new dependencies unless your task says so.
8. If a rule you learned should bind future work, add it to CLAUDE.md in its own short bullet (only if
   your task allows CLAUDE.md edits) — otherwise put suggested wording in your report.
9. Stay inside YOUR files (listed in your task). If you must touch another file, keep the change minimal
   and list it in your report — another developer may own it and the lead will merge by hand.
10. Commit trailer on every commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
11. Do NOT touch README.md, PROCESS.md, docs/prompt-history.md or reflections/ (the lead owns docs).
    Do not push, tag, or touch `main`/`gold`. Do not deploy. Do not access production (no flyctl ssh).
12. Finish with the full gate green: `APP_URL=http://localhost:<port> mise exec -- pnpm check`.

## Report back (your final message, ≤ 700 words)
Branch name; commit list (oneline); per item: red line → change → green, and whether the remove-the-fix
check was done; full `pnpm check` totals; anything you changed outside your files; anything left undone
and why; suggested CLAUDE.md wording if any. Stop your server by port before finishing.
