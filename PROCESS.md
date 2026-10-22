# Process overview

How I got Hangout from the brief to what's deployed. Every prompt I gave
the agent is quoted in [`docs/prompt-history.md`](docs/prompt-history.md);
this is the account, rewritten (not appended to) each time the work moved
on.

## How I directed the work

The idea and the rule at its centre were mine. When the agent offered a
fixed hangout length, I wrote back "do the longest overlap with the ability
to make the hangout shorter" (prompt 3), and that became `recommend()`
([`1925f3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1925f3f)).

I overruled the agent where I disagreed. It advised building less for
crit 8; I built everything, calendar included. Before crit 9 it advised
cutting features down to one idea. I answered "can't we just edit the
readme's definition of good?" (prompt 18): keep the features, and make
"good" a plan's whole life, so each one has to earn its place
([`fd47b33`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd47b33)).
For the final round I asked for an audit against the marking criteria. I
then made the calls it couldn't: keep the social layer but justify it,
leave Fly's machine settings alone, and delete the test data it left in
production.

## The stack, and why it beat the alternatives

I kept crit 7's server-rendered Astro and one SQLite file on the Fly
volume
([`96a3e37`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/96a3e37),
ADR 1) over a new framework or a separate database. It fits a 256 MB
machine, and I'd shipped it before. The obvious alternative for real time
was to push the new data to every open page. I chose server-sent events
that say only *which* part changed; each page then re-reads it through the
same access rules as any request
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).
Pushing data would have meant writing every privacy rule twice. The cost
is one machine: in-process pub/sub doesn't spread.

## Two workflows, and what each cost

For crits 8 and 9 I worked one feature at a time, in triplets: a spec that
starts red, the feature, then a harness change
([`3b4e59e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3b4e59e),
[`c318a3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/c318a3d),
[`9ef4e6c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/9ef4e6c)).
It was slow, but I could read every diff.

For crit 10 and the final round I ran a team. One lead agent wrote the
briefs and reviewed every diff. Fixers worked in separate git worktrees,
and their branches merged into an integration branch that had to pass
before `main`
([`41fa6f0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/41fa6f0),
[`ae2c42f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ae2c42f)).

The cost was review, not typing. Three times a fixer's own tests passed on
work that was still wrong, and only reading the diff caught it. Parallel
fixers also collide in shared files, so I gave each one its own files.

## What I threw away

- **Writing straight into Google Calendar.** OAuth on an unverified app
  only works for listed test users, so my pod couldn't have used it. Links
  and `.ics` files replaced it
  ([`1925f3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1925f3f)).
- **The open grid.** In open Doodle polls people approve what looks popular.
  The blind grid replaced it
  ([`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284),
  ADR 10).
- **A test that couldn't fail.** The first double-submit test passed with
  its fix removed. I deleted it and rewrote it
  ([`047d3fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/047d3fa)).
- **Refusing plans dated in the past.** It would have needed a test-only
  route in production
  ([`a480bc3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a480bc3)).

## How I knew results were right before accepting them

I measured rather than trusted a green suite:
- live updates at 52 ms and 167 ms on the live site, and 405 ms at p95 with
  eight people watching one group ([`docs/judging.md`](docs/judging.md));
- two people from link to calendar in 12 actions;
- People-tab overflow red at 137 px before its fix
  ([`ea3c9b2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ea3c9b2));
- axe violations from 36 to 0
  ([`9dd9acb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/9dd9acb)).

I also rehearsed crit 10 by reading only the log while two people used the
app. That's how I found a refused edit reading as if it had happened
([`1c56cf9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1c56cf9)).

## Failures, fixed in the harness

- **A migration that would have wiped production.** SQLite ignores
  `foreign_keys=OFF` inside drizzle's transaction, so rebuilding a table
  cascade-deleted every RSVP. It was reproduced (3 RSVPs → 0) and fixed,
  and `spec/migrations.test.ts` now holds it
  ([`12e9694`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/12e9694)).
- **Secrets in the log.** Invite links reached `flyctl logs`, and a newline
  could forge a line
  ([`e8026da`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e8026da)).
  The rule went into `CLAUDE.md`, along with the ones for friend codes and
  redirects
  ([`7181368`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/7181368)).
- **A helper that hid absence.** `textOf` read a missing element as "", so
  "doesn't contain the secret" passed on an empty page. It throws now
  ([`7f5b64d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/7f5b64d)).
- **One link that froze the site.** `/calendar?month=0000-01` looped
  forever. Dates are clamped now, shipped alone as a hotfix
  ([`d2dc727`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d2dc727)).
- **A real-browser accessibility check.** The jsdom floor couldn't see
  contrast or focus, so `spec/a11y.test.ts` runs axe and a Tab-through in
  Chrome
  ([`31ee022`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/31ee022)).

One mistake I didn't fix in the harness: a broad `pkill` killed the fixers'
servers. I changed how I briefed them, not a rule.

## Where I stand on the small web

Robin Sloan's home-cooked app is made for the people around you, and
Shirky's situated software for "a specific social group". I built for
*any* small group, which argues against both. My answer is that each
group's copy is situated, with its own link, names and week, while the
app stays general. I didn't read the course's small-games writing closely
enough to place Hangout against it.

## Who wrote what

I wrote every prompt in the prompt history and made the decisions above.
The agents wrote the code, the tests and the first drafts of these
documents. Every commit is under my name, with a Claude co-author line, and
I rewrite the documents in my own words.
