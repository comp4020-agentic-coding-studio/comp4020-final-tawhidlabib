# Process overview

How I got Hangout from the brief to the deployed app. Every prompt I typed
is in [`docs/prompt-history.md`](docs/prompt-history.md), marked
"own" where the call was mine and "R" where I took the agent's
recommendation; "prompt N" points there. This file was rewritten each crit
([`b663ce5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b663ce5),
[`3f08e38`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3f08e38),
[`e08fea0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e08fea0)).

## The calls I made

The idea and its core rule were mine (prompt 3). The agent offered a length
the group sets; I wrote "do the longest overlap with the ability to make
the hangout shorter", which became the recommendation
([`1925f3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1925f3f)).
It warned that writing into Google Calendar needs OAuth, and an unverified
app only works for listed test users, so my pod couldn't have used it. I
took links and an `.ics` file. It also suggested a smaller crit 8. I asked for everything,
and it was live that evening
([`4f83271...2889130`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/4f83271...2889130)).
The next day I deployed the redesign before the crit 8 session, against
its advice to wait
([`b663ce5...db452ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/b663ce5...db452ba)).

For crit 9 I picked the last spot at a full event as my decision, and
first-in-wins with a self-filling waitlist as the rule, each from four
unranked options. ADR 6 gives the reason: it's the only rule
where every tap gets an answer straight away
([`fd9fd67`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd9fd67)).

When I asked if it reached HD (prompt 17), the agent said it had become a
general social app and should cut features. I asked "can't we just edit
the readme's definition of good?" (prompt 18), because I thought it now
beat the simple version I'd planned. The features stayed and "good" became
a plan's whole life, in the README, `CLAUDE.md` and `spec/` alike
([`fd47b33`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd47b33)).
From its proposals I chose hiding the group's week until you've answered,
since two Doodle studies backed it: the blind grid
([`1256bbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1256bbd),
[`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284)).

The full audit I asked for (prompt 27) raised scope again
([`4e59253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4e59253)).
I chose "justify and tidy" (prompt 28): a README reason for each feature,
and the theme picker moved into `/me`
([`86b5597`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/86b5597),
[`71f8f03`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/71f8f03)).
I had the audit's test events deleted from production after a snapshot. I
left Fly's machine settings alone for the cold start, as a question for my
tutor, and a health check went in instead
([`cf89632`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/cf89632)).

## Stack, and why it beat the obvious alternative

I kept crit 7's stack (prompt 2): server-rendered Astro and one SQLite file
on the Fly volume
([`96a3e37`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/96a3e37),
[ADR 1](docs/adr/0001-astro-and-sqlite.md)).
A new framework might have suited real time better, but crit 8 was due the
day after setup, and I'd shipped this one once and it fits a 256 MB
machine. The cost is one machine, and forms that reload the page.

For real time the obvious move was pushing new data to every open page. In
the crit 9 plan I approved, the stream only names what changed, and the
page re-reads it through the normal access rules
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).
Pushing data would have meant writing every privacy rule twice. A change
reached another screen in 52 ms in production
([`61c49a3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/61c49a3)).

## Workflow, and what it cost

For crits 8 and 9 one agent built a feature at a time: a spec that starts
red, the feature, then a harness change
([`3b4e59e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3b4e59e),
[`c318a3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/c318a3d),
[`9ef4e6c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/9ef4e6c)).
It was fast, eight milestones in one evening
([`6671f9f...b616093`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/6671f9f...b616093)),
but one agent wrote each feature and its test, and twice a new test could
have passed without its feature (prompt 12).

For crit 10 and the final round I asked for a team (prompts 20 and 28):
one Opus agent writing briefs and reviewing every diff, the others in
separate worktrees, merged into a branch that had to pass before `main`
([`0f9b10d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0f9b10d),
[`0713984`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0713984)).
Review caught work agents had called done: a migration that would have
deleted every RSVP in production (3 RSVPs went to 0 when reproduced)
([`12e9694`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/12e9694)),
and a phone tab bar still hiding 96 px
([`bc4f8c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/bc4f8c3)).
The cost was collisions, like two branches with one migration number
([`d2eba78`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d2eba78)).
When my weekly budget ran low (prompt 29), I paused with nothing half-done
on `main` and every brief saved, then resumed
([`3bca8ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3bca8ef)).

## Failures fixed in the harness

`CLAUDE.md` came forward from crit 7 (prompt 2,
[`e6eb352`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e6eb352))
and says to write down what the work teaches, so failures went into it or
the checks instead of being retried:

- The checks never visited the group page; now they build one each run
  ([`ffd3028`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ffd3028)).
- Reaction tests failed while curl showed the app was right: JSDOM can't
  match emoji in a selector
  ([`f681fc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f681fc2)).
- The first double-submit test passed with its fix removed, so "prove a
  check can fail" became a rule
  ([`047d3fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/047d3fa)).
  The calendar hotfix later went red again with its fix reverted
  ([`d2dc727`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d2dc727)).
- The first logging pass leaked invite links, so ids that open things now
  count as secrets
  ([`e8026da`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e8026da)).
- A broad `pkill` killed other agents' servers, so the final round's brief
  says to stop them by port only
  ([`3bca8ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3bca8ef)).

## How I knew it was right

Asking if crit 10 was finished (prompt 22) found the work merged but never
pushed. Asking about other devices (prompt 26) got a three-device run on
the live site, and link previews for invites
([`a36b726`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a36b726)).
A stray comma in the grid headers was found by reading the page
([`1cb87cb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1cb87cb)).
Rehearsing crit 10 from the log alone showed a refused edit reading as if
it had happened, so refusals now read "tried to"
([`1c56cf9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1c56cf9)).
A flaky test never reproduced, so I can't say it's fixed
([`ad8f5a6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ad8f5a6)).

## What I threw away

OAuth went, and the open grid, since in open Doodle polls people approve
what already looks popular
([`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284)).
So did the first double-submit test, and audit claims that didn't hold up:
two in crit 10 (prompt 20) and three in the final audit
([`4e59253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4e59253)).

## Where I stand on the small web

Robin Sloan's home-cooked app is one "no one else will ever use", and Clay
Shirky's situated software is "designed for use by a specific social
group". I chose "any small group" (prompt 3), which goes against both. My
answer is that each group's copy is situated, with its own link, names and
week, while the app stays general. I didn't read the course's small-games
writing closely enough to place Hangout against it.

## Who wrote what

I typed every prompt and made the calls marked "own". The agents wrote the
code, tests, commit messages and first drafts of these documents; every
non-merge commit after the template has a Claude co-author line. Some
calls were made without asking me: the rules added after each problem,
[ADR 9](docs/adr/0009-block-and-mute.md)'s block rules, and keeping
past-dated plans.
