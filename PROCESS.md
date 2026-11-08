# Process overview

Every prompt I typed ("prompt N") is in
[`docs/prompt-history.md`](docs/prompt-history.md), marked "own" for
my calls and "R" where I took the agent's recommendation.

## How I approached this project

In my experience, AI agents are good at producing a promising, attractive
first version, so I used that on purpose. I started Hangout from my
general idea (prompt 3), then made bolder requests on top of it: a
redesigned interface, events, friends, comments and live updates, with
eight features built in one evening (prompts 6 to 12,
[`6671f9f...b616093`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/6671f9f...b616093)).

When I asked the agent how to reach a HD (prompt 17), it pushed back: the
app had outgrown my original idea, so it advised cutting features. I
thought the new additions had improved the app, so instead I had the README's
definition of "good" rewritten around everything I'd added
([`fd47b33`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd47b33)).
From its proposals I also chose the blind grid, which hides the group's
week until you've answered
([`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284)).

Up to then one agent wrote each feature and its own test, and twice a
test could pass without its feature (prompt 12). So once I was happy with
the app, I stopped building and had all the work thus far checked by a team of agents. One Opus 5.5
agent led, briefed and reviewed, with Sonnet 5.5 and Haiku 4.5 agents
doing the work. 

After fixing the issues found in the audit, I ran six read-only audits in parallel, from
security to the rubric, and the lead re-ran every finding before
accepting it (prompt 20,
[`0f9b10d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0f9b10d)).
Then eleven auditors judged the whole submission against the HD criteria
and each area's industry standard: OWASP, WCAG 2.2, Core Web Vitals and
Nielsen's heuristics (prompt 27,
[`4e59253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4e59253)).
The lead reproduced every key finding, and three didn't hold up: Memories
"showing too early" was correct behaviour. I gave each area of that report
its own agent to fix, red test first and reviewed before merging
(prompt 28), but the scope calls stayed mine: keep every feature but
justify each, and leave Fly's machine settings alone
([`86b5597`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/86b5597),
[`cf89632`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/cf89632)).
Last, I had agents rewrite the documentation by utilising my prompt history
(prompts 33 and 36).

## Rounds of review

On three occasions, I set up a team of agents to do a comprehensive audit/analysis of the work, each with an Opus lead reviewing
the findings. I did this because I found that the agent that wrote the code tends to defend its earlier decisions; questioning its design decisions often results in reassurance, whereas reviewer agents tend to be adversarial, finding issues the original agent's green tests had passed.

**Round 1, the crit 10 audit and fix (prompts 20 and 21)** was a good
outcome. Six audits ran at once, then fixers worked in separate worktrees.
Review caught a migration a fixer said it had checked, which would have
deleted every RSVP in production (reproduced, 3 RSVPs went to 0,
[`12e9694`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/12e9694)),
and logging that wrote invite links into the logs
([`e8026da`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e8026da)).
One agent checking its own work would have shipped both. The bad part was
parallel agents colliding: two branches made the same migration number
([`d2eba78`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d2eba78)).

**Round 2, the HD audit (prompt 27)**, only judged. Eleven auditors gave
me an honest score instead of a guess: about 74/100, a solid D
([`4e59253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4e59253)).
That was good even though the number was lower than I wanted, because it
came with a ranked list of what was holding me back. It also showed
auditors can be wrong: three claims didn't hold up when reproduced, so
nothing went in the report unchecked.

**Round 3, fixing the report (prompt 28)**, gave each area its own agent,
red test first. It was mostly good. Security went from no headers and 17
dependency advisories to all six headers and none
([`788917b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/788917b)),
and photos stopped leaking their GPS location
([`fd8cc47`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd8cc47)).
One agent found a link that froze the whole site, which I shipped alone,
ahead of the round
([`d2dc727`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d2dc727)).
Another showed round 2's accessibility scan had been too kind, passing
text at 4.41:1
([`f792d0a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f792d0a)).
Less good: one agent I stopped for budget had committed nothing, so a
single agent finished its work later (prompt 32), and one flaky test was
never proven cured.

Overall the teams were worth it. The cost was budget and my time
reviewing every diff, but that review is where most of the catches came
from.

## The pipeline and tests

The template's pipeline
([`ed72ded`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ed72ded))
builds the Docker image on every push to `main`, runs `pnpm check` against
it, checks the process evidence, scans for secrets, and deploys only if it
all passes. I grew what it checks. Lint joined typecheck and tests in
`pnpm check`
([`6e31644`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/6e31644)).
The HTTP spec suite carries crit 7's quality floor
([`2288e1b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/2288e1b)),
which skipped the group page until it built one each run
([`ffd3028`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ffd3028)).
Real-Chrome tests cover holding up
([`5cbb5c5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5cbb5c5))
and accessibility
([`dbd18cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/dbd18cf)),
and unit tests the pure logic
([`1d71657`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1d71657)):
39 test files and 581 tests by 22 Oct
([`ad8f5a6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ad8f5a6)).
For crit 10 every change logs who did what
([`5ee5766`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5ee5766)).
Production was snapshotted before risky changes (prompts 23 and 28), and
the crit tags mark
[`b663ce5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b663ce5),
[`a9d3270`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a9d3270)
and
[`a36b726`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a36b726).

## The stack, and why it beat the alternative

I kept crit 7's stack (prompt 2): server-rendered Astro and one SQLite file
on the Fly volume
([`96a3e37`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/96a3e37),
[ADR 1](docs/adr/0001-astro-and-sqlite.md)). A new framework might
suit real time better, but crit 8 was due the day after setup and I'd shipped
this one before. The cost is one machine and forms that reload. For real
time, the obvious move was pushing data to open pages, which would mean
writing every privacy rule twice. I approved a stream that only names what
changed, which pages re-read through the normal access rules
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).
A change reached another screen in 52 ms
([`61c49a3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/61c49a3)).

## The landing page is my README

I decided to make the app's landing page act as my README, because I
realised it would be a much more entertaining way to show off the app and
more useful to a visitor than a plain text file. My tutor, Bill, agreed,
and tests hold the page to its sources word for word
([`b3c7027`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b3c7027)).
I threw out the first version because it read like an assignment
([`f557001`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f557001),
[`39bf25c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/39bf25c)),
had it retold as four animated sections, then retitled so it didn't sound
like a rubric
([`7ed8c96`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/7ed8c96),
[`62aceee`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/62aceee)).
README.md now says so and links each course heading to its section
([`7e8a72e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/7e8a72e)).

## What I threw away

I dropped OAuth, which the agent warned my pod couldn't use (prompt 3);
the open grid, since people answer open polls strategically
([`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284));
a double-submit test that passed with its fix removed
([`047d3fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/047d3fa));
and the first landing-page README.

## Where I stand on the small web

Robin Sloan's home-cooked app is one "no one else will ever use", and Clay
Shirky's situated software is "designed for use by a specific social
group". I chose "any small group" (prompt 3), against both. My answer is
that each group's copy is situated, with its own link, names and week,
while the app stays general. I didn't read the course's small-games
writing closely enough to place Hangout against it.

## Who wrote what

I typed every prompt and made the calls marked "own". The agents wrote the
code, tests, commit messages and first drafts of these documents; every
non-merge commit after the template has a Claude co-author line. Calls
made without asking me include the rules added after each problem,
[ADR 9](docs/adr/0009-block-and-mute.md)'s block rules, and accepting
past-dated plans
([`a480bc3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a480bc3)).
