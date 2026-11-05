# Process overview

Every prompt I typed ("prompt N") is in
[`docs/prompt-history.md`](docs/prompt-history.md), marked "own" for
my calls and "R" where I took the agent's recommendation.

## How I work

I build a lot fast, then stop and have it checked. For crit 8 the agent
suggested a smaller scope and I asked for everything, with my own rule for
picking a time: "do the longest overlap with the ability to make the
hangout shorter" (prompt 3,
[`4f83271...2889130`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/4f83271...2889130)).
On 7 Oct I had eight milestones built in one evening
([`6671f9f...b616093`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/6671f9f...b616093)).
I find this method to be effective, especially with design, as AI is incredibly good at creating minimum viable products. It often produces what looks like an amazing response to the initial prompt with many issues outside of the basic use case.

I make the product calls and delegate the building. When the agent said
Hangout should lose features (prompt 17), I asked "can't we just edit the
readme's definition of good?" (prompt 18), because I thought the bigger app
was better. The features stayed and "good" became a plan's whole life
([`fd47b33`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd47b33)).
I picked the blind grid from its proposals as a "perfect idea backed by
research"
([`33d4284`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284)).

I keep asking whether it's done, HD, and works across devices (prompts 15,
17, 22, 26); asking found crit 10 merged but never pushed. I paused for my
weekly budget with nothing half-done on `main` (prompt 29,
[`3bca8ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3bca8ef)).
I kept two rules: spec tests start red
([`e6eb352`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e6eb352)),
and every new check is made to fail once
([`047d3fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/047d3fa)).

## Rounds of review

Up to crit 9 one agent wrote each feature and its test, and twice the test
could pass without it (prompt 12). For crit 10 I asked for a team
(prompt 20): one Opus agent briefing and reviewing, Sonnet and Haiku agents
working. Six read-only audits came first: state integrity, security, live
updates, front end and accessibility, test quality, and the rubric. Each
fix then ran in its own worktree, red test first, merged into a branch that
had to pass before `main`
([`0f9b10d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0f9b10d),
[`0713984`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0713984)).

Then I asked for "1 agent per thing to judge" (prompt 27): eleven
auditors, one per area from security to UX and UI, judged against the
rubric and OWASP, WCAG 2.2, Core Web Vitals and Nielsen
([`4e59253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4e59253)).
I had one developer agent per area fix the findings, red first and
reviewed before merging (prompt 28). The scope calls stayed mine: keep
every feature but give each a reason
([`86b5597`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/86b5597)),
and leave Fly's machine settings alone
([`cf89632`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/cf89632)).

This beat one agent checking its own work because review caught what the
builders' green tests passed. A migration reported as checked would have
wiped every RSVP in production; reproduced, 3 RSVPs went to 0
([`12e9694`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/12e9694)).
The first logging pass leaked invite links
([`e8026da`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e8026da)).
A phone tab bar reported fixed still hid 96 px
([`bc4f8c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/bc4f8c3)).
One calendar link froze the server, so that fix shipped alone, ahead of the
round (prompt 30,
[`5e444a6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5e444a6)).
The audit's own accessibility scan passed text at 4.41:1, so the new check
tells axe where to look
([`f792d0a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f792d0a)).

The costs were budget and collisions: two branches made the same
migration number
([`d2eba78`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d2eba78)),
and a broad `pkill` killed other agents' servers, so later briefs stop
servers by port
([`3bca8ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3bca8ef)).
I had claims reproduced before accepting them: five audit claims
didn't hold up (prompts 20 and 27), and reading crit 10 from the
log alone showed a refused edit reading as done, so refusals now say
"tried to"
([`1c56cf9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1c56cf9)).
I had this file, rewritten each crit
([`3f08e38`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3f08e38),
[`e08fea0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e08fea0)),
marked against the HD band (prompt 33,
[`ed7e85f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ed7e85f)).

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
