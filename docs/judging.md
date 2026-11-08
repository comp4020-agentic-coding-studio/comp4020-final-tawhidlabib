# How Hangout's judged claims are judged

The README splits what "good" means into claims `spec/` **enforces** and
claims that can only be **judged**. This file is how the judged ones were
judged: what was measured, how the session with real people was run, what
counts as passing, and what the session found.

## The claims, and how each is judged

| Claim (README) | How it's judged | Passes if |
|---|---|---|
| **Beats the group chat**: a group gets from "we should hang out" to a plan | A real friend group plans a real hangout in Hangout instead of the chat (session below) | They reach a plan, in less time and fewer messages than their chat usually takes, and it happens |
| **Honest answers** (the blind grid, ADR 10) | Afterwards, ask each person whether the hours they marked were their real ones, and whether they'd have marked differently after seeing the group's | Most say they marked their real week and wouldn't have changed it; anyone who would have explains why |
| **Joining costs a name** | Time a newcomer from opening the invite link to marking an hour, on their own phone, with no help | Under a minute, with no questions asked |
| **Works on the phone in your pocket** | The session above, on people's own phones | Nobody needs a laptop, and nothing is cut off |
| **Holds up** (keyboard, resize, slow or dropped connection) | Enforced by `spec/holds-up.test.ts` in real Chrome. Judged by a keyboard-only pass by someone other than me | The keyboard pass completes the core flow unaided |

## Measured so far (by the agent, on the deployed app)

These are measurements, not judgements: they show the app *can* do the
thing, not that people *will*.

- **The core flow, two people, end to end:** 12 actions and about 4 seconds
  of machine time, on the live site, 13 Oct. One person starts a group, a
  second joins on a phone, both mark an hour, the first proposes the best
  time, the second says they're in and gets the calendar link. Three runs:
  4.1 s, 4.0 s, 4.4 s. People are slower than a script, so this is a floor,
  not a claim about human time.
- **Live updates:** one person's save reached another's open page in 52 ms
  (7 Oct) and 167 ms (13 Oct), on the live site.
- **Every page at both marking viewports** (390×844 and 1920×1080): no
  sideways scroll. Every keyboard stop is visible, with a focus ring.

## How the session with real people was run

The plan had three sessions. The one that ran is under Results: four
people, each using Hangout themselves, as a lighter version of Session 1.
It gathered what people thought rather than timings or message counts, so
those parts of the plan below weren't measured.

### Session 1: plan something real

1. Pick a real hangout your friend group actually wants to do this week or
   next.
2. Send the invite link to the group chat with one line: "let's use this to
   pick a time". Say nothing else about how it works.
3. Note the time. Don't help unless someone is stuck; if you do, write down
   what you said.
4. When it lands on a plan, note the time again, and count how many chat
   messages it took to get everyone to use the link.
5. After the hangout (or the day it was meant to be), ask each person the
   four questions below.
6. Run `node scripts/outcomes.ts /data/app.db` on the server
   (`flyctl ssh console`) for the numbers. It prints counts and durations
   only, no names.

### The four questions

1. Did you mark your real free hours, or what you thought would work for
   everyone?
2. When the group's week appeared, would you have changed anything? What?
3. Was anything confusing, or did anything not work on your phone?
4. Would you use this instead of the group chat next time? Why or why not?

### Session 2: a newcomer, cold

Give one person who's never seen Hangout only the invite link, on their own
phone. Time them from opening it to marking their first hour. Don't speak.

### Session 3: keyboard only

Ask someone to make a plan with only a keyboard: Tab, arrows, Space and
Enter. Note where they get stuck.

## Results

- Date: 21 October 2026
- Who: four people (P1–P4), each using Hangout themselves
- All four enjoyed using Hangout, and all four praised the UI and UX
- All four especially liked the animations, and found them informative
- P1 didn't like signing in with a private sign-in link; the other three
  thought it was fine
- P2 spent time on the events page and enjoyed it, especially the comments
  and reactions
- P3 liked that everyone puts in when they're free to hang out, which made
  planning easier than a group chat
- P3 also liked that the group's availability stays hidden while you put in
  your own, so it doesn't sway your choice; they believed seeing everyone
  else's first would have changed what they marked. This backs the blind
  grid (ADR 10), the "honest answers" claim above.
- What it showed: the core idea held up with real people. The one change
  it points to is the sign-in link, which one person in four disliked.
  Hangout has no passwords by design (README, "What I chose not to
  build"), so the link stays, as a known cost of that choice.
