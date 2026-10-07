# Process overview

This is the crit 9 version, rewritten rather than appended to. It describes
Hangout as it stands at "All at once": live, social, and with one decision
about what happens when several people want the same thing at once.

## From the brief to Hangout

The brief asks for a multi-user, real-time website that's good, and leaves
"good" to me. I started from a problem I have: my friends agree we should
hang out, then the group chat never lands on a time. Crit 8 shipped the core
([`b663ce5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b663ce5)):
a group, an invite link, a week of hours, the longest overlap recommended,
and a plan in your calendar.

Everything since grew from the README's argument that a good Hangout beats
the group chat:
- a brand, colour themes and motion
  ([`ad1626f...db452ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/ad1626f...db452ba))
- friends, events and a calendar
  ([`4f3f0cb...d8f5f97`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/4f3f0cb...d8f5f97))
- comments and reactions, so the talk lives with the plan
  ([`cf5438b...6671f9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/cf5438b...6671f9f))
- live updates and the crit 9 decision
  ([`e3d7473...fd9fd67`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/e3d7473...fd9fd67))
- an inbox, polls, event extras, group admin, nudges, photo memories, and
  avatars with block and mute
  ([`dfebbd1...d0ff703`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/dfebbd1...d0ff703))
- a logo that always goes to the landing page, and logging out
  ([`6b1e6ef...f8e9dd0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/6b1e6ef...f8e9dd0))

## How the work went

Every big step started in plan mode with questions only I could answer: how
a person exists, what "private" means, which several-people decision to
defend and by what rule, whether photos are uploaded or linked. I answered
them, and the agent planned around the answers. Nine ADRs record the ones
that matter.

Then each milestone ran the same loop, visible in the history: a `spec:`
commit with tests that fail, a `feat:` commit that turns them green, a
`harness:` commit adding the new pages to the quality floor, and a deploy
through CI. Seven milestones in a row reached production one at a time, so
nothing waited on everything else.

Writing tests against the contract paid off early. The interface was
redesigned twice (tabs, a new home page, a navigation bar, a new brand)
and not one crit 8 test changed. They drive the app the way a person
would, through forms, links and cookies, never through how the page
happens to be built.

## The harness

`CLAUDE.md` came forward from crit 7 and grows where the work bit back:
- the routes rule now covers dynamic pages and signed-in states
  ([`ffd3028`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ffd3028),
  [`66e58b3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/66e58b3))
- a JSDOM trap with emoji
- rules for live updates: publish on every state change, and never put
  data in the stream
- rules for uploads

The quality floor builds a small world on every run (a host, friends, groups
with plans, public, private, full and closed events, albums with photos) and
checks every page as each of those people sees it. That's 392 checks.
`spec/README.md` says which file holds which promise.

## The stack, and why

Server-rendered Astro and one SQLite file on the Fly volume (ADR 1). It
fits one 256 MB machine, and the forms work without JavaScript.

For real-time I chose **server-sent events** over WebSockets and polling.
Every write is already a form post, so all that travels back is "this
changed". The browser reconnects on its own, Fly's proxy passes it through,
and in production a change reached another screen in 52 ms. The stream
carries only the topic; each page re-reads what changed through the same
access rules as any request, so private plans have one place their rules
live
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).
Photos live on the same volume (ADR 8). The cost: all of it assumes one
machine.

## The decision for crit 9

**When two people want the last spot at a full event, the first request to
reach the server wins. Everyone after joins a waitlist in order and hears at
once, and when anyone drops out, the first person waiting who fits moves in
and is told.** Every tap gets a definite answer the moment it's made, which
is what the README means by "it answers the question, honestly". It costs
fairness to people who are slow or offline; a lottery would serve them
better. [ADR 6](docs/adr/0006-the-last-spot.md) has the options and costs,
and `spec/waitlist.test.ts` fires five simultaneous taps at one spot.

## Where it went wrong, and what changed

- **A test blamed the app for its own bug.** Reaction counts read zero while
  curl showed them saved: JSDOM can't match emoji in an attribute selector.
  The lookup changed and the trap went into `CLAUDE.md`
  ([`f681fc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f681fc2)).
- **A failing test found a real limit.** Explore showed only 30 events, so
  search went in
  ([`91a9733`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/91a9733)).
- **Tests that couldn't fail.** Two would have passed without their
  feature, matching an older notification or a form that no longer existed.
  Both were tightened before their spec commits.
- **A bug no test reached.** Picking an avatar photo did nothing, because
  the upload-on-choose handler lived in the album component. Reading the
  code caught it
  ([`c594a35`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/c594a35)).
- **A secret nearly went public.** The deploy token went into a tracked
  file. It moved before anything was committed, and the secret scans
  confirmed it never reached GitHub.

## Who wrote what

I made the product decisions: identity, privacy, what counts as good, which
features, and the crit 9 rule. I directed and reviewed the work in Claude
Code (Opus 5.5). The agent wrote the code, the tests, and the first drafts of
the README, the ADRs, this file and my reflections, at my request and from
the session record. I edit them into my own words.

## Next

Crit 10 adds server-side logging, starting where I most want to see the
server: the live stream, the waitlist race, and uploads. After that, the
inbox should reach people when they're not on the site, which is the open
cost in ADR 7.
