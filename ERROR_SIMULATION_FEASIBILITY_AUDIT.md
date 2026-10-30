# Error Simulation Feature Feasibility Audit

## A. Executive Summary

**Feasible with moderate-to-substantial engine extensions; not a toggle-only change and not an engine rewrite.** The dynamic generator already advances a chronological simulation, preserves movement momentum, reevaluates defensive assignments, changes relay decisions, and compiles a deterministic playback timeline. However, **a released throw currently always becomes a successful reception**. There is no thrown-ball failure outcome, post-throw loose-ball state, or recovery planner. Those are the central missing capabilities.

Backup positioning is real, begins before release, and can be reused. Backup **retrieval** is not implemented, and assigned support is frequently late. Runners can change goals, stop and retreat in supported circumstances, but the bunt/infield planner does not evaluate discretionary extra bases like the outfield-hit planner. Error-aware runner decisions need new logic; changing possession alone will not produce the requested example.

Recommend extending the existing generation event pipeline with a narrowly scoped throw outcome and a live-ball recovery branch. Initially support one deterministic, physically calculated elevated overthrow on an eligible direct infield throw toward second, followed by retrieval, simultaneous runner reads and a bounded opportunity for another defensive action. Then broaden throw eligibility and error shapes. Keep Include Error OFF by default and preserve the clean generation branch. The mobile generation bar and field-first interface already exist.

### Scope and evidence method

- Inspected checkout: `8c132aeade11f9b1f03132f34bc2005ca0099a52`, initially clean; audit date: 2026-10-30. Paths below are relative to this repository root. Line references describe this checkout.
- Read source, current and historical simulation/defensive/running documentation, test suites and audit/browser utilities. Searched source for error, bobble, dropped/missed catch, overthrow, loose ball, interruption/replanning and randomness terminology; examined the actual possession and continuation branches rather than relying on search alone.
- Ran the existing unit suite and production build; verification results are recorded in K. Ran two read-only Node/Vite SSR generation probes against unchanged application modules, including the requested pitcher bunt example. No network sources were used.
- **Observed** describes current code or measured clean-play output. **Proposed** describes implementation recommendations, not capabilities delivered by this audit. No application/test changes are part of this task.

## B. Existing Architecture

### Generation, simulation and playback are separate

1. `App` holds draft `DynamicSettings` separately from a generated `DynamicScenario` (`src/App.tsx:41–68`). `generate()` validates settings, paints loading feedback, and synchronously calls `new DynamicPlayProvider().generate(settings)`; exceptions preserve the prior play and display a notice (`98–125`).
2. `DynamicPlayProvider.generate()` validates and clones inputs, constructs movement, running and defense engines, computes the initial untouched batted trajectory and feasible interception, creates runners and a `TimelineBuilder` (`src/dynamic/provider.ts:158–203`). This initial interception is planned in advance, not discovered by browser collisions.
3. The provider forecasts an anticipated defensive target and assigns all nine jobs at contact, explicitly to start backups early (`224–275`). Its local `reassess()` reassigns defenders from current positions, velocities, runner state, route reservations and deadlines (`276–344`).
4. The provider advances chronological cues, pickup/catch, throw preparation, flight, reception, runner crossings, relay reads and further opportunities. `TimelineBuilder.interval()` integrates concurrent movement over an interval, splitting at runner events and retaining velocity (`src/dynamic/timelineBuilder.ts:148–213, 304–359, 398–524`). This is **time-based motion with event-triggered decisions**, not a generic event-queue scheduler.
5. The result contains timed `PlayPhase[]`, motion samples, bilingual message references, events, decisions, diagnostics and initial settings (`provider.ts:1300–1370`). It is a precompiled playback artifact, not a mutable gameplay session. It is treated as fixed by playback; the TypeScript objects are not deeply frozen.
6. `sample()` reconstructs positions from the scenario at any requested time without invoking decision engines (`src/simulation/timeline.ts:15–84`). `usePlayback()` only advances/seeks a playback clock, with step/full modes (`src/hooks/usePlayback.ts:5–85`). Browser frames and playback speed do not drive baseball decisions. The authored encyclopedia uses a separate scripted provider and the same scenario/sampler interface (`src/simulation/scriptedPlayProvider.ts`, `src/simulation/types.ts:119–149`).

### Entities, state and physical paths

- Defenders have independent current positions and velocities in `TimelineBuilder`; runners have independent progress, goal, signed running velocity, status, delay and first-base/retouch state (`timelineBuilder.ts:42–65`; `src/dynamic/types.ts:217–249`). Defensive assignments are a distinct tactical layer.
- The ball travels independently during a `BallAction.kind === "travel"`; when held it follows an owner, possibly through an unsecured gather (`src/simulation/types.ts:88–105`). Ownership during compilation is largely a local, always-valued `Position` named `owner`, paired with `inFlight` and `stage` (`provider.ts:200–202, 246–255`). This owner can mean the anticipated initial fielder or releasing fielder, not necessarily secure possession at that instant.
- Batted-ball `BallFrame`s contain world velocity and height (`src/dynamic/trajectory.ts:34–49`). Throw playback samples contain position/time/height, not a full velocity vector (`src/dynamic/throwing.ts:53–60, 102–111`; `src/simulation/types.ts:83–87`). There is **no uniform persistent ball position/velocity/owner state spanning every action**.
- Dynamic coordinates are projected into physical metres through `toWorld`/`fromWorld`; interpolation, motion and timing use that geometry (`src/dynamic/geometry.ts:11–55`). The diamond has 27.43 m basepaths and the modeled outfield has 90 m corners/120 m center (`src/dynamic/conventions.ts:9–11`). Defense uses acceleration/braking/steering plans, not instant relocation (`src/dynamic/locomotion.ts`; `timelineBuilder.ts:187–212`). Authored scenarios retain authored geometry.
- Paths are physically computed but tactical choices and action sequences are assembled by the provider's explicit control flow. This is neither a collection of wholly scripted dynamic animations nor a general-purpose autonomous agent simulation.

### The consequential architectural boundary

**Already possible:** revise assignments during a released flight on runner events, cancel obsolete automatic throws before release, intercept some through-cutoff flights, choose another target after a reception, and reopen a late opportunity (`provider.ts:788–833, 893–933, 1117–1188`).

**Not possible as implemented:** let an intended reception fail, continue that throw past the receiver, select a loose-ball retriever, and reenter normal defense from the recovered state. `performThrow()` unconditionally schedules glove contact, gather and ownership by `to`, then resolves outs (`851–988`). No missed-reception branch exists.

**Intermediate-state resume:** `TimelineBuilder` advances its current internal state incrementally, so a recovery branch can continue *inside the same generation*. There is no public checkpoint/resume API; the provider's owner, stage, reservations, relay budget and continuation flags live in closures. A playback `Snapshot` omits enough momentum, runner legal/read state and pending-scoring information that it cannot safely restart simulation. External arbitrary resume is unnecessary for this feature and would be a substantially larger project.

## C. Current Capability Matrix

“Already supported” applies to the stated clean-play capability, not implied error support.

| Capability | Classification | Evidence / practical boundary |
| --- | --- | --- |
| Time-based, concurrent ball/defender/runner motion | Already supported | `timelineBuilder.ts:150–524`; timed ball/movement samples. |
| Pure deterministic seeking and replay | Already supported | `simulation/timeline.ts:15–84`; `dynamic.test.ts:31`; probes in F. |
| Internal tactical reassignment during play | Already supported | `provider.ts:276–344`; runner-event callback `timelineBuilder.ts:518–524`. |
| Cancel a pending automatic throw | Already supported | `provider.ts:782–799`; before release only. |
| Change a released flight's destination arbitrarily | Not supported | Flight samples/reservations committed at `provider.ts:803–857`; special cutoff interception is distinct. |
| Event-driven continuation after successful receipts | Already supported | Relays `893–933`, ordinary follow-up `995–1019`, double-play branch `1024–1066`, late attempts `1117–1155`. |
| Failed-throw live-ball continuation | Not supported | Unconditional reception and `owner = to`, `provider.ts:858–885`. |
| Public simulation checkpoint/resume | Not supported | `generate(settings)` entry; closure state `provider.ts:200–255, 693`. |
| Independent ball velocity across all phases | Partially supported | Batted frames have velocity; throw samples and snapshots do not. |
| Physically timed, arcing throws | Already supported | `throwing.ts:61–111`; forecasts share `throwFlight()`. |
| Overthrow / wide / short miss / dropped receipt | Not supported | No outcome variant in `ThrowRoute` or `SimulationEvent`; unconditional receiving branch. |
| Unreachable airborne batted ball landing instead of a catch | Already supported | `movement.ts:74–76, 89–109`; provider releases runners on landing (`505–514`). This is not failure of an otherwise feasible catch. |
| Flight through an optional cutoff / intentional interception | Already supported | `throwing.ts:115–120`; `provider.ts:806–833, 878–879`. |
| Early backup assignments and readiness diagnostics | Already supported | `provider.ts:224–275`; `defense.ts:1413–1528, 1680–1710`. |
| Automatic loose-ball pursuit after a throw | Not supported | `MovementEngine.field()` only plans initial batted contact (`movement.ts:23–206`); no loose stage in `defense.assign()`. |
| Retrieve initial batted balls in outfield / after wall carom | Already supported | `trajectory.ts:178–245`; `movement.ts:35–137`. Not a thrown-ball recovery API. |
| Reassign coverage after a recovery | Partially supported | Coverage/role allocator exists; recovery event and nullable possession integration do not. |
| Runner advances beyond first planned goal | Partially supported | `baserunning.plan():83–105` for hit situations; no infield-error opportunity model. |
| Runner stop / retreat / reverse | Already supported | `baserunning.ts:136–179`; signed motion and first-base turns in builder. Full rundowns absent. |
| Simultaneous reactions to loose throws | Not supported | No error-observation trigger or retrieval-time forecast. Existing runner arrays/shared clock are reusable. |
| Force/tag, base occupancy, scoring checks | Already supported | `defense.ts:49–63`; `provider.ts:938–989`; `timelineBuilder.ts:527–608`. Need new-path validation. |
| Legal completion after a loose throw | Not supported | End loop assumes held possession (`provider.ts:1068–1188`). |
| Batted-ball boundary awards | Already supported | `trajectory.ts:193–199`; `provider.ts:205–218, 518–525`. |
| Thrown ball entering dugout/stands / overthrow awards | Not supported | No throw boundary event or throw-specific award handling. |
| Mobile bottom generation bar | Already supported | `DynamicControls.tsx:477–489`; `styles.css:969–986`. |
| Field-first quick editing | Already supported | `App.tsx:403, 442–472`; `components/FieldSetup.tsx`. |
| Include Error setting/toggle | Not supported | Absent from `DynamicSettings`, defaults and controls. |
| New feature's device performance / human reaction calibration | Unverified | No error implementation or measured error-recovery workload yet. |

## D. Relevant Code Map

| Repository path / symbol | Relevant lines | Responsibility |
| --- | --- | --- |
| `src/App.tsx`, `App`, `generate`, `pick` | 41–81, 98–148, 403–472 | Draft/generated boundary, generation guard, field-first integration. |
| `src/components/DynamicControls.tsx`, `DynamicControls` | 31–53, 73, 477–490 | Measured action bar outside advanced settings. |
| `src/components/FieldSetup.tsx`, `StartingSituation`, `QuickHitEditor` | 1–102 | Existing direct field/situation editing. |
| `src/styles.css` | 940–986, 1108–1161 | Desktop sticky/mobile fixed bar; overlay offsets and landscape layout. |
| `src/dynamic/types.ts`, `DynamicSettings`, `BattedBall` | 35–85 | Generation input and initial contact result/trajectory. |
| `src/dynamic/types.ts`, assignments, routes, runners, events, metadata | 87–340 | Tactical jobs, receiver reservations, legal runner state, diagnostics. |
| `src/dynamic/provider.ts`, `DynamicPlayProvider.generate` | 158–344, 407–640 | Contact preparation, local state and initial batted-ball timeline. |
| Same, local `performThrow` | 693–1021 | Route commitment, release, flight, unconditional reception, out resolution, follow-up. |
| Same, ending and emitted result | 1024–1299, 1352–1370 | Special continuations, bounded finishing, scoring/termination metadata. |
| `src/dynamic/throwing.ts`, `throwingProfile`, `throwFlight`, `throwSamples`, `cutoffCrossing` | 13–39, 73–120 | Shared analytic drag/gravity flight, sample compilation and cutoff reachability. |
| `src/dynamic/trajectory.ts`, `predictTrajectory` | 60–139, 142–247 | Home-contact launch, bounce/roll/wall integration; bounded 30 s physical horizon. |
| `src/dynamic/movement.ts`, `MovementEngine.field`, `.starting` | 23–206, 208–244 | Initial all-nine interception search and strategic starting positions. |
| `src/dynamic/defense.ts`, `isForced`, `ThrowingEngine.returnTime` | 49–99 | Live force chain and runner return estimates. |
| Same, `DefensiveDecisionEngine.choose`, `.arrival`, `.assign` | 286–678, 681–734, 736–1713 | Candidate ranking, route/receiver timing and all-nine allocation. |
| Same, `backupPoint`, `.travel`, `.release`, local `cover`/`backup` | 182–192, 211–253, 1003–1193, 1414–1483 | Physical support geometry, momentum-aware timing, base coverage. |
| `src/dynamic/baserunning.ts`, `BaserunningDecisionEngine` | 9–35, 37–143, 144–179 | Runner creation, legal goals, hit-dependent upgrades, receipt-time retreats. |
| `src/dynamic/runningGeometry.ts` | 1–288 | Route length, first touch versus settling, signed velocity, crossing roots. |
| `src/dynamic/receiving.ts`, `planMovingReception` | 1–82 | Controlled moving first/second-base reception; glove versus bag/control. |
| `src/dynamic/timelineBuilder.ts`, `TimelineBuilder.interval`, `.retire` | 150–524, 527–608 | Concurrent motion, crossing events, occupancy, outs and pending runs. |
| `src/simulation/types.ts`, `BallAction`, `PlayPhase`, `Snapshot` | 88–142 | Shared playback schema; optional receiver permits ownerless travel. |
| `src/simulation/timeline.ts`, `sample`; `timedPath.ts`, `sampleTimed`/`sliceTimed` | 15–84; 3–33 | Pure playback reconstruction and timed physical interpolation. |
| `src/simulation/scenarioValidation.ts`, `validateScenario` | 5–169 | Structural, continuity, receiving, ownership and occupancy invariants. |
| `src/dynamic/diagnostics.ts`, `inspectDefense` | 14–221 | Settings, physical paths, positions, timing and assignments for reproduction. |
| `src/dynamic/messages.ts`; `src/i18n/ui.ts` | messages 80–100, 201–203; UI 38–41, 104–112 | Typed EN/JA messaging and current scope/limitations text. |
| `src/hooks/usePlayback.ts`, `tickPlayback`/`usePlayback` | 5–85 | Browser clock/seek/step behavior; no baseball decisions. |

Core dependencies are local TypeScript modules; React/ReactDOM render the app. Vite loads/builds, Vitest runs model tests, and Playwright Core runs browser suites (`package.json`). No physics framework or external service is needed or present for this feature.

## E. Throwing Error Feasibility

### Observed throwing mechanics

`DefensiveDecisionEngine.choose()` considers the bases runners are actually attempting, force/appeal versus tag requirements, ball arrival and runner first-touch time, run prevention and continuation prospects (`defense.ts:286–678`). Explicit coach targets can override automatic ranking (`589–615`). `assign()` allocates a base receiver using eligibility, middle-infielder preferences, travel time and committed reservations (`1003–1193`). A base target and the receiving fielder are separate concepts.

The route can be direct, through-cutoff, actual relay, cutoff-hold, carry or hold (`types.ts:160–174`). Every released leg uses the actual compiled release position, throwing profile and shared `throwFlight()`. Preparation includes planting/braking and waiting for a receiver when needed (`provider.ts:737–805`). Throws are moving balls, not instantaneous transfers. The low-arc solution uses 9.81 m/s² gravity, 0.08 s⁻¹ drag, release/receipt height 0.8 m and a 45-degree limit (`throwing.ts:43–111`). Release speeds depend on thrower, distance, pivot context and arm-strength setting.

**A miss cannot happen naturally under this model:** `throwSamples()` ends at the destination, clamps path progress to one and height to at least receipt height. `performThrow()` emits glove contact and receives unconditionally. A receiver arriving late produces waiting before release, not a failed catch. “Moving receiver missed…” is an integrity exception, not a simulated error (`provider.ts:886–889`). Merely deleting `ThrowReceived` would leave ball/owner/out assumptions inconsistent.

Base and relay flights share physics. Actual relay receipts change possession and reopen choices; a through-cutoff throw goes to the base unless the special catchable-height interception branch applies (`provider.ts:733–734, 806–833, 893–933`). Recovered balls could use those throwing primitives **after** a new recovery branch establishes genuine secure control.

### Error shapes and required physical work — proposed

| Shape | Required extension | Initial suitability |
| --- | --- | --- |
| Elevated overthrow beyond receiver | Perturb the released launch elevation within a bounded physical profile; compute height at the intended receiver, prove the throw is beyond reachable height, and continue the same flight until interception/ground impact. Continue bounce/roll from actual velocity. | **Recommended first.** Retains the intended throwing lane and makes behind-the-receiver backup directly instructional. Limit to safe central lanes. |
| Wide throw | Perturb world-space azimuth; evaluate whether the receiver can adjust and catch; continue the missed flight and retrieval from its real lateral trajectory. | Feasible later. Adds lateral reach/adjustment policy and more foul-boundary cases. |
| Short / bounced throw | Model ground impact before receipt, bounce height/timing, scooping versus missed catch, and continuation/retrieval. | Highest initial behavioral ambiguity. No current thrown-ball one-hop/scoop model; defer. |

An unchanged accurate launch followed past the receiver is not necessarily an inaccurate throw: it is a missed catch, and may remain catchable. Moving its endpoint behind the bag alone can also leave it catchable at the bag. The launch perturbation must cause a verified miss rather than simply instruct the receiver to ignore a ball within reach. An adjusted overthrow may pass high at the receiver and then be caught by a backup or bounce and be retrieved; no contact should occur through a player's catchable envelope without an explicit resolution policy.

`predictTrajectory()` has useful impacts, rolling friction, stop detection and wall mechanics, but its public API derives launch from contact settings, starts at home and uses different airborne integration/drag from throws (`trajectory.ts:60–139, 142–247`). It **cannot** be called with a new aim to restart a loose throw without resetting position/velocity and changing physics. Introduce an explicit continuation-from-position/height/velocity helper, preserving throw drag through flight and calibrated ground response at impact. Keep accurate throw prediction/compilation unchanged. A broader unified integrator is optional, not a prerequisite or permission for unrelated refactoring.

## F. Defensive Recovery Feasibility

### Reusable responsibilities

`AssignmentType` already distinguishes `CoverBase`, `BackupThrow`, `BackupFielder`, `Relay`, `Cutoff`, `RelayTrailer`, `RecoverPosition`, `PossessBall`, `ChargeBunt` and others (`types.ts:16–34`). `RecoverPosition` means positional recovery, **not retrieving a loose throw**. `FieldBall` is currently the designated initial batted-ball pursuer. Intentional relay/cutoff receiving is a separate reserved action.

`backupPoint()` places support beyond the receiving position in physical space; conventional depth is 8 m, secondary support 13 m (`defense.ts:182–192`; `conventions.ts:66–78`). Allocation avoids already-consumed players, weighs arrival against the deadline, and reports late support (`defense.ts:1413–1528, 1680–1710`). Contact anticipation and release reassessment exist independently of any error setting. These should remain the source of initial backup duties in both modes.

The map allocator assigns one job per fielder (`defense.ts:747–796`); base/home coverage, primary possession and fixed receivers take precedence over optional support. Relay reservations prevent moving a committed receiver away during flight. Recovery must release an obsolete intended receiver reservation at the appropriate observed failure, not globally disable that safeguard.

### Measured pitcher-to-second example

Read-only probe used `defaultSettings()` plus:

```json
{
  "ball": {"type": "Bunt", "destination": {"x": 500, "y": 650}, "strength": "hard"},
  "anticipateBunt": true,
  "aggression": "aggressive"
}
```

Defaults include R1, zero outs, average runners, standard defense/arm and automatic throw selection. Times below are playback seconds, including the one-second Ready phase (`provider.ts:353–359`).

| Observed event / duty | Measured current behavior |
| --- | --- |
| Initial jobs, time 0 | P fields; SS covers second; 1B covers first; LF backs the initial fielding; RF backs second; C backs first; CF holds `(500,175)`. |
| P secure pickup | 3.359320 s. |
| P release to SS at second | 3.709320 s. |
| SS secure receipt and R1 force out | 5.113370 s. |
| RF second-backup target | `(500,338.2396357902826)`, behind second relative to P's lane. |
| RF readiness at release | 4.408510 s remaining travel versus 1.404050 s until secure receiving deadline: explicitly `late-backup`. |
| Other release duties | 3B recovers third; SS/1B retain receiving/coverage jobs; CF still holds. |
| Final | One out, BR on first, zero runs; completion 11.048393 s. |
| Integrity / repeat | `validateScenario()` returned `[]`; a second generation from identical settings was JSON-identical. |

This disproves the assumption that **CF necessarily backs P-to-second**. Current code selects from available outfielders by travel/readiness with a small preference bias; proximity in the drawn image alone is insufficient on the physical projection (`defense.ts:1450–1465, 1514–1528`). In this fixture RF is selected. The request's educational expectation needs explicit coaching review. Do not silently change clean-play assignments while implementing errors.

A second probe, `Ground ball`, hard, aim `(500,590)`, aggressive runners, no bunt anticipation, produced P→SS→1B with two genuine force outs at 3.717565 and 5.386648 s; CF initially held and RF again had late second backup. This confirms successive ordinary defensive actions without demonstrating failure recovery. Both probe scenarios validated and reproduced identically.

### Missing recovery behavior

`MovementEngine.field()` already searches all nine for reachable ball heights and earliest batted interception, refines contact time and can retrieve a stopped ball in the outfield (`movement.ts:35–137`). But it assumes an initial contact trajectory, initial positions, zero initial movement in its approach timing and the original reaction delay. It does not accept an arbitrary loose trajectory and current defender velocities. Calling it again unchanged would lose momentum and reset baseball context.

`updateAirReads()` is another useful precedent: it examines future catchable trajectory frames using current locations and optional current velocities (`src/dynamic/airborne.ts:140–199`). It classifies airborne contact for runner reads; it neither selects a loose-throw retriever nor compiles that recovery. Reuse the current-state reachability approach, not the entire airborne-contact rule set.

Proposed recovery planning must:

1. Continue the ball independently; no secure owner exists while loose.
2. Evaluate reachable interception/retrieval from **current** positions and velocities after a detection/read delay, including the already-moving backup and other eligible defenders. Backup status should help through better position, not guarantee possession.
3. Assign one primary loose-ball pursuer; retain another fielding backup and genuine base/home coverage as appropriate. Add an explicit loose-ball stage/reason, or explicitly parameterize `FieldBall`; do not label loose-ball chasing as base coverage.
4. Preserve smooth motion during reassignment and honest late/unfulfilled diagnostics. A late backup may still retrieve after the ball passes the base; base-reception lateness is not the same deadline as loose-ball interception.
5. On touch, show gather before secure possession; then use actual recovery position/velocity for throwing and reassignment.

Existing outfield pursuit and motion are useful building blocks. **Sensible recovery will not emerge from the positioning allocator alone.** Its source/owner/stage assumptions, original return context and completion cancellation all need deliberate integration.

## G. Baserunning Feasibility

### Observed decisions and timing

`BaserunningDecisionEngine.create()` makes independent runner records sorted lead-to-trailing (`baserunning.ts:9–35`). `plan()` applies legal/forced initial goals, contact reads, lead-runner blocking and discretionary hit advances; it computes candidate base times versus retrieval/return/tag time with aggression margins (conservative 1.6 s, normal 0.4 s, aggressive −0.65 s; `37–143`). Speed and aggression are separate.

`baseTouchTime()` and `runningAdvance()` share route/momentum calculations (`runningGeometry.ts`; tests in `defensiveV2Corrections.test.ts:30–125`). The builder splits at actual crossings, maintains occupancy separately from continuous progress, and tracks run-through/round/read/return (`timelineBuilder.ts:150–179, 214–334, 404–524`). Force chains are reevaluated from live statuses and progress (`defense.ts:49–63`), not awarded from the original diagram alone.

Goals can change after initial contact, airborne reads, landing, pickup and an intended target decision (`provider.ts:427–484, 505–514, 638–674`). Actual relay/cutoff receipt calls `reconsider()`; non-aggressive, unforced runners can retreat under its limited timing policy (`provider.ts:893–895`; `baserunning.ts:144–179`). Runner events reassign defense, but **that callback does not generally re-run `running.plan()` on every event** (`provider.ts:276–344`; `timelineBuilder.ts:518–524`). Distinguish defensive reevaluation from runner-goal reevaluation.

### Consequences for the bunt example

| Desired outcome | Existing support / required work |
| --- | --- |
| R1 attempts third after missed second throw | Motion, timing comparison and lead-order constraints reusable. Current infield/bunt `plan()` lacks the loose-ball extra-base evaluation; add it. |
| BR attempts second | Extra-base motion reusable. Current infield approach sets straight run-through, and an incomplete overrun locks the goal to first (`baserunning.ts:58,108–109`). Add a legal observed-error transition from approach/overrun/read into a second-base attempt; do not teleport BR from foul-side overrun onto a rounding route. |
| Either runner holds | Existing hold/retreat machinery reusable; new retrieval and return timing estimates must make holding a genuine option. No automatic one-base award for a live in-play miss. |
| Recovered defender challenges third/second | Candidate ranking and force/tag resolution reusable after control. Generalize error continuation beyond original ball-type-specific follow-up branches. |
| Several runners react at once | Shared clock and lead-to-trailing evaluation reusable; introduce a coordinated read using the same ball snapshot, not sequential reactions that advance time per runner. |

Proposed reads should compare remaining running time with recovery interception/gather/preparation/return/receiver/tag time, preserving real velocities and live force legality. `ThrowingEngine.returnTime()` currently estimates from `BattedBall.fieldingPoint`, original fielder and a target hint (`defense.ts:78–99`); it is not a current loose-ball estimate and can misleadingly assume the ball is already controlled. Use an explicit recovery context rather than mutating the contact record to masquerade as an outfield hit.

No runner should react to Include Error or to the generator's future selected miss before visible evidence. For an initial version, an intended-receiver miss/pass event plus a bounded read delay is a simple explicit observation boundary. Later trajectory-based recognition can occur before that crossing, but requires a stated policy. Initial clean/error motion and goals must agree until the permitted observation; backup duties should agree regardless. Existing initial-contact forecasts are idealized, so this causal boundary must be tested explicitly.

Full rundowns and generalized throw-behind tag chases are outside the current model. Initial eligibility/read policies must avoid creating an unresolved between-base chase and must never declare a stranded runner safe solely to finish animation.

## H. Continuation and Termination

### Current live-play ending

Generation does **not** always stop at the first attempted out or first possession. It supports actual relay receipts/redirection, one designated additional outfield throw, an infield/bunt double-play follow-up after a real out, and up to two renewed late attempts (`provider.ts:893–1066, 1117–1155`). However, these are bounded explicit branches rather than a uniform loop for arbitrary defensive actions.

The finishing phase sets `opportunitiesClosed`, cancels obsolete support and assumes the ball is held. It advances remaining runners/read/returns and bunt third recovery; rechecks late opportunities at runner events, and brakes defenders (`1068–1229`). A 32-pass runner-resolution bound throws on nonconvergence. Two intermediate relays are allowed per return (`throwing.ts:51`; `provider.ts:699, 905–932`). Initial physical trajectories have a 30-second horizon and fail if they cannot stop (`trajectory.ts:18, 247`). No equivalent general loose-throw/action bound exists.

`retire()` guards duplicate outs, manages third-out legality and run disallowance (`timelineBuilder.ts:527–608`). Third outs stop live runner actions, with a separate cosmetic defensive braking interval (`provider.ts:1231–1271`). The provider emits `PlayCompleted` and one of three termination reasons: third out, boundary award, or no remaining defensive opportunity (`1283–1299, 1355–1360`). The latter is a result of the existing bounded control flow, not a universal proof that no possible baseball action remains.

### Required live-ball branch — conceptual, not implemented

```text
normal contact -> secure pickup -> prepare committed throw
  -> release accurate or selected inaccurate launch
     -> secure actual reception: existing out/continuation rules
     -> observed miss:
          no receiver possession, no out from planned receipt
          continue same world position/velocity/height
          release obsolete receiving reservations
          read loose ball; reassign pursuit/coverage; update runner goals
          advance to real interception -> gather -> secure recovery
          rank live defensive opportunity from recovery state
          throw/carry/hold; resolve and repeat within explicit bounds
  -> controlled ball + settled legal runners + no useful live action
     OR third out OR supported dead-ball ruling
  -> PlayCompleted
```

No public playback resume or runtime browser replanning is required: generate the complete interrupted/recovered timeline beforehand on the existing simulation clock.

Termination must include ball disposition. Settled runner goals alone do not end a loose-ball play. Finishing code must not conjure the old owner or cancel pursuit while the ball is still live. Require physically secure control and valid runner occupancy/turn completion, unless a third out or implemented dead-ball ruling closes play. A maximum action/time/event bound should reject generation with a diagnostic if resolution fails, preserving the last good UI play; it must not manufacture safe results or a legitimate-looking `PlayCompleted`.

### Boundaries and initial constraints

The park has meaningful fair-field geometry, an outfield fence and batted home-run/ground-rule-double awards. `geometry.isPlayable()` checks a fair-area polygon; `clamp()` is a screen rectangle, not a legal dead-ball boundary (`geometry.ts:76–83,145–170`). Backup points can use foul ground near first/third; this does not model dugout/stands collision geometry. The batted boundary routine assumes home-origin contact, original occupancy and batted-ball awards (`trajectory.ts:178–223`; `provider.ts:205–218`). **Do not reuse it to award a wild throw.** No thrown-ball award timing/boundary system is verified or present.

Proposed first-version constraints: one injected error, direct infielder-to-second throws, no carries or intermediate relay errors, bounded high miss that remains within a conservative central playable region throughout its continuation and recovery, and a finite recovery/action budget. If that physical opportunity does not exist, report no eligible error. Do not clamp a wild ball back onto the field, assume a real fence stops every throw, or guarantee a backup catch. Expand to foul-lane throws only with explicit play-area boundaries and throwing-award rules.

## I. UI Integration

The requested controls are already well positioned for a minimal addition:

- The single action bar is `DynamicControls`' `.generate-box`, **outside** `.advanced-settings` (`DynamicControls.tsx:73,477–489`). Desktop styling is sticky; mobile is a fixed bottom bar at widths ≤600 px or landscape ≤950×500 (`styles.css:940–986`). No separate mobile button needs to be introduced.
- The bar's `ResizeObserver` measures its actual height into `--generate-bar-height`, with visual viewport inset tracking (`DynamicControls.tsx:31–53`). Main padding and mobile quick-editor/focus-panel offsets use that height (`styles.css:969–982,1108–1113`). More height is supported structurally, but reduces available field space and needs layout testing, especially landscape/Japanese.
- Field-first editing is **implemented**, not merely planned: `StartingSituation`, direct field selection and `QuickHitEditor` share draft settings (`App.tsx:127–148,403,442–472`; `components/FieldSetup.tsx`). Keep the toggle in the action bar, not a field overlay or quick-editor requirement.

**Proposed:** a visible native checkbox labeled **Include Error** in the action row beside Generate on wider screens, wrapping into a compact row immediately above the full-width button on narrow phones. Use one DOM control, a generous label hit area (at least the existing 44 px control convention), keyboard/focus support and checked-state semantics. Do not hide it behind Configure or advanced settings. Japanese label length, loading/status text and landscape field visibility must determine whether the side-by-side layout actually fits.

Add a typed setting, default false, in `DynamicSettings` and `defaultSettings()`, validate it and clone it with generated metadata. `App` already retains draft settings across generations and compares them with `generated.dynamic.settings` for pending edits (`App.tsx:41–68`). Settings persist for the mounted session; only language has localStorage persistence in the inspected App (`153–157`). Do not claim reload persistence. Use the same shared draft setting across desktop/mobile, disable edits during generation consistently, and preserve the previous scenario until a successful generation completes.

No comparison subsystem is needed. Regenerating the same inputs is deterministic today. For no eligible error, preserve the scenario and show a concise translated informational result, not a validation failure or an advance award. Put labels/accessibility text in `src/i18n/ui.ts` and generated eligibility/error/recovery explanations in typed `src/dynamic/messages.ts`, with EN/JA parity as required by `AGENTS.md`. Current scope/model/run-through text explicitly says errors are unsupported (`ui.ts:104–105`; `messages.ts:84,100`) and will need a narrowly accurate update during implementation, not in this audit.

## J. Architectural Options and Error Selection

### Options grounded in the current code

| Approach | Tradeoffs | Recommendation |
| --- | --- | --- |
| Extend throw outcome alone | Natural location to choose a miss, but current code has no formal outcome union. Merely changing samples leaves automatic possession, outs, runner logic and finish assumptions wrong. | Necessary component, insufficient architecture by itself. |
| Generalized failed-action framework | Could eventually cover drops/bobbles, but pickup, first touch, secure catch, retouch and throw failure have distinct rules. Broad abstraction now risks disguising those differences. | Defer broad framework; introduce only explicit state/outcome distinctions needed by throwing. |
| Generic interruption/checkpoint/replanning engine | Makes external resume possible but would have to serialize closure flags, possession, reservations, pending runs and momentum. No public API exists to extend. | Excess scope for this feature. |
| Extend current chronological generation pipeline with explicit loose-ball continuation | Reuses shared clock, pure playback, motion and legal-out machinery. Requires a continuation helper/state context and integration with the provider's special branches. | **Preferred.** Model success/miss explicitly and resume from actual state inside generation. |
| Scripted alternate error sequence | Easy visual example but cannot establish real interception, runner choices, subsequent out timing or backup value. | Does not satisfy the requested behavior. |

A small explicit compilation context for possession/loose ball, current ball kinematics, event time, reservations, runner state and action budgets is justified. Avoid a wholesale rewrite of all clean decisions. Preserve immutable *contact facts* separately from the live recovery ball/source context: existing `ball.fielder`, `touchPoint`, `caught`, and `isOutfieldHit()` drive return support, running approach and continuation (`geometry.ts:175–178`; `defense.ts:897–910`; `provider.ts:995–1031`). Overwriting those facts to trigger an outfield branch would introduce incorrect bunt/catch/relay behavior.

### Selection and no-op applicability

**Recommend B within A:** automatically inject at the **first eligible actually released throw**, once per play, using a stable eligibility predicate. Do not pick a failed candidate/cancelled preparation or a carry. This is predictable and avoids a stochastic error engine. For the first scope, skip direct throws outside the safe geometry domain, relays, appeals and boundary-dead plays; record the reason and selected release/event identity.

| Situation | Proposed behavior |
| --- | --- |
| Routine caught fly, no return needed | Generate the ordinary catch; say no eligible throwing error occurred. Do not invent a throw or drop. |
| Grounder/bunt held or carried | Same principle; toggle does not demand a futile throw. |
| Multiple throws | First qualifying release receives the only miss. Derive later opportunities from the new state; do not replay now-obsolete planned follow-ups. |
| Early throw unsuitable, later released throw suitable | Use the later throw only if it genuinely occurs without altering earlier decisions to create eligibility. |
| No safe supported miss geometry | Leave the play normal and expose “no eligible throwing error” rather than silently claiming success. |

Approach C (fielding or throwing) adds rules and causal ambiguity immediately; reserve it for later stages. Guaranteeing an error would require changing the chosen situation/throw or rejecting otherwise valid plays. That undermines the coaching interpretation of the existing input. Prefer **an error where a suitable opportunity naturally exists**, clearly communicating no-op cases. Product wording/help should explain that qualification despite the simple toggle label.

### Reproducibility

There is no randomness in the inspected generation path; searches found seeded input generators in tests/audit scripts, not a production random error source (`trajectoryEdges.test.ts:145–148`; `scripts/defensive-audit-v2.mjs:75–84`). Identical settings reproduce complete clean timelines in tests and both probes. `dynamic.settings`, events, decisions and diagnostics already support debugging (`types.ts:309–321`; `diagnostics.ts:14–221`).

Keep selection and miss parameters deterministic for the initial implementation. Record eligibility policy/version, chosen throw ID, intended receiver/target, actual launch perturbation, observation time and recovery identity alongside settings/model version. A seed is unnecessary unless randomness is later introduced; if introduced, use an explicit stored seed and separate streams so enabling errors does not perturb unrelated contact choices. No user-facing comparison/reproduction UI is required.

## K. Risks and Testing

### Regression risks and evidence-driven checks

| Major risk / affected functionality | Required verification |
| --- | --- |
| Ball discontinuity, implausible arc, receiver “ghost catch” | Compare world position, height and velocity across release/miss/impact/recovery boundaries; assert actual miss outside receiver reach; no discontinuous extension of clamped `throwSamples()` (`throwing.ts:102–111`). |
| Teleporting / instant reversals | Reuse `planMotion` current velocity; sample all defenders and BR transitions through read/reassignment. Check speed/acceleration, continuity and physical route length, not just endpoints (`timelineBuilder.ts:187–212`; `defensiveAudit.test.ts:50–95`). |
| Invalid field positions / disappearing ball | Assert finite world/projected positions and conservative in-play eligibility; no `clamp()` used as a ball collision. Retain structural validator coordinate bounds (`scenarioValidation.ts:14–22,68–85`). |
| Stale owner / phantom force / duplicate out | No `ThrowReceived`, secure owner or out at missed receiver; exactly one owner after actual gather; live force versus tag and real base contact on subsequent attempt. `retire()` guards duplicates but must never be called from the obsolete success branch. |
| Conflicting pursuit and coverage | All-nine uniqueness on every snapshot; one primary retriever; base/home roles preserved/replaced; committed receivers released only when appropriate. Check early backup and real arrival deadlines, including RF/CF fixture. |
| Stuck runners / duplicate occupancy | Error reads process leading and trailing runners from one snapshot; test hold, advance, retreat, rounded and run-through BR; final occupancy agrees with physical position. Existing lead-goal policy alone does not prove new recovery decisions legal. |
| Force-chain / scoring regressions | Loaded/first-and-second cases, force removed by another out, third force versus timed tag, BR-before-first third out, prior scored runs and retouches. Preserve `timelineBuilder.retire()` scoring semantics. |
| Bunt integration | R1 rounding toward third, 3B recovery, charging/first rotation and moving-reception cancellation. `buntRecoverThird` route and BR straight approach are especially sensitive (`defense.ts:1252–1263`; `baserunning.ts:108–109`). |
| Relay/cutoff integration | No corruption of original contact support context, relay budgets, optional cutoff height/readiness or reservations. First release eligibility must skip unsupported legs. Test a later ordinary throw after a clean relay. |
| Endless live play / premature completion | Assert monotonic time and finite events/actions, no success completion while loose or a runner unresolved; supported normal termination for recovered hold, recovered out and third out. Exercise exhausted-budget diagnostic separately. |
| Playback / teaching / localization | Seek across miss, bounce, recovery, out and backwards; identical results regardless of order/language/speed; no auto-owner at intended target; meaningful phases rather than one phase per physics sample. EN/JA labels, responsibilities and no-eligible messages. |
| OFF-mode drift | Exact deterministic before/after clean scenario comparison after normalizing only newly added metadata/default fields. Preserve all existing outputs, assignment/timing decisions, authored scenarios and both matrices. Test absent legacy setting equivalent to false if supported. |
| Mobile performance and layout | Measure synchronous generation latency and phase/sample count on representative long recoveries; shared sampler walks past phases on every frame (`timeline.ts:20–31`). Bound candidate searches/actions; avoid repeated full trajectory copies per decision. Browser tests plus device profiling for actual responsiveness. |

### Existing infrastructure

- Vitest in Node; no browser is needed for engine testing (`vite.config.ts`; `package.json`). `validateScenario()` checks timestamps, paths, known players, unique movement, continuity, outs, occupancy, receiving positions and final base positions (`scenarioValidation.ts:5–169`). It is **not** a full legal-play proof or velocity/ball-energy validator.
- Validation currently expects any travel-to-held transition to identify the *actual* final receiver (`88–125`), and treats a receiver mismatch as failure. Ownerless `travel` samples can represent loose motion, but continued throw portions require a consistent `journeyId` to avoid “throw without possession” (`126–146`). Preserve that integrity check; don't globally relax it to allow detached throws. A later gather must name the retriever, not the missed intended receiver.
- `relayPhysics.test.ts:21–59` checks drag/gravity, endpoints, unreachable throws and cutoff height; later cases check actual receptions, early backup, reservation, two intermediate legs, interception and redirection (`293–404`). These are strong reusable patterns, not missed-catch tests.
- `defensiveAudit.test.ts:50–130` provides independent all-nine movement/localization checks and `649` onward retains the 576-case tactical matrix. `physicalMatrix.test.ts:13` onward adds 576 physical cases. `trajectoryEdges.test.ts:124–148` includes focused edges and 128 seeded combinations.
- `dynamic.test.ts:31–39,90–118,226–255,422–497` covers determinism, double-play continuation, third outs, retreats, force/tag and scoring. `baserunning.test.ts:174–214,311–350` covers occupancy, first-base approach, retired run-through, third-out freeze and outfielder selection. `defensiveV2Corrections.test.ts:30–125` checks first crossing and moving base contact.
- `tacticalCorrectness.test.ts:155–181` includes P-to-second/pivot and a bunt lead force; `584–608` explicitly checks renewed opportunity after hold. `buntsAndReturnSupport.test.ts:70–106,110–146` checks catcher transfer, rotating receivers, third-recovery convergence and LF support across possession.
- `scripts/defensive-audit.mjs` accepts JSON settings and an exact time without writing output unless requested. `defensive-audit-v2.mjs` writes extensive traces/flags with settings, replay seeds, outs/runner-touch ledgers and source identity. Those scripts are reusable but some assertions assume every throw receives successfully; adapt deliberately in the later implementation.
- `scripts/mobile-generate-browser.mjs` and `field-ux-browser.mjs` cover persistent generation, loading/validation, layouts, EN/JA, field editing and one action control. These provide the toggle's interaction/layout test locations. Historical browser pass statements are not evidence that a new toggle fits.

### Manageable initial new test set — proposed, no tests added here

1. **OFF equivalence:** a small checked-in clean baseline corpus spanning bunt, ground double play, caught fly, relay, boundary and force/tag scoring; exact normalized results/settings-absent versus false. Run existing suites/matrices unchanged.
2. **Miss physics:** deterministic central elevated launch; normal launch stays catchable and accurate, selected launch passes above receiver reach, conserves continuation at miss, then bounces/rolls/stops or is truly intercepted. No imaginary endpoint stop; no additional physics sample teaching phases.
3. **Requested P→second bunt:** use F's verified fixture. Assert initial jobs/motion agree with OFF until a legitimate observation; P really releases to SS; no intended receipt/lead force occurs on the miss; RF's preexisting late backup remains honest, CF is not teleported. Recovery winner is chosen by reachable timing; one true gather/control, legal later decisions and finite completion. Freeze expected new exact times only after the implemented physical model is reviewed.
4. **Timing-dependent runner outcomes:** variants with a promptly intercepted versus a longer rolling recovery, plus aggression/speed changes. Establish at least one hold and one extra-base attempt; check R1→third/BR→second only when the actual estimates allow them, and a recovery throw can record a real out. No test should require every runner safe or every error an extra base.
5. **BR timing edge:** miss detected before first, during straight overrun, and after return/read. Verify continuous legal motion and no false second-base occupancy/force.
6. **Multiple runners/outs:** R1+R2, R1+R3 and loaded; include one/two initial outs, force disappearance, base blocking, a runner holding and another advancing, recovered force/tag timing and third-out run accounting.
7. **Repeated actions/no eligibility:** no-throw fly, hold/carry bunt, unsupported boundary lane, cancelled throw and two successive throws. At most one injected error, correct stable eligible release, obsolete planned double-play leg cancelled; a genuine recovery follow-up must not consume/restore possession twice. Include recovery hold, recovery out and bounded-failure diagnostic.
8. **Playback/UI/localization:** exact forward/backward/restart samples through failure/recovery; no owner while loose; EN/JA coverage; default OFF, repeat generation, draft/application boundary, one toggle in action bar, keyboard and 320 px/landscape/Japanese layouts without field/transport overlap.

Use invariant checks over modest additional base/out/profile combinations once focused cases pass. Existing 576-case suites and future error-path matrix coverage serve different purposes; large counts do not establish coaching correctness or human calibration.

### Verification performed for this audit

- Production build: `npm run build -- --outDir /tmp/baseball-error-audit-build` **passed** (TypeScript + Vite). Output redirected outside the repository; no dependency installation.
- Unit suite: `npm test` **passed: 375 tests across 14 files**, including both existing 576-case matrices; captured verification run completed in 69.63 s. Log: `/tmp/baseball-error-audit-tests.log` (local audit artifact, not committed).
- Both SSR probes in F generated, passed `validateScenario()` and reproduced JSON-identically from identical settings.
- No browser suites or physical-device trials were run for this documentation-only audit. No new feature behavior is claimed verified.

## L. Recommended Implementation Stages

The proposed throwing → fielding → complex staging is sensible, but **Stage 1 must already include a complete recovery/runner/termination path**. A visual bad throw followed by safe declarations is not an acceptable intermediate feature release.

| Stage | Deliverable / acceptance gate | Relative complexity |
| --- | --- | --- |
| 1a: bounded simulation foundation | Explicit successful/missed throw outcome, ownerless ball kinematics, consistent physical continuation, recovery interception/gather, coordinated runner reads, actual subsequent defense and terminal invariants. Internal deterministic P-to-second fixture, no public toggle yet. | High; most of the architectural work. |
| 1b: first complete user feature | Default-OFF toggle, first eligible direct-to-second elevated overthrow, clear no-eligible result, EN/JA, full normal-mode regression and mobile checks. Preserve clean backups; review RF/CF convention explicitly. | Low UI work; medium-to-high integration/verification. |
| 1c: broaden throwing scope | Other in-play base throws and safe lanes, wider/shorter throws, more interception adjustments. Add boundaries/throw awards before allowing exits into unmodeled territory; keep one deliberate error per play. | Medium-to-high, dependent on geometry/rules expansion. |
| 2a: ground-fielding errors | Bobble/delayed control and ball passing a ground fielder, using new loose-ball/recovery context. Distinguish first touch from secure control and changing pursuit. | Medium-to-high once Stage 1 foundation exists. |
| 2b: dropped airborne catches | Integrate forces, first-touch tag-up, retouch, infield fly, runner reads and catch/out reversal correctly. | High rules risk; separate from simple ground bobbles. |
| 3: expanded live-play behavior | More recovery actions, relay-leg failures, additional miss shapes/decisions, fuller dead-ball and between-base chase handling. | High to very high if full rundowns/general arbitrary continuation enter scope. |

Approximate change surface for complete Stage 1: provider orchestration, throw/ground continuation physics, current-state recovery search, defensive loose-ball allocation, runner forecasting/first-base transitions, state/events/diagnostics, validation/tests, UI/state and bilingual messages. This spans several engine modules rather than a small isolated patch. No speculative calendar estimates are supplied.

Future implementation should update the existing tactical/physics/running/scope documentation as appropriate; this audit intentionally does not rewrite it.

## M. Open Questions

1. **Backup convention:** is RF's late backup with CF holding acceptable for the verified P-to-second play, or should a separately reviewed clean defensive-convention correction establish CF movement? This audit does not authorize or implement that correction.
2. **First-release scope:** accept a narrow direct infield-to-second initial release, with other plays explicitly reporting no eligible error, or require broader base-throw coverage before exposing the toggle? Broader coverage materially increases boundary and BR transition work.
3. **Observation/read policy:** detect a high miss at intended-receiver passage plus a delay, or model earlier visible recognition? The delay is a provisional coaching assumption, not verified human reaction data.
4. **Miss definition:** elevated overthrow beyond reachable glove height is recommended. Agree on a bounded launch envelope; do not make a catchable trajectory fail by fiat. Decide which other reachable defenders can attempt interception while protecting coverage.
5. **BR run-through transition:** what continuous, legal turn/read behavior should follow an error detected while BR is outside first? Current straight-run-through policy deliberately excludes that opportunity.
6. **Coach override during recovery:** does a specified original target apply only to the original throw, or also constrain recovered-ball choices? Automatic recovery ranking is recommended; silent permanent override may force futile throws, while silently ignoring it is confusing.
7. **Completion/action budget:** what bounded recovery/throw count is enough for the first scope? Define a failure diagnostic, not a fake safe outcome, when unsupported chase/loop behavior remains.
8. **No-op communication:** approve concise “No eligible throwing error in this play” output while leaving the requested contact/situation intact. Error probability, comparison tooling and official error scoring are unnecessary for the initial feature.
9. **Boundary expansion/calibration:** before foul-lane errors, specify actual modeled live/dead territory and thrown-ball award semantics. Surface/arm/read parameters also need local coaching review; passing consistency tests is not empirical validation.

## N. Overall Recommendation

**Proceed with a scoped implementation after review; classify the work as a moderate architectural extension with high behavioral/testing complexity.** A broad feature covering arbitrary throws, drops, boundaries and repeated recovery would be substantial. The existing event-driven compiler and physical movement make a focused implementation practical without replacing the engine or changing playback architecture.

The critical deliverable is an explicit **miss → loose ball → real interception/gather → live runner/defense decisions → legitimate conclusion** path. Reuse early backup allocation, current momentum, timed motion, force/tag adjudication and pure playback. Extend runner opportunity evaluation and BR approach transitions, and remove success-only ownership/termination assumptions on the error branch. Preserve the accurate branch when disabled.

Implement one deterministic central elevated overthrow first, with the verified pitcher bunt as an acceptance scenario, honest RF/CF backup behavior, no forced advancement and a subsequent defense/hold decided from actual timing. This provides a concrete test of the educational objective before expanding error variety.

### Documentation reconciled against source

Reviewed `docs/DEFENSIVE_AUDIT.md`, `DEFENSIVE_AUDIT_V2.md`, `DEFENSIVE_AUDIT_V2_IMPLEMENTATION.md`, `DYNAMIC.md`, `BASERUNNING.md`, `PHYSICS.md`, `TACTICAL_CORRECTIONS.md`, `THROWING_RELAYS.md` and `BUNTS_AND_RETURN_SUPPORT.md`. Historical exclusions of all R3 bunts, aerodynamic throws or multi-stage relays are stale for this checkout: source and tests now support ordinary fair R3 bunts, drag/gravity throw flight and up to two intermediate receivers. Historical claims of test counts/timing are not substituted for current execution. Conversely, documentation's absence of throwing errors/throw bounce recovery is confirmed by current source, not assumed. Authored prose mentioning bobbles/overthrows provides coaching notes, not executable failure simulation (`src/scenarios/index.ts:10,44,73`; `src/scenarios/author.ts:12`).
