# Dynamic simulator: continuous trajectories

The current implementation extends the original dynamic simulator and preserves the authored encyclopedia. See [PHYSICS.md](PHYSICS.md) for the six-stage implementation report, calibration, coaching conventions, click meanings, supported rules and limitations.

## Execution boundary

`DynamicPlayProvider` validates a situation and compiles an immutable `PlayScenario`. Both providers use the same SVG field, pure sampler and playback controls. Physical generation never depends on browser animation frames, playback history or language. Settings remain drafts until Generate is selected. Invalid or unresolved inputs preserve the previous generated play and display a translated notice; they never substitute an unrelated script.

Dynamic ball inputs are **Ground ball**, **Line drive** and **Fly ball**, with soft/normal/hard profiles. The former `Base hit` input is an outcome label and is no longer accepted by this provider. Authored base-hit scenarios are unaffected. Bunts and errors are not generated.

## Modules

- `calibration.ts` and `conventions.ts`: provisional contact-to-first targets, shared movement and throwing parameters, team responsibilities.
- `geometry.ts`: physical/display projection, regulation diamond, configured 90/120 m ground and interpolated fence.
- `trajectory.ts`: deterministic launch, flight, impacts, rolling, wall interactions and untouched path.
- `locomotion.ts`: analytical acceleration, cruise, braking, steering and arrival plans.
- `movement.ts`: all-nine reachable-height interception search, refinement, fielding approach and starting alignment.
- `runningGeometry.ts`: route lengths, motion-aware timing and physical base-crossing roots.
- `baserunning.ts`: legal goals, contact reads, aggression margins and developing-return decisions.
- `airborne.ts`: airborne reads, first-touch tag-ups, retouch requirements and infield fly.
- `defense.ts`: throwing alternatives, cutoff/relay selection, live coverage, backups and conditional trailing.
- `provider.ts`: chronological play events, possession, receiving/control, throws, awards and scoring.
- `timelineBuilder.ts`: shared-clock movement and tactical snapshots.
- `simulation/timedPath.ts` and `simulation/timeline.ts`: time-based pure sampling; authored geometry remains compatible.
- `diagnostics.ts`: model parameters, interception candidates, timing ledger and all-nine responsibilities.

`SimulationMetadata.modelVersion` and `contactTime` identify the generated model and Ready offset. Motion samples carry timestamps; path vertices alone do not encode speed. Numerical samples do not become individual teaching steps.

## Baseball behavior

The primary fielder intercepts the moving ball. A ball not reachable in the infield continues to the outfield. First touch and secure possession are distinct. Actual control/release positions determine subsequent lanes. All nine jobs are reevaluated on tactical events. Preferred cutoffs yield to timely alternatives with corresponding base coverage; committed throw receivers and cutoffs remain reserved during preparation and flight.

Runner speed and aggression are independent. The batter accelerates from contact, and current momentum survives reassignment. Existing run-through, rounding, return, force/tag and provisional-scoring rules remain. Catches remove forces; retouch appeals are distinct from tags and forces. The third out ends live motion. Boundary awards use original runner occupancy and do not invent a defensive possession.

## Interface and validation

Ground clicks aim a lane; airborne clicks request the untouched first landing. Constrained launches are identified in the preview and notes. The optional projected-path layer and height/shadow display do not change simulation results. English and Japanese are generated from the same typed message references.

Run automated tests, `npm run build`, `npm run test:dynamic:browser`, `npm run test:browser` and `npm run test:pages`. Preserve both the 576-case all-nine base/out/target matrix and the 576-case physical trajectory/base/out matrix, plus focused numerical, rules, localization and deterministic-seek checks. Use `npm run audit:defense -- --case center-home-close` for a developer JSON timing/assignment review.

Detailed surface physics, human read mistakes, spin/wind, errors, bunts, full rundowns, detailed body mechanics, general foul-ball simulation and uncommon appeal adjudications remain outside the model. Do not imply that an unsupported case is physically or legally resolved.
