# Process overview

This is the crit 9 version, rewritten rather than appended to. It describes
Hangout as it stands at "All at once": live, social, and with one decision
about what happens when several people want the same thing at once.

## From the brief to Hangout

The brief asks for a multi-user, real-time website that's good, and leaves
"good" to me. I started from a problem I have: my friends agree we should hang
out, then the group chat never lands on a time. Crit 8 shipped the core: a
group, an invite link, a week of hours, the longest overlap recommended, and
a plan in your calendar.

Since then the app has grown in the direction the README argues for. Friends,
events and a calendar came first
([`4f3f0cb...d8f5f97`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/4f3f0cb...d8f5f97)).
They needed a person who exists across groups, so ADR 4 replaced crit 8's
per-group identity with a profile and a private sign-in link. Then came
comments and reactions on every plan
([`cf5438b...6671f9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/cf5438b...6671f9f)),
so the talk lives with the plan instead of in the group chat Hangout exists
to end. Crit 9 then made all of it live
([`e3d7473...fd9fd67`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/e3d7473...fd9fd67)).

Every big step started in plan mode with questions only I could answer:
- how a person exists
- what "private" means for an event
- which several-people decision to defend, and by what rule

I answered them, and the agent planned around the answers.

## The harness

`CLAUDE.md` came forward from crit 7 and keeps growing where the work bit
back:
- the routes rule now covers pages behind a dynamic segment and pages that
  change when you're signed in
  ([`ffd3028`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ffd3028),
  [`66e58b3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/66e58b3))
- a JSDOM trap with emoji is recorded
  ([`f681fc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f681fc2))

The quality floor now builds a small world on every run (a host, friends, a
group with plans, public, private and full events, threads with comments in
them) and runs its accessibility checks over every page as each of those
people sees it. That's 272 checks, and every feature adds its states.

## The stack, and why

Server-rendered Astro and one SQLite file on the Fly volume (ADR 1). It
still fits: one 256 MB machine, forms that work without JavaScript, and
pages that read straight from the database.

For real-time I chose **server-sent events** over WebSockets and polling.
Every write in Hangout is already a normal form post, so the only thing that
needs to travel the other way is "this changed". That's one-directional,
which is exactly what SSE is. It runs through Astro's Node adapter with no
extra server, the browser's `EventSource` reconnects on its own, and Fly's
proxy passes it through: 52 ms from a save to another person's stream in
production. Polling fast enough to feel live would cost a request a second
from every open tab.

The stream carries only the topic that changed. Each page then re-reads that
part through the same access rules as any request. So private events,
groups and threads have exactly one place their rules live, and nothing
private travels down the stream
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).

The cost: the pub/sub is in memory, so it's right only for one machine.
That's what the course setup gives me, and ADR 6 says what scaling out
would need.

## The decision for crit 9

**When two people want the last spot at a full event, the first request to
reach the server wins. Everyone after joins a waitlist in order and hears
at once, and when anyone drops out, the first person waiting who fits moves
in automatically and is told.** It's the only rule I considered where every
tap gets a definite answer the moment it's made. That's what the README
means by "it answers the question, honestly". It costs fairness to people
who are slow or offline, and a lottery would have served them better.
[ADR 6](docs/adr/0006-the-last-spot.md) has the options, the reasons and the
costs. `spec/waitlist.test.ts` fires five simultaneous taps at one spot and
checks exactly one wins.

## Where it went wrong, and what changed

- **The tests blamed the app for a test bug.** The reaction tests read zero
  while curl showed the reaction saved and rendered. JSDOM can't match
  emoji in an attribute selector. I fixed the test's lookup without changing
  what it checks, and recorded the trap
  ([`f681fc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f681fc2)).
- **A failing test found a real limit.** Explore listed only the soonest 30
  public events. A growing test database pushed a new event off it, which
  is exactly what would happen in production. Search went in instead of a
  longer list
  ([`91a9733`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/91a9733)).
- **The checks kept going blind on new pages.** Each new signed-in or
  dynamic page passed every check while nothing visited it, until the
  fixture learned to build the people who see it.
- **A secret nearly went public.** The deploy token went into a tracked
  file instead of the ignored one. It was moved before anything was
  committed, and the secret scans confirmed it never reached GitHub.

## Who wrote what

I made the product decisions: identity, privacy, what counts as good, and
the crit 9 rule. I directed and reviewed the work in Claude Code (Opus 5.5).
The agent wrote the code, the tests and the first drafts of the README,
the ADRs, this file and my reflections, at my request and from the session
record. I edit them into my own words.

## Next

Crit 10 adds server-side logging. Before then, the rest of the plan lands
one milestone at a time:
- a notifications inbox
- polls
- event extras
- group management
- smarter availability
- photo memories
- richer profiles with mute and block
