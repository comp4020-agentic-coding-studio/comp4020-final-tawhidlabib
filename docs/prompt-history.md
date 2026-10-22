# Prompt history: the Hangout final project

This is every prompt I gave the agent (Claude Code, Opus 5.5) during the
final project, from setting up the repo for crit 8 to the HD push after
crit 9. Each prompt is quoted **exactly as I typed it**, typos included. Under
each one:
- the questions the agent asked and **what I answered**
- **what resulted**: decisions, commits, deploys
- anything that went wrong or got corrected along the way

It's raw material for the final `PROCESS.md`, so it's more complete than a
process overview should be.

**How to read the answers.** When the agent asked a multiple-choice
question, it sometimes marked one option as recommended.
- **(R)**: I picked the option it recommended.
- **(own)**: I wrote my own answer, picked against its recommendation, or
  picked where it made no recommendation.

Being honest about which is which matters when the crit asks how I
*directed* the work.

**Citing commits.** Hashes below are commits in this repo. In `PROCESS.md`,
link one as
`https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/<hash>`
and a range as `.../compare/<from>...<to>`. A table of ready-made ranges is at
the end.

---

## Crit 8: "It's alive!" (cutoff Wed 7 Oct, 12:00)

### Prompt 1 · Tue 6 Oct, ~12:50 · setting up the week

> `/comp4020:start`

- I interrupted the agent's first command, then ran the skill again.
- The agent worked out the target from the date, landed on **crit 9**, and
  found the final-project repo still held only the template's first commit.
- I rejected its first round of questions to clarify things myself (prompt 2).

### Prompt 2 · Tue 6 Oct · correcting the target

> the target should be crit 8 "It's Alive!". My group is Yúnlín for the
> wednesday 12:00 cutoff

**A correction I made.** The agent had followed the date arithmetic, but the
crit 8 setup had never happened, so crit 8 was the real target. My answers
to its follow-up questions:

- Save Yúnlín as my group permanently: **yes (R)**
- Carry the harness forward from `comp4020-crit7-tawhidlabib`: **yes (R)**
- Stack: **keep crit 7's** (Astro + SQLite) **(own)**
- Apply all the proposed `CLAUDE.md` changes: **yes (R)**
- Carry crit 7's quality checks forward as my own: **yes (R)**
- Commit the setup as three commits: **yes (R)**
- Add the README test now, and the core-flow test later: **yes (R)**

**Result**
- The repo was cloned and `CLAUDE.md` carried forward from crit 7. Every
  rule was kept, and the facts the final template made untrue were updated
  ([`e6eb352`]).
- The stack was carried over and adapted to port 8080 and the template's
  Docker image ([`96a3e37`]).
- Crit 7's accessibility and structure checks came across as my own
  sensors ([`2288e1b`]).
- The first crit 8 test went in, starting red ([`4f83271`]).

### Prompt 3 · Tue 6 Oct, afternoon · the idea

> What do I need to do for this crit? I would like my app to be based called
> "Hangout" where you can create "friend-groups" and say what days of the week
> at which times you are free to hangout in that week with that friend group.
> The app will recommend hangout times to the group; you can say agree to come
> to hangouts and if you do agree, it can get added to your google calendar.
> ask me questions wherever you need more info. Use opus 5.5 as the model for
> the rest of this chat and work

**The agent pushed back on two things before building:**
1. Writing straight into Google Calendar needs Google sign-in (OAuth), and
   until Google verifies the app, only listed test users can use it. My pod
   would hit a wall at the crit.
2. Crit 8 only checks for signs of life, so it suggested a smaller scope.

**My answers**
- Who counts as a person: **name and invite link (R)**
- Google Calendar: **add-to-calendar link, no OAuth (R)**
- Crit 8 scope: **"Everything incl. calendar" (own)**, against its
  recommendation of groups, availability and overlap only
- Who it's for: **any small group (own)**, with no recommendation offered
- How long a hangout is: **"do the longest overlap with the ability to make
  the hangout shorter" (own)**, my own rule instead of its "group sets a
  length" option. This became the core recommendation logic.
- The grid: **1-hour slots, 8am to midnight (R)**
- Turning a time into a plan: **anyone proposes, everyone RSVPs (R)**
- The Fly token: **yes, I have it**
- I approved the build plan.

**Result**
- flyctl was installed.
- The data model went in ([`ca78b9c`]), then the core-flow tests, written
  red first ([`5da247f`]).
- The app went in under those tests:
  - starting a group, joining by link, marking hours ([`e4d2810`])
  - recommendations, proposals, RSVPs, Google Calendar links and `.ics`
    files ([`1925f3f`])
  - copying the invite, unsaved changes, drag to paint ([`2889130`])
- **Caught by reading the rendered page, not by a test:** the `en-AU` date
  format put a stray comma in the grid headers ("Tue," over "8")
  ([`1cb87cb`]).
- **The checks had a blind spot:** the quality checks only visited `/` and
  `/readme/`, never the group page people actually use. The fix makes a
  fresh group on each run so the checks see it ([`ffd3028`], [`93adb55`]).

### Prompt 4 · Tue 6 Oct, evening · the documents

> give me the file path for mise.local.toml for me to update. write up readme
> and process.md and reflections for my crit, I will change it later for my
> assignment submission but I would like my crit to be marked and pass all the
> checks

**Result** ([`b663ce5`])
- The agent gave me the path and wrote `README.md`, `PROCESS.md`, ADRs 1–3
  and `reflections/crit-8.md`.
- **Sources were checked against the real text.** Robin Sloan's essay was
  confirmed. Clay Shirky's own site was down (it showed a DreamHost "Site
  not found" page), so the README cites a mirror whose quotes were checked.
- The agent added a **"Who wrote what"** section to `PROCESS.md` without my
  asking, saying it drafted these documents.
- The README was kept inside the 400–600 word limit.

### Prompt 5 · Tue 6 Oct, evening · shipping crit 8

> I have updated the mise.toml file. Please complete the crit

- **A near miss.** I put the Fly token in `mise.toml`, which git tracks, under
  `[tools]`, instead of the ignored `mise.local.toml`. The agent caught it
  before anything was committed, moved it to `mise.local.toml` under
  `[env]`, and restored `mise.toml`. The secret scans before going public
  and in CI both came back clean.
- First deploy, by hand. A two-person check on the live site passed, and
  data survived a machine restart.
- Preflight found no blockers. Asked to confirm making the repo
  permanently public, I answered **"Yes, ship it now"**.
- Repo made public, CI checked and deployed it, and **`crit-8` was tagged at
  [`b663ce5`]**.

---

## Between crits: the interface

### Prompt 6 · Wed 7 Oct, ~13:00 · tabs, a call to action, themes

> i would like you to make the UI very modern with good user experience. there
> should be different tabs for different functionalities. there should be a
> call to action. Allow users to change the theme of the website to different
> colours.

**Result** (on a branch, not yet live)
- The theme picker's test, written red first ([`ad1626f`]).
- Five colour themes plus Auto, Light and Dark, rendered by the server so
  there's no flash of the wrong colours ([`c4a90b7`]).
- Group page tabs, a next-step banner, and a front page with a call to
  action ([`f6f1554`]).
- The agent pointed out crit 8 was at 14:00 and **recommended merging only
  after the crit**, so my pod would see the marked version.

### Prompt 7 · Wed 7 Oct, ~13:26 · animations and branding

> I want the UI to be more interesting with nice animations and branding.
> Currently it is very basic with basic buttons for functionality. I need the
> user to have a good experience and want to use the website.

**Result**
- **Brand:** "Find the overlap", with a logo of three overlapping circles,
  Bricolage Grotesque and Inter fonts (self-hosted), and a favicon.
- **Motion:** a looping demo in the hero, toasts and confetti after actions,
  a sliding tab indicator, and animated cards and grid cells
  ([`67c5986`], [`14ec06b`]).

### Prompt 8 · Wed 7 Oct, ~13:40 · white background, then deploy

> Please change the very background colour to white and then you can merge
> after doing that to main so it will be on the live production

**Result**
- The light-mode page became white ([`db452ba`]).
- Merged and **deployed at about 13:41, before the 14:00 crit 8 session**.
  That was my call, against the agent's suggestion to wait. The `crit-8` tag
  stayed on the marked version.

---

## Growing the app (toward crit 9)

### Prompt 9 · Wed 7 Oct, afternoon · events, friends, navigation, calendar, groups

> I would like to create a facebook events style feature where you can create
> an event and make it public or private and invite your friends. I would like
> the ability to add friends as well. I would like a modern navigation bar with
> animations. I would like a page showing your calendar of upcoming hangouts. I
> would like a page where you can see your friend groups and then click and go
> into a friend group to see the users, everyone's hangout availabilities and
> anything else that is necessary.

**The agent flagged a design problem first:** a person only existed inside
each group, and friends, a personal calendar and invites all need someone
who exists across groups. My answers:
- How a person exists: **a profile, no password, with a private sign-in
  link (R)**
- Adding friends: **a friend link plus accepting (R)**
- Event visibility: **public or private (R)**
- The calendar: **month grid plus agenda (R)**
- I approved the plan.

**Result** ([`4f3f0cb`]...[`d8f5f97`])
- Eleven contract tests, written red first ([`4f3f0cb`]).
- Profiles and the animated navigation bar ([`116cc91`]).
- Friends ([`8d9c635`]).
- The groups page, and a People tab showing everyone's week ([`0746168`]).
- Events ([`eae8f4e`]), the calendar ([`df7f501`]), and a signed-in home
  page ([`2f3cf7a`]).
- The quality checks now cover every page, signed in or not ([`66e58b3`]).
- **ADR 4** (profiles, replacing ADR 2's per-group identity) and **ADR 5**
  (event visibility), and the README brought up to date ([`d8f5f97`]).

### Prompt 10 · Wed 7 Oct, ~17:00

> continue working

**Result:** the agent carried on with the same approved plan through to the
deploy.

### Prompt 11 · Wed 7 Oct, ~20:55 · comments and reactions, and feature ideas

> on every event i would like an option for users to add comments to the event
> and reactions. There should also be an option to add comments and reactions
> to other planned hangouts. please suggest more features and functionality to
> add to the website

**Result** ([`cf5438b`]...[`6671f9f`])
- Comments and reactions on every event and hangout ([`52ab670`]).
- **A correction worth telling at a crit:** the reaction tests failed while
  the app was right. Checking the running app with curl showed the reactions
  saved and displayed. The cause: the test library (JSDOM) can't match emoji
  like 🎉 in a CSS selector. The test's lookup changed (what it checks
  didn't), and the trap went into `CLAUDE.md` ([`f681fc2`]).
- The agent suggested ten more features, with live updates first because
  crit 9 requires them.

### Prompt 12 · Wed 7 Oct, ~21:10 · live updates and everything else

> yep deploy to main. I would also like to add live updates for crit 9 with all
> of your idea dot points below it. I would like a notification inbox, polls on
> plans, and all the event extras, group management, smarter availability,
> after the hangout, profiles. I would like all of these features to be added

**My answers to the agent's questions**
- The several-people decision to defend at crit 9: **the last spot at a full
  event (own)**, chosen from four options with no recommendation.
- The rule for it: **first in wins, and the waitlist fills itself (own)**,
  chosen from four rules with no recommendation.
- Photos: **uploaded to the app (R)**
- Notifications: **an in-app inbox, live (R)**
- Deploying: **each milestone as it lands (R)**
- I approved the eight-milestone plan.

**Result:** eight milestones, each a red test, then the feature, then a
harness commit, then a deploy.
- **M1, live updates and the waitlist** ([`e3d7473`]...[`fd9fd67`]):
  - server-sent events, where the stream carries only *which* topic changed
  - the grid saves as you tap, and "here now" avatars show who's looking
  - the waitlist decided inside one database transaction
  - **ADR 6** records the decision
  - in production, a change reached another screen in **52 ms**
- **Crit 9 documents:** `PROCESS.md` rewritten and `reflections/crit-9.md`
  drafted ([`3f08e38`]). **`crit-9` tagged.**
- **M2, inbox:** [`dfebbd1`]...[`0cf3ac2`]
- **M3, polls:** [`3b4e59e`]...[`9ef4e6c`]
- **M4, event extras:** deadlines, covers, filters, spots left, host
  editing ([`93b8107`]...[`78c49c9`])
- **M5, group management:** [`66a8c92`]...[`d6ca44c`]
- **M6, smarter availability:** [`b42ba75`]...[`0531aa8`]
- **M7, photo memories and ratings:** [`666b3be`]...[`b856d47`]. A real
  upload was checked on the live site, and strangers got 403.
- **M8, avatars, bios, block and mute:** [`bbe0698`]...[`d0ff703`]
- **The docs** caught up with all of it ([`b616093`]).

**Corrections during this run**
- A failing test showed Explore listed only the soonest 30 public events,
  which is a real limit in production too. Search went in instead
  ([`91a9733`]).
- Two new tests could have passed without their feature (matching an older
  notification, or a form that no longer existed). Both were tightened
  before their spec commits.
- Picking an avatar photo did nothing with JavaScript on, because the
  upload handler lived in the album component. Reading the code caught it,
  not a test ([`c594a35`]).

### Prompt 13 · Thu 8 Oct, ~00:05 · logo and logging out

> when you press the hangout logo in the top left i want the app to take you to
> the original home page that you see before logging in. I also want a log out
> button in the settings please make these changes and push to production

**Result** ([`6b1e6ef`]...[`f8e9dd0`])
- The logo now goes to `/welcome`, the original landing page, signed in or
  not.
- There was no separate settings page, so **the agent put Log out on the
  profile page (`/me`)**. It forgets you on that device, and because there's
  no password, it reminds you to keep your sign-in link first.
- Deployed, and `crit-9` moved to include it.

### Prompt 14 · Thu 8 Oct, ~00:20 · updating every document

> please update all the documentation (process.md reflection e.t.c) with all
> the new work that has been done and commit and push the updates. I will
> review it later

**Result** ([`c3bf3c5`], [`a9d3270`])
- `PROCESS.md` was rewritten to cover everything since crit 8, and the
  crit 9 reflection was extended.
- **ADRs 7–9** were added: notifications, photos, and block and mute. **The
  agent designed ADR 9's rules**, so check you agree with them.
- `CLAUDE.md` gained rules for live updates and uploads.
- `spec/README.md` gained an index of which test holds which promise.
- `crit-9` moved to this commit.

### Prompt 15 · Tue 13 Oct, 11:45 · is crit 9 finished?

> what do I have to do to complete crit 9? I want it finished to be marked

**Result**
- Preflight found **no blockers**. A fresh check on the live site measured
  **167 ms** from one person's save to another person's screen.
- What's left is mine:
  1. rewrite the reflection in my own words
  2. be ready to defend ADR 6 against the three rules I didn't pick
  3. prepare the "directed, grounded, corrected" story
  4. try it live with a friend

### Prompt 16 · Tue 13 Oct · this file

> Please create a new file that contains all of my prompt history for this
> entire major project with notes on what resulted from the prompt. I will
> later use this file to create a better process.md when my final project is
> due.

**Result:** `docs/prompt-history.md`, this file.

### Prompt 17 · Tue 13 Oct · is it HD?

> Please help me brainstorm more ideas to make the project even better, I
> would like to achieve a HD grade for the major project and I am unsure if
> the project clearly reaches that mark yet

**Result**
- The agent read the published rubric and band descriptors first, rather
  than guessing.
- Its honest read: process at D to HD (the risk being documents the agent
  wrote), the app at D–Cr (nothing tested the HD band's own examples), and
  **response to the brief the biggest risk**. HD wants "one idea, carried
  all the way", and the app had grown into a general social app.
- It recommended **cutting features** as the HD move, and proposed a
  research-backed design change: hide the group's week until you've
  answered, citing two scheduling studies it checked were real.

### Prompt 18 · Tue 13 Oct · my calls on each part

> for the response to the brief (part A), can't we just edit the readme's
> definition of good? Because I think what it is right now is better than the
> simple features intially planned. For part B, the research designed choice,
> I believe that is a good decision, hiding it until they have answered is
> perfect idea backed by research. You can complete part C for me. For part
> 2, the deployed app, I want you to do all your suggestions to get that
> criteria to a HD standard. For part 3, I will work with you to rewrite the
> process and reflection using my entire prompt-history file when i'm done
> with the project and I will rewrite it in my own words where applicable;
> i'll do this later.

**My calls**
- **Keep the features (own)**, against the agent's cut-features advice:
  reframe the definition of good so every feature serves one idea instead.
  The agent agreed this works if the README, `CLAUDE.md` and `spec/` all
  say the same idea, and built it that way: **a plan's whole life**.
- **The blind grid: yes (own)**, an idea the agent proposed and I chose.
- Part C and Part 2 delegated to the agent. The agent said what it could
  and couldn't do for Part C: it can't survey my friends, so it measured
  what it could and built the kit for my sessions.

**Result** ([`1256bbd`]...[`fd47b33`]), on a branch, not deployed until
after the crit 9 session:
- **The blind grid**, red tests first ([`1256bbd`]), enforced on the server
  ([`33d4284`]). **ADR 10** records it.
- **Holds up**: a keyboard-driven grid, autosave that survives a bad or
  dropped connection, no double submits, and **seven real-Chrome tests** at
  both marking viewports ([`5cbb5c5`]).
- **`docs/judging.md`** and a read-only **`scripts/outcomes.ts`** for Part C
  ([`61c49a3`]). Measured on the live site: two people from link to
  calendar in 12 actions, about 4 seconds.
- **The README, `CLAUDE.md` and `spec/README.md`** rewritten around one
  idea ([`fd47b33`]).

**Corrections in this run, all at the harness level:**
- **A test that couldn't fail.** The first double-submit test passed with
  the fix removed: Chrome merges same-instant presses, and Playwright's
  click waits for the page to load. Rewritten, proved red without the fix
  and green with it, and the rule went into `CLAUDE.md`: **prove a check
  can fail** ([`047d3fa`]).
- **A race found by trying it.** Two people proposing the recommended
  time in the same second made two identical plans. Fixed to merge, with a
  red-first browser test ([`11db9fc`]).
- **A leak caught by a new test.** `/groups` and the home page showed the
  week's best time before you'd answered. The test's first version passed
  *vacuously*, because its hours were in a different week from the one the
  overview reads. It was rewritten to use the current week, then went red
  for the right reason before the fix ([`11b224c`]).
- **The page jumped on load**, putting a keyboard user's first Tab in the
  middle of the page. Found by walking every page's tab order in Chrome
  ([`11db9fc`]).

### Prompt 19 · Wed 14 Oct, ~16:00 · ship it, and the documents

> please push all the updates now that crit 9 has finished. I would also like
> you to update the process.md, the readme, and the reflection to hit a HD
> standard. the process.md write-up should be based on the prompt-history
> document.

**Result**
- The `hd` work was merged and deployed after the 14:00 session. CI ran all
  seven real-Chrome tests on its own Chrome, and they passed. **`crit-9`
  stayed on [`a9d3270`]**, the commit that was marked, because the cutoff
  had passed.
- This file was brought up to date, and `PROCESS.md`, the README and the
  crit 9 reflection were rewritten against the HD band descriptors.
  **These are still agent drafts; I'll rewrite them in my own words.**

### Prompt 20 · Sun 18 Oct · a team to audit it

> I want you to use sonnet 5.5 agents and haiku 5.5, with opus 5.5 as the
> leader/ coordinater/consultant/team leader to do a comprehensive analysis
> and bug fix of my major project to ensure that it hits HD criteria. Only
> use the one opus 5.5 agent and you can decide how many of the sonnet and
> haiku agents you need to get the best outcome. You will work as a tech
> development team together to polish and upgrade this major project

**Result**
- There was no Haiku 5.5, so the cheap model was Haiku 4.5. The one Opus
  agent led: it wrote every brief, reviewed every diff, and merged.
- **Six audits ran in parallel, read-only:** state integrity, security and
  access, live updates, front end and accessibility, test quality, and the
  rubric. The lead re-ran each finding before accepting it. Two of the
  rubric auditor's claims were wrong and were dropped:
  - "the README is over 600 words": it counted URLs, and the course count
    is 600;
  - "a missing crit-10.md fails CI": any crit reflection passes.

### Prompt 21 · Sun 18 Oct · keep going, start the fixes

> keep going, start the fixes

**Result**
- Each fix ran in its own git worktree with a red test first. The lead
  merged them into a `team-polish` branch and ran the full check there
  before anything went near `main`.
- **Logging for crit 10:** every endpoint now writes who did what, both to
  `flyctl logs` and to an `activity` table on the volume. Refusals are
  logged too.
- **The integrity fixes:**
  - asking for a +1 at a full event no longer costs you your spot;
  - clearing a spot limit empties the waitlist;
  - a plan outlives the person who proposed it;
  - a free stretch is announced once;
  - the same hour twice in one save no longer causes a server error.
- **The front end:**
  - the People tab no longer scrolls sideways on a phone (the test was red
    at 137 px first);
  - contrast across 5 themes in light and dark went from 36 axe violations
    to 0;
  - tap targets and the theme label were fixed.
- **Tests:** `textOf` now throws when nothing matches, so an absent element
  can't pass a "doesn't contain" check. New tests cover sign-in link
  rotation, host-only cancel, `.ics` access and the no-JavaScript path.

**Caught in review (the lead's corrections)**
- **The migration would have wiped production.** The integrity fix rebuilt
  the hangouts table. Drizzle runs migrations in a transaction, where SQLite
  ignores `PRAGMA foreign_keys=OFF`, so the rebuild's DROP would have
  cascade-deleted every RSVP and comment on the volume. The agent reported
  it had checked this on old data. The lead reproduced the loss (3 RSVPs →
  0), fixed `db.ts` to switch keys off before migrating, and added
  `spec/migrations.test.ts`, which was red, then green.
- **The log leaked the invite links.** The first logging pass wrote group
  ids (the invite secret) and private events' share ids into every line, and
  a newline in a form field could forge a whole log line. The fix: a one-way
  tag and the name instead of the id, and every field is cleaned. Both tests
  were red first, and the forging test went red again with the fix removed.
- **My own mistake:** a broad `pkill` of the server killed the agents'
  servers in other worktrees. That made one repro look like a different
  bug. From then on, servers were stopped by port only.
- **Friend codes for anyone.** A signed-out request with a person's id was
  redirected to their friend code. The lead found it while reading the
  endpoint, a Sonnet fixer closed it, and ids now reach only people you
  already know of. An open redirect (`/\evil`) went in the same pass.
- **Done wasn't done.** The front-end fixer reported the tab bar fixed
  without measuring it. A Haiku agent measured it in Chrome: 96 px still
  hidden at 390 px. Fixed with a red test first.
- **Crit 10, rehearsed.** Two people in separate cookie jars, read only
  from the log. It told them apart and showed every refusal, but a refused
  edit read "Sam edited event 9 → denied". Refusals now read "tried to".
- **A decision against a fix.** A fixer held back refusing plans dated in
  the past, because the memory tests make their past plans that way. The
  lead dropped it rather than add a test-only route to production, and
  deleted the skipped test, so it didn't read as a check.

**Result of the round**, merged and checked before anything shipped:
- **Security:** friend codes, the open redirect, archived groups refusing
  joins and nudges, nudge weeks limited, and form posts capped at 64 KB
  ([`40cf06e`]...[`00e09ad`]).
- **Live updates and plan rules:**
  - after the RSVP deadline you can still say "can't go", and the waitlist
    moves up;
  - a changed name or avatar reaches every page showing it;
  - event edits and cancellations reach every guest's own pages;
  - a vote for an option a poll doesn't have is refused
  ([`71b20d7`]...[`8e506cd`]).
- **Docs:** ADR 11 (who may see and change what), an ADR 6 note,
  `CLAUDE.md` rules, the README, and a `PROCESS.md` rewritten for crit 10.
- 28 test files and 447 checks, all passing, none skipped.

### Prompt 22 · Sun 18 Oct · is the crit also finished?

> is the crit also finished>

**Result**
- No. The work was merged locally but not pushed, so production still ran
  the 14 Oct version, with no activity logging. `reflections/crit-10.md`
  didn't exist yet. The agent laid out what crit 10 asks for against what
  was done.

### Prompt 23 · Sun 18 Oct · please finish off crit 10

> please finish off crit 10

**Result**
- `reflections/crit-10.md` drafted: 270 words, every claim from this round.
  **An agent draft; I'll rewrite it in my own words.**
- **A volume snapshot before deploying** (`vs_XK9ppxNyOL3tB44ODLO`),
  because this deploy ran the hangouts migration on real data. SSH into
  production was refused, so the agent couldn't count rows directly.
- **A test that fails one hour a week.** The first push for crit 10 went
  red in CI at 11:21pm on a Sunday. A blind-grid test built its best time
  from Sunday 11pm, the week's last hour. Once that hour starts, nothing
  is left to recommend, so the app was right and the test failed for the
  clock. It passed locally only because it ran before 11pm. The fix was
  checked at 11:23pm Sunday, the hour that failed.
- **Crit 10, live.** After the deploy, two people with separate cookie
  jars used the live site while only `flyctl logs` was read. Thirteen
  activity lines told the story. Both people were told apart (p18 and p19),
  Ben's three attempts on Ana's group and event were logged as `tried to …
  → denied` with the reason, and none of the lines held the invite link or
  the private event link. The server booted after the migration; it
  refuses to start if the migration leaves anything dangling.
- After the fix CI went green and deployed: [`9f14e71`].

### Prompt 24 · Mon 19 Oct · the tag, and the documents

> can you set the crit 10 tag so that it can be marked off correctly. Have
> you also updated all the project documentation so the readme,
> process.md, reflection, prompt history?

**Result**
- The README, `PROCESS.md` and the reflection were already current for
  crit 10. This file was behind: it was missing prompts 22–24, and its
  summary sections were still as of 14 Oct. Brought up to date.
- **`crit-10` tagged** at the commit that brings this file up to date,
  annotated like `crit-8` and `crit-9`. The course pages don't say the
  cutoff sweep reads a tag. They say it reads `reflections/crit-10.md`
  and the deployed app. So the tag is my own marker of the shipped state.
  If I rewrite the documents before Wed 21 Oct 12:00, the tag moves with
  them; after the cutoff it never moves.

### Prompt 25 · Mon 19 Oct · is it Fly's database?

> are you using fly's database for my project? Please explain to me how
> everything is saved for users to enable the multi user app

**Result**
- No: not Fly's managed Postgres. It's one SQLite file on a 1 GB Fly volume
  at `/data`, next to the app on its one machine (ADR 1), with uploads
  beside it. The agent explained the 23 tables, how cookies tell people
  apart, how the live stream works, and what this costs: one machine, and
  backups are snapshots.

### Prompt 26 · Mon 19 Oct · does it work across devices, for my friends?

> does the app work across multiple devices? Can i send it to friends to
> use as well? This needs to be the case

**Result**
- Checked on the live site in real Chrome, with three devices that shared
  nothing. You start a group on a laptop. A friend on a phone joins from
  the invite link with just a name. You sign in on a tablet with your
  private link. The friend's plan reached the tablet live, in 208–475 ms,
  and was there after a real reload.
- **A wrong first conclusion, corrected.** Two early runs said the plan
  was missing on a reload. The script had only changed the part after
  `#`, which switches tabs on the open page rather than loading it again,
  so it read the old page before the live update arrived. With a real
  reload it passed every time (14 of 14 runs). The app was right and the
  script was wrong, and it was traced to its cause rather than written
  off as a flake.
- **Link previews, added.** A shared invite showed as a bare URL in chat
  apps, because the site had no Open Graph tags. Now every page makes a
  card. An invite's card names its group, since whoever sees the card has
  the link anyway, and drawing the card joins nobody. A private sign-in
  link's card names no one, never repeats the token, and isn't indexed.
  Red first, and the token check went red again with the fix removed
  (`spec/sharing.test.ts`).

### Prompt 27 · Mon 19 Oct · is it HD? a full audit

> what else can I do in order to achieve a HD in this assignment. How can I
> make this project even better? I want you to assign sonent 5.5 agents to
> do a deep dive into this project, 1 agent per thing to judge. I want you
> (opus 5.5 agent) to be the master of this team where each sonnet agent
> reports back to you. For very very small aspects, you can use haiku
> agents. [...] Remember that I want a thorough report that tells me if my
> project is at a gold standard HD, or a detailed list of improvements/
> changes that must be made in order to get to that standard.

**Result**
- **Eleven auditors:** ten Sonnet agents, one area each (process,
  response, artefact, functional, security, UX, UI, accessibility,
  performance, next-level), plus a Haiku agent for word counts and links.
  They judged against the marking criteria fetched from the course site
  and each area's industry standard (OWASP, WCAG 2.2, Core Web Vitals,
  Nielsen).
- **The lead reproduced every key finding** before it went in the report,
  and corrected three claims on checking. For example, Memories "showing
  too early" turned out to be correct behaviour.
- **Verdict:** about 74/100, a solid D. Process D–Cr (50%), artefact near
  HD, response D–Cr. The biggest gaps:
  - `PROCESS.md` under-showed evidence already in git;
  - the README's judged claims had no results;
  - its evidence links 404'd on `/readme/`;
  - "says who it leaves out" wasn't true.
- `docs/hd-audit-2026-10-19.md`, with verified notes in
  `docs/audit-evidence/`.

### Prompt 28 · Mon 19 Oct · fix everything in the report

> please go through the report that has been created and fix/improve/change
> everything that was found in the report to make my project hit that gold
> standard. Use a different opus 5.5 agent for each update and have each
> agent report back to you [...] After finishing all of the updates, please
> update all of my projects documentation, so the readme, process.md, and
> prompt history so it's up to date with the work that's been done so far.

**My calls** (asked before building):
- **Scope: justify and tidy (own).** Keep every feature, give each a
  README reason, move the theme picker into `/me`, keep Explore off the
  main nav.
- **Production test data: remove it (own).** The lead did it itself, after
  a fresh volume snapshot, deleting only the two "Audit …" events.
- **Cold start: don't change Fly's machine settings (own).** Add a health
  check instead, and ask the tutor about `min_machines_running`.

**Result** (developer A, before the pause): security headers and a CSP;
EXIF and GPS stripped from photos; 17 dependency advisories to 0; a health
check; graceful shutdown; "log out everywhere"; delete my profile; a
restore runbook.

### Prompt 29 · Mon 19 Oct · pause for the budget

> I want you to find a good spot to cool down because i am about to run
> out of this week's budget. [...] Please leave the project in a way that
> you can resume the gold standard plan after the budget resets on
> thursday in the best way so we can get optimal results at the end of it.

**Result**
- Stopped the running agents, saved one half-finished branch as a labelled
  work-in-progress commit, and stopped every server.
- Wrote `docs/gold/RESUME.md`: the state, my decisions, every remaining
  agent's brief word for word, and the order to finish in.
- Nothing half-done reached `main` or production.

### Prompt 30 · Thu 22 Oct · resume the gold plan

> resume the gold plan

**Result**
- **Developers B, C, D and F**, one Opus agent each, merged after review:
  - B: correctness at the edges (far weeks, event spot limits, overnight
    events, look-alike names);
  - C: accessibility, plus a real-Chrome check;
  - D: a branded 404, `/readme/` as a landing page, and the blind grid on
    the front page;
  - F: lint, 44 unit tests and a licence.
- **A hotfix shipped alone.** Developer B found `/calendar?month=0000-01`
  froze the server's only thread, so one link took the site down for
  everyone. The lead reproduced it on the live code, cherry-picked the fix
  onto `main`, proved its test red without the fix, and deployed it
  before the rest of the round.
- **C found the audit's own scan was too kind.** Real-Chrome axe skips text
  over decorative effects, single characters and hidden text, so the
  grid's heat counts were 4.41:1 while the scan said clean. The new check
  sets those options.

### Prompt 31 · Thu 22 Oct · finish wave 2, merge, and the documents

> please finish up work on gold round wave 2 now and then start the merge
> and documentation update to finish off this plan

**Result**
- Developer E (the group page) was stopped before it had committed
  anything. The lead did E's must-do items itself:
  - a best time now says who it leaves out, which makes the README's
    promise true;
  - "1 hour", not "1 hours";
  - a keyboard-scrollable table;
  - a confirm before archiving;
  - calendar entries named by plan and group.
  Each was red first.
- **Still open, recorded honestly:** the 1920 two-column layout, your own
  second device updating live, a "save your sign-in link" prompt, the
  recommendation's trade-off line, and a "How was it?" card.
- The README (dead links fixed, Doodle checked against Doodle's own help
  pages, point 7, 600 words), `PROCESS.md` (rewritten per the audit's
  plan, 21 citations), `CLAUDE.md` (rules for README points 3 and 4) and
  this file were brought up to date.

---

## For the final PROCESS.md

### Decisions that were mine (own)

- **The idea:** Hangout, friend groups, weekly free hours, recommendations,
  RSVPs, and getting plans into a calendar.
- **The recommendation rule:** "the longest overlap with the ability to make
  the hangout shorter".
- **Building everything for crit 8**, against the agent's smaller-scope
  recommendation.
- **"Any small group"** as the audience, which the README then argues with
  (Sloan and Shirky argue for one specific group).
- **Deploying the redesign before the crit 8 session**, against the agent's
  advice to wait.
- **The feature list itself:** events, friends, navigation, calendar,
  groups page, comments, reactions, and the full set of eight milestones.
- **The crit 9 decision:** the contested last spot at a full event, with
  first-in-wins and a self-filling waitlist.
- **Keeping the features and reframing "good"**, against the agent's
  advice to cut them (prompt 18).
- **Choosing the blind grid** from the agent's proposals (prompt 18).
- **Running the last round as a team** (prompt 20): one Opus lead
  reviewing, with Sonnet and Haiku agents doing the work.
- **The gold round's scope and production calls** (prompt 28): justify and
  tidy the social layer, delete the test data, and leave Fly's machine
  settings alone.

### Where I took the agent's recommendation (R)

Identity (name and link, then profiles), calendar links instead of OAuth,
the grid size, anyone-proposes, friend links with accepting, public/private
events, the calendar layout, uploading photos, the in-app inbox, deploying
per milestone, and the harness and commit choices during setup.

### Things the agent did that I didn't ask for

These are worth reviewing before citing them:
- the "Who wrote what" section in `PROCESS.md`
- harness commits and `CLAUDE.md` rules after each problem
- the quality checks growing at every step
- **ADR 9's rules for block and mute**
- putting Log out on `/me`, since there was no settings page
- **accepting plans dated in the past** (prompt 21), decided in review
  rather than asked
- **refusals reading "tried to"** in the log, after rehearsing crit 10
- **the volume snapshot** before the crit 10 deploy

### Corrections

- **The crit 8 target:** corrected by me (prompt 2).
- **Google Calendar via OAuth:** the agent warned it wouldn't work for my
  pod, so it became links (prompt 3).
- **The date-label comma bug:** caught by reading the rendered page
  ([`1cb87cb`]).
- **The checks never visited the group page:** fixed ([`ffd3028`]).
- **Shirky's site down:** cited a mirror whose quotes were checked against
  the real text (prompt 4).
- **The deploy token in a tracked file:** moved before any commit (prompt 5).
- **The JSDOM emoji trap:** the tests blamed the app; curl proved it right
  ([`f681fc2`]).
- **Explore's 30-event limit:** found by a failing test ([`91a9733`]).
- **Tests that couldn't fail:** tightened before their spec commits
  (prompt 12).
- **The upload handler in the wrong component:** found by reading the code
  ([`c594a35`]).
- **The double-submit test that couldn't fail:** proved both ways, and the
  rule went into `CLAUDE.md` ([`047d3fa`]).
- **Two identical plans from one race:** found by trying it ([`11db9fc`]).
- **The blind grid leaking on `/groups`:** caught by a test that first
  passed vacuously ([`11b224c`]).
- **A migration that would have wiped every RSVP in production:** caught in
  the lead's review of an agent's fix, by reproducing it (prompt 21).
- **Invite links in the logs:** the first logging pass leaked them; caught
  in review, with a red test first (prompt 21).

### By the numbers (as of 22 Oct)

- 31 prompts
- 188 commits since the template's first commit
- 11 ADRs
- 39 test files and 571 checks, run by `pnpm check` with typecheck and
  lint. 35 run against the app over HTTP, with real-Chrome tests in
  `spec/holds-up.test.ts` and `spec/a11y.test.ts`, and 4 are unit tests
  of the pure logic.
- 0 dependency advisories (17 before the gold round), and 6 security
  headers on every page
- 3 crit tags: `crit-8` at `b663ce5`, `crit-9` at `a9d3270`, `crit-10` at
  `a36b726`
- live changes measured at 52 ms (7 Oct) and 167 ms (13 Oct) in
  production, and 405 ms at p95 with 8 people watching one group (19 Oct,
  audit)
- the core flow for two people: 12 actions, about 4 seconds (13 Oct)
- crit 10 audit: 6 audits, 3 fixers, 1 measurer; 3 problems caught in
  review that the agents' own tests had passed
- gold round: 11 auditors, then 6 developers (A–F), and 1 hotfix shipped
  alone

### Ready-to-cite ranges

| work | range |
|---|---|
| Crit 8 setup and harness | [`ed72ded...4f83271`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/ed72ded...4f83271) |
| Crit 8 app | [`4f83271...2889130`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/4f83271...2889130) |
| Interface: themes, tabs, brand | [`b663ce5...db452ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/b663ce5...db452ba) |
| Profiles, friends, events, calendar | [`db452ba...d8f5f97`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/db452ba...d8f5f97) |
| Comments and reactions | [`d8f5f97...6671f9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/d8f5f97...6671f9f) |
| Live updates and the crit 9 decision | [`6671f9f...3f08e38`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/6671f9f...3f08e38) |
| Milestones 2–8 | [`3f08e38...b616093`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/3f08e38...b616093) |
| Logo, log out and the doc update | [`b616093...a9d3270`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/b616093...a9d3270) |
| The HD push: blind grid, holds up, one idea | [`245dcb3...fd47b33`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/245dcb3...fd47b33) |
| Crit 10: logging, integrity, review fixes | [`4125a6e...0713984`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/4125a6e...0713984) |
| Crit 10: documents and deploy | [`0713984...e0dd49f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/compare/0713984...e0dd49f) |

A range `a...b` on GitHub shows the commits *after* `a` up to and including
`b`.

[`e6eb352`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e6eb352
[`96a3e37`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/96a3e37
[`2288e1b`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/2288e1b
[`4f83271`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4f83271
[`ca78b9c`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ca78b9c
[`5da247f`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5da247f
[`e4d2810`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e4d2810
[`1925f3f`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1925f3f
[`2889130`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/2889130
[`1cb87cb`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1cb87cb
[`ffd3028`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ffd3028
[`93adb55`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/93adb55
[`b663ce5`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b663ce5
[`ad1626f`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/ad1626f
[`c4a90b7`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/c4a90b7
[`f6f1554`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f6f1554
[`67c5986`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/67c5986
[`14ec06b`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/14ec06b
[`db452ba`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/db452ba
[`4f3f0cb`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/4f3f0cb
[`116cc91`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/116cc91
[`8d9c635`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/8d9c635
[`0746168`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0746168
[`eae8f4e`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/eae8f4e
[`df7f501`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/df7f501
[`2f3cf7a`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/2f3cf7a
[`66e58b3`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/66e58b3
[`d8f5f97`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d8f5f97
[`cf5438b`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/cf5438b
[`f681fc2`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f681fc2
[`52ab670`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/52ab670
[`6671f9f`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/6671f9f
[`e3d7473`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/e3d7473
[`fd9fd67`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd9fd67
[`91a9733`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/91a9733
[`3f08e38`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3f08e38
[`dfebbd1`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/dfebbd1
[`0cf3ac2`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0cf3ac2
[`3b4e59e`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/3b4e59e
[`9ef4e6c`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/9ef4e6c
[`93b8107`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/93b8107
[`78c49c9`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/78c49c9
[`66a8c92`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/66a8c92
[`d6ca44c`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d6ca44c
[`b42ba75`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b42ba75
[`0531aa8`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/0531aa8
[`666b3be`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/666b3be
[`b856d47`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b856d47
[`bbe0698`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/bbe0698
[`c594a35`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/c594a35
[`d0ff703`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/d0ff703
[`b616093`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/b616093
[`6b1e6ef`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/6b1e6ef
[`f8e9dd0`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/f8e9dd0
[`c3bf3c5`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/c3bf3c5
[`a9d3270`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/a9d3270
[`1256bbd`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/1256bbd
[`33d4284`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/33d4284
[`5cbb5c5`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/5cbb5c5
[`047d3fa`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/047d3fa
[`11db9fc`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/11db9fc
[`11b224c`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/11b224c
[`61c49a3`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/61c49a3
[`fd47b33`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/fd47b33
[`00e09ad`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/00e09ad
[`40cf06e`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/40cf06e
[`71b20d7`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/71b20d7
[`8e506cd`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/8e506cd
[`9f14e71`]: https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/commit/9f14e71
