# Tactical correctness and baseball accuracy corrections

Baseline: `75896bf`. Development branch: `feature/tactical-correctness-improvements`. This is a review release; main and the published site are not changed by this work.

## Evidence and the defensive system

Research for this task is offline. The attached **Baseball Positive Coaching Manual (2013)** was examined directly, together with the previously supplied **Perry Hill Infield System Training Manual** and the **FCA Baseball Handbook**. Page numbers below are PDF page numbers. References support coaching conventions; they do not establish numerical running or throwing norms.

| Reference         | Relevant pages | Application and qualifications                                                                                                                                                                                        |
| ----------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseball Positive | 12, 83–89      | Ball/base/backup, live coverage and backing the actual incoming throw. Its “all nine move” teaching phrase is not implemented as compulsory movement; the user's instruction permits deliberate tactical holding.     |
| Baseball Positive | 100            | Middle-infielder double-play feeds and pivots. Actual opportunities still depend on the complete sequence's timing.                                                                                                   |
| Baseball Positive | 107–115        | Throwing lanes, relay communication, redirection and holding when an out is unavailable. An optional cutoff must not delay a direct throw that can reach its actual receiver.                                         |
| Baseball Positive | 137–138        | First-base run-through/rounding and fly-ball leads that vary with direction, depth and safe return time. R1's 15/30/45-foot RF/CF/LF guidelines are starting conventions, not universal distances on a 90-foot field. |
| Perry Hill        | 23–28          | Distinct feeds and pivots, including 6-4-3 and 4-6-3 responsibilities.                                                                                                                                                |
| Perry Hill        | 41, 43         | Ordinary bunt defense: SS at second, 2B covering first, corner/pitcher reads, catcher handling close bunts, and third coverage with R2. Page 47's squeeze is a different system and remains unsupported.              |
| FCA               | 34–35          | CF/RF single with R2: home priority when realistic, 1B cutoff, C at home, P backing home, and live-base coverage. Through, cut, redirect and hold are distinct choices.                                               |

The existing **first-baseman home-cutoff** convention is retained for all outfield sectors. Baseball Positive uses P as home cut-relay in some situations (84, 107, 113); FCA also uses P on some LF singles. These are legitimate alternatives. They are documented rather than mixed into a system in which P is already the plate backup. Timely alternate infield cutoffs and corresponding coverage rotations remain supported. The complete tandem-relay and wheel/pickoff packages in these manuals are not implemented.

## Reproduction, causes and corrections

### A. Missing double plays

Reproduced: a hard grounder at 425,425 with R1 produced a 6-4-3 against a slow BR, but omitted the second throw against a fast BR. Some other “shortstop” clicks actually passed through the shifted infield and were fielded by LF; the click is not proof that SS fields the ball.

The old tests primarily established the slow-runner fixture. Initial choice ranked the first force separately, the compiler inserted an unnecessary 0.18 s receive pause, and the second throw used the same universal flight/transfer profile as other throws.

The engine now forecasts the force/pivot/first sequence, records both arrival estimates and pivot preparation, then reevaluates actual remaining time at reception. It removes the idle pause, uses a distinct pivot profile, and selects conventional receiving personnel with a readiness fallback: 2B for SS/3B feeds, SS for P/2B feeds. A feasible double play with one out can outrank a plate attempt because its inning-ending force cancels the run. A late second throw can still be declined; fast runners are not guaranteed to be doubled up.

Tests include actual 6-4-3, 4-6-3, 5-4-3 and 1-6-3 throws, nearby coordinates, all three contact strengths and runner profiles, and third-out termination.

### B. Holding without a useful explanation

Confirmed two causes beyond the initial decision: the compiler did not revisit a useful throw when a runner later completed a retouch/changed goal during the holding phase; and optional cutoff readiness could be charged as a mandatory delay even on a through throw.

Holding intervals can now yield at meaningful runner events. The compiler evaluates a bounded number of renewed live opportunities and starts a throw only for a real runner challenge. It includes pending legal tag-up intent and the runner's return-to-base time. An actual relay still waits for its receiving player; a direct through throw does not wait for an optional cutoff. A late cutoff is reported explicitly.

A remote outfielder can return the ball to control runners without an immediate out. A player already controlling the infield does not generate a gratuitous return to the same base, and a catch with no active runners does not require another throw. Explicit coach hold/cutoff overrides remain authoritative.

Every selected decision includes the runner-specific alternatives and a reason for each meaningful target. Separate `holdingDecisions` preserve rejected alternatives after an earlier throw without changing the historical primary-throw decision interface.

### C. Home versus second

Reproduced in tag-up sequences: the initial receiver could see only a returning runner, miss the subsequent legal departure and return toward second. A forced intermediate relay or wait for an optional cutoff could also incorrectly eliminate an attainable plate opportunity.

The defense now evaluates pending and actual scoring attempts, includes retouch time, distinguishes direct-through throws from relays using the arm profile's provisional accurate-return range, and reevaluates live runner events. Realistic run prevention outranks merely controlling a trailing runner. Reliable inning-ending forces, including an attainable two-throw double play, retain their run-cancelling value. A runner who will score well before any return is conceded.

Generated tests exercise LF, CF and RF home opportunities at nearby points, C preparation, P backup, alternatives at second, and hopeless plate attempts. Competitive attempts remain distinct from clearly favorable estimates; neither label scripts an out.

### D. Third-base coverage

The baseline already used runner goals rather than occupancy alone. A blanket failure for every advancing R2 was not reproduced. The confirmed airborne-read defect could conceal an advancement intention until landing, delaying the need for third coverage.

Coverage now receives earlier runner intentions from the developing flight. Tests independently require a receiving assignment at threatened third, including when the selected return is elsewhere and during bunt rotations. An alternate is selected when the ordinary defender has another job. `late-coverage` and unfulfilled coverage remain visible rather than claiming a moving receiver is already ready.

The broader audit also reproduced an actual receiver-reservation failure at 640,430 / 650,550 with R1+R2: a new home threat could pull the committed first-base receiver away during flight. Committed receivers are now excluded from other base/cutoff allocations until reception.

Post-release follow-up: a normal sacrifice bunt at 637,620 with only R1 reproduced an additional failure. 3B charged, but after P secured the ball the allocator saw R1's goal of second and assigned no return to third. It braked/held in the charging lane; play completion would also cancel an unfinished receiving recovery once runners stopped. The earlier R2 regression did not cover this case. Securing a bunt now creates a third-base recovery while R1 can advance through second, without requiring an authored attempt at third. A free, timely 3B is preferred, with a reserved/late player's replacement chosen under the coverage timing rules. The already-live recovery finishes before completion; obsolete backups still stop, and retirement/third-out rules remain intact. Six added tactical regressions cover nearby aims, anticipated positioning, empty bases and third-out cancellation, alongside an EN/JA rendered-position browser regression.

First follow-up validation: **307 tests pass across 11 files, including 51 tactical tests**; production build, dynamic browser suite and both static-hosting paths pass. The exact rendered final frame was reviewed with 3B at third, R1 at second and the batter retired at first. This version was published as `89f5dd4` after review.

After publication of `89f5dd4`, review identified that waiting for secure possession was too late: 3B should never pursue a clearly right-side bunt handled by another primary fielder. That contact-side read now excludes 3B from charging and assigns threatened third immediately. Updated tests require 3B's coverage before fielding and arrival at the bag before the reported pickup, preserving 2B at first, SS at second and left-side/primary-fielding duties. Full play is also now the default playback mode in both app modes; step-by-step remains selectable and its automatic pauses remain tested.

Early-coverage/default-playback verification: all **307 tests**, production build, both bilingual browser suites and root/repository-path static hosting checks pass. The dynamic browser regression checks the third-base instruction at playback 1.2 s and actual third-base occupancy at 4 s, before the reported bunt's secure pickup.

### E. Obsolete movement after the defensive opportunity ends

Reproduced: P and supporting outfielders could continue a distant first-base backup while an already-retired BR finished a permitted sprint.

When no throw is selected, obsolete backup, pursuit and support jobs are cancelled; meaningful live-base coverage remains. Moving defenders brake toward a physical stopping point. A subsequent runner event can reopen a genuine opportunity. At the third out, runners and live throwing stop; defenders may only finish a distinct post-play braking phase. No new receiving, cutoff or pursuit job starts in that phase.

### F. Waiting for line drives to land

Reproduced with a hard line drive toward 700,150 and R1. The baseline retained its initial freeze/read until first landing even though no fielder could reach an airborne catch.

The new read uses current fielder positions, velocity, height and remaining pre-landing flight. It distinguishes a controllable catch, uncertainty, and an impossible catch even under an optimistic speed bound. Uncatchability requires successive observations and a minimum read interval. It never consults the generator's final `caught` result. Runners can commit before landing; two-out runners continue on contact.

Fly-ball leads begin with the manual's direction/depth guidance, then are limited by a safe return estimate. A runner must still retouch before a legal tag-up. Retouch-and-hold is now `RunnerRetouched`; it is not falsely narrated as a departure. Wall contact also releases airborne reads because an airborne out is no longer possible after the carom.

This is a deterministic, idealized read of the modeled trajectory, not a validated human perception/error model.

### G. Outfield throws and tag-ups

The universal 20 m/s effective flight speed is replaced by the profiles below. Tag-up evaluation uses the same assigned route, receiver readiness and release model as actual throwing. It includes any required return to the original base. Catch forecasts project defenders through the control interval so braking that overlaps gathering is not charged twice; a pending caught batter does not consume force-play coverage in that forecast. Controlled first touch, secure catch, release, flight, receiving control and tag timing remain separate.

Tests include a caught fly around 80 m, a fast aggressive R3 and a strong return producing a real home attempt/tag out; a deeper catch permits a successful tag-up. These are timing-dependent examples. Aggressive tag-up policy can accept a deficit up to 0.4 s and can fail; it does not promise a safe base.

### H. Sluggish fielders

Identified two modeling causes: fielders were capped at 6 m/s while the same provisional average running profile has a maximum around 6.9 m/s, and modest lane corrections over about 7 degrees could trigger a complete stop/restart.

Defender top speed now uses the same provisional average-athlete calibration. The controlled fielding approach still ends at no more than 3 m/s. Reaction (0.25 s) and acceleration (5 m/s²) are retained. Safe, sufficiently distant corrections up to 30 degrees use bounded lateral steering; larger/shorter turns still brake. Receiver reservations reduce unnecessary role changes. Tests check continuity and acceleration without requiring artificially lively movement.

### I. Tall fence and disappearing balls

The previous 2.5 m assumption is not a measurement of the reported home ground. Field settings now expose a provisional height and two explicit modes. The default is an **8 m provisional setting with a keep-in-play training net**, not a claim that the real fence is 8 m. Training mode returns all boundary flights into play. Standard mode applies normal boundary rules at the configured height.

Actual caroms generate wall-contact events, update runner reads and all-nine responsibilities, and remain available for retrieval. Interception truncates hypothetical boundary outcomes. Explicit low-fence tests preserve home runs and two-base awards from original occupancy. Stronger/faster fielders can legitimately intercept an old boundary fixture, so those rule fixtures now declare their intended fence conditions.

### J. High pop-ups

Added `Pop-up` as a separate airborne input, using steep 78/75/72-degree soft/normal/hard launch profiles. The existing constrained landing solve, height, hang time, impacts and fielding engine are reused. Controls show predicted flight time and maximum height, alongside the on-field height badge.

Infield fly considers both fly balls and pop-ups, but still requires the base/out state, fair input and modeled ordinary-effort opportunity. Line drives and bunts do not qualify. A declaration and later catch cannot retire BR twice.

### K. Ordinary fair bunts

Added low-speed 5/7/9 m/s soft/normal/hard contact using the existing bounce, roll and interception model. Bunt aims are limited to 25 m from home. Optional anticipated-bunt positioning is a pre-pitch setting independent of the eventual ball type.

For ordinary fair bunt defense, available P/corners charge under control, the nearest fielder handles the ball, SS covers second and 2B covers first. With R2, third coverage takes priority; an available P or C can cover third when 3B fields it, with receiver readiness determining the choice. The defense considers lead forces and a possible continuation, but a well-placed bunt need not yield a lead out. Tests cover both lines, the pitcher, first-and-second coverage and all-nine support.

A runner on third is explicitly unsupported for this input: squeezes, bunt pop-ups, missed bunts and foul-bunt strike rules are future work. They are not silently generated as ordinary sacrifice bunts.

## Calibration and research provenance

The following research information was **supplied by the user**, not independently retrieved or verified online in this task:

- Gene Coleman, _14U Baseball Performance Requirements_ (Professional Baseball Strength, 6 March 2025): approximately 4.55 s home-to-first on 90-foot bases. The timing start is unclear, so it is not a verified contact-to-first average.
- Spaniol, Monrad, Baham and Paulison, _Standardized Throwing Velocity Normative Values for Youth Baseball Players_ (2024 NSCA National Conference): selected academy sample, 606 male players. The supplied age-13/14/15 peak means are 57.7/62.3/66.6 mph, n=77/98/138, SD approximately 6.0/5.8/6.5 mph. The stationary stretch-style maximum-effort protocol is not an in-game IF/OF effective-flight norm or a representative school population.
- ABCA _Inside Pitch_, _The Hot Corner: Execution of the Cutoff and Relay System_: supplied principles distinguish through, redirect, cut/hold and timely alignment. Full article not retrieved. Other listed websites are provenance pointers, not sources claimed to have been consulted.

The contact-to-first targets remain **5.3 / 4.7 / 4.2 s**, including the start and acceleration. They are provisional profiles, not measured percentiles. The one-second Ready phase remains outside that interval. Runners are not slowed to force outs.

| Throw kind             | Standard effective flight speed | Minimum preparation |
| ---------------------- | ------------------------------- | ------------------- |
| Short feed             | 16 m/s (35.8 mph)               | 0.20 s              |
| Ordinary infield       | 22 m/s (49.2 mph)               | 0.30 s              |
| Middle-infielder pivot | 22 m/s                          | 0.22 s              |
| Relay                  | 23.5 m/s (52.6 mph)             | 0.26 s              |
| Full outfield return   | 25 m/s (55.9 mph)               | 0.38 s              |

Developing/strong arms subtract/add 2 m/s. These are **configurable engineering assumptions**, not the cited radar means. Braking and receiver readiness may extend preparation. Direct accurate-return distance is provisionally 65/75/85 m for developing/standard/strong outfield arms; longer returns use the existing intermediate relay. This distance heuristic is also unmeasured. Through throws do not wait for an optional cutoff; actual relay receptions retain receiving and read/transfer time. Surface, catch, tag and fence parameters still require local film/measurement.

## Diagnostics

`npm run audit:defense -- --case center-home-close` or `--settings path.json --time seconds` reports:

- Model version, configured fence mode/height, running/movement assumptions and all throw profiles.
- Ball path, wall/bounce events, interception candidates and height.
- Progressive airborne-read classifications, times, runner goals and catchability bounds.
- Selected/alternative targets, force/tag/appeal status, run consequence, rejected bases and projected double-play timing.
- Actual release, preparation, flight, receiving control and base-touch events.
- Later holding evaluations and their rejected opportunities.
- Live base coverage, threatened/uncovered bases, late cutoff/coverage/backup issues and all-nine assignments.
- Assignment transitions/cancellation, post-play braking and termination reason.

Primary throw decisions remain in `decisions`; later deliberate holds are in `holdingDecisions`. The historical reassessment snapshots are labeled by prediction time. Sampling the compiled movement history supplies current positions without rerunning the decision engine.

## Validation and remaining limits

The dedicated tactical suite checks actual decisions and events under independently stated coaching expectations, alongside all-nine movement, possession, English/Japanese explanations and history-independent scrubbing. Existing matrices remain necessary structural checks; they do not prove tactical optimality.

Final validation on this branch:

- Full automated suite: **301 passing tests across 11 files**, including **45 dedicated tactical correctness tests**, both existing 576-situation matrices, and the seeded/edge trajectory regressions.
- Production TypeScript/Vite build: passed.
- Dynamic browser checks: passed, including continuous playback/pause, deterministic seeks, double-play phases, home priority, airborne reads, retouches, bunts, pop-ups, wall caroms, field/arm settings, English/Japanese and six layouts.
- Scripted encyclopedia browser checks: passed for all 24 plays, synchronized reading/playback controls, saved language and six layouts.
- Static-hosting checks: passed at both `/` and `/baseball/`.
- Separate deterministic exploration: **1,000 situations, no consistency failures**, covering all 45 ball-type/strength/out combinations with varied runners, strategy, arms and fence settings. Generation time on this environment was approximately 32 ms median, 72 ms at the 95th percentile and 154 ms maximum; these are local measurements, not a browser performance guarantee.
- Representative browser screenshots reviewed: double-play approach/pivot, bunt rotation, high pop-up and Japanese mobile layout. The field and transport remain visible together.

The additional exploration is a development check rather than a substitute for the committed tactical regressions. Passing these checks establishes the tested decisions and timing invariants, not universal baseball accuracy.

The system remains a deterministic single-play teaching model. No errors, mistaken fielder reads, collisions/obstruction, detailed hand/foot mechanics, spin/wind, full rundowns, tandem double cuts, wheel/pickoff packages, general foul-ball adjudication or full-game/walk-off engine is added. Throws use effective planar flight rather than aerodynamic trajectories. Japanese coverage is complete in automated checks; local coaches should review wording and the adopted conventions. Empirical player/surface calibration and external coaching review remain necessary.
