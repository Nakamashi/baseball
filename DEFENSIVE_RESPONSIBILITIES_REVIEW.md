# All-nine defensive responsibilities review and corrections

Reviewed 2026-11-05 against the checkout deployed as `bf47372`. Scope: the dynamic provider and all 24 guided plays, including grounders, fair bunts, airborne contact, returns/relays, optional throwing-error recovery, and closing/third-out behavior. The existing engine, physical calibration, UI layout and baseball outcome rules are retained.

## Finding and standard

The reported grounder at `(495,618)`, with R1 and Include Error enabled, left 2B at `(575,425)` throughout. This was real generated behavior. SS received at second, RF had the primary second-base backup and CF was left stationary; CF later won actual recovery. A generic `HoldPosition/guardSpace` fallback filled the spare player's assignment without choosing a useful support location.

The wider review found the same issue in spare-middle-infielder, corner-guard, catcher-direction and duplicate-outfield-support paths. The opportunities-closed branch also reverted unassigned players to generic holds. The guided catalogue contained job sentences promising movement without corresponding movement targets.

The revised standard is **a named task, concrete position and next-action cue for every live defender**. Fielders move into those positions using existing physical plans. Arriving early at a receiving or support position is allowed; repeated shuffling would not teach better defense. Ready, secure-ball decisions, set receivers, dead balls and completion have explicit reasons to wait.

## Evidence before changes

The original full suite passed **414 tests in 15 files**. A separate 240-play comparison covered five contact types, three sectors, four occupancies, zero/two outs and errors OFF/ON. Counts of plays with no meaningful displacement by each defender (more than 0.05 m was considered displacement):

| Defender | Before | After, same 240 inputs |
| --- | ---: | ---: |
| P | 20 | 0 |
| C | 56 | 0 |
| 1B | 0 | 0 |
| 2B | 3 | 0 |
| 3B | 55 | 0 |
| SS | 18 | 0 |
| LF | 12 | 0 |
| CF | 39 | 0 |
| RF | 20 | 0 |

These are model diagnostics on a fixed corpus, not universal rules that every player must travel on every conceivable play. 17 of the 24 original guided plays also had at least one defender with no displacement; the reviewed catalogue has none.

## Responsibilities by position

Existing primary fielding, actual receiving, live-base coverage, cutoff/relay and useful backup duties retain priority. New support jobs fill the remaining needs after that allocation; they never reserve a player ahead of an actual receiver.

| Defender | Contact / developing play | Secured ball / throw / recovery | Waiting and replacement trigger |
| --- | --- | --- | --- |
| P | Field a reachable ball; cover first or a vacated plate; begin the existing relevant backup. | Preserve the actual throw/carry/recovery role. If otherwise free, provide an off-lane infield return option inside second. | Read runners and the next target; do not force another throw without an opportunity. |
| C | Field a close ball, protect a scoring threat, or undertake the existing optional foul-side first backup. | A free C steps slightly to the ball side behind home for a clear view and directs the defense. Home depth stays calibrated at 1.5 m. | Call hold/cut/next base; actual home coverage overrides directing/support. |
| 1B | Cover first or execute a higher-priority fielding/cutoff duty. | Maintain live first/return coverage; existing trailing remains conditional. A free corner guards near its bag. | Announce a renewed first-base threat and replace vacated coverage. |
| 2B | Field, cover, receive, cut/relay or back up when assigned. Otherwise support the second-base receiver from the right outfield shoulder. | Reassess at possession changes and runner events. Cover the bag if the receiver leaves; pursuit wins only on actual reachability. | A support position is not possession, a force out, or an automatically inserted relay. |
| SS | The corresponding middle-infield fielding/receiving/cutoff duty; a free SS uses the left shoulder of second. | Preserve committed reception until completion or observed miss. Then reallocate by current runner and ball state. | Replace vacated coverage; distinguish an available return target from a committed reception. |
| 3B | Cover a live third-base threat; preserve current bunt charging/early third recovery. Otherwise guard within 3.1 m of third on the field side. | Do not leave third to manufacture optional support; live coverage supersedes guarding. | Move onto the bag when the runner/throw requires it; call an approaching runner. |
| LF | Existing primary/neighbor batted-ball backup or appropriate actual receiving/return support. | Spare outfielders protect their neighboring gap instead of duplicating every second-base return role. | Maintain depth and communicate a ball beyond the primary; actual loose-ball recovery uses current position/momentum. |
| CF | Existing ball/base backup. On infield plays, a second available layer behind a base now moves instead of being discarded as a duplicate. | The deeper layer can realistically improve recovery; it receives no guaranteed interception. | Remain ready beyond the primary backup; observed loose-ball pursuit supersedes support. |
| RF | Existing right-side fielding/backup, first-base support or timing-selected target backup. | Preserve incoming lane, actual deadline and useful backup movement. | A late backup remains reported as late; deeper support does not retroactively make it ready. |

## Changes and their geometry

`src/dynamic/defense.ts`, `types.ts`, `conventions.ts` and `messages.ts` add `SupportReceiver`, `GuardBase`, `ShadeField` and `DirectDefense` plus specific reasons and bilingual action/why/next templates. Reassessment triggers now explicitly include missed throws and recovery.

New support targets are anchored to bases or the original contact, not continually offset from the player's current location. Reassessment therefore does not cause drifting. Provisional spacing is centralized under `conventions.support`:

- Spare middle infielder: 4 m to their side of second, 2 m toward the outfield; separated from the bag, receiving lane and adjacent running lanes.
- Free corner: 0.5 m toward its side and 3 m deeper than the bag. This is guarding, not a claim to cover a live receiving deadline.
- Free C: a 0.75 m lateral step behind home, retaining the 1.5 m physical depth.
- Free P: an off-lane return position 12 m inside second and 6 m laterally, with no automatic relay.
- Spare outfielder: a 5 m shade from the original fielding alignment toward the play, or a distinct 21 m deep base-backup layer on an infield play. Outfield returns retain the neighbor/far-outfielder division; they do not gain multiple collapsing second-base supports.

Existing acceleration/braking plans compile the motion and preserve momentum when duties change. A receiver at the bag still waits. Once offensive opportunities close, obsolete outer-field chases stop with a specific runner-containment instruction. The third out starts no new coverage or pursuit. Completed phases now say the play is over instead of presenting the generic supporting-position thought.

These numerical support spacings are explicit engineering/team conventions, not measured athlete norms. They require on-field coaching review before being described as universally optimal baseball positioning.

## Exact pitcher-grounder result

For `(495,618)`, normal strength, default R1/zero outs/average runners/normal aggression:

- P fields; SS receives at second; 1B covers first.
- 2B moves from `(575,425)` to the right outfield shoulder of second, approximately `(539.99,362.20)`, supporting SS and ready to replace coverage.
- 3B moves into the near-third guarding position instead of guarding from the untouched starting marker.
- RF retains the original primary backup at second. CF begins a deeper, separate support layer at contact.
- Errors OFF: P releases to second at **2.609177 s**, SS releases to first at **3.957565 s**; the original two legal force outs remain.
- Errors ON: the miss occurs at **3.632498 s**. CF's genuine secure recovery improves from **7.175613 s** to **6.208946 s**. The ball remains loose until actual touch/gather; no phantom second-base force is awarded.

Times include the one-second Ready phase. The RF/CF allocation is now educationally more useful: CF was already moving when the ball escaped. **RF's primary backup is still late for the ordinary throw**, and that warning remains. A conventional CF-primary/RF-first scheme, such as the comparison repository uses, remains a separate coaching choice; this review does not silently force it across every throw geometry.

## Guided catalogue

`src/scenarios/index.ts` now supplies explicit contact destinations and matching responsibilities for previously omitted P, middle-infield and third-base jobs. Airborne examples give a free P an infield return position; far outfielders shade the gap, including on infield catches. The actual catcher, receiving bases, runner paths, prescribed calls and phase durations retain their authored meanings. New sentences have exact Japanese translations in `src/i18n/ja-playbook.ts`.

All 24 guided plays now contain real contact movement for all nine defenders. These remain authored diagrams, not the dynamic engine's physical trajectories.

## Regression evidence and tests

`src/tests/defensiveResponsibilities.test.ts` adds focused checks for the exact grounder, real pre-throw motion, support separation from running lanes, stable reassignment targets, replacement coverage, purposeful receiver waiting, translated instructions, deterministic seeking, third-out shutdown and all 24 guided plays. Its matrix covers **720 generated plays**: five contact types × three sectors × eight occupancies × three out counts × error OFF/ON.

The existing error tests retain successful recovery, genuine subsequent tags, legal third-out scoring, controlled first-base turns and run-through/return transitions. Original recovery inputs remain recorded, including cases whose new positioning changes a tag into a safe extra base or a runner's extra-base attempt into a hold. Two nearby physical fixtures add real recovered third-out tags after BR finishes the existing run-through/return. Speed assertions distinguish defender caps from the configured runner profile; the former blanket allowance of 10 m/s for BR is tightened to the actual runner cap.

The 16 clean-output golden scenarios were independently compared against a saved pre-review source snapshot. All retain identical untouched ball data, initial positions, out identities and non-completion events. Full output hashes change because support assignments, text, motion and settling change. Old hashes are retained as `preResponsibilityReviewSha256`; new hashes protect the reviewed outputs with both absent and false error settings. The 240-input comparison also retains identical clean final states. Five clean pop-up cases change only airborne-read descriptions because supporting defenders now occupy different observed positions; their outcomes remain unchanged.

The new `npm run audit:responsibilities -- /tmp/defensive-responsibilities.json` provides repeatable inputs, contact assignments with explanations, event ledgers, final states and stationary/missing-duty counts. CI runs it alongside the existing strict defensive and bunt audits. The dynamic browser suite now checks visible 2B support, EN/JA text and backward/forward seeking on the exact reported grounder with errors OFF and ON.

Local verification:

- Full Vitest suite: **452/452 passed in 16 files**, including both existing 576-case tactical/physical matrices.
- Responsibility CLI: **720/720 generated**, no structural failures, no generic live fallback duties, no permanently stationary defenders in this matrix; **24/24 guided plays** have all-nine contact motion.
- Bunt audit: **3,360 plays**, zero implemented integrity errors; **2,760 Soft fielding inputs** and **87 LF-return cases** also checked. Existing bunt success counts and primary pickups are unchanged.
- Strict defensive audit: **2,522/2,522 generated**, zero Critical/High findings and 60 deterministic replays. Late/optional support advisories remain visible.
- Production TypeScript/Vite build and whitespace/script syntax checks pass.
- Local browser startup is blocked by workspace socket permissions (`listen EPERM`; Chromium `setsockopt: Operation not permitted`). Browser CI results are recorded separately when available; local compilation/unit checks are not presented as a visual inspection.

## Scope limits and follow-up

- Full rundowns, arbitrary fielding errors and dead thrown-ball awards remain outside the existing engine's scope.
- Endpoint clearance is tested for the new support anchors. The point-marker model does not adjudicate player collisions, obstruction or every possible route intersection.
- Meaningful motion and a specific instruction do not prove that a role is optimal for every team. Review primary-versus-secondary backups and the adopted home-cutoff convention with a coach using the documented cases.
- Readiness remains a timing claim, not a label: existing late/unfulfilled coverage diagnostics are retained.
- Attention, signals and orientation are communicated in text; the simulator still does not animate gaze or glove readiness. The external comparison suggests a future attention overlay without requiring players to wander after reaching good positions.

See [SIMPLE_FIELDING_COMPARISON.md](SIMPLE_FIELDING_COMPARISON.md) for the requested independent review of that repository and the distinctions between its automatic planner, coach-built plays and physical error recovery.
