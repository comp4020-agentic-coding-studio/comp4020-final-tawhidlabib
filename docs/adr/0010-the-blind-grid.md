# 10. The blind grid: your honest week before the group's

Date: 2026-10-13 · Status: accepted

## Context

Hangout's recommendation is only as good as the hours people mark. The grid
showed everyone's hours as you marked yours, the way When2meet and an open
Doodle poll do. Research on real scheduling polls says that changes what
people answer.

[Zou, Meir & Parkes, "Strategic Voting Behavior in Doodle Polls"](https://dash.harvard.edu/handle/1/33009592)
(CSCW 2015) analysed over 340,000 Doodle polls, comparing *hidden* polls
(you can't see others' answers) with *open* ones. In open polls, responders
are more likely to approve slots that are already very popular or very
unpopular, and avoid the uncertain middle. Their model: people approve their
real preferences *plus* "safe" choices, to appear cooperative.
[Reinecke et al., "Doodle Around the World"](https://dash.lib.harvard.edu/handle/1/12561360)
(CSCW 2013), across more than 1.5 million polls from 211 countries, found
that "poll participants from collectivist countries respond earlier, agree to
fewer options but find more consensus". How people answer is shaped by
social norms, not only by when they're free.

For Hangout, that means an open grid gets the group's *performed*
availability, not its real availability. The README's second point, "it
answers the question, honestly", can't hold if the answers themselves aren't
honest.

(I confirmed both papers' authors, titles and venues against Crossref and
the papers themselves. The Reinecke quote is from its abstract. The Zou
finding is from its abstract, as summarised by its Harvard record.)

## Options

1. **Open grid** (what it was): see everyone's hours while you mark yours.
   Fast and sociable, but it's the open-poll setting the research warns about.
2. **Blind until you've answered, per week.** You mark your own hours first,
   then the group's week appears. "None of these work" counts as answering,
   so nobody has to fake an hour to see the group.
3. **Blind until everyone has answered.** The most honest, but the group's
   week can stay hidden indefinitely behind one quiet member, which works
   against "beats the group chat".

## Decision

**Option 2.** It removes the moment of influence (seeing others while you
answer) without making anyone wait on anyone else.

**How it's enforced.** On the server, not in the page:
- Until you've answered for a week, the group page reads **only your own
  hours** from the database. Heat, counts, names, best times and
  Everyone's week are all derived from data that simply isn't loaded.
- `/groups` and the home dashboard show a best time only to someone who has
  answered for that week. A test caught them leaking it, and they were
  fixed.
- The live stream carries no data at all ([ADR 6](0006-the-last-spot.md),
  `CLAUDE.md`), so it can't leak either.
- Your first answer reveals the week in place, with a fade-in.

`spec/blind.test.ts` holds the rule, including that `/groups` and home
don't leak the best time early.

## What it costs

- **A little friction for the eager.** Someone who wants to see when
  everyone's free before committing to anything now has to answer first.
  "None of these work" is the escape hatch, and seeing the group's week only
  after answering is the point.
- **Changing your answer after seeing the group is still possible.** Blind
  first answers don't stop someone revising toward the crowd later. We
  accept that: the first, uninfluenced answer is what the design protects,
  and people revising for real reasons (a plan fell through) shouldn't be
  stopped.
- **We haven't measured honesty in Hangout itself.** The design rests on
  published findings about Doodle, not on Hangout's own data. The README
  says this claim is *judged*, and how.
