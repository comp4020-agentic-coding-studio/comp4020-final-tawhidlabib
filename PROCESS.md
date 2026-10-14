# Process overview

How Hangout got from the brief to what's deployed, told from my prompt
history ([`docs/prompt-history.md`](docs/prompt-history.md), every prompt
quoted, with what it led to). This version follows crit 9; I rewrite it,
rather than append to it, at each crit.

## How I directed the work

Nineteen prompts built Hangout. The pattern that mattered: I made the
product calls, the agent asked before guessing, and I overruled it where I
disagreed. The prompt history marks each answer as the agent's
recommendation or my own call. The ones that shaped the app were mine:
- **The idea and the core rule.** "Longest overlap, with the ability to
  make the hangout shorter" replaced its offer of a fixed hangout length.
- **Scope.** I built everything for crit 8, against its advice to ship
  less.
- **The crit 9 decision**, chosen from four options it laid out without
  recommending one.
- **Keeping the features.** It advised cutting them for "one idea"; I chose
  to reframe "good" around a plan's whole life, so every feature has to
  earn its place by moving a plan on
  ([`fd47b33`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd47b33)).

The large steps (the core app, the social features, the eight crit 9
milestones) went through plan mode first. The agent named the decisions
that were mine to make (how a person exists, what "private" means, whether
photos are uploaded), and waited for my answers. Smaller requests went
straight to building. Ten ADRs record the decisions, each with what it
costs.

## What I threw away, and why

- **Writing straight into Google Calendar.** It was in my first prompt.
  The agent pointed out that OAuth on an unverified app only works for
  listed test users, so my pod couldn't have used it at the crit. Links
  and `.ics` files do the job without the wall (ADR 3).
- **A name and a cookie per group** (ADR 2), once friends and a personal
  calendar needed someone who exists across groups. Replaced by a profile
  with a private sign-in link (ADR 4).
- **The open grid.** Everyone could see everyone's hours while marking
  their own, like When2meet. Research on 340,000 Doodle polls found people
  in open polls approve what looks popular rather than when they're free
  (Zou, Meir & Parkes, 2015). The blind grid replaced it
  ([`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284),
  ADR 10).
- **Tests that passed for the wrong reason**, three times. Each was
  deleted or rewritten rather than kept green (see below).

## The stack, and why it beat the alternatives

Server-rendered Astro and one SQLite file on the Fly volume (ADR 1). I kept
crit 7's stack because I'd shipped it once, it fits a 256 MB machine, and
crit 8 was due the next day. A new framework would have spent that day on
learning.

For real-time I chose **server-sent events** over WebSockets and polling.
Every write was already a form post, so only "this changed" ever needs to
travel back: one direction, which is exactly what SSE is. The deciding
call was that the stream carries **no data**, only which topic changed.
Each open page re-reads it through the same access rules as any request.
The obvious alternative, pushing the new data, would have meant a second
copy of every privacy rule
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).
The cost, written into ADR 6: in-process pub/sub only works on one machine.

## How I knew results were right before accepting them

A green suite wasn't enough. Each claim was checked against the thing
itself:
- **Live updates were timed on the live site**: 52 ms from one person's
  save to another's screen, and 167 ms a week later.
- **The core flow was driven in real Chrome**, two people at both marking
  viewports: link to calendar in 12 actions, about four seconds.
- **The rendered page was read, not just the code.** That caught a date
  format putting a stray comma in the grid headers, which no test saw
  ([`1cb87cb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1cb87cb)).
- **When a test blamed the app, curl checked the app.** Reactions read as
  zero while curl showed them saved. The test library can't match emoji in
  a selector, so the test was at fault
  ([`f681fc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f681fc2)).
- **Sources were checked against the papers**, not the agent's memory.
  Shirky's site was down, so the README cites a mirror whose quotes were
  verified.

## Failures, fixed in the harness

Where something went wrong, the fix landed in `CLAUDE.md` or `spec/`, not
in a retry:
- **The checks never visited the page people use.** The quality floor
  walked a static list of routes. The fix makes it build people and groups
  every run and visit every page as each of them sees it: 405 checks now
  ([`ffd3028`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ffd3028)).
- **A test that couldn't fail.** The first double-submit test passed with
  the fix removed, because Chrome merges presses made in the same instant.
  I had it rewritten, proved red with the fix taken out and green with it
  back, and `CLAUDE.md` now requires that for every new check: **prove a
  check can fail**
  ([`047d3fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/047d3fa)).
- **A leak, caught by a test that first passed vacuously.** The blind grid
  hid other people's hours on the group page, but `/groups` showed the
  week's best time. The first version of the test marked hours in a future
  week the overview never reads. Rewritten, it went red for the right
  reason, then green with the fix
  ([`11b224c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/11b224c)).
- **A race found by trying it.** Two people proposing the recommended
  time in the same second made two identical plans. A red-first browser
  test now holds the merge
  ([`11db9fc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/11db9fc)).
- **A secret nearly went public.** I put the deploy token in a tracked
  file. It was moved before anything was committed, and the secret scans
  confirmed it never reached GitHub.

## The decision for crit 9

When two people want the last spot at a full event, the first to reach the
server wins, and the waitlist fills itself in order. Every tap gets a
definite answer the moment it's made. It's unfair to people who are slow or
offline, and a lottery would serve them better. I chose who loses, on
purpose (ADR 6; `spec/waitlist.test.ts` fires five simultaneous taps).

## Who wrote what

I made the product decisions above and directed and reviewed the work in
Claude Code (Opus 5.5). The agent wrote the code, the tests, and first
drafts of the documents. I rewrite the documents in my own words.
