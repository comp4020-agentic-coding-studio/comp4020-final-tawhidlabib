# COMP4020 Final Project — marking criteria (verbatim from the course site, fetched 19 Oct 2026)

Brief: "Make a multi-user, real-time website that's good."
Fixed requirements: Multi-user (>=2 people, own browsers, shared state, app tells them apart);
Real-time (changes in every other open session within ~1s, no reload or viewer action; explain transport);
Persists (survives sessions, restarts, redeploys). "Design for co-presence. The showcase, a room of
simultaneous users, is the target situation." "Deciding what not to build is part of the work."

Weights (COMP4020): Legibility of process 50% · Working deployed artefact 25% · Response to the brief 25%.
Bands: HD 80–100 · D–Cr 60–79 · P 50–59 · N <50. Marker picks a band then a number.

## Legibility of process (50%)
- HD: "corroborated and skilled: beyond checking out, the evidence shows deliberate direction — failures
  diagnosed and fixed at the harness level rather than retried, judgement visible in what was thrown away";
  explains "why one beat the obvious alternative" and "how you knew the result was right before accepting it."
- D–Cr: "corroborated and competent: the account checks out and shows a real working process, but the
  directing is routine — attempt, accept, repeat — or the evidence has thin spots."
- P: "process asserted rather than shown: claims uncited, or only weakly supported by the evidence."
- Evidence: PROCESS.md read against commit history, CLAUDE.md and spec/; three crit reflections; /ship cutoff
  tags (changes between tagged versions count). PROCESS.md must cite commits as links (link text = hash or
  range). "Uncited claims don't count as evidence, and markers don't trawl the repo for what you didn't cite."
  "A history that grew over time is more convincing than one big dump at the end."
- PROCESS.md 900–1100 words, rewritten (not appended) each crit; must make the case for the stack and agent
  workflow with trade-offs and citations; SHOULD discuss position relative to the small-web and small-games
  writing read in the course.
- "PROCESS.md must be your own account, written by you for a reader." Documents that read like agent output
  "signal little added value." (Student intends to rewrite README/PROCESS/reflections in own words.)

## Working deployed artefact (25%)
- HD: "holds up under use it wasn't designed for: the keyboard, a resize mid-interaction, a slow connection."
  (Final brief adds: "two people acting at once or a slow connection.")
- D–Cr: "deployed, live, and does what the brief asks at both marking viewports."
- P: "notable gaps: the core interaction is unreliable, or one viewport is broken."
- Marked: deployed state of last commit at the deadline, latest stable Chrome at 1920×1080 AND 390×844.
- Marker arrives with only the URL and begins at /readme/ — "everything a newcomer needs must be on the page."
  Two people in separate Chrome profiles (incognito counts), no shared cookies/storage; both visible at once,
  one at each viewport; marker returns the next day (machine will have stopped/restarted).
- Judged against the three fixed requirements and the README's claims. No feature checklist; "features
  outside your definition of 'good' earn nothing extra."

## Response to the brief (25%)
- HD: "a pointed, surprising answer to the provocation, scoped with judgement: one idea, carried all the way."
- D–Cr: "a well-scoped response with a real idea behind it; minor drift."
- P: "meets the brief only loosely; over- or under-scoped, or an answer without a point of view."
- Evidence order: README, then CLAUDE.md, then spec/, then the app, "looking for the same idea in each."
- Marked down even if checks pass: "a chat room with the nouns swapped"; "features with no reason to exist";
  "a README promising a kind of good that the rules and checks never mention."
- README 400–600 words (guidance; badly overshooting can cost marks under response): what good means, what you
  read/looked at, what you chose not to build; cite sources; published in full at /readme/. Strongest versions
  state which claims are enforced, which are judged, and HOW the judged ones were judged.

Due: noon Mon 9 Nov 2026. Showcase (unmarked) Wed 11 Nov.
