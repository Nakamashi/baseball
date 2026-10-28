# Authoring a play

## Runtime contract

A `PlayScenario` contains the initial `GameState`, the `BallEvent`, stable player IDs, starting positions and an ordered array of `PlayPhase`s. The scenario library is independent of React. The renderer receives only a scenario and a sampled snapshot.

Coordinates use a 1000 × 900 SVG viewBox, with home at (500,770), first at (700,570), second at (500,370) and third at (300,570). Use `bases` and `defaults` from the geometry module. Default defender IDs are P, C, 1B, 2B, 3B, SS, LF, CF, RF; runners are BR, R1, R2, R3. Runner identities must never change when they advance.

A phase has a start and duration in seconds, movement paths beginning at the previous position, a ball action, responsibility text for every present player, a game state and runner statuses. All phase state changes happen at its **start**. Put a catch/out/safe event in a receive/catch phase **after** the travel phase. During movement, base occupancy records last established bases, not a prediction of where runners will finish.

`BallAction` explicitly distinguishes possession (`held`, owner ID) from travel (`travel`, path, hit/throw style and receiving defender). Travel has no owner until arrival. Held ball coordinates follow the owner, even when the owner moves. Throw paths must end at the receiver's arrival position. A catch then transitions to a held phase with the same receiver. A hit begins at home; the initial pitcher-held ball represents the pre-contact setup, not a simulated pitch.

`sample(scenario, time)` reconstructs every player from initial positions and all elapsed paths. It has no mutation or animation history. Paths interpolate by distance across all segments. Seeking backward, restarting, and playing forward therefore produce the same snapshot at the same time. Playback owns only a clock; it cannot change baseball state.

## Add an authored scenario

1. Choose a genuine base/out situation and explicit outcome. Define whether a runner is forced, whether a catch requires retouch, and which defenders cover vacated bases. Document team-specific cutoff choices and plausible alternatives.
2. Add a `Spec` and call `author(spec)` in the catalogue, or supply a complete `PlayScenario` directly. Use a unique ID. Start with a representative existing ground, aerial, hit or bunt example, but review the tactical differences rather than copying it unchanged.
3. Call `assign` with meaningful action, why, and supporting responsibility for each player whose assignment differs from the defaults. Runners need their own instructions. Stationary players still have a monitoring or contingency responsibility.
4. Add `ready`, `contact`, `held`, `throwTo` and `finish` phases as appropriate. The author helper prefixes each movement with the last authored location and snapshots teaching text/state. `contact` can move any number of players simultaneously. Use arrays of intermediate points for routes or runners who must touch a base before continuing.
5. Assign changes to outs, occupancy, runs and statuses in the receive/catch phase. Mark retired/scored runners and remove them from occupancy. Never put two runners on one base. Clear occupancy at the third out. A failed relay should show the batter safe, not a second out.
6. Add Japanese translations for every new teaching sentence in `src/i18n/ja-playbook.ts` (or a translated reusable template in `src/i18n/index.ts`). Follow [translation maintenance](TRANSLATIONS.md).
7. Run `validateScenario`, `npm test`, and `npm run build`. Add outcome-specific assertions for unusual rule cases. Scrub through each transition in the browser and inspect all nine defenders. Check that every throw arrives at the displayed receiver.

For example, a route from first to third must include `bases[2]` as an intermediate waypoint. Do not draw a direct first-to-third line across the infield. A tag-up route must start only in a phase after the catch, with the runner still at the original base at catch time.

The helper methods are conveniences, not another simulation engine. Ground balls, fly balls, base hits and bunts all render through the same types, timeline and SVG component. Generic helpers describe actions; scenario-specific baseball decisions remain in the catalogue.

## Provider boundary

`PlayProvider.resolve(gameState, ballEvent)` returns either a supported list or an explicit unsupported reason. `ScriptedPlayProvider` compares outs, exact runner occupancy, ball type and direction. Count is intentionally ignored. The UI guides category → supported starting situation → authored play. Choices are derived from the library, and changing filters selects a compatible play when required. Arbitrary unsupported base/out controls are not offered in Version 1. The strict provider API remains available for future integrations.

A future dynamic provider should produce and validate the same schema, including explanations, outcomes and explicit possession. It can implement baseball rules and generated paths behind this boundary without modifying `sample`, `BaseballField` or `usePlayback`. UI integration needs to replace the provider instance and offer generated results; it should not put baseball rules inside event handlers.

## Validation scope

Validation checks all nine defenders, recognized IDs, coordinates, paths, contiguous timing, explanations, outs/count ranges, base references, duplicate occupancy, retired runners, final base positions, throw origins/receivers and possession transitions. Tests also check every scenario's initial positions, stable possession, outs versus retired runners, exact matching, unsupported selections, tag-up timing, bunt coverage and deterministic seeks.

Structural validation cannot determine whether a coach's cutoff choice or runner advancement is appropriate for every team. Keep assumptions and alternatives explicit and review new plays tactically.
