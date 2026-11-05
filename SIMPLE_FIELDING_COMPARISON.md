# Simple Fielding: code review and comparison

Reviewed 2026-11-05. Repository: [mrthames/simple-fielding](https://github.com/mrthames/simple-fielding). Snapshot: [`47a223554a8fea11ee393e71b9fef3616139e193`](https://github.com/mrthames/simple-fielding/tree/47a223554a8fea11ee393e71b9fef3616139e193), package version **0.43.2**. This is a source review and local engine exercise; its website and browser rendering were not exercised.

## Assessment

The projects share a coaching objective and much of the interaction vocabulary: choose contact, show the whole defense, explain each player's job, animate runners and throws, and replay the result. Their strongest contribution to our current responsibility review is explicit **scenario-specific support for the fielders who do not handle the ball**. Their automatic engine is a simpler, mostly positional teaching model. Its broader error selection, whiteboard and play builder should not be mistaken for a more general physical simulation.

The source was downloaded into `/tmp/simple-fielding` for inspection. No third-party application code was incorporated into our simulator.

## How their engine works

The main entry point is [`Engine.planPlay()`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L2768). It builds field geometry and starting positions, dispatches to a play planner, finishes the assignments, and compiles a completed timeline. Playback samples that timeline. This is broadly the same generation/playback separation we use; it is not a browser-time collection of independent decision-making agents.

| Concern | Observed implementation |
| --- | --- |
| Field and levels | [`field.js`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/field.js#L1) uses feet, home as origin, and configurable league geometry/tempo. There are baseball and softball levels, including 90-foot baseball. |
| Contact classification | [`classify()`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L204) combines the requested location, distance, fielder proximity and catch-reach rules. It does not integrate an untouched batted ball and search its full physical trajectory as our dynamic provider does. |
| Hit value | `hitBases()` at lines 246–254 uses location, depth/fence fractions and corner conditions to choose a provisional single/double/triple. The coach can override the outcome. |
| Responsibilities | `assign()` at lines 185–197 assigns one role, destination, job sentence, delay and optional route per fielder. Existing assignments take precedence. Roles are field, cutoff, relay, trail, cover, backup and hold. |
| Movement | [`buildTimeline()`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L2041) constructs fielder tracks first. Travel normally takes distance / level speed; a hold-role movement uses half speed. This generated-play movement does not retain our independent acceleration/braking state. |
| Throws | Transfer time, receiver arrival and `throwTime()` determine release/arrival. The ball is drawn through start/midpoint/end keyframes with an assigned arc. Youth and older-level throw timing use different empirical formulas (lines 29–48, 2198–2268). |
| Runners and calls | Runners are processed lead-first. Arrival comparisons, a tag allowance, send margins and occupancy constraints can produce holds, safes or outs (lines 2290–2518). Some destinations are prescribed by contact classification or error planning. |
| Tactical redirection | There is a specific “Cut 2” rebuild when a throw home is clearly late, not a general post-event replanning loop (lines 2783–2802). |
| End of play | Fielders' tracks are shortened after the last ball/call event and eased to a stop. Runners finish their routes (lines 2528–2558). |

Our engine already has more explicit treatment of continuous ball motion, acceleration, possession/gather states, live reassessment and physical base contact. Their approach makes a much broader set of teaching situations straightforward to author.

## The pitcher grounder: a concrete comparison

I converted our `(495, 618)` aim to approximately **(-1.59, 48.36) feet** in their coordinate system and generated their `junior90` grounder with a runner on first and no outs. This matches an input location, not an identical trajectory or athlete calibration. Their planner selects P and plans **P → SS at second → 1B**.

| Fielder | Their actual assigned duty |
| --- | --- |
| P | Field the comebacker and throw to second for the lead runner. |
| C | Run down the foul side to support the first-base throw. |
| 1B | Cover first and present a receiving target. |
| 2B | **Back up the throw to second**, about 16 feet beyond the bag on the throwing line. |
| SS | Cover second, take the force, then throw to first. |
| 3B | Move to cover third. |
| LF | Come in behind third against a possible bad throw. |
| CF | **Come in behind second.** |
| RF | Come in behind first. |

The important rules are explicit in [`engine.js`, lines 1022–1037](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L1022) and [1127–1144](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L1127): the spare middle infielder backs the second-base throw or the primary fielder; the outfield convention is RF–first, CF–second, LF–third. All nine moved in this reproduction.

This is more explicit than our previous fallback for 2B and CF. It is a useful coaching alternative to our current timing-ranked primary backup plus deeper support layer. We should compare its job allocation, not copy its distances or promise that any assigned backup arrives in time.

## “Every fielder has a job” does not mean they solved every idle case

Their [`fillHolds()`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L1341) assigns remaining players their **unchanged starting coordinates**. Outfielders receive “Take a few steps in, stay ready for the ball,” despite the unchanged destination. Infielders receive “Stay ready at your spot and watch the ball.” Their general all-nine test checks job text and a finite timeline; it does not require useful motion for every role.

I exercised the **49 presets allowed by their Little League filter**. Seventeen had at least one stationary defender and fourteen used this fallback. Restricting that exercise to **34 fair batted-ball presets**, two pop-up examples had stationary outfielders and generic fallback jobs. Non-batted plays and legitimate waiting are included in the broader counts; these numbers are diagnostics, not a judgment that every stationary assignment is wrong.

They do, however, make attention visible. [`computeLooks()`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L1960) generates gaze tracks: fielders watch the batter/ball or their next throw target; runners look toward bases, the ball or the third-base coach. SVG attention overlays and the 3D view consume these tracks. This gives a player at a correct stationary location a visible instructional responsibility without artificial wandering.

## Errors and recovery: useful breadth, significant simplifications

Their automatic mode supports bobbles/dropped outfield catches, through-the-legs grounders and wild throws. [`applyError()`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/engine.js#L328) modifies an ordinary planned play before compiling its timeline.

For a wild throw:

1. It selects the first non-carry/non-mound throw.
2. It extends the throw to a coach-selected or default location, bounded with `inPark()`.
3. It chooses the retriever by distance from **planned assignment endpoints**, excluding the thrower and intended receiver (lines 375–388).
4. It offers eligible runners one additional base, removes their forced/committed flags and appends a throw toward the lead extra-base destination (lines 389–405).
5. At compilation, the chosen fielder's route is replaced from their sampled position **0.3 seconds before** the miss. Travel to the loose endpoint uses constant speed. The ball waits there if necessary (lines 2240–2259).
6. Timing can still make a runner hold; an extra base is not always successfully gained. A previously stationary runner starts 0.1 seconds after the miss. Already advancing runners' extended routes do not receive a general miss-observation gate (lines 2326–2331, 2441–2463).

Consequences for our feature: it demonstrates why backups matter and supports genuine subsequent ball travel/throwing, but does **not** meet our stricter requirements for receiver-envelope misses, continuous launch velocity, momentum-ranked recovery or universal observation-based runner reactions. Bobbles use a fixed delay and a small pop-out; an outfielder's bobble can first be replanned as a hit worth another base. These are teaching abstractions, not evidence for physical error probabilities.

## Automatic play, coach-built play and whiteboard are distinct

The [step builder](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/script.js#L1) is especially useful educationally. Steps include pitch, field, throw/fake, carry, tag, base touch and hold, with runner orders and optional fielder moves. A wild or dropped throw clears `holder` and creates `loose`; a later field step must restore possession. **The coach chooses safe/out calls**; this is explicitly documented in the source.

Nested alternative endings share an initial sequence, and sharing encodes the built play in the URL fragment. This is an authoring capability, not autonomous recovery from arbitrary physical state.

The whiteboard allows repositioning and drawing. The “Play it as built” handler closes the board and resumes the original plan at the existing clock ([`app.js`, lines 813–818](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/app.js#L813)); it does not recompute tactics from the hand-moved positions. That distinction matters when interpreting the README.

## Teaching and interface ideas worth considering

- **Ask before showing:** pause at contact with routes hidden, ask where everybody goes, then reveal the play (`app.js`, lines 351–397).
- **Position-focused lessons:** the learner drags one fielder toward their expected job. [`Training.grade()`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/training.js#L680) evaluates direction and a generous distance range, including a legitimate stay-put answer. It does not demand an exact pixel.
- **Clear team conventions:** [`docs/SCENARIOS.md`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/docs/SCENARIOS.md) explains differences such as third-base versus first-base home cutoffs and ordinary versus wheel bunt defense. These are coaching choices, not universal rules.
- **Replayable bug reports:** [`playlog.js`](https://github.com/mrthames/simple-fielding/blob/47a223554a8fea11ee393e71b9fef3616139e193/app/js/playlog.js#L1) records the situation and contact in a reproduction code. Our deterministic generation can support a similarly useful diagnostic export.
- **Documentation exercised against the engine:** their CI builds guide pages and checks named outcomes against generated results. That is a valuable guard against coaching prose drifting away from actual behavior.
- **Team labels, projector mode and attention overlays:** useful teaching affordances, separate from simulation correctness. No EN/JA localization system was found in the inspected application scripts.

## Verification and limitations of this review

Downloaded and inspected the application JavaScript, coaching reference, README, license, test workflow and all twelve Node test files. Exercised all **147 individual Node tests together: 147 passed**. Also ran the standard Node test command successfully and performed the pitcher-grounder and preset-role exercises above.

Their browser audit was not executed: its `@playwright/test` dependency was not installed in this isolated review directory, and this workspace also blocks Chromium/socket startup. No dependencies were installed, no live visual inspection is claimed, and no conclusion about deployed mobile behavior follows from these source checks.

The repository uses **PolyForm Noncommercial 1.0.0**, with an attribution notice, rather than an unrestricted MIT-style license. That is relevant to any future proposal to reuse source. The comparison and recommendations here do not require importing their implementation.

## Recommendation for our simulator

Use their explicit comebacker responsibilities and written convention tables as a comparison during the all-nine review. Retain our physical motion, live state, legal-out and event-based reassessment infrastructure. Prioritize purposeful spare-infielder duties, coordinated outfield support, honest readiness deadlines and clear next-action cues. Consider attention indicators and an ask-before-reveal teaching interaction later. Their broader authoring, softball and league features are separate product decisions and should not expand the current defensive-correctness task implicitly.
