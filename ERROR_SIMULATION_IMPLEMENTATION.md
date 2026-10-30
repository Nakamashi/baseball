# Defensive Throwing Errors and Live-Ball Recovery

## Implementation summary

Implemented an optional **Include Error** setting, OFF by default. The first actually released eligible direct infield throw toward second can become one deterministic elevated overthrow. The ball passes above the intended receiver, continues with gravity and drag, lands/bounces/rolls if not intercepted, and is recovered by a defender selected from actual movement and timing. Runners read the observed miss; subsequent defense is ranked afresh after secure recovery. A miss grants neither possession, an out nor an extra base.

The feature extends the existing synchronous chronological generator. Playback still samples a completed timeline; no browser-time decision engine, external checkpoint API, comparison mode or new dependency was introduced. The clean branch is preserved and checked against hashes captured before implementation at source `8c132aeade11f9b1f03132f34bc2005ca0099a52`.

## Changed modules

| Area | Files | Change |
| --- | --- | --- |
| Physics and recovery search | `src/dynamic/throwing.ts`, new `src/dynamic/throwRecovery.ts` | Exact arbitrary-state thrown-ball advancement; elevated launch, conservative geometry, impacts/roll/stop, competing current-momentum interception plans, explicit failure/budgets. |
| Chronological orchestration | `src/dynamic/provider.ts` | Eligible release selection; missed versus received branch; loose-ball pursuit, gather, fresh defensive attempts, terminal checks and recorded diagnostics. |
| Runner decisions and physical first touch | `src/dynamic/baserunning.ts`, `runningGeometry.ts`, `timelineBuilder.ts` | Coordinated error reads and live return estimates; controlled stop on first when braking room exists; deferred departure after an existing run-through/return; precise error-path base touches. |
| Assignments, state and inspection | `src/dynamic/types.ts`, `defense.ts`, `diagnostics.ts`, `src/simulation/types.ts` | Explicit ball-control states, `PursueLooseBall`, error/recovery events, eligibility/launch/recovery metadata, loose playback status, accurate missed-throw timing ledger. |
| UI and language | `src/App.tsx`, `src/components/DynamicControls.tsx`, `src/styles.css`, `src/i18n/ui.ts`, `src/dynamic/messages.ts` | One accessible toggle in the existing measured generation bar; no-eligible notice; localized safe-generation failure and coaching messages; updated limited scope. |
| Regression coverage | `src/tests/throwingErrors.test.ts`, `src/tests/fixtures/{clean-error-baseline,error-recovery-cases}.json` | Clean equivalence, actual error physics/recovery, runner choices and first-base continuity, subsequent tags, scoring, occupancy, budgets, localization and deterministic sampling. |
| Browser coverage | `scripts/error-browser.mjs`, `package.json`, `.github/workflows/defensive-v2.yml` | New browser command and CI step for feature, language, action bar, repeat/loading/failure behavior and small-screen clearance. |
| Documentation | This report; relevant current dynamic/physics/running/relay/tactical/defensive notes | Support boundaries and separate RF/CF coaching finding. |

The preexisting `ERROR_SIMULATION_FEASIBILITY_AUDIT.md` is retained unchanged.

## Throw and recovery lifecycle

1. Generate the original batted ball, pickup, runner goals, defensive choices and early backups using existing rules. The error setting does not change these decisions.
2. Complete throw preparation and any pre-release cancellation. Consider eligibility only at a real release.
3. For an eligible release, solve the smallest supported elevation that passes the intended receiving position at **3.2 m**, above the existing **2.25 m** maximum catch height. Preserve release speed/profile, physical release position and horizontal bearing. Verify no other defender's pre-recognition route already intersects the throw within the modeled catch envelope.
4. Compile the released ball to the receiver passage. Emit `ThrowMissed`, with no glove contact, reception, base touch or out at the missed receiver. Remove obsolete receiver/cutoff reservations only after passage.
5. Continue the ball during a **0.25 s** observation/read delay. Existing defenders retain their current jobs and momentum; runners retain their existing plans. At recognition, evaluate recovery candidates from actual positions and velocity.
6. Assign one `PursueLooseBall` job. Preserve live coverage and useful existing backup jobs where they do not conflict. Read all runners from one observed state; hypothetical timing calculations do not advance the live clock.
7. Advance to the actual reachable ball point. Ground contacts generate meaningful bounce events rather than a phase per numerical sample. Check that the selected defender physically reaches the ball.
8. Emit `RecoveryTouched`, then an unsecured gather: **0.12 s** for an airborne reception or **0.25 s** for a ground pickup. Only `RecoverySecured` establishes secure recovered possession.
9. Rank fresh automatic defensive opportunities from the actual holder, locations, velocities and live runners. An original coach throw override controls the original action; it does not force every recovered return toward an obsolete target. Reuse the existing preparation, receiving, force/tag and scoring rules for useful subsequent actions; hold when none is viable.
10. Complete only with secure possession and settled legal runners, or a valid third-out rule. Finite bounds fail generation explicitly rather than generating a fake safe/out conclusion.

`BallControl` distinguishes secure possession, released flight, loose ball and gathering. `DefensiveAuditFrame.ballControl` is authoritative for secure possession on the error branch; its older `owner` field remains the contextual last actor for compatibility. Playback ownership comes from actual ball actions and is absent throughout loose travel and unsecured gathering.

## Physics and continuity

`advanceThrownBall()` uses the same isotropic linear-drag/gravity equations as accurate throwing, from an arbitrary world position, height and velocity. It does not restart a contact trajectory at home. Airborne drag is **0.08 s⁻¹**, gravity **9.81 m/s²**. Launch speed is the existing feed/infield/pivot profile with the existing arm-strength adjustment.

The miss path continues until a natural stop for eligibility/prediction, although actual playback truncates it at a real interception. Landing uses the existing ground response assumptions: horizontal retention **0.82**, vertical restitution **0.42**, transition to rolling for small hops, and **1.2/1.8 m/s²** inner/outer rolling resistance. Ground impacts legitimately change velocity; ordinary phase boundaries do not. No throw endpoint stop, screen-edge collision/clamp, boundary award or guaranteed backup catch is used.

Timed playback portions share one journey identity across miss/read/bounce/recovery splits. The structural validator still rejects detached throws and incorrect receiving/ownership transitions. Full launch samples/velocities and impact events are retained in error metadata for independent inspection.

## Eligibility and supported region

There is at most **one injected error per play**, selected in chronological release order. Eligible actions currently require:

- A direct, actually released throw to second, with an infielder throwing after a ground ball or ordinary fair bunt.
- No carrying/hold, caught-ball/appeal case, actual relay leg or optional through-cutoff error.
- Release-to-receiver distance **15–38 m**; release within **15 m** laterally of center, **4–37 m** into fair territory; bearing toward center with lateral direction component at most **0.55**.
- A physically reachable elevated miss within the existing **45°** launch limit.
- The entire untouched continuation stays in the conservative supported region: **3–95 m** into the field, less than **30 m** from center laterally, at least **2 m** inside either foul-line wedge, and **10 m** short of the modeled outfield fence. No physical point is clamped to satisfy eligibility.
- No other existing pre-recognition defensive route supplies an intervening catch at reachable height.

These are explicit engineering scope bounds, not baseball rules or measured youth-error distributions. Stronger arms or some otherwise ordinary direct throws can be ineligible because the untouched roll would exit this region. The situation and throw are left unchanged in those cases.

When no suitable release occurs, a normal play is generated and a compact EN/JA notice says **“No eligible throwing error occurred in this play.”** Metadata distinguishes no released throw from all releases being ineligible and records the reason at each considered release. Cancelled preparations and carries never consume the one-error selection.

Unsupported: wide/short throws, intentional one-hop receiving/scoops, fielding bobbles or dropped catches, errors on relay/cutoff legs, foul/dugout/stands exits and their awards, full rundowns and general human misreads. The central miss/read policy must not be generalized to those cases without the corresponding rules and geometry.

## Defensive recovery and coverage

The primary is the earliest feasible controlled interception among P, 2B, SS, LF, CF and RF. C and the corner fielders retain home/corner coverage priority in this narrow central-lane version. This is a declared limited eligibility policy, not a claim that a catcher or corner infielder may never recover a ball in real baseball.

Each candidate uses `planMotion()` with the actual current velocity, acceleration and top speed. The current implementation conservatively requires controlled arrival at the ball's sampled point; it does not claim a diving catch or use a guaranteed moving glove extension. A stopped ball can be retrieved later. Existing backups gain an advantage only through their actual position/momentum. The recovery winner is not chosen by its assignment name.

During pursuit, ordinary base/home coverage is reevaluated for live runner goals with the pursuer reserved. An existing `BackupThrow` is retained when the alternative is free holding/support and no receiving duty conflicts. No `RecoverPosition` job is relabeled to conceal loose-ball pursuit. The provider checks the actual compiled interception before gathering.

## Runner behavior and first-base legality

The recognition boundary is receiver passage plus the bounded read delay. Before that boundary, enabling errors does not alter runner movement or goals.

At recognition, each active runner evaluates one discretionary additional base, in lead-to-trailing order, without advancing time. Estimates include remaining recovery, gathering, actual current-momentum defender projections, receiving readiness, throwing preparation/flight and force/tag requirements. Previously selected leading intentions are included in later candidate coverage, while every runner still shares the same observed ball state. Existing aggression margins remain **1.6 s conservative**, **0.4 s normal** and **−0.65 s aggressive**; speed is not increased to grant bases. Holding is a genuine result; an accepted risk may produce a later out.

BR retains the straight route already traveled. If the error is observed before first with enough physical braking room, BR may brake to a stop **on first**, touch it, then accelerate toward second. No curved pre-first route is substituted beneath the runner. If a run-through has already begun, or there is not enough braking room, a possible onward attempt must include the existing stop/read/return first; its extra cost is included in the decision. A deferred goal activates only after a real return to first. In many eligible plays that makes BR hold while R1 can attempt third.

New controlled-stop progress retains sufficient precision to prevent the ordinary near-integer display snap from creating an early base touch during braking. Forecast touch time and compiled crossings are independently checked; the clean path retains its original numerical behavior.

This is still an idealized model of reading a known moving ball after recognition. Reaction delay and aggression margins need coaching/empirical calibration. It does not model arbitrary throw-behind chases or full rundowns.

## Subsequent defense and completion

Recovery decisions use automatic target selection even when the original action was a coach override. They reuse actual force chains, receiver reservations, glove versus secure control, bag contact, tag timing, duplicate-out guards, third-out freeze and run accounting.

The error branch permits up to **12 further defensive actions** (including cancellation/relay continuation calls), a **60 s live-play horizon**, a **25 s** loose-trajectory/retrieval planning horizon and the existing **32-pass** runner-resolution guard. Existing relay and late-opportunity bounds remain. The engine checks for unresolved runner motion, missing secure possession and a remaining viable supported out before successful completion. Limits never award bases or fabricate an out.

`ErrorRecoveryFailure` causes a localized generation failure. `App` retains the prior generated scenario, as with existing generation failures. Diagnostics retain the exact selection, release, observation, physical continuation, recognition positions/velocities, candidate recoverers and control times.

## UI behavior

The checkbox is labeled **Include Error** / **エラーを含める**, starts OFF, uses the shared draft settings, and persists through successive generations in the mounted session. It sits alongside Generate in the **existing** `.generate-box`, outside advanced settings. It has a 44 px label hit area, native keyboard/checked semantics, an EN/JA scope tooltip, and is disabled during generation.

The compact single-row layout places the label beside a flexible button without adding a second bar. Mobile continues to use the existing fixed action bar, ResizeObserver height measurement, visual viewport inset and field/editor padding/offset rules. No-eligible information uses a small status message. There is no comparison mode or large new teaching panel. New browser coverage includes 320×568, 390×844, 844×390, desktop, English and Japanese; execution limitations below must be resolved before claiming those layouts visually verified.

## Verification

### Captured baseline

Before engine changes, `npm test` passed **375 tests in 14 files**. A 16-situation JSON corpus records settings, meaningful events and SHA-256 hashes of complete compiled scenarios. It covers ordinary grounders, the verified bunt, a double play, caught fly, deep relay, boundary home run, forces, tags and scoring.

The new equivalence tests regenerate every corpus entry with the setting omitted and explicitly false. They normalize **only** the new `includeError` setting field; no timings, positions, messages, decisions, phases, trajectories, outcomes or existing metadata are removed from comparison.

### Automated feature checks

The focused suite checks:

- Real P→SS bunt miss, no phantom force/reception, early RF backup preserved, actual CF recovery, genuine gather and ownerless travel.
- Analytic release speed, arc and continuous world position/height/velocity; physical impact energy loss; natural roll/stop; unsupported geometry rejection.
- Initial clean/error movement equality until the miss; current RF momentum; independently recomputed earliest recovery.
- Conservative holds, aggression-based attempts, shared-time multi-runner reads and legal occupancy.
- Continuous controlled first-base stop, exact first/second touching, preservation of already-started overrun/return, real recovered tag outs and recovery holds.
- Third-out/timed-run legality, no duplicate outs, multiple occupancies/out counts, one injected error, explicit budget failure and no-eligible plays.
- Pure forward/backward seeking, repeated generation, full EN/JA event/responsibility formatting and an accurate missed-throw diagnostic ledger.

Browser coverage is implemented in `npm run test:error:browser` and added to the existing browser regression workflow. It checks default OFF, keyboard operation, actual recovery messaging, repeated generation, loading guards, failure preserving the old play, no-eligible messages, English/Japanese, and bar/field/transport clearance on the listed viewports.

### Final execution results

| Check | Result |
| --- | --- |
| Unmodified baseline `npm test` | **375/375**, 14 files. |
| Final `npm test` | **414/414**, 15 files; both original 576-case matrices retained, all 39 new tests passed. Final recorded duration 78.43 s. |
| `npm run build` | **Passed**: TypeScript and Vite production build, 61 transformed modules. |
| `npm run audit:defense -- --settings /tmp/error-acceptance-settings.json --time 5.7` | **Passed**: `ballControl: loose`, no actual owner, missed initial throw with no glove/secured receipt; CF recovery recorded. |
| `node --check scripts/error-browser.mjs` | **Passed**. |
| `git diff --check` | **Passed**. |
| `npm run test:browser` | **Blocked before page execution** by Chromium socket `setsockopt: Operation not permitted`. |
| `npm run test:dynamic:browser` | **Blocked** by the same Chromium sandbox restriction. |
| `npm run test:mobile:browser` | **Blocked** by the same restriction. |
| `npm run test:field:browser` | **Blocked** by the same restriction. |
| `npm run test:error:browser` | **Blocked** by the same restriction; test is added to the existing browser CI workflow. |

The local Vite server also cannot bind its port (`listen EPERM 0.0.0.0:5173`). No browser/mobile screenshot, visual-layout or physical-device pass is claimed. The browser workflow is configured for verification in an environment that can launch Chromium; this task did not trigger remote CI, deploy or commit. These browser checks remain a review/release verification limitation.

A local warmed Node/Vite SSR probe of the acceptance scenario (15 generations) measured **15.7 ms median / 30.4 ms maximum**, **20 compiled teaching phases**, and **971 untouched overthrow physics frames**. The full scenario including existing movement/diagnostics plus error metadata serialized to approximately **1.03 MB**. These are local engineering measurements, not mobile performance guarantees. Only one scenario is generated at a time; the physics samples do not become individual teaching phases.

Temporary logs are `/tmp/error-implementation-baseline-tests.log`, `/tmp/error-final-tests.log`, `/tmp/error-final-build.log`, `/tmp/error-defense-audit.json`, and `/tmp/error-*-browser.log`; these are local evidence, not required runtime files.

### Exploratory evidence

A deterministic 576-input exploration of ordinary grounders, runner occupancies, out counts, arms and speeds produced **192 injected errors**, **zero generation failures** and **zero structural validation errors**. A separate 1,100-input seeded exploration varied continuous ground/bunt aims, strength, occupancy, outs, strategy, arm, speed and anticipation; after the intervening-catch guard it produced **538 injected errors**, **zero generation failures**, and useful BR-advance/recovered-out fixtures. These are consistency observations, not real-world error probabilities or a substitute for tests. Their selected settings are retained as fixed regression fixtures.

No outside sources, remote research or dependency installations were needed.

## RF/CF coaching observation

The audited bunt remains unchanged before failure: **RF backs second and is late for the clean receipt; CF holds its original location.** With the new observed miss, a deterministic reachability calculation selects **CF**, who starts from that held position and intercepts the rolling ball. RF continues from its actual preexisting movement; it is not teleported or awarded possession. This is an educationally coherent recovery of this modeled overthrow, but it **does not establish that the clean CF holding convention is optimal coaching**.

For the audited hard bunt at `(500,650)`, anticipated, R1, zero outs, average/aggressive runners, standard arm:

| Event | Playback seconds, including Ready |
| --- | ---: |
| P secure pickup | 3.359320 |
| P release toward SS at second | 3.709320 |
| Ball passes above SS | 5.040055 |
| Recognition / coordinated runner read | 5.290055 |
| CF reaches rolling ball | 8.511148 |
| CF secure recovery | 8.761148 |
| R1 reaches third | 9.677084 |
| BR returns to first; play completes | 11.048395 |

No out is recorded; R1 on third and BR on first are timing outcomes. Other fixed fixtures demonstrate recovered returns that tag BR at second, including a third out with earlier runs counted under non-force scoring rules.

The RF/CF allocation should remain a **separate coaching review**. No clean assignment convention, fielder speed or initial position was changed to make this feature succeed.

## Limitations and next expansion

- The error is intentionally deterministic and narrowly eligible. Repeating identical settings repeats the same selection/launch/recovery; a play without a suitable release remains normal.
- Recovery uses controlled, sampled interception with conservative coverage exclusions, not full reach/footwork or human perception. Calibration remains provisional.
- The full untouched continuation is checked for safe geometry, so some throws that could be intercepted early are conservatively excluded because their later hypothetical roll would leave the supported region.
- A maximum of one discretionary extra base per error observation keeps the decision scope bounded; later defensive opportunities are still evaluated, but there is no general multi-read arbitrary rundown agent.
- Real-device performance and mobile layouts require the browser/device verification described below; engine tests establish model consistency, not empirical realism.

Next expand direct infield throwing lanes within an explicitly modeled in-play region, improve current-motion moving interceptions and repeat runner reads, and review the CF/RF backup convention separately. Add throw-specific out-of-play geometry and award timing **before** allowing foul/dugout/stands exits. Wide throws and short/bounced throws need explicit receiver adjustment/scoop policies; dropped airborne catches should remain a separate later rules stage.
