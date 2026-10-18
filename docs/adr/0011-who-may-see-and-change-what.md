# 11. Who may see and change what

Date: 2026-10-18 · Status: accepted

## Context

Crit 10 asks for "what each person may see and change is checked on the
server", with the decision and its reasons in the repo. Two classmates will
use the app from its URL alone, in separate Chrome profiles. It's a finding
if the logs can't tell them apart, or if one can change what belongs to the
other.

Hangout has no accounts with passwords. Who you are is a cookie (ADR 2,
ADR 4): `hg_<group>` for a membership, `hp` for a profile. So every access
rule ends up being one question: which cookie does this request carry, and
what does that cookie entitle it to?

## Options

1. **Check in the page.** Hide the buttons a person shouldn't press. This
   fails against anyone with curl. The endpoint does whatever it's asked.
2. **One central access table** (subject × verb × object), consulted by
   every route. It's tidy on paper, but most of Hangout's rules depend on
   state, not on a role: whether you've answered this week, whether an event
   is full, whether a plan's day has come.
3. **A few rule functions, each owning one kind of thing, called by every
   route that touches it.** Pages, endpoints, the live stream and file
   routes all ask the same function.

## Decision

**Option 3.** There is one function per kind of thing, and every way in asks
it: the page, the form endpoint, the live stream (`/api/live`), the `.ics`
download, and the photo route.

| Thing | Who may see it | Who may change it | Rule lives in |
|---|---|---|---|
| A group, its week and plans | Its members (the invite link is the secret) | Members change their own hours and answers. Only the admin renames, archives, removes or promotes | `currentMember()` (identity.ts), `isAdmin()` (manage.ts) |
| Others' hours that week | Only members who have answered that week | Each member, their own only | `hasAnswered()` (blind.ts, ADR 10) |
| A public event | Anyone with the link, and Explore | Its host edits, invites and cancels. Anyone signed in answers for themselves | `canSee()` (events.ts) plus a `hostId` check |
| A private event | Its host and the people invited | The same as a public event | `canSee()` |
| A plan's comments, reactions, polls, photos | Whoever can see the plan | You speak only as yourself. An author deletes their own, and an event's host can delete any on their event | `openThread()` (talk.ts) |
| A profile and its friends | You | You | `currentPerson()` |
| The live stream | Each topic is authorised like its page. One refused topic refuses the stream | Nobody: it carries no data (ADR 6) | `authorise()` (api/live.ts) |

A few cross-cutting rules sit on top of the table:

- **The server decides who you are.** No form field names the actor. Your
  member or person id comes from the cookie, so you can't save hours, answer
  or comment as someone else by editing the form.
- **A refusal is logged.** A 403/404/409 for an access reason goes through
  `refuse()` or `deny()` (activity.ts) as `denied (reason)`. One person
  failing to change another's thing is a line in `flyctl logs`.
- **Ids that open things are secrets.** A group's id is its invite, an
  event's share id opens a private event, and a friend code lets someone
  friend you. None of them is ever logged, and none is ever handed to
  someone who didn't already supply it.
- **Same-origin posts only.** Astro's origin check refuses cross-site form
  posts, and `allowedDomains` names the Fly domain so that check works
  behind Fly's proxy.

## Consequences

- Holding the invite link is enough to join a group. That's the brief's "joining
  costs a name" (README), and the trade-off is that a leaked link admits
  anyone. The admin can remove a member, and a removed member can't rejoin
  under the same profile.
- "Can see it" and "can change it" are separate questions, and each route
  answers both. An archived group's plans can be read but not added to.
- Review caught gaps that no single-browser test would have shown:
  - The first logging pass wrote invite ids and share ids into every line.
  - A signed-out request could turn person ids into friend codes.
  Both are fixed, and each fix came with a test that was red first:
  `spec/activity.test.ts`, `spec/security.test.ts`.
- The rules are tested over HTTP, as a stranger, a member, a host and a
  guest. Those tests are `spec/coverage.test.ts`, `spec/events.test.ts`,
  `spec/blind.test.ts` and `spec/activity.test.ts`. The quality floor visits
  every page in every one of those states (`spec/routes.ts`).
