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

## Responsibilities and defensive decisions

The defensive fundamentals audit in [DEFENSIVE_AUDIT.md](DEFENSIVE_AUDIT.md) defines the adopted team system, all-nine position review, corrections, validation matrix, diagnostics commands and remaining limitations. It supersedes the earlier unconditional coverage and always-received cutoff conventions.

The engine reserves one active job per player, driven by live threats, the selected throwing route, receiver readiness and backup availability. Assignments are reassessed at contact, fielding, throw release, receipt, runner-base crossings, outs and completion. Deliberate holding is stationary; supporting, trailing, receiving, fielding and backup assignments drive actual movement. Each phase snapshots the assignments for deterministic playback and complete English/Japanese explanations.

The ball-side middle infielder cuts returns toward second; SS cuts toward third; 1B cuts toward home. Other players cover necessary vacated bases. A throw may travel directly, pass through a cutoff, use an actual long relay, stop at a cutoff, or be carried to a nearby base. Backups extend the actual incoming lane behind the receiving point, including a relay receiver. Arrival/deadline and limited-space issues are available through developer JSON diagnostics.

Throw comparisons consider each base an advancing runner is actually attempting, including home, rather than only the next base. Actual route/receiver time, force versus tag, outs and game context determine the choice. Realistic run prevention matters under standard strategy too; hopeless home throws cannot outrank available outs. A secure third force out has appropriate value under the run-scoring rules. A second throw remains conditional on time and outs, and live action stops at three outs.

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
