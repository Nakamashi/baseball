# Continuous ball motion and coordinated defense

October 29 sliding approach: established runners stopping at second or third use a
short final braking zone (effective deceleration 20 m/s²). Running acceleration,
speed profiles, contact reactions, airborne reads and retouches are unchanged.
This is simplified slide timing, not measured friction or a sliding animation.
Predictions and compiled samples share the same plan, ending at the bag with zero
velocity. Average R1 reaches second from a 2.19 m lead in 4.705 s after contact,
versus 5.160 s, including 0.25 s reaction. Some deceleration remains, unlike the
4.532 s unrestricted crossing estimate.

> Thrown-ball update (October 29): [THROWING_RELAYS.md](THROWING_RELAYS.md) describes
> the current gravity/linear-drag throwing model and bounded two-relay routes.
> The historical constant-speed throwing limitation below is superseded.

> Historical implementation report for `75896bf`. The tactical-corrections review branch updates throwing/movement profiles, airborne reads, fence configuration and dynamic pop-ups/bunts. See [TACTICAL_CORRECTIONS.md](TACTICAL_CORRECTIONS.md) for its current behavior and evidence.

This release implements the six-stage physical-simulation development plan on the existing dynamic provider. The authored encyclopedia is unchanged. Both modes still use the same field, playback controls, teaching navigation, player focus and bilingual display boundary.

## Scope and evidence

The physical field preserves 27.43 m basepaths and the user's stated 90 m corners / 120 m center. Intermediate fence depths are interpolated, not surveyed. The fence height is **assumed to be 2.5 m**; replace it when the actual height is measured. The display remains schematic; all physics use world-space metres and seconds.

Contact-to-first targets are **provisional coaching profiles requested by the user**, not published junior-high population averages: slow 5.3 s, average 4.7 s, fast 4.2 s. Gravity is 9.81 m/s². The remaining physical/skill values are engineering assumptions requiring local calibration. No youth speed dataset was verified: external MLB and PubMed requests were blocked. Do not turn these assumptions into sourced claims in future documentation.

The supplied FCA handbook's baserunning section supports run-through versus round/read/return, pitcher/third-base freeze reads, and deep-infield contact reads. It does not establish numerical running or throwing benchmarks.

## Timing audit findings

The baseline at `3db4075` already searched 40 ground-ball points **between home and the click**; it was not completely devoid of interception logic. However, the click still bounded the search and became a mandatory stopping/retrieval location when that segment had no opportunity. Base-hit inputs restricted primary fielding to outfielders. Fixed speed along that bounded segment did not represent a continuing bouncing/rolling ball.

The baseline also gave the fast BR an immediate 7.2 m/s, so a straight 27.43 m first-base leg took approximately 3.81 s **after contact**, excluding the one-second Ready phase. Fielders had a 0.35 s reaction and 0.35 s fielding delay but no acceleration, braking or velocity state. Their limited-distance movement was interpolated across teaching intervals. Those differences, plus the bounded ball path, could make routine outcomes and displayed movement misleading. The correction replaces the shared timing/path model rather than installing a coordinate-specific out or merely lowering runner speed. Throw flight remains 20 m/s for an honest baseline comparison; reaction and fielding control are now separately adjustable 0.25 s assumptions.

## Stage A: one clock and shared motion

`calibration.ts` fits maximum running speed to the _whole_ straight contact-to-first interval, including a 0.10 s start and 5.5 m/s² acceleration. Maximum speed is not distance divided by the target time. Established runners start from a configurable 2.1944 m secondary lead and a 0.25 s reaction/read allowance. Fly-ball runners with fewer than two outs return from that lead to prepare for a tag; they do not teleport to the bag. Curved first-base approaches, stopping at other bases, and returns have their own physical route lengths and timing.

`locomotion.ts` supplies immutable, piecewise acceleration/cruise/braking plans. Defender maximum speed is 6 m/s, acceleration 5 m/s² and initial reaction 0.25 s. Small lane adjustments steer with bounded acceleration; substantial changes brake before the new approach. Reassignment preserves current velocity. A player who arrives early waits. A player still braking is explicitly assigned `Decelerate`, rather than being described as stationary.

Player motion is evaluated from those plans during generation and stored as timed samples, with segment boundaries retained. Playback interpolates these samples in world space. It does not spread a short movement over an unrelated long phase.

Time zero in the physical model is bat contact. The presentation retains a one-second Ready phase. A 4.2-second sprint therefore touches first at playback time approximately 5.2 s, independently of pauses or playback speed. An already-retired BR may finish the sprint while outs remain. `RunnerBaseTouch` distinguishes that physical touch from earning a legal base; the third out freezes live movement.

Actual base-crossing roots are found on acceleration/braking segments. A late stop/return decision cannot erase an earlier physical base touch. First-base turns allow sufficient braking distance instead of snapping velocity to the return speed.

Throwing retains **20 m/s effective flight speed (44.7 mph)** as a conservative comparison baseline. This is not a radar release-speed claim. Secure-ball-to-release preparation is at least 0.30 s and allows the thrower to finish braking. Receiver/cutoff readiness can extend it. Flight and the 0.12 s receiving-control interval are separate. Relays retain a documented 0.15 s reception/read allowance before the next preparation. Carrying a controlled ball to a nearby base does not invent a throw or an unnecessary throwing transfer. Tag resolution retains a simplified 0.25 s allowance.

## Stage B: unobstructed trajectories

`trajectory.ts` computes a deterministic, untouched-ball prediction at up to 120 samples/s, splitting at physical impacts. Horizontal airborne velocity uses simple linear drag; height uses gravity. Ground contact damps vertical speed by 0.42 and horizontal speed by 0.82. Small bounces transition to rolling. Rolling deceleration is 1.2 m/s² in the modeled inner 39 m and 1.8 m/s² outside it. This radial surface mask is an approximation, not the brown SVG artwork or a surveyed dirt boundary.

Ground-ball initial horizontal profiles are 11 / 23 / 32 m/s for soft / normal / hard, adjusted within a bounded depth-intent range (0.92–1.12 multiplier). These are trial launch profiles; they are not the previous endpoint travel speeds. Ground balls continue beyond the aim point, lose speed through impacts and rolling, and stop naturally or meet the fence. No bobble, error or overthrow creates additional time.

Airborne profiles solve first landing distance using the same flight equations. Fly angles are 55° / 45° / 35° and line-drive angles 28° / 20° / 12° for soft / normal / hard. Launch-speed bands are 8–24 / 12–34 / 16–43 m/s. An out-of-band request is constrained and identified in both the preview and generated notes. Do not silently change surface resistance or promise an infeasible landing. These profiles are adjustable presets, not a measured relationship between youth launch angle and contact quality.

Prediction ends at a natural stop or an explicit out-of-play boundary. A 30 s bound rejects unexpected non-termination instead of silently returning an unfinished trajectory.

## Stage C: interception and developing defense

`MovementEngine.field` examines the whole trajectory for all nine defenders, not just points before the click. It checks reaction, acceleration, movement, height (up to 2.25 m), a 0.6 m glove reach and a controllable moving-fielding approach (up to 3 m/s at touch). It refines feasible scan intervals by bisection. A defender can field while moving and then brake with the ball; an unnecessary complete stop is not required at first touch. Fence-adjacent approaches must retain stopping room.

Each candidate records touch time, ball point, body point, arrival estimate and catch status. Earliest controllable touch wins, with distance/stable position priority resolving ties. A naturally stopped ball can be retrieved later. The selected body motion must actually reach the glove window when compiled; a generation guard rejects inconsistent plans instead of inventing possession.

The ball travels to its real touch point. During gathering its glove offset closes toward the moving defender and its height transitions toward the controlled-ball height. `BallTouched` precedes `BallFielded`; there is no throwing possession during gathering. A missed infield opportunity simply leaves the ball moving into the outfield. `BallPassedInfield` triggers responsibility reassessment.

This is an ideal-read deterministic model: the generator knows the prescribed trajectory, and the chosen feasible interception is not randomly spoiled. It does not model mistaken reads or errors. Unreachable infielders can take coverage/relay jobs instead of making a compulsory futile chase.

## Stage D: catches and airborne rules

`airborne.ts` coordinates airborne reads, tag-up release and infield-fly qualification. With fewer than two outs, fly runners prepare at the original base; line-drive runners make a controlled read and retain the ability to return. With two outs, runners go on contact. On an uncaught landing the ordinary advancement planner is released.

First defensive touch permits tag-up departure only after the runner has retouched. Completed control records the catch/out. A returning runner must reach the original base before advancing again. Catch completion removes forces. A timely throw to that original base can produce a **retouch appeal**, not a force or an invented tag. A third-out catch cancels provisional contact runs and stops further live throwing.

Infield fly applies only to a fair fly (not a line drive), fewer than two outs, first and second occupied, and an infielder with a modeled ordinary-effort opportunity. The 0.6 s spare-arrival criterion is a coaching approximation, not an umpiring oracle. Declaration retires BR once and removes forces; a later catch does not record a second BR out.

## Stage E: coordinated assignments and boundaries

The existing ball/base/backup system remains. First baseman is preferred for home cutoffs, SS for third, and the ball-side middle infielder for second. If the preferred cutoff cannot reach the lane in time, choose a timely available infielder and rotate coverage of vacated bases. A position is not an unconditional entitlement to a late relay. Once a throw is planned, its cutoff and receiver are reserved through preparation and flight; they are released at receipt or redirection.

All nine assignments are reassessed at existing tactical events plus landings, infield passage, catches, retouches and boundaries. An infielder fielding just onto the grass still makes an infield play; crossing the drawn 39 m boundary does not itself invent a cutoff. Very deep fielding can still require a relay system. Backups use the actual/predicted release lane and receiving point, with shared motion estimates and explicit late/space-limited issues. First-base trailing and catcher support remain conditional on higher-priority live responsibilities.

A low wall impact reflects horizontal velocity using the modeled fence normal with energy loss. An untouched flight clearing the 2.5 m wall awards a home run. A ball clearing after ground contact awards exactly two bases from original occupancy. A catch or other interception before that point truncates the hypothetical path and prevents the hypothetical award. Boundary pursuit is labeled `TrackBall`; no impossible catch/possession is claimed. Actual boundary resolution stops defensive throwing and allows the awarded runner routes to complete.

## Stage F: coaching visualization and diagnostics

Click meanings are explicit:

| Type        | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| Ground ball | Aim direction and approximate depth intent; never a forced stopping point           |
| Line drive  | First ground-contact point if untouched, subject to the displayed launch constraint |
| Fly ball    | First landing point if untouched, subject to the displayed launch constraint        |

The former dynamic `Base hit` outcome category is replaced by physical ball types. Archived settings with that value are rejected explicitly; authored encyclopedia base-hit plays are preserved. Fair airborne aims can extend beyond the fence within the diagram/160 m bound so a true boundary-clearing flight can be selected. Ground aims remain inside the playable field. Bunts remain disabled.

The optional **Projected ball path** layer shows the untouched path, first landing, bounces, stopping/boundary point and actual interception/fielder route. When settings are drafts, the previous generated interception marker is hidden. A shadow and height indicator preserve the ball's ground-plane position while showing airborne height. This is a top-down teaching diagram, not a perspective 3D renderer.

`npm run audit:defense -- --case center-home-close` exposes:

- Model version and physical/skill parameters.
- Playback time and time since contact.
- Ball state, height, unobstructed prediction and interception candidates.
- Contact, first touch, control, throw release, glove contact, receiving control and base-touch timing.
- Runner goals, velocity, timing comparisons and sampled positions.
- Throw alternatives, active all-nine assignments, backup deadlines and coverage issues.

Use `--settings path.json` for a selected situation and `--time` for arbitrary playback timestamps. Predictions and latest-reassessment snapshots are labeled separately from sampled current positions.

## Release verification — 2026-10-28

- `npm test`: **256 tests passed in 10 files**, including the original 576 base/out/throw-target all-nine cases, 576 additional physical ball/base/out cases, 128 independently seeded combinations and nine preserved exploratory edge cases. Matrices are grouped into smaller tests and yield to the Node event loop between tests so worker reporting stays responsive; coverage is retained.
- The explicit 396,473 hard-grounder / fast aggressive BR regression passes by interception and arrival timing. Profile tests inspect actual first-base-touch events at 5.3 / 4.7 / 4.2 s after contact, including a retired BR finishing a permitted sprint.
- A separate 1,000-situation seeded exploratory run independently varied all three ball types, all strengths, outs, occupancy, runner profiles, aggression, score/inning, defensive strategies, coach throw choices and continuous fair aim coordinates. **Zero generation exceptions and zero scenario-validation failures.** This checks model consistency, not the tactical optimality of every generated play.
- That exploratory run under concurrent container test load measured about 45.5 ms median, 107.8 ms at the 95th percentile and 1.67 s maximum generation time. These are development-environment observations, not phone benchmarks or latency guarantees. Generation is synchronous; slower devices and rare long plays should be profiled before adding substantially more search.
- CI reproduction exposed a Vitest IPC reporting timeout on two-worker runs even though all 256 assertions passed. The CPU-heavy audit files now yield between tests, allowing queued reporting messages to run; no assertions or coverage are removed and timeout limits are not increased.
- `npm run build`: passed TypeScript and production bundling.
- `npm run test:dynamic:browser`: passed routine interception, double play, automatic home relay, natural first-base motion, extra bases, contact reads, height/path overlay, catches, appeals, boundary awards, draft protection, language-preserving seeks and six viewport sizes.
- `npm run test:browser`: all 24 authored English/Japanese plays, guided choices, reading/playback synchronization, teaching auto-pause, saved language and six responsive layouts passed.
- `npm run test:pages`: final production assets render from plain static hosting at both `/` and `/baseball/`, with no failed assets or browser exceptions.
- The defensive diagnostics CLI produces the model parameters, timing ledger, alternatives and all-nine JSON assignments. Late backups remain explicitly reported. Desktop and phone screenshots were inspected; the field and transport fit together and airborne height has a readable contrast badge.

## Validation and remaining limits

Keep the existing 576 base/out/throw-target all-nine matrix and the additional 576 physical trajectory/base/out cases. Add focused tests for profile times, momentum, early waiting, late base touches, intercept feasibility, height, bounces, wall interactions, catches, retouches, infield fly, boundary awards, possession, scoring, bilingual explanations and history-independent seeks. Run all automated tests, production build and the three browser/static smoke suites before deployment.

The 396,473 hard-grounder regression now reaches a moving SS interception instead of stopping at the aim. A fast aggressive BR is retired by calculated arrivals; there is no coordinate-specific out rule. Nearby hits, different fielding alignments and soft contact can legitimately produce other outcomes. Existing home-play fixtures are recalibrated to real continuous trajectories, not preserved by forcing obsolete endpoint results.

Numerical correctness is not empirical baseball validation. Film contact-to-first runs, release-to-catch throws, ball travel through measured points and rollouts on the actual surface. Record age, batting side, effort, surface, timing method and repeated-trial spread. Do not compare a flying sprint directly with contact-to-first. Refit the shared parameters and review a representative play set, not one desired out.

No spin/lift, weather, detailed hops/terrain, per-player scouting calibration, diving/jumping, errors, bobbles, overthrows, full rundowns, obstruction/collision adjudication, missed-base/fourth-out appeal system or general foul-ball simulation is included. Between-base and body/footwork geometry remain simplified. Throws use an effective flight speed rather than an aerodynamic projectile. Japanese coverage is automated; a Japanese-speaking coach can refine wording and tactical conventions centrally.
