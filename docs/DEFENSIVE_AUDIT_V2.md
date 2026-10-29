# Defensive Audit V2

Audit date: 29 October 2026. Production source: `8331a1c06e7d2e3d73cdb7f4407a241b3435b567`.

**The average-runner double-play concern is reproduced. There is also a separate, more substantial error in predicting a rounding batter's first touch, which causes apparently viable but impossible first-base challenges. No production gameplay mechanics have been changed.**

## A. Executive summary

| Coverage | Count |
| --- | ---: |
| Proposed baseline | 1,104 |
| Unsupported baseline combinations excluded | 72 |
| Valid baseline executed | 1,032 |
| Baseline combinations reinterpreted, still included | 120 |
| Additional controlled contact-strength variations | 724 |
| Additional anticipated-bunt variations | 104 |
| Focused double-play cases | 270 |
| Seeded input variations | 60 |
| Focused rules, catches and relay cases | 12 |
| **Distinct configurations executed successfully** | **2,202** |
| Additional identical-input determinism replays | 60 |
| Passed all checks without a flag | 328 |
| Flagged for a defect, model concern or advisory review | 1,874 |
| Failed implemented hard rules/integrity assertions | **0** |

The final batch took 98.066 seconds in this environment. Preliminary harness-development runs and individual investigations are not added to these totals. All final configurations generated successfully; all 60 determinism comparisons matched the complete generated scenario.

The highest automated severity per flagged configuration is **Critical 0 / High 97 / Medium 1,777 / Low 0**. These are scenario counts, not unique defects. Manual presentation findings are listed separately below. A flag is not automatically an incorrect baseball play: 1,812 configurations have late/space-limited support advisories and 227 have unavailable optional/intermediate support. These sets overlap. Preserving a necessary base instead of supplying an impossible optional backup can be correct.

| Finding | Severity and confidence | Affected configurations |
| --- | --- | ---: |
| First-touch forecast sometimes times a stop-and-return instead of the runner's first crossing | **High, confirmed timing/decision defect** | 51 |
| Stopped second-base reception imposes a systematic average-runner DP timing floor | **High, confirmed model bottleneck; appropriate physical correction needs validation** | 46 directly flagged |
| Relay continuation forecast omits the pending 0.15 s read interval | **Medium, confirmed forecast/execution discrepancy** | 8 |
| Pitcher wins reachable pop-up ties without a cooperative priority system | Medium, confirmed mechanism gap; system-dependent coaching recommendation | 8 |
| Glove contact and secure possession have identical displayed reception wording | Low, confirmed presentation ambiguity | Manually verified in the reported DP reproduction; not an automated per-case flag |
| Late base coverage | Medium advisory; includes harmless transient third-out snapshots | 12 |

Overall, the simulator has a useful, coordinated physical foundation and distinguishes many important baseball states correctly. It is not yet a reliable model of ordinary double-play opportunity or every live throw decision. The two High findings warrant attention before using these outcomes to teach timing or tactical judgment. Passing the existing tests did not expose them.

### Adjustments and exclusions

* All 72 bunts with an initial R3 are rejected by `validateSettings`: six directions × four R3-containing occupancies × three out counts. This restriction covers **all** bunts with R3, not only squeezes. Consequently ordinary fair-bunt defense with a runner on third, including bases loaded, could not be evaluated. This is a documented feature limitation, not a defensive failure assigned to a generated play.
* All 120 outfield-sector pop-ups were reinterpreted at **32 m** on the same azimuth. These test high infield/shallow-grass pop-ups toward those sectors, not conventional deep outfield pop-ups. Their normal 75° launch remains physically meaningful. No original combination was silently dropped.
* Shallow fly balls retain the production `Fly ball` definition. A low, short fly is possible; it need not be renamed a pop-up to fill the matrix. The distinct steep `Pop-up` profile is also tested.
* Ground aims specify direction/depth intent, not a stopping point or guaranteed fielder. A nominal shortstop or outfield aim can be intercepted by another position. Pop-up, line-drive and fly aims request first landing subject to launch limits.
* Bunt aims use short line bunts (10 m intent), pitcher (14 m), catcher/front of plate (3 m), and longer push intentions toward SS/2B (22 m). All remain fair and within the 25 m input limit. Contact profiles can stop short of the requested push depth. No ordinary bunt was deliberately aimed deep into the outfield.
* No foul balls, foul bunts, bunt pop-ups, errors, deliberate drops, deflections or full rundowns were invented. A naturally uncaught ball is covered; an error on a reachable catch is not modeled.

Every adjusted/excluded baseline ID, full setting and reason is retained in [matrix-exceptions.json](../audit/defensive-v2/matrix-exceptions.json).

## Method, architecture and independent reference basis

The harness calls the real `DynamicPlayProvider.generate`. It does not implement a replacement simulator or use prescribed outcomes. Complete settings, attributes, input seeds and production assumptions are saved. The engine has no RNG: seeds 17, 29, 101 and 997 generate reproducible input perturbations, not fictional randomized throws. The 60 seed variations span 15 important templates; each has a complete identical-input replay. Seed-dependent profile changes are recorded and are not presented as controlled one-variable comparisons.

Baseline strength is normal, with standard strategy, automatic throws, normal aggression and average runners. Ground and ordinary-bunt baselines receive soft/hard variants; selected outfield line-drive and tag-up configurations receive them where useful. The 104 additional bunt cases independently enable pre-pitch anticipation, including weak/hard line-bunt variations. The 270 DP cases use ten aim points × three strengths × three running profiles × three out counts. Labels identify aim zones, not promised scoring sequences. Strength presets sometimes change launch angle as well as speed; these are comparisons of the existing production profiles, not isolated exit-velocity experiments.

The dedicated strength group has 724 cases. The disjoint anticipated-bunt group contains 72 normal and 32 additional soft/hard cases; the DP grid contains 90 cases per strength. These counts are not double-counted in the 2,202 total.

| Production area | Representation and audit relevance |
| --- | --- |
| `types.ts`, `provider.ts` | Five contact types; coordinates, strength, occupancy, outs, profile, aggression, strategy, arm and fence settings. Provider compiles one deterministic play and records decisions/reassessments. |
| `trajectory.ts`, `geometry.ts` | SI world geometry with 27.43 m bases, 90 m corners and 120 m center; gravity, drag, bounces, surface resistance and boundary interactions. Schematic coordinates are projected to/from world metres. |
| `movement.ts` | Searches the continuing trajectory for feasible controlled interceptions by all nine defenders. Earliest touch wins; distance and stable position order break ties. The selected primary is known during generation. |
| `defense.ts`, `conventions.ts` | Ranked out opportunities, force/tag/appeal alternatives, full DP forecasts, carry/through/relay routes, base coverage, backup priorities and one assignment per player. Receiver and relay reservations persist through committed throws. |
| `baserunning.ts`, `airborne.ts`, `runningGeometry.ts` | Goals, velocity, leads, contact reads, first-base approach/rounding, advancement/retreat, retouches, tag-ups and infield-fly qualification. |
| `locomotion.ts`, `throwing.ts` | Acceleration/braking, controlled arrivals, release preparation, gravity/drag throwing, control intervals and bounded relays. The current throw speeds are release speeds, not the historical constant-speed assumptions. |
| `timelineBuilder.ts` | Splits at runner crossings; compiles movement and ball samples; records outs, possession, provisional runs and third-out resolution. |
| `simulation/timeline.ts`, `App.tsx` | Playback samples compiled physical paths without rerunning decisions. Event display rounds timestamps to one decimal and hides the event type. |

All actual defender and runner motion samples, ball samples, responsibilities, diagnostic runner snapshots and role changes are retained. Hypothetical untouched projection frames are omitted from the archive because actual ball paths are already saved; exact settings regenerate the projection. Duplicate path vertices are reduced to endpoints when the complete timed samples are present. Production timestamps are retained without display rounding, but the compiler itself quantizes event times to microseconds. This is not greater precision than the underlying model.

Independent hard checks reconstruct force chains from initial occupancy, preceding retirements, catches/infield flies and recorded touches; check unique outs, third-out scoring, base-touch order, physical runner base/retouch positions, catch-before-ground/wall contact, secure possession before release, physical receiver/base/tag proximity, all-nine assignments and finite ordered time. Both defender and runner sampled speeds are checked against their configured caps. They do **not** call the defense's `isForced` or `choose` functions to decide correctness. The existing structural validator is additional evidence, not the independent oracle. Exact hands/feet are absent; geometric checks use generous modeled reach tolerances (0.65 m receiving/base proximity and 1.2 m runner-tag proximity), not claimed rulebook measurements.

Decision timing is compared with actual crossings under unchanged runner goals. The DP floor is independently derived from rest-to-rest kinematics. Optional-support warnings originate in production diagnostics and are explicitly advisory; a second pass independently compares actual compiled base-backup positions with the relevant actual reception. A future-base backup is not mislabeled late for a different relay leg.

### References actually consulted locally

No internet access was required. The four supplied PDFs were extracted locally; the source files are identified by SHA-256 in [reference-provenance.json](../audit/defensive-v2/reference-provenance.json). The existing defensive audit, physics, baserunning, throwing/relay and tactical-correction documents and tests were also reviewed as historical/intended behavior, not as proof.

| Source | Relevant pages/rules | Application |
| --- | --- | --- |
| 2026 Official Baseball Rules | 5.06, 5.08(a), 5.09(a), 5.09(b)(4–6), 5.09(c); definitions of Catch, Force Play, Infield Fly and Tag | Ordinary fair-ball legality, first-touch tag-up permission, removal of forces, appeal distinction, unique outs and third-out scoring. No MLB-only competition procedures imposed. |
| Inside Baseball, Cutoff & Relay | pp. 3–5, 12–19, especially 17 | Ball-side deep relay, base coverage, actual throw lanes, pitcher backups and separate home cutoff. |
| Perry Hill | pp. 23–31, 38, 41, 43, 50–66 | Feeds/pivots that adapt to the received throw, moving footwork, bunt priorities, pop-up priority and coordinated relay alternatives. Page 41 is the active R1 bunt play; page 40 describes the preceding pickoff setup. |
| Baseball Positive | pp. 12, 80–91, 107–115, 118–124 | All-nine ball/base/backup responsibilities, communication, receiving, pitcher duties and coherent alternative rotations. |

The manuals differ. Baseball Positive uses P as a home cut-relay in some small-diamond systems; Inside Baseball p.17 uses 1B as home cutoff with P backing home/third. Perry Hill p.57 uses 3B as a home cutoff on some LF singles. This audit retains the repository's declared 1B-home-cutoff/P-backup system rather than mixing those incompatible allocations. Baseball Positive p.118 places P above C on pop-ups; Perry Hill p.38 places C above P. Both subordinate P to the other infielders. Neither qualitative manual supplies universal junior-high transfer times, speeds or numerical ordinary-effort thresholds. The current 5.3/4.7/4.2 s contact-to-first profiles and all throw/fielding parameters remain provisional engineering assumptions.

## B. Results by hit type

| Type | Executed | No flags | Flagged | Main result |
| --- | ---: | ---: | ---: | --- |
| Ground ball | 1,030 | 63 | 967 | DP coverage floor, first-touch prediction failures on later returns, and late support. Ground aims often become different legitimate fielders. |
| Line drive | 314 | 1 | 313 | 35 catches; most others are naturally uncaught. First-touch prediction failures cause unnecessary first-base follow-ups. Numerous flags concern optional relay support, not illegal outcomes. |
| Fly ball | 290 | 70 | 220 | 274 catches, one infield fly; includes legal tag-up, third-out catch, home run, two-base award and gap-return probes. |
| Pop-up | 240 | 166 | 74 | All caught in this ideal-read matrix; 40 infield flies. Eight pitcher-priority reviews. No generated error/missed-catch claim. |
| Bunt | 328 | 28 | 300 | All fair ordinary bunts within supported scope. No automatic second-base attempt on any of the 96 soft bunts. Corner, pitcher and catcher rotations exercised. |

Ground-ball and line-drive force/tag results remained legal under the implemented checks even when the decision forecast was wrong. That distinction matters: a useless throw can correctly end with a safe runner. Caught line drives release forces and returning runners receive retouch instructions; uncaught drives can release runners before landing following successive uncatchability reads. The focused caught-line case and existing airborne regressions retain those distinctions.

The 104 anticipated-bunt cases were fielded by P 54 times, 1B 20, C 16 and 3B 14. Across all bunts, soft contact selected first 71 times and third 25 times, **never second**. Normal/hard bunts sometimes challenged second or third when the timing supported it, or held when no useful out existed. A soft bunt can still yield a legitimate third-base challenge; soft contact alone does not prohibit all lead plays.

Representative first-line soft bunt: `anticipate-bunt-first-line-b1-o0-soft` has C secure at 3.822380, release to first at 4.172381, and 2B secure at 5.236805 before BR's physical first touch at 5.699999. SS covers second and 3B covers third from contact. The recent weak-bunt second-base restraint and early right-side third coverage remain intact in the sampled cases.

Representative first-and-second normal bunt: `anticipate-bunt-third-line-b3-o0-normal` has P secure at 4.266014, throw at 4.616014, and 3B secure a real third-base force at 5.482776. This is a defensible lead out, not an assumed sacrifice. Detailed all-nine traces also preserve corner-fielded anticipated bunts in the full archive.

## C. Results by defensive situation

| Initial bases | Baseline executed | Baseline flagged |
| --- | ---: | ---: |
| Empty | 138 | 98 |
| First | 138 | 113 |
| Second | 138 | 112 |
| Third | 120 | 90 |
| First and second | 138 | 108 |
| First and third | 120 | 88 |
| Second and third | 120 | 96 |
| Loaded | 120 | 94 |

Each out count has 344 baseline cases. Empty bases still require coverage/control and backups; they also expose the unnecessary return-to-first defect without a lead-runner complication. R1 situations expose the DP floor. R2/R3 and multiple-runner cases exercise third/home threats, forces that differ by occupancy, returning runners and run consequences. Loaded states exercise force removal and infield-fly qualification; loaded bunts remain unsupported.

With two outs, no throw was released after the recorded third out. Continuation attempts did not manufacture a fourth out. Some easy inning-ending plays still use second rather than first; an available legal force at second is a reasonable alternative and is not failed merely for differing from a preferred textbook choice. The first-touch forecast defect also appears in two-out returns and can prevent the defense from accurately recognizing that a supposed third-out chance is already gone.

### Double-play outcomes and sequence coverage

The controlled DP grid contains 20 zero/one-out cases for each strength/profile pair; the other 90 cases start with two outs.

| Contact | Slow: 2 outs / 20 | Average: 2 outs / 20 | Fast: 2 outs / 20 |
| --- | ---: | ---: | ---: |
| Soft | 0 | 0 | 0 |
| Normal | 20 | 0 | 0 |
| Hard | 14 | **0** | 0 |

These are deliberately chosen aim/profile configurations, not estimated real-world frequencies. Hard contact sometimes passes through the shifted infield, explaining why it can yield fewer DPs than normal contact in the same grid. A direction label cannot establish a missed opportunity. Six additional seeded average/strong-arm cases **do** turn hard-grounder DPs; their other input perturbations mean this is a sensitivity observation, not an isolated arm-strength experiment.

Successful grid sequences include 6-4-3 (8), 4-6-3 (4), 5-4-3 (6), 1-6-3 (6), 3-4-3 (8) and 3-4-1 (2). The production default sends 1B feeds to 2B rather than SS; 3-6-3 therefore did not emerge here. The code can use alternate ready receivers, but 5-6-3 and 1-4-3 were not observed. This is documented coverage, not a claim that all requested notation sequences were reproduced. The 3-4 alternatives are mechanically legal; adopting the more conventional SS pivot on a 1B feed is a coaching-policy question. There is no hardcoded two-out award.

### Tag-ups, relays and dynamic roles

`focus-loaded-relay` reproduces CF's catch at 5.083485, release at 5.563485, 2B control at 7.560569 and SS control at second at 8.867399. R3 scores at 9.663482. Home is not automatically preferable when the run cannot realistically be stopped. Tag-up departure at first touch (4.963485) precedes completed catch legally; returning R1/R2 retouch separately.

The automatic right-center manual probe hits the wall at 4.077601, is secured by CF at 6.044402 and returns CF–2B–SS to second. R1 reaches third, while BR reads/returns to first. P switches from second backup toward third as the play develops. That is a coherent control return, not proof of an incorrect home cutoff.

To inspect the p.17 home arrangement independently of the automatic target, the explicit-coach `focus-right-center-home` probe assigns deep relay 2B, inner home cutoff 1B, C home, SS second, 3B third, P home backup, LF third support and RF support, with CF possessing. The left-center probe reverses the primary middle infielder to SS and leaves 2B at second. CF releases at 6.424402; the primary relay controls at 8.869495; C controls at 11.469441. The inner cutoff is an optional job, not fictional intermediate possession. These coach-directed throws do **not** establish that automatic home selection would be tactically correct.

Existing 31 throwing/relay tests additionally cover two actual intermediate receptions, ready/late relays, changing targets and preservation of the incoming backup lane. A full two-middle-infielder tandem/trailer package is conditional, not a universal arrangement; the generator will not abandon second for a trailer without ready replacement coverage. No wrong-side deep relay or missing committed receiver was confirmed in these focused gap cases.

## D. Detailed anomalies and reproductions

Reproduce any ID with:

```sh
npm run audit:defense:v2 -- --case ID --output /tmp/defense-v2-ID
```

This saves that case's exact settings, result, flags and compiled evidence. All production inputs, raw times, alternative decisions and every player's path are also in the complete results/archive. Detailed readable examples are indexed in [examples/index.json](../audit/defensive-v2/examples/index.json).

### H1. First-base opportunity uses final stopping/return time instead of first touch

**High; confirmed.** Reproduce `base-ground-second-b1-o0`. Aim `(639.4496484048682, 470.94926393313546)`, normal grounder, R1, zero outs, normal aggression, average runners, standard arm/default field, automatic throws. Seed 0 means an unperturbed explicit input.

| Event | Absolute time | Since contact |
| --- | ---: | ---: |
| RF first touch | 4.626450 | 3.626450 |
| RF control | 4.876450 | 3.876450 |
| RF releases toward second | 5.256450 | 4.256450 |
| R1 reaches second | 5.704854 | 4.704854 |
| Cutoff 2B glove contact | 5.723862 | 4.723862 |
| 2B control and new decision to first | 5.843862 | 4.843862 |
| BR first touch/round | **6.268920** | **5.268920** |
| 2B releases to first | **6.293862** | **5.293862** |
| 1B glove contact | 7.504426 | 6.504426 |
| 1B control | 7.624426 | 6.624426 |

At the decision, the forecast says BR needs **2.1808585652582844 s**, ball control needs **1.6305642398226898 s**, and the force margin is **+0.5502943254355945 s**. Actual BR first touch is only **0.425058 s** away. The estimated runner time is wrong by about 1.755801 s. BR's goal stays at first throughout; this is not an acceleration caused by choosing a new base. The throw is released 0.024942 s after BR already touched first. Final result is correctly safe; the error is in the decision and its forecast.

At 5.843862 BR progress is 0.928179 and velocity 6.337838227767871 m/s. `runningPlan` asks for a 4 m/s rounding arrival. With too little remaining distance for that braking target, `speedPlan` generates a physical overshoot/stop/return plan. `runningTime` returns the complete plan duration. The compiler's `nextRunnerBoundaryTime` correctly finds the earlier base crossing, but `DefensiveDecisionEngine.choose` compares the throw against the later duration. A runner crossing during preparation triggers role reassessment without necessarily cancelling the obsolete committed throw.

| Defender | Initial and relevant later work |
| --- | --- |
| P | Backs second; changes to first backup at the misleading first-base decision. |
| C | Holds home; begins first-base backup only at 5.843862. |
| 1B | Covers first, receives the late follow-up; no false force is recorded. |
| 2B | Initial cutoff, intercepts at a real flight crossing, controls, then makes the unnecessary throw. |
| 3B | Covers third throughout the live return. |
| SS | Covers second while 2B is out on the lane. |
| LF | Supports second, later brakes as opportunities close. |
| CF | Backs RF's batted-ball pursuit, then brakes. |
| RF | Fields/releases, transitions to first support after cutoff receipt. |

The production movement history supports these changes; they are not inferred only from final positions. The [full example](../audit/defensive-v2/examples/base-ground-second-b1-o0.json) includes all nine first movements, every role transition, sample speed/distance and final coordinates.

**Recommended correction:** predict the earliest legal base crossing on the current physical plan, not final goal-settlement time. Use the same crossing concept in defense and runner arrival estimates. Reevaluate a still-unreleased throw when the relevant first touch removes its out opportunity. Preserve legitimate control returns and receiver reservations during actual flight. Validate curved approaches, late braking, straight run-throughs, continuing advances, retouches and two-out returns without slowing BR. This can change offensive decisions as well as throws, so tests must check timing and selected opportunities, not preserve current final outcomes.

### H2. Second-base stopped reception creates an average-runner DP ceiling

**High; confirmed model bottleneck.** Reproduce `dp-ss-average-hard-o0`: hard grounder `(425,425)`, R1, zero outs, standard arm and average runners. This closely matches the user's supplied example.

| Event | Absolute | After contact |
| --- | ---: | ---: |
| Contact | 1.000000 | 0.000000 |
| SS starts moving after reaction | 1.2500000851690547 | 0.2500000851690547 |
| First ground contact | 1.314584 | 0.314584 |
| SS glove touch | 2.223991 | 1.223991 |
| SS secure possession | 2.473991 | 1.473991 |
| SS release | 3.234254 | 2.234254 |
| 2B glove contact at second | 3.936207 | 2.936207 |
| 2B secure possession / force | 4.056207 | 3.056207 |
| Pivot release | 4.276207 | 3.276207 |
| 1B glove contact | **5.586486** | **4.586486** |
| BR first touch | **5.700001** | **4.700001** |
| 1B secure possession | **5.706486** | **4.706486** |

The secure-first deficit is **0.006485 s**. The second throw is 27.43 m, has a 23 m/s release profile, takes 1.310279 s under gravity/drag, and then requires 0.120000 s of control. Its effective mean horizontal travel speed is about 20.934 m/s; the flight is not evidence of a mistaken universal low-speed throw. Pivot preparation is 0.220000 s. There is no additional phantom reception or extra out.

The first preparation lasts **0.760263 s** even though SS already controls the ball. 2B starts 9.01963301983512 m from second and must arrive fully stopped before glove contact. With acceleration 5 m/s², this short triangular rest-to-rest trip requires `2 * sqrt(distance / acceleration)` plus the 0.25 s reaction: about **2.936207 s after contact**. Adding receiving control, pivot, 27.43 m flight and first-base control imposes a best-case bound near **4.706486 s**. An earlier clean pickup cannot overcome that receiving floor. The symmetric 4-6-3 reproduces the same times; an early P pickup also waits for the same second-base receiver.

| Sequence probe | Initial control | First release | Force/control at second | Return release | First control | BR first touch | Outs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 6-4-3 | 2.473991 | 3.234254 | 4.056207 | 4.276207 | 5.706486 | 5.700001 | 1 |
| 4-6-3 | 2.473991 | 3.234254 | 4.056207 | 4.276207 | 5.706486 | 5.700001 | 1 |
| 5-4-3 | 2.427173 | 2.777173 | 4.107025 | 4.327025 | 5.757304 | 5.699998 | 1 |
| 1-6-3 | 1.906644 | 3.004761 | 4.056206 | 4.276206 | 5.706485 | 5.700000 | 1 |
| 3-4-3 | 2.243679 | 2.696184 | 4.057015 | 4.277015 | 5.707294 | 5.699998 | 1 |

Second-base body arrival is inferred from the compiled position at glove contact; secure possession is the later event. There is no separate foot-contact event for a receiver already standing on the bag. Detailed glove/secure/base distinctions beyond the point-marker model cannot be claimed.

All-nine movement in the 6-4-3:

| Player | Work through play | Distance travelled, m |
| --- | --- | ---: |
| P | Anticipates first-base backup; still 3.756 m from that backup target at the return's glove contact, then brakes. | 25.829 |
| C | First-base backup; still 5.685 m short at that reception, then brakes. | 30.491 |
| 1B | Moves from holding alignment to first; ready for reception. | 1.227 |
| 2B | Covers second from contact, stops, receives/forces, pivots. | 9.020 |
| 3B | Deliberate guard/hold; no live third-base threat. | 0 |
| SS | Controlled fielding approach, possesses, throws, holds. | 3.097 |
| LF | Backs SS's batted ball, then brakes/holds. | 7.491 |
| CF | Holds initially; later second-base support, then brakes. | 11.396 |
| RF | Second-base backup, switches toward first support, then brakes. | 19.740 |

No defender exceeded the configured speed cap beyond floating-point tolerance. This does not establish ideal routes. In particular, the support assignments must not be described as ready merely because the receiving player recorded an out. Deliberate holding is not a missing job, and Baseball Positive's instruction that all nine move is a teaching convention rather than a rule requiring unnecessary travel.

Relevant code: `movement.starting`, `defense.travel/assign/arrival`, `locomotion.planMotion`, `throwing.throwFlight/throwingProfile`, and `provider.performThrow`. **Recommended correction:** investigate moving reception/foot-on-bag windows and continuity through the pivot before retuning speeds. Validate against actual base arrival, secure possession, foot contact and first touch. Review starting DP depth and provisional control/preparation calibration with local evidence. Do not award an automatic DP, skip genuine possession, or slow runners. Changing receiving geometry can affect every force, relay and tag, so retain all rule and motion checks.

### M1. The continuation read is missing from its decision-time forecast

**Medium; confirmed in eight configurations.** Same H1 example: the new decision is timestamped **5.843862** and predicts first control after **1.6305642398226898 s**. Actual first control is **7.624426**, or **1.780564 s** later. Difference: **0.1499997601773102 s**.

`provider.performThrow` selects/records the redirected decision, then advances a mandatory **0.15 s** relay-read interval before preparing the throw. The selected forecast is evaluated before that pending interval without charging it. This is separate from H1's much larger runner-arrival error. Correcting only the read interval will not fix H1.

The expected behavior is one consistent forecast reference instant. Include pending read time, or advance/project both sides before recording the decision and reevaluate the opportunity. Keep useful physical read/transfer time rather than deleting it to create outs. Test optional cutoff interception, actual relays, coach overrides and a target that becomes unavailable during the read. H1's all-nine table applies to this exact trace.

### M2. Pitcher pop-up selection ignores cooperative priority

**Medium review recommendation; no illegal out.** Reproduce `base-pop-pitcher-b1-o0`, normal pop-up `(500,584.3941369105671)`, R1, zero outs. P, 2B and SS each have a reachable caught opportunity at production-relative **3.6507498105366922 s**. P is selected by distance after the equal-time comparison. Touch occurs at **4.650750**, catch/control at **4.770750**, and BR is retired once. R1 retouches at **5.295970**.

Initial roles are P fielding, C first backup, 1B first coverage, SS second coverage, LF fielding backup, RF second backup, with 2B/3B/CF holding. Thus the alternative fielders do not physically compete and call/yield; 2B does not pursue at all. The issue is the missing priority/communication policy, not a collision or impossible catch. Both consulted priority systems favor middle infielders over P, but a team may legitimately allow a well-positioned pitcher to take an uncontested ball.

If adopting Perry Hill p.38, use priority among genuinely safe/reachable catches and rotate vacated coverage. Do not send a distant SS through a nearer defender merely to obey a rigid ranking. Validate C/P convention, near-fence plays, catches with limited time and R1/R2 coverage. Relevant code: `MovementEngine.field` candidate sort and `DefensiveDecisionEngine.assign` supporting duties.

### L1. Repeated reception wording obscures a correct state distinction

**Low; confirmed in source and the H2 trace.** `ThrowGloveContact` and `ThrowReceived` use the same `received` message. `App.tsx` displays only the formatted explanation and one-decimal time, not the event kind. The result looks like two receptions while the runner arrives between them.

The underlying sequence is glove contact → insecure receiving interval → secure possession. The point-marker state never gives the receiver secure throwing possession during that interval. Recommend distinct EN/JA glove-contact and control wording and optional exact-time diagnostics. This is a presentation change requiring localization and browser tests; it should not move the out to glove contact or merge the state transitions.

### Support/coverage flags requiring judgment

`base-ground-left-center-b2-o2` reports late third coverage at 5.043704 in a receiver-possession snapshot immediately before BR's inning-ending force at the **same timestamp**. The initial 3B coverage exists. The third-out transition then freezes live play. This warning is not evidence of a lost live out and should not motivate a new post-third-out coverage run.

Other support flags reflect substantial real distances. In H2, P/C/RF cannot all finish their backup routes before the throw arrives. In deep returns, an optional relay backup may be unavailable while third and second remain properly covered. The complete all-nine audit identifies actual positions and changed responsibilities rather than treating an assignment name as successful protection. These are candidates for coaching-route review, not 1,812 proven defensive errors.

## E. Root causes and limits of the conclusion

| Category | Conclusion |
| --- | --- |
| Rule engine | No violation found by executed unique-out, force-removal, catch, base-order, tag-proximity or scoring assertions. This is bounded evidence, not proof for all continuous inputs or unmodeled appeals. |
| Runner timing | First crossing and final stopping/return duration are different quantities; defense sometimes uses the latter. H1 is the highest-priority confirmed defect. |
| Movement planning | Rest-to-rest base reception creates the H2 floor; velocity-continuous receiving/footwork is absent. No arbitrary movement-speed violation was confirmed. |
| Defensive decisions | Reasoning can be wrong even when execution correctly returns a safe result. H1 inflates available time; pending read time further distorts the comparison. |
| Throw physics | The 27.43 m pivot flight is consistent with the configured 23 m/s gravity/drag model. No universal slow-throw or duplicate-possession defect was established. Calibration remains provisional. |
| State transitions | Runner crossings and reservations are recorded, but an obsolete pre-release challenge can continue after a crossing removes its purpose. |
| Narration/animation | Playback follows compiled samples. Identical reception wording plus rounded time obscures different control states. Role labels alone cannot establish readiness. |
| Coaching policy | Pop-up priority, 1B-feed pivot personnel, tandem-trailer choices and backup conventions need a declared coherent team policy, not arbitrary assertions that every manual difference is wrong. |

Unsupported/unverified scope includes general foul adjudication, squeezes/all R3 bunts, bunt pop-ups, errors/bobbles, collision/obstruction adjudication, realistic hand/foot geometry, full rundowns, general missed-base/fourth-out appeals, individual scouting attributes and full-game/walk-off procedures. The four references do not provide measured junior-high movement, slide or throwing calibration. All pop-ups in this matrix were caught; missed-pop/error behavior was not manufactured to claim coverage. Browser playback was not newly exercised in this audit; presentation findings use the actual compiled state, sampler and display source.

## F. Prioritized corrections for review — not implemented

| Order | Proposed correction and reason | Other effects / validation / existing tests |
| --- | --- | --- |
| 1 | Use earliest legal base touch for opportunity timing, including overshoot/rounding plans; reassess obsolete still-unreleased challenges. | Affects defense and offensive return estimates. Add independent first-crossing tests for all profiles, round/run-through, late braking, extra-base goals and two outs. Preserve physical samples, legal first-base protection and retouches. Replace assertions relying only on final goal time. |
| 2 | Make receiving/body arrival, secure control and base-foot contact explicit enough to support moving pivots; examine the DP floor before changing calibration. | Affects forces, carries, relays, tags and readiness. Verify near-tie 6-4-3/4-6-3, third/P/1B feeds, weak versus hard contact, developing/standard/strong arms and no fourth out. Existing slow-runner fixtures alone are insufficient. Do not require every hard grounder to become a DP. |
| 3 | Include pending relay read time consistently in forecast and execution and revisit target after the read. | Affects cut/intercept/redirect/hold chains and plate timing. Assert decision-relative control and runner crossing times, preserving receiver reservations and no extra artificial pause. |
| 4 | Choose/document reachable-catch priority and 1B-feed pivot conventions with the local coach. | Affects pop-up ownership and vacated coverage. Add all-nine tests for safe alternatives and legitimate exceptions; do not impose one manual's personnel universally. |
| 5 | Review support routes using actual reception deadlines; refine warnings that arise only at the third-out transition. | Protect home/third and committed receivers before optional backup. Validate actual positions, not just assignment types; retain explicit late support and distinguish future-base jobs. |
| 6 | Distinguish glove contact/control wording in EN/JA and expose precise times where useful. | Update typed dynamic templates/localization and run both browser suites for the UI change. Keep the underlying event distinction. |

No recommendation requires artificial runner penalties, an automatic DP bonus or fabricated errors. Review these findings before changing mechanics.

## G. Permanent infrastructure, artifacts and verification

```sh
npm run audit:defense:v2 -- --strict
npm run audit:defense:v2:summary
# Single exact reproduction, in a separate output directory:
npm run audit:defense:v2 -- --case dp-ss-average-hard-o0 --output /tmp/dp-v2
```

`--strict` exits nonzero for Critical rule/integrity failures. High and advisory findings remain visible and do not silently become expected passing baseball outcomes. Future corrections should reduce the relevant defects while retaining independent assertions, not rewrite the engine to satisfy a desired result. Routine output is a bounded progress/summary stream.

| Artifact | Contents |
| --- | --- |
| [summary.json](../audit/defensive-v2/summary.json) | Counts, severity, source commit, exact physical assumptions, runtime and trace SHA-256. |
| [results.json](../audit/defensive-v2/results.json) | Every configuration, seed, outcome, exact meaningful timing, decisions/alternatives and explanations of flags. |
| [traces.jsonl.gz](../audit/defensive-v2/traces.jsonl.gz) | Complete actual compiled play evidence for all 2,202 scenarios, including all-nine/runner/ball motion and role snapshots. Approximately 189 MiB compressed. |
| [player-audits.jsonl.gz](../audit/defensive-v2/player-audits.jsonl.gz) | All nine first movements, route distances, maximum sampled speed, role changes, actual reception/support positions and final position for every scenario. |
| [analysis.json](../audit/defensive-v2/analysis.json) | Per-player aggregates, DP comparisons, all base/out situation counts and example index. |
| [examples/](../audit/defensive-v2/examples/index.json) | 21 detailed readable examples with full player audits and English event descriptions. |
| [matrix-exceptions.json](../audit/defensive-v2/matrix-exceptions.json) | All 72 exclusions and 120 reinterpretations with complete input settings. |
| [verification.json](../audit/defensive-v2/verification.json) | Checks actually executed and recorded outcomes. |

Validation on unchanged production mechanics: **339 tests passed across 12 files** with `npm test`; `npm run build` passed TypeScript and Vite production bundling. Both audit scripts passed Node syntax checks. The final 2,202-case strict audit passed its hard assertions, and all 60 identical-input replays matched. Browser suites were not rerun because no simulator/UI code changed. No deployment, commit, external message or gameplay modification was performed.
