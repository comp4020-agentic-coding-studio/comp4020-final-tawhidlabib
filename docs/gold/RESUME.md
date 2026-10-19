# Resume the gold-standard plan

Paused **Mon 19 Oct 2026** for the weekly budget; resume after it resets
(Thu 22 Oct). To resume, tell Claude: **"resume the gold plan"**. It
reads this file first.

## Where things stand

- **`main`** (= GitHub, = live site, = `crit-10` tag at `a36b726`) is
  untouched by this round. Nothing from the gold round is deployed.
- **`gold`** is the integration branch, 19 commits ahead of `main`. Full
  check **green: 30 files, 467/467 tests**, run four times in a row;
  `pnpm audit --prod` reports 0 vulnerabilities. It holds:
  - the audit: `docs/hd-audit-2026-10-19.md`, plus
    `docs/audit-evidence/00–11`;
  - **developer A (security and platform), merged:**
    - six security headers and a CSP on every page;
    - EXIF/GPS stripped from uploads (sharp 0.35.5);
    - 17 advisories down to 0 (Astro 7.4);
    - `/api/health` plus a Fly check;
    - graceful shutdown that checkpoints the WAL;
    - "log out on this device / everywhere else";
    - delete my profile;
    - `docs/restore.md`;
    - ADR 4 and ADR 8 notes and `CLAUDE.md` bullets;
  - a flaky-test fix (`db82af4`).
- **Production clean-up done** (you authorised it): the two "Audit …"
  test events were deleted after snapshot `vs_mROllGwnoNetyebK8DoV`.
  Explore now shows none.
- The scratch folders under `.claude/jobs/…` are temporary; everything
  needed is in this folder and in git.

## Your decisions, already made (don't re-ask)

- **Scope:** "Justify + tidy". Keep every feature, give each a README
  reason, move the theme picker from the header into `/me`, keep public
  Explore off the main nav.
- **Production test data:** remove it. Done.
- **Cold start:** don't change `min_machines_running`. Add a health check
  (done) and faster boot, and note the question for the tutor. The
  observed cold start is **4.2 s**.

## Left to do, in order

### Wave 1, finish (one Opus agent each, in worktrees, all in parallel)

Brief for every agent: `docs/gold/BRIEF.md`; each one first runs
`git merge --ff-only gold`. Item lists are in the next section.

- **B: correctness.** Port 8102. Nothing was committed, so start fresh.
- **C: accessibility CSS and a real-Chrome a11y check.** Port 8103.
  Nothing was committed, so start fresh.
- **D: first impressions.** Port 8104. **Resume branch
  `worktree-agent-a324ef8195ccf8ce6`**:
  - `8567437`: its red spec (14 of 17 red, for the right reasons);
  - `fb63d38`: a **WIP** commit with `Base.astro` half-edited and
    `404.astro` started, unreviewed.

  Tell D to continue from that branch: finish, squash or replace the WIP
  commit with proper `fix:`/`feat:` commits, then report. Its worktree is
  still at `.claude/worktrees/agent-a324ef8195ccf8ce6`. If it has gone,
  `git worktree add` the branch again.

### Wave 2 (after wave 1 merges into `gold`)

- **E: the group page.** Brief: `docs/gold/WAVE2-E.md`, port 8105.
  Covers "leaves out", the trade-off line, own-device live updates, the
  best-times card, the 1920 layout, the table region, the save-your-link
  prompt, calendar titles, "How was it?", and confirming before archive.
  Add any markup notes agent C leaves for `g/[id].astro`.
- **F: engineering hygiene.** Port 8106.
  - Biome (lint and format) with a CI step.
  - Unit tests for `src/lib/recommend.ts` (ties, maximal stretches) and
    `src/lib/time.ts` (both DST transitions), via a separate vitest
    project.
  - A `LICENSE` file (MIT).
  - Extracting the group page's inline script to `src/scripts/` only if E
    has finished with `g/[id].astro`.
  - Faster boot for the cold start, if any cheap win exists.

### Lead's follow-ups (small, do while agents run)

- `flash.ts`: add `deleted: "Your profile is deleted."` and use it on
  profile deletion (developer A's suggestion).
- Decide on the schema mismatch A found: `schema.ts` says
  `members.person_id` is "set null", but the database has NO ACTION
  (migration 0001 used ALTER TABLE). `deletePerson` works around it.
  Either fix `schema.ts`'s comment and type to match reality, or write a
  careful members-table rebuild migration (needs a red migration test like
  `spec/migrations.test.ts`). **Recommended: correct the schema to match
  the database; no rebuild.**
- **Docker non-root user and sharp in the image** couldn't be verified
  locally (Docker wasn't running). CI's `docker build` will be the first
  real test of the sharp install. Watch that run closely when `gold`
  merges.

### Docs (lead, after all code merges)

- **README:**
  - absolute GitHub links for `docs/` (they 404 on `/readme/` today);
  - Reinecke link on `dash.harvard.edu`;
  - "says who it leaves out" (true once E lands);
  - `CLAUDE.md` rules for README points 3 and 4;
  - the Doodle wording;
  - point 7 "It's remembered";
  - one-line reasons for the social layer (friends, Explore, block/mute);
  - ≤600 words;
  - the judging results line (needs your session; see below).
- **`PROCESS.md`:** follow Appendix A of the audit (first person, cite
  the commits that already exist, fix the pkill over-claim, add the
  small-web position, fix the counts). It's still a draft for you to put
  in your own voice.
- **Prompt history:** prompts 27 (the audit) and 28 (this round) and the
  pause, plus everything this round changed and caught.
- Then: full `pnpm check` and `check:evidence` on `gold`, merge to `main`
  (fast-forward), push, watch CI including the Docker build with sharp,
  verify live, and run the two-person live check again.

### Needs you (no agent can do these)

1. **Run one real judging session** with 4–6 friends, using the questions
   in `docs/judging.md`, and send the numbers. This is the biggest single
   mark gain for "Response to the brief".
2. **Rewrite `PROCESS.md`, the README and the reflections in your own
   voice** once the agents' drafts are in.
3. Ask your tutor whether `min_machines_running = 1` is allowed during
   marking.

## The crit-10 tag

The crit 10 cutoff is **Wed 21 Oct 12:00**, which falls before this plan
resumes. `crit-10` stays at `a36b726` (what's live) and **must not move
after the cutoff**. The gold work lands on `main` after it, as final
project work (due Mon 9 Nov 12:00).

## Agent item lists (verbatim, for relaunching)

### B: correctness (port 8102)

Files: `src/lib/time.ts`, `src/lib/eventForm.ts`,
`src/components/EventForm.astro`, `src/lib/db.ts` (only `nameKey` and the
member functions, away from lines 20–55), `src/lib/people.ts` (only
`renamePerson`), `src/lib/forms.ts` (`ERRORS` and `field()`),
`src/pages/api/me.ts` (rename validation),
`src/pages/api/groups/[id]/join.ts` (name-taken), new
`spec/edges.test.ts`, optional new `src/lib/names.ts`. A one-line change
in each page that reads `?week=` is allowed.

1. **Extreme weeks.** `?week=9999-12-27` gives a 500. Add a
   `weekParam(asked, tz)` helper in `time.ts` that falls back to this
   week when the asked week is more than 520 weeks from now, and use it
   everywhere `?week=` is read.
2. **Event capacity.** 0, negative or non-numeric silently becomes
   "unlimited". Empty means unlimited; anything else that isn't a positive
   integer is an `event-capacity` error. The same for max +1s.
3. **Overnight events.** A 22:00–01:00 event is refused. Make "end before
   start" mean the next day everywhere `endTime` is used (`.ics` DTEND,
   Google link, agenda, event page). If that needs a schema change or
   touches more than ~8 files, improve the error message instead and say
   why.
4. **Event dates.** Refuse past dates and dates more than ~2 years ahead
   (not for group hangouts). Decide how editing a past event should
   behave.
5. **Unicode names.** Normalise with NFKC, strip `\p{Cf}` and collapse
   whitespace, for both `nameKey` and the display name (`field()`). Say
   whether old rows could now collide.
6. **Empty rename.** A whitespace-only rename should show the
   "Pick a name…" error.
7. **Name taken.** The message should point a returning person to their
   sign-in link.
8. **Max lengths.** Give the inputs in the forms you own a `maxlength`,
   and list the other forms that lack one.

### C: accessibility CSS (port 8103)

Files: `src/styles.css`, new `spec/a11y.test.ts`, `spec/browser.ts`
(helpers only), and `CLAUDE.md` (one bullet). Tiny attribute-only
component edits are allowed. Not `g/[id].astro`: give markup notes for it
in the report instead.

1. **Focus ring.** Make it ≥3:1 in all 5 themes × light/dark (it's
   `--accent-ring` at 38% today).
2. **Focus hidden at 390×844.** Add `scroll-padding-bottom` (bottom nav
   plus safe area) and keep the sticky save bar off focused controls.
3. **Contrast.** `/welcome .reassure` (4.45:1), `/me` forest link
   (4.47:1), `/events` dark date tile (2.3:1) and `.who` (3.66–4.02:1),
   and the heat-4 count in sunset/forest light (4.31–4.42:1). Bring all
   to ≥4.5:1.
4. **Forced colours.** Checked slots, focus, selected tabs and heat must
   stay distinguishable.
5. **Targets.** "Close poll" is 63×21, and the poll checkbox and
   visibility radios are 13 px. Make all ≥24×24.
6. **Reflow.** `/events/new` overflows by 4 px at 320 px.
7. **Phone chrome.** Reduce the sticky chrome on phones without breaking
   the tab-fit test in `holds-up`.
8. **Toast and confetti.** Never cover the heading or primary buttons;
   confetti gets `pointer-events: none`.
9. **Best-times card.** Make the winning card visibly stronger (CSS
   only).
10. **Grid header.** Fix the today circle overlapping "Mon".

**The check:** `spec/a11y.test.ts` in real Chrome, over these routes at
390×844 and 1920×1080, light and dark, ≥3 themes:

- axe with colour contrast on and reduced motion emulated, expecting zero
  violations;
- Tab through each page and assert focus is never covered by a fixed
  element (at 390 px);
- every focus indicator has ≥3:1 contrast;
- `scrollWidth ≤ clientWidth` at 320 px.

It must go red against the current CSS first. Keep it under ~2 minutes.

### D: first impressions (port 8104, resume branch above)

Files: new `src/pages/404.astro`, `src/pages/readme.astro`,
`src/components/Landing.astro`, `src/components/HeroDemo.astro`,
`src/layouts/Base.astro` (header, nav and meta), `src/pages/me.astro`
(add a "Look" section only), `src/pages/e/[id]/index.astro`
(not-found/cancelled state), `public/og.png`, new
`spec/first-impressions.test.ts`. Use component `<style>` blocks, not
`styles.css`.

1. **Branded 404.** HTTP 404, in the Base layout, with links home and to
   `/readme/`.
2. **Cancelled or missing event.** A branded "It may have been
   cancelled" page with no console error.
3. **`/readme/` as a landing page.** A "Try it in 60 seconds" box at the
   top (two profiles, the blind grid, propose, calendar), "Try it live"
   buttons at top and bottom, a centred ~720 px card, and the
   "Get started" pill on one line. Must not break
   `spec/readme-full.test.ts`.
4. **The blind grid on the first screen.** The hero says "mark your week
   before you see anyone else's", and the demo shows a blind member.
   Fill the empty comparison panel and fix the orphan trust line.
5. **Theme picker.** Move it from the header into `/me` ("Look"). If
   `spec/theme.test.ts` legitimately changes, explain why.
6. **Nav.** Explore stays off the main nav.
7. **`og:image`.** Add `public/og.png` at 1200×630 and
   `summary_large_image`, but not on private-link pages.
8. **`theme-color`.** Separate light and dark meta tags.
