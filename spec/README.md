# The spec

The [final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
and its spec are on the course website, along with the specs for crits 8, 9 and
10, which run in this repo. The brief poses the problem; the spec is the fixed
contract.

## What ships

`invariants.test.ts` checks the two things the course relies on:

- `/` answers with a 200, which is what the deploy and the crit capture read
- `/readme/` publishes `README.md`. Markdown renderers all differ slightly, so
  it checks the README's headings rather than every word: each one has to
  appear, in order, in the HTML the server sends, since no script runs. Render
  it however you like, as long as it's there in full; the marker reads it there.

Both run against the **running** app over HTTP, so they hold whatever it's built
with. In CI that app is the image your `Dockerfile` builds, started with a
throwaway `/data`, and a red run blocks the deploy. Locally, start the app
however you run it and `pnpm check` finds it at `APP_URL` (default
`http://localhost:8080`). Keep them; don't delete them.

## Your checks

Everything else in `spec/` is yours to write. Any `spec/*.test.ts` runs with
`pnpm check`, against the same running app. Some lines of a spec only a person
can judge; those are left to the crit and the marker.

At a crit, a green `check` job is half the shipped mark, but it's never the
judgement of the work: your tutor checks what you deployed against the published
spec.

## What's here

The template's two checks are in `invariants.test.ts`. Everything else is
Hangout's own. Each file holds the promises of one part of the app,
written red before the part existed. Every test drives the running app
over HTTP as a person would: forms, links, cookies and live streams. None
of them reads the code.

| file | holds |
|---|---|
| `crit-8.test.ts` | crit 8: start or join a group by link, mark hours that survive a cold restart, the longest overlap recommended, a shortened proposal on your calendar at the right instant (across daylight saving) |
| `live.test.ts` | **crit 9**: a change reaches every other open page within a second; "here now"; only a plan's people can listen |
| `waitlist.test.ts` | **crit 9's decision** (ADR 6): of simultaneous taps on the last spot exactly one wins; the waitlist fills itself in order; +1s take spots |
| `profiles.test.ts`, `session.test.ts` | a profile and its private sign-in link (ADR 4); the logo goes to the landing page; logging out forgets you, and the link brings you back |
| `friends.test.ts` | friend links, requests and accepting; no befriending yourself |
| `events.test.ts`, `event-extras.test.ts` | public and private events (ADR 5); RSVPs and `.ics`; deadlines, covers, Explore filters, spots left, host editing |
| `calendar.test.ts` | hangouts and events on the right days, and in Up next |
| `comments.test.ts`, `polls.test.ts` | talk and polls on plans, only by the plan's people |
| `inbox.test.ts` | notifications, the live bell, read and unread (ADR 7) |
| `group-admin.test.ts`, `smarter.test.ts` | admins, removal, leaving, archiving; copying a week, nudges, everyone-free alerts |
| `memories.test.ts` | photo albums (real images, 5 MB, private to the plan; ADR 8) and "how was it?" |
| `profile-plus.test.ts` | avatars, bios, block and mute (ADR 9) |
| `theme.test.ts` | the colour theme picker |
| `quality-floor.test.ts`, `readme-full.test.ts` | the floor for every page in every state, from the small world `routes.ts` builds each run, and the whole README at `/readme/` |

`people.ts` lets a test act as one person, with their own cookie jar.
`stream.ts` listens to the live stream the way an open tab does.
