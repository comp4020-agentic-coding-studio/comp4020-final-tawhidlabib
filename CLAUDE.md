# Final project

The platform under this repo is fixed and documented where it lives --- `fly.toml`,
the `Dockerfile`, the CI workflow and `spec/README.md` each say what they fix.
Read it there rather than restating it here. The course website publishes the
[final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
and the specs for crits 8, 9 and 10, which all run in this repo. Read the brief
and the current crit's spec before you plan or build.

This file is the harness: the rules I hold the agent to. It came forward from
`comp4020-crit7-tawhidlabib` (and before that `comp4020-ass2-tawhidlabib`),
minus everything that was true only of crit 7's starter app.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
  This repo is server-rendered with no base path --- the address is plain
  `http://localhost:8080/`.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.
- **A new page needs its route added to `spec/routes.ts`.** A server-rendered
  app has no `dist/*.html` to walk, so coverage is that explicit list: forget it
  and the quality floor keeps passing while quietly testing nothing. A page
  behind a dynamic segment (`/g/[id]`, `/e/[id]`) or one that changes when
  you're signed in can't be listed, so `dynamicRoutes()` there builds a small
  world each run and visits every page in every state a person can see it in
  (stranger, member, signed in, host, guest). A new state or a new page gets
  a line there.
- Commit `pnpm-lock.yaml` with any dependency change: CI installs with
  `--frozen-lockfile`.

## Red is not always wrong

"Never commit a red state" means the shipped checks and any test that was
passing. It does **not** mean this deliverable's own spec tests: those are
written before the app exists and are supposed to start red. Red-to-green
across the work is the record of the work. Never edit a spec test to make it
pass --- change the app.

## The model invents identifiers that look right

The reading list on the last repo was drafted from memory and every DOI in it
was plausible. A wrong one was the single mistake that survived everything
`pnpm check` ran: well-formed, resolving, and pointing at somebody else's paper.
Nothing catches that shape of error except checking against the source.

This project's `README.md` cites what I read to decide what good means, and
citations are exactly that shape: titles, authors, URLs and quotes the agent
will produce confidently and get subtly wrong. Anything that claims to point at
something real, check against the real thing before it ships, and say in
`README.md` which parts are real and which are plausible fiction.

Verification that needs the network stays out of `pnpm check`. A gate that fails
when someone else's API is slow is a gate you learn to skip.

## Judge the artefact, not the code that makes it

Reading the source of a generator does not tell you what it produced. On the
last repo the first artwork pass had bottles floating off a counter and a head
detached from its shoulders --- invisible in the code, obvious the moment a
proof was rendered.

The equivalent here is state. A schema reads correctly and still produces a
database that loses a row on the second submit, or an empty-state that nobody
ever sees because the seed data hides it. Drive the running app --- create the
thing, reload, come back to it --- rather than concluding from the handler that
it must work.

## What good means, as rules

`README.md` is the argument: a plan's whole life, from "we should hang out"
to remembering it, beating the group chat at each step. These rules are
that argument applied to code. A change that breaks one is wrong, however
green the checks:

- **Nobody sees the group's week before giving their own** (ADR 10). Hide
  it at the source: until someone has answered for a week, read only their
  own hours, so nothing derived from anyone else's (heat, counts, names,
  best times, Everyone's week, overviews) can reach them. A new view of
  availability must ask `hasAnswered()` first.
- **Every feature moves a plan one step on.** If a change doesn't help a
  group get to a time, show up, or remember it, it doesn't belong.
- **It holds up.** A phone at 390×844, a keyboard alone, a resize midway, a
  slow or dropped connection. Each new interaction gets a real-browser check
  in `spec/holds-up.test.ts`.
- **Joining costs a name.** Never add a step between an invite link and
  marking an hour.

## Live updates, and what changes state

Every page that shows shared state is live (crit 9). Parts that change carry
`data-live="<topic>"`, and the stream (`/api/live`) says only *which* topic
changed. The page then re-reads that part through the same access rules as
any request. So:

- **Anything that changes shared state must `publish()` its topic** (and
  `notify()` the people it concerns). Forget one, and every other open page
  goes stale without any error. That's exactly what no single-browser check
  will catch.
- **Never put data in the stream.** Not names, not comments, not counts.
  Access rules then live in one place, and a private event can't leak down
  a channel nobody thought to guard.
- **A live part needs a stable `id`**, and must not be replaced while
  someone is typing in it. The availability grid is patched, never replaced.
- **State that has to be fair under a race goes in one SQLite transaction**
  (ADR 6). Don't check in one statement and write in another.

## Logging: who did what

Crit 10 is judged by someone tailing `mise exec -- flyctl logs -a comp4020-final-tawhidlabib`
while two people use the app, so the server has to say who did what.

- **Anything that changes shared state publish()es, notify()s AND logs.** Call
  `logActivity()` (`src/lib/activity.ts`) from the endpoint: who, action, target,
  outcome. Each call prints one `[activity] <time> p12 "Ana" proposed hangout 41 in
  group #3f9a1c "Uni mates" → ok` line to stdout (Fly keeps it) and appends a row to the `activity` table
  on the volume, so it outlives restarts and redeploys. `node scripts/activity.ts
  [db] --last N` reads it back.
- **Log refusals too.** A 403/404/409 for an access reason goes through
  `refuse()` / `deny()` with outcome `denied (reason)`: that is how you show
  one person couldn't change what was the other's.
- **Never log a secret.** No `hp` / `hg_` cookie, sign-in link or token, no
  friend code, and no message bodies (log "commented on hangout 41" and a
  length). Names are fine: they are how two people are told apart.
- **Ids that open things are secrets too.** A group's id is its invite link
  and an event's share id opens a private event, and the first logging pass
  wrote both into every line. Name them with `groupRef()` (a one-way tag and
  the name) and `eventRef()` (the numeric id and the title), never
  `${group.id}` or `${event.shareId}`.
- **A refusal reads as an attempt.** `deny()` words it "tried to edit", so a
  line never looks like the thing happened. Pass the past tense, as for
  `logActivity()`.
- **Logging never throws into a request**, and `spec/activity.test.ts` holds
  all of this (it reads the local DB, so it skips where the app's DB isn't
  on this machine, as in CI).

## Who may see and change what

ADR 11 is the map. A route asks the thing's own rule (`currentMember`,
`canSee`, `openThread`, `isAdmin`) and never trusts the form to say who is
acting. Review found three holes no single-browser test showed:

- **A friend code is a password.** Never put one in a redirect, page or log
  for someone who didn't supply it. Look people up from a form's numeric id
  only through `knownPerson()` (`src/lib/circle.ts`), never `personById()`.
- **Never redirect to a raw form value.** Use `safeBack()`: browsers read
  `/\` as `//`, so "starts with one slash" isn't enough.
- **An archived group refuses every change** through `refuse()`, joining
  and nudging included.

## Files people send

Uploads are checked by their bytes, not their names, and served only by a
route that checks access (ADR 8). A new upload kind reuses `saveImage()`
and gets its own access rule. Never point a public route at the uploads
folder as a whole.

## Prove a check can fail

A test that can't fail is worse than none: it says something's held when
nothing is. The first double-submit test passed **with the fix removed**.
Chrome merges presses made in the same instant, and Playwright's `click`
waits for the page to finish loading before pressing again, so the race it
claimed to test never happened. The rewrite presses again 300 ms later,
inside the page, the way an impatient person does. The fix was proved by
taking it out: the test went red, then green when the fix went back.

So for every new check: make it fail on purpose once (remove the fix, or
break the app), see it go red for the right reason, then restore. In a
browser test, a person's second press doesn't wait for the page to load:
use `noWaitAfter`, or act from inside the page.

Two more ways a check passes while proving nothing:
- **A stream test that counts any event.** Opening a page sends `presence`
  on the same topic, so "something arrived" is always true. Match
  `event === "change"`.
- **A skipped test.** `it.skip` reads as a check in the file and runs as
  none. If a rule is decided against, delete the test and say why there.

## The checks

`pnpm check` is `pnpm typecheck` (`astro check`) then `pnpm test`, and `test`
runs `vitest` against whatever is already answering at `APP_URL` (default
`http://localhost:8080`) --- it starts nothing itself. CI builds the
`Dockerfile`, runs that image with a throwaway `/data`, and checks it; a red run
blocks the deploy. So before pushing, run the check against the built server
(`pnpm build && pnpm start`), not the dev server: production runs the build, and
a pass against `pnpm dev` is not a pass against what ships.

The accessibility floor (`spec/quality-floor.test.ts`) runs in jsdom, without a
browser: contrast and overlap rules are off, so a green axe pass is a floor and
not a clean bill of health.

JSDOM's selector engine doesn't match emoji outside the basic plane (🎉, 🙌)
in attribute selectors: `[value="🎉"]` finds nothing, and the test reads a
count of zero while the app is right. Find the element in code and compare
its value instead. Check the running app with curl before blaming the code.

`pnpm check:evidence` is the extra gate before shipping. It works out the
current deliverable from the repo name and the course API, so the reflection is
named for the current crit --- `reflections/crit-8.md`, then `crit-9.md` and
`crit-10.md` --- and no other name will satisfy it. A new crit gets a new file;
it never renames the last one.

Read the failure before changing anything.

## This file is yours

A starting point, not a rulebook: what I add to it is the harness, and the
harness is assessed. This file and the sensors wired into `check` carry across
the course --- both come with me into the next repo. The prototype doesn't:
source, and the tests answering this deliverable's published spec, stay behind.

As I learn what this app needs --- a convention the work has to hold to, a
sensor that keeps catching me out, a fact about the stack that is easy to get
wrong --- write it down here and wire it into `check`. Growing this file is the
work.
