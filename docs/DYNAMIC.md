# Dynamic simulator — Phase 2A

This version extends the existing app rather than replacing its encyclopedia. Both providers output `PlayScenario`/`PlayPhase` data, rendered and sampled by the same SVG field, pure timeline sampler, playback clock and player focus panel. The compact layout, synchronized reading controls, auto-paused teaching mode, Japanese support and Pages deployment remain in place.

## Data and execution boundary

`DynamicSettings` contains a game state, continuous destination, ball type/strength, aggression, runner speed and coach override. `GameState` adds optional inning/half, scores, fielding team, strategy and ball status to preserve authored-play compatibility. `DynamicPlayProvider.resolve` validates supported input and returns a playable result or an explicit limitation; `generate` is the typed API used by the simulator form.

The generator compiles a deterministic play in response to meaningful events, then playback samples the result without changing decisions. No tactical calculations depend on animation frame rate, previous playback history or current display language. Form edits are drafts until Generate is selected. Unsupported inputs never substitute an unrelated scripted play.

`src/dynamic/types.ts` defines the ball, defensive player, runner, structured assignment, event, decision and generated timeline metadata. The initial engine supports rolling ground balls and outfield hits. Airborne trajectories, catch/tag-up rules and errors need additional event handlers in a later phase.

## Movement and timing

`geometry.ts` uses the existing 1000 × 900 field. A 282.84-unit basepath corresponds to 27.43 metres. Timing calculations convert SVG distances to metres before dividing by metres/second; rendering geometry does not determine physical speed.

`movement.ts` samples possible ground-ball interceptions along the batted path, compares ball arrival against defender arrival including reaction time, and selects the earliest feasible fielding opportunity. If no early interception is feasible, it compares retrieval at the destination. Outfield-hit retrieval compares outfielders' arrival times with ball travel time. Equal retrieval opportunities have deterministic position-order tie-breaking. These are simplified estimates, not a complete model of hops, acceleration or fly-ball height.

Current youth assumptions in `conventions.ts`:

| Quantity                                          | Default             |
| ------------------------------------------------- | ------------------- |
| Basepath                                          | 27.43 m             |
| Defender running speed                            | 6 m/s               |
| Runner slow / average / fast                      | 5.1 / 6.2 / 7.2 m/s |
| Throw speed                                       | 20 m/s              |
| Fielding delay                                    | 0.35 s              |
| Transfer                                          | 0.30 s              |
| Receive / tag                                     | 0.12 / 0.25 s       |
| Reaction allowance                                | 0.35 s              |
| Ground-ball soft / normal / hard effective speed  | 12 / 24 / 34 m/s    |
| Outfield-hit soft / normal / hard effective speed | 8 / 15 / 23 m/s     |
| Cutoff / long-relay distance thresholds           | 23 / 55 m           |
| Close-play margin                                 | about 0.45 s        |

Established runners begin with a small schematic lead (0.08 of a basepath). The batter begins at home. Non-forced runners may return from that lead. Defender movement toward assignments is capped by running speed in every phase. A throw waits if necessary for its receiver to reach the target. A nearby first baseman can carry the ball to first without an invented throw; otherwise pitcher coverage is considered.

Change assumptions centrally, then run the tactical tests. Do not alter scoring or safe/out results directly to produce a desired animation.

## Responsibilities and conflicts

`defense.ts` gives each defender one primary assignment. Priority order is fielding/possession, the imminent receiving base, necessary cutoff/relay, remaining base coverage, imminent backup, then supporting position. A deterministic reservation map resolves conflicting roles. Reassigned players do not keep two simultaneous targets.

The assignment stores its type, target, priority, supported base/teammate, explanation and replacement events. It drives both the movement target and coaching text. Nonessential movement stops when the ball is secured; the old thrower returns to support, the cutoff becomes the next ball holder, and base receivers remain at their targets. Each phase snapshots assignments rather than referring to a mutable future plan.

The default convention is intentionally one coaching system, not a universal rule:

- 1B cuts outfield throws home; 2B can cover first, SS covers second, C covers home, and P backs up home.
- SS cuts throws toward third; 3B covers third, 2B covers second, and P backs up third when free.
- 2B cuts returns toward second, with SS receiving at second when a separate cutoff is needed.
- Long throws use a relay assignment and two actual throwing legs. A shorter cutoff return may also be received and redirected, or held on the coach's instruction.
- A backup target lies beyond the receiver on the throwing line. Outfielders back up a fielding attempt without sending the entire defense toward the ball. Other players maintain useful support.

The coverage preferences and cutoff maps are separated in `conventions.ts`. Future team-specific settings can replace them without modifying the renderer or path interpolation.

## Defensive decisions

At contact, the defense anticipates coverage and a likely return target. At fielding, the engine reevaluates forces and advancing runners using remaining running time versus estimated throwing time. It prefers an available lead force with fewer than two outs, a feasible out with two outs, or a timely critical home play under run-prevention strategy. Conservative defense requires a larger timing advantage. If there is no useful out, the ball is returned to the infield or held.

A lead force can lead to a second throw only when outs remain and there is a plausible timing window. Successful double plays are not assumed. At three outs, live running and further throwing decisions stop.

The late/close-game recommendation is a simple rule for innings six onward with a critical runner at third and fewer than two outs. The coach can override it. There are no win probabilities or professional strategy models.

## Baserunning

`baserunning.ts` treats speed and aggression separately. Forced runners and the batter have minimum legal advances. A hit permits additional bases only when estimated retrieval/return time and the selected safety margin justify them. Conservative, normal and aggressive margins are 1.6, 0.4 and -0.65 seconds respectively. A negative margin permits a marginal attempt; it does not make the runner safe.

Runners are planned from the lead runner backward so a trailing runner cannot be assigned the same held base or pass another runner. Routes include every intervening base. At fielding and cutoff reception, decisions may be updated; a runner can retreat along the current basepath if a marginal extra base becomes unsafe and the return base is available. Forced runners cannot avoid a force by retreating to an illegally occupied base.

Coach overrides recalculate the expected defensive return route, so a throw to the wrong base can let a trailing runner advance. Hold is not treated as permission for unlimited automatic runs: the same bounded advancement estimates apply.

Stationary base occupancy is distinct from in-transit positions. Runners leave occupancy when moving and establish it when stopping. IDs remain BR/R1/R2/R3. Runs are provisional until the play resolves. A force third out or BR retired before first cancels runs; for a non-force third out, only runs crossing strictly before the out count. The batting team's score is updated at resolution.

## Events and shared animation

`timelineBuilder.ts` records contact, fielding, throw starts/receipts, base touches, advances/retreats, outs, provisional runs, disallowed runs and completion. Each throw and runner-base crossing is a deterministic boundary. Paths are split at those boundaries so a runner who reaches a base before a throw does not visually slow down merely to match the throw phase.

Contiguous pieces of one ball flight share a `journeyId`. Validation checks that continuation geometry connects and ownership changes only on the actual receipt. A ball in flight has no owner. A held ball follows its owner. Receiver readiness, tags and transfers consume model time.

The common sampler chooses the phase by its authored start time and recomputes positions from the beginning, including backwards seeks. The slider permits arbitrary fractional positions. Teaching mode pauses at the next boundary, while full-play mode runs continuously. UI timestamps are deliberately rounded for readability.

## Extending the engine

- Add new event handlers for catches, legal tag-ups, infield fly qualification, bunts and errors before enabling their controls. Do not reinterpret an unsupported fly as a ground ball.
- Keep pitcher/bunt cover conventions in the assignment layer and force/tag logic in the decision layer.
- Add individual player capabilities by supplying movement/throwing parameters through the existing player types and timing functions; preserve speed limits in compiled phases.
- Add alternate convention configurations behind the coverage/cutoff maps, with regression tests for vacated bases.
- Add bilingual dynamic message keys and parameter tests in the same change as new instructions.

## Validation and limits

Run `npm test`, `npm run build`, the existing encyclopedia browser checks, `npm run test:dynamic:browser`, and `npm run test:pages`. Tests cover representative baseball decisions plus every base/out combination at multiple locations, varied strengths/strategies/overrides, possession, geometric continuity, speed limits, third-out scoring, deterministic seeks and bilingual instructions.

Phase 2A does not generate fly balls, line drives, tag-ups, bunts, bobbles, overthrows, collisions, rundowns, unusual appeals or professional physical outcomes. Those situations remain available where authored in the encyclopedia. No coach-facing positional editor, quizzes, printouts, per-player ability form or stored side-by-side comparison is included. Throw/runner estimates can be close or tactically debatable; discuss the displayed assumptions and alternatives with the team's coach.
