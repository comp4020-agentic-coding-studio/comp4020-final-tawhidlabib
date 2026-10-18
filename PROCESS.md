# Process overview

How Hangout got from the brief to what's deployed, told from my prompt
history ([`docs/prompt-history.md`](docs/prompt-history.md), every prompt
quoted, with what it led to). This version follows crit 10; I rewrite it,
rather than append to it, at each crit.

## How I directed the work

Twenty-one prompts built Hangout. I made the product calls, the agent asked
before guessing, and I overruled it where I disagreed. The ones that shaped
the app were mine:
- **The idea and the core rule:** "longest overlap, with the ability to
  make the hangout shorter", instead of a fixed length.
- **Scope.** Everything for crit 8, against its advice to ship less.
- **Keeping the features**, reframing "good" around a plan's whole life so
  each has to move a plan on
  ([`fd47b33`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd47b33)).
- **The blind grid**, chosen from its proposals, and the crit 9 decision.

Large steps went through plan mode, where the agent named the decisions that
were mine and waited. Eleven ADRs record them, each with what it costs.

## How the work was organised for crit 10

For the last round I asked for a team (prompt 20): one Opus agent as lead,
Sonnet agents to fix, Haiku to measure. The lead never wrote a fix it then
reviewed itself. It ran six read-only audits in parallel and re-ran every
finding before accepting it. Two were wrong and were dropped. Then it gave
each fixer one area, in its own git worktree, with the same brief: a red
test first, the fix, then the fix taken out once to see the test go red
again. Every branch merged into `team-polish` and passed the full check
there before anything reached `main`.

The trade-off is cost in tokens and in review. Six audits find more than
one, but each finding still has to be checked by hand, and two fixers
working on nearby files collide. Here it was worth it: review caught three
problems that every agent's own green run had passed (below).

## What I threw away, and why

- **Writing straight into Google Calendar.** OAuth on an unverified app
  works only for listed test users, so my pod couldn't have used it. Links
  and `.ics` files do the job (ADR 3).
- **A name and a cookie per group** (ADR 2), once friends needed someone
  who exists across groups: a profile with a sign-in link (ADR 4).
- **The open grid.** In open Doodle polls people approve what looks popular
  (Zou, Meir & Parkes, 2015). The blind grid replaced it
  ([`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284),
  ADR 10).
- **Refusing plans dated in the past.** A fixer wrote it and held it back
  because it broke the memory tests. The lead dropped it: the grid never
  offers a past day, a hand-made one lands under Past, and keeping the
  tests able to make one in CI would need a test-only route in production
  ([`a480bc3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a480bc3)).

## The stack, and why it beat the alternatives

Server-rendered Astro and one SQLite file on the Fly volume (ADR 1): crit
7's stack, which fits a 256 MB machine and cost no learning. For real-time,
**server-sent events** carrying **no data**, only which topic changed. Each
page re-reads it through the same access rules as any request, so privacy
rules live in one place
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).
The cost: in-process pub/sub works on one machine only.

## How I knew results were right before accepting them

- **Measured, not assumed:** live changes at 52 ms and 167 ms on the live
  site, link to calendar in 12 actions in real Chrome, and an avatar change
  reaching another open page in 210 ms.
- **The rendered page was read.** A Haiku agent measured every tab at
  390 px in Chrome after the front-end fixer said its work was done: the
  tab bar still hid 96 px
  ([`bc4f8c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/bc4f8c3)).
- **Crit 10 was rehearsed.** Two people in separate cookie jars, read only
  from the log, the way the marker will. That showed a refused edit
  reading as if it had happened
  ([`1c56cf9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1c56cf9)).

## Failures, fixed in the harness

Each fix landed in `CLAUDE.md` or `spec/`, not in a retry:
- **A migration that would have wiped production.** It rebuilt the
  hangouts table, and SQLite ignores `foreign_keys=OFF` inside drizzle's
  transaction, so every RSVP and comment would have cascaded away. The
  fixer said it had checked. The lead reproduced the loss (3 RSVPs → 0)
  and fixed it, with a red-then-green test
  ([`12e9694`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/12e9694)).
- **The log leaked invite links**, and a newline in a form forged a log
  line ([`e8026da`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e8026da)).
- **Friend codes for anyone.** A signed-out request turned person ids into
  friend codes ([`40cf06e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/40cf06e)...[`779b307`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/779b307)).
- **Tests that couldn't fail.** A double-submit test passed with its fix
  removed, so `CLAUDE.md` now requires proving each check red
  ([`047d3fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/047d3fa)).
  A test helper read a missing element as "", so "doesn't contain the
  secret" passed on an empty page. It now throws
  ([`7f5b64d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/7f5b64d)).
- **My own mistake:** a broad `pkill` killed the fixers' servers in other
  worktrees and made one repro look like a different bug. Servers are now
  stopped by port only.

## The decision for crit 10

What each person may see and change is checked on the server, by one rule
function per kind of thing that every route asks: page, form, live stream,
`.ics` and photo (ADR 11). Identity comes only from the cookie, never from
the form. Every change and every refusal is logged with who did it, to
`flyctl logs` and to a table on the volume that outlives the crit, with no
secrets in it. The cost is the one ADR 2 chose: whoever holds an invite
link can join.

## Who wrote what

I made the product decisions above and directed and reviewed the work in
Claude Code (Opus 5.5 leading Sonnet and Haiku agents). The agents wrote
the code, the tests, and first drafts of the documents. I rewrite the
documents in my own words.
