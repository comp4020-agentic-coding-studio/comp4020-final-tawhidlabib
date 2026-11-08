# Process overview

Every prompt I typed is in
[`docs/prompt-history.md`](docs/prompt-history.md), marked "own" for
my calls and "R" where I took the agent's recommendation.

## How I approached this project

In my experience, AI agents are good at producing a promising, attractive
first version. I started Hangout from my
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

Then I ran an audit round where I ran six read-only audits in parallel, from
security to the assignment marking criteria, and the lead agent re-ran every finding before
accepting it (prompt 20,
[`0f9b10d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0f9b10d)).
Then eleven auditors judged the whole submission against the HD criteria
and each area's industry standard(prompt 27,
[`4e59253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4e59253)).
The lead reproduced every key finding, and ensured three incorrect findings did not reach production. I gave each area of the resulting report
its own agent to fix, red test first and reviewed before merging
(prompt 28).

Last, I had agents rewrite the documentation by utilising my prompt history (prompts 33 and 36). I found that the agents did not do a good job at illustrating my process in creating the app but it provided me a good foundation to improve upon with my own input.

## Rounds of review

On three occasions, I set up a team of agents to do a comprehensive audit/analysis of the work, each with an Opus lead reviewing
the findings. I did this because I found that the agent that wrote the code tends to defend its earlier decisions; questioning its design decisions often results in reassurance, whereas reviewer agents tend to be adversarial, finding issues the original agent's green tests had passed. A manager agent was useful in fact-checking each sub agent's findings.

**Round 1 (prompts 20 and 21)** was a good
outcome. Six audits ran at once, then fixers worked in separate worktrees.
The review caught a migration a fixer agent said it had checked, which would have
deleted every RSVP in production (reproduced, 3 RSVPs went to 0,
[`12e9694`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/12e9694)),
and logging that wrote invite links into the logs
([`e8026da`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e8026da)).
One agent checking its own work would have shipped both issues. The bad part was
parallel agents colliding: two branches made the same migration number
([`d2eba78`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d2eba78)).

**Round 2, the HD audit (prompt 27)**, only reviewed the code. Eleven auditors gave
me a grade against the marking criteria.
([`4e59253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4e59253)).
This was useful as it provided me a ranked list of what was holding my project back. It also demonstrated the importance of a more powerful agent
with the role of manager as it identified three claims that didn't hold up when reproduced, so
nothing went in the report unchecked.

**Round 3, fixing the report (prompt 28)**, gave each area its own agent,
red test first. Security went from no headers and 17
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
In this case, assigning separate agents allowed each to focus on security, performance, correctness and edge cases, test coverage, dependency risks, accessibility, maintainability, and so on. Providing each agent a narrow brief results in deeper analysis than “review everything” assigned to one agent.

## The Stack

**Astro, rendered on the server,** means every save is a plain form that
works even with JavaScript off
([`7bca623`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/7bca623))
The server decides who is the user and what they may see, in one place.

**SQLite, one file on the Fly volume,** fits because a friend group's data
is small. A separate database server would add a machine and a network
hop for no gain, while one file survives redeploys. Its library,
better-sqlite3, also runs every write in order, one at a time, which makes
Hangout fair: when two friends tap Going on the last spot at once, exactly
one gets it, with no locking code of my own
([`fd9fd67`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd9fd67)).

**Real time** uses server-sent events, because updates only flow one way:
friends save by form and just need to see each other's changes. Each live
part of a page has a topic; when it changes, the server sends only the
topic's name, never the data, and each open page re-reads that part
through the same access rules
([`5c1013a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5c1013a)).
A change reached another screen in 52 ms
([`61c49a3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/61c49a3)).

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
40 test files and 593 tests by 22 Oct
([`ad8f5a6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ad8f5a6)).
For crit 10 every change logs who did what
([`5ee5766`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5ee5766)).
Production was snapshotted before risky changes (prompts 23 and 28), and
the crit tags mark
[`b663ce5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b663ce5),
[`a9d3270`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a9d3270)
and
[`a36b726`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a36b726).

## The landing page is my README

I made the app's landing page my README, because I realised it would be a
much more entertaining way to show off the app and more useful to a visitor
than a plain text file. My tutor, Bill, agreed. I threw out the first
version because it read like an assignment
([`f557001`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f557001)),
and README.md now links each course heading to its section
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

** Note that I used Claude to help me write this process.md file **
