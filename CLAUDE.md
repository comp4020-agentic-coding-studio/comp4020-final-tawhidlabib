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
