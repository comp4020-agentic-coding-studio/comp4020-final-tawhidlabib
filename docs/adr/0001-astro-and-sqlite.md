# 1. Server-rendered Astro on one SQLite file

Date: 2026-10-06 · Status: accepted (crit 8)

## Context

The final project has to be multi-user, real-time and persistent, on one
256 MB Fly machine with one volume at `/data`. There's no separate database
server. The template ships no stack, and crit 8 is due the day after setup,
so the first choice has to be one I can get live fast.

## Options

- **Keep crit 7's stack:** Astro on the Node adapter, better-sqlite3 and
  Drizzle. I've shipped it once, and it fits the machine.
- **A new framework** (SvelteKit, Next, Hono with a SPA). Possibly nicer for
  real-time later, but a new learning curve against a one-day deadline.
- **Bare Node.** The fewest moving parts, but I'd hand-roll routing,
  templating and migrations.

## Decision

Keep crit 7's stack, adapted to the final template: everything on port 8080,
`DATABASE_PATH` on the volume, migrations applied at boot, and the spec run
against the running app rather than a build the tests boot themselves.
Pages are server-rendered forms that work without JavaScript, with small
scripts layered on top.

## What it costs

SQLite means one machine, which is fine for friend groups and is what the
course setup allows anyway. Server-rendered forms reload the page on every
save. Crit 9's real-time layer will need a push channel (server-sent events
are the likely fit) on top of a stack that doesn't give me one for free.
