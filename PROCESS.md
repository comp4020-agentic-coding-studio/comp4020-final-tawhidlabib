# Process overview

This is the crit 8 version. It describes Hangout as it stands at "It's
alive!", and I'll rewrite it at each crit.

## From the brief to Hangout

The brief asks for a multi-user, real-time website that's good, and says
what good means is mine to decide. I started from a problem I actually
have: my friends agree we should hang out, then the group chat never lands
on a time.

Before any code, I agreed a plan with the agent in plan mode. That's where
the decisions in `README.md` were made:
- who counts as a person (a name and an invite link, no accounts)
- how plans reach a calendar (links, not Google's API)
- what to recommend (the longest stretch the most people share, which you
  can shorten when you propose it)
- how fine the grid is (1-hour slots, 8am to midnight)
- who turns a recommendation into a plan (anyone, then everyone RSVPs)

The agent pushed back once on scope. It suggested keeping crit 8 to groups
and availability, and I chose to build the whole flow anyway. The build
order is what made that safe: each step left a working app behind it.

## The harness

`CLAUDE.md` came forward from crit 7
([`e6eb352`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e6eb352)).
Every rule was kept: spec tests start red, judge the rendered page rather
than the code, check plausible-looking identifiers against the source, and
keep network checks out of `pnpm check`. What changed was the facts the
final template made untrue. Tests no longer build and boot the app
themselves; they check whatever is serving at `APP_URL`, and CI checks the
Docker image.

The final template ships only two checks, so I brought crit 7's quality
floor (lang, title, landmarks, one h1, alt text, axe) forward as my own
sensors
([`2288e1b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/2288e1b)).

## The stack, and why

Server-rendered Astro on the Node adapter, with one SQLite file through
Drizzle on the Fly volume
([`96a3e37`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/96a3e37)).
I'd shipped it in crit 7, it fits a 256 MB machine, and setup was the day
before the cutoff. The trade-offs, including what it costs crit 9's
real-time layer, are in [ADR 1](docs/adr/0001-astro-and-sqlite.md). The
identity and calendar decisions have their own records:
[ADR 2](docs/adr/0002-invite-link-identity.md) and
[ADR 3](docs/adr/0003-calendar-links-not-oauth.md).

## How the work went

The workflow was tests first, then small steps. The core flow went in as
red HTTP tests before any page existed
([`5da247f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5da247f)).
They test what a person does (join by link, mark hours, come back), not how
it's stored. The one that matters most kills the server and asks a cold one
on the same database whether your hours are still there.

Then the build went in the order the plan set, each step committed when its
tests went green:
- the data layer
  ([`ca78b9c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ca78b9c))
- starting and joining a group, and the availability grid
  ([`e4d2810`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e4d2810))
- recommendations, proposals, RSVPs and calendar links
  ([`1925f3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1925f3f))
- the JavaScript polish last, so it could be cut if time ran out
  ([`2889130`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/2889130))

The whole build is
[`ca78b9c...2889130`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/ca78b9c...2889130).

## Where it went wrong, and what changed

- **The checks went blind on the real page.** The quality floor walked a
  static route list, but the page people use, `/g/[id]`, is dynamic. Every
  check was green while the group page went unchecked. The fix makes a fresh
  group each run, so the checks see the page as a stranger, a member, and a
  member with plans. The routes rule in `CLAUDE.md` now says so
  ([`ffd3028`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ffd3028),
  [`93adb55`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/93adb55)).
- **A bug no test saw.** The `en-AU` locale formats "Tue, 8 Jan" with a
  comma, so the grid headers read "Tue," over "8". All 50 tests passed. It
  only showed when we read the rendered HTML, which is exactly the
  harness's "judge the artefact" rule
  ([`1cb87cb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1cb87cb)).
- **A citation that would have broken.** Shirky's own site is down, so the
  README cites a mirror we checked against the real text. The other source
  was checked the same way.

## Who wrote what

I made the product decisions, and I directed and reviewed the work in
Claude Code (Opus 5.5). The agent wrote the code, the tests, and this first
draft of `README.md`, `PROCESS.md`, the ADRs and my crit 8 reflection, at
my request and from the session record. I'll rewrite them in my own words
for the final submission.

## Next

Crit 9 makes Hangout real-time: a change one person makes should reach
everyone else within about a second. The decision to record then is what
happens when two people change the same thing at once.
