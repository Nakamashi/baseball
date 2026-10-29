# Defensive Audit V2 implementation

This report supplements, and does not rewrite, the original
[Defensive Audit V2](DEFENSIVE_AUDIT_V2.md) against production `8331a1c`.
Implementation and regression verification are complete. Unit/build/strict-audit
and all browser/mobile/production-page checks pass in GitHub Actions. Evidence and
remaining calibration/device limits are recorded below.

## 1. Implemented fixes

**H1 — first crossing.** `runningGeometry.ts` now distinguishes `baseTouchTime`
from settling `runningTime`. It searches every signed acceleration/cruise/braking
leg for the earliest base crossing. The compiler uses the same root definition,
without treating stationary reaction delays as new touches. Defense, running
reads, catches/retouches and force resolution consume the touch time. Existing
run-throughs, rounding and returning still finish on the physical clock.
An automatic challenge expiring before release is cancelled and reevaluated;
released throws retain their receiver reservations.

**M1 — one relay clock.** `provider.ts` advances runners and defenders through
the existing 0.15 s read before ranking/recording the relay continuation. The read
is neither omitted from the decision reference nor charged twice.

**H2 — moving force reception.** New `receiving.ts` plans a controlled reception
through second instead of requiring a full stop before every feed. Glove arrival
precedes secure control by the existing 0.12 s. Control coincides with actual body
contact at the bag, explicitly recorded as `BaseTouched` before the force. The
1.2 m/s controlled crossing is a provisional engineering value; the existing
5 m/s² braking takes 0.24 s before the following throw. Forecast projections and
compiled movement retain velocity. Late, off-lane and ineligible receivers keep
ordinary receiving. A first baseman preparing a throw to second is no longer
silently reassigned to carry at first; P can cover first for that continuation.
No runner, arm or defender top-speed bonus was introduced.

**R3 bunts.** `validateSettings` accepts ordinary fair bunts with R3, retaining
the fair-area and 25 m scope. Existing contact/freeze reads govern advancement.
An R3 home force requires the actual live BR/R1/R2 chain; other home outs need
a tag. If C fields with R3, P remains available for plate coverage. No squeeze
strategy, bunt pop-up, foul-bunt strike logic or error generator was added.

**Pop-ups.** For caught pop-ups, similarly timed/reachable candidates cooperate
under CF/LF/RF/SS/2B/3B/1B/C/P priority. Eligibility requires a time within 0.08 s
of the earliest catch and route length no greater than max(20 m, earliest + 8 m).
These modest thresholds are provisional. Perry Hill p.38 supplies C-over-P; the
different Baseball Positive p.118 convention was considered rather than mixed
into the same system. Ownership and yielding are exposed in metadata and EN/JA
assignment reasons. Coverage is recomputed, while clearly superior P catches
remain possible. Infield-fly eligibility/force removal remain separate rules.

**Coverage.** Resolve an immediately controlled force before allocating the next
live jobs, removing meaningless pre-third-out warnings. Reserve C near home when
a runner is advancing to third, avoiding an optional first-base backup route
that later pulls 3B away from third. Keep genuine late/space-limited support
visible. Deep gap relays, the separate home cutoff and pitcher base backup keep
the adopted Inside Baseball pp.12–19 system. Audit summaries compare actual
support positions at reception, not just assigned role names.

**Narration.** `ThrowGloveContact` describes the ball reaching the glove;
`ThrowReceived` describes secure control, in English and Japanese. Force legality
still waits for control. Exact timestamps and event kinds remain in diagnostics.

**Mobile.** The single existing Generate Play button becomes a fixed bottom bar
below 600 px, and in phone landscape up to 950×500. It retains the same handler
and validation. A synchronous submission latch, disabled button, localized
loading text and spinner prevent repeat generation. ResizeObserver measures bar
height for content clearance; visualViewport supplies keyboard displacement;
safe-area padding protects the gesture area. Long validation messages can scroll
inside the bar. Explicit hover/loading colors avoid the shared pale hover style;
actual rendered text contrast is tested at 4.5:1 or better in both states.
Desktop placement and encyclopedia mode remain unchanged.

## 2. Exact reproductions

All times are playback seconds, including the one-second Ready interval.

`base-ground-second-b1-o0`: RF touches at 4.626450, controls at 4.876450,
releases to 2B at 5.256450, glove 5.723862, secure 5.843862.
Before, 2B decided before its pending read and released a futile throw to first
at 6.293862, secure 7.624426; BR had touched first at 6.268920.
At the old 5.843862 decision, the forecast incorrectly gave BR 2.180859 s,
although physical first touch was only 0.425058 s away.
After, the read ends at 5.993862 and 2B holds: BR needs only 0.275058 s to
first, versus 1.630564 s for ball control. The runner still touches at 6.268920;
the correction removes the throw rather than slowing the runner.

`dp-ss-average-hard-o0`:

| Event | Before | After |
| --- | ---: | ---: |
| SS first touch | 2.223991 | 2.223991 |
| SS secure | 2.473991 | 2.473991 |
| Feed release | 3.234254 | 2.895032 |
| Glove at second | 3.936207 | 3.597565 |
| Secure/base force at second | 4.056207 | 3.717565 |
| Pivot release | 4.276207 | 3.957565 |
| Glove at first | 5.586486 | 5.275769 |
| Secure at first | 5.706486 | 5.395769 |
| BR physical first touch | 5.700001 | 5.699998 |
| New outs | 1 | 2 |

The changed first force is physically controlled at second; the second force
beats BR's unchanged sprint. The retired BR can finish the sprint with fewer
than three outs. Tests bracket a calibrated first-base near tie by ±3 ms using
actual possession and crossing, rather than granting a blanket double play.

`base-pop-pitcher-b1-o0`: P becomes SS while first touch 4.650750 and secure
4.770750 remain unchanged. The play records one BR out, not duplicate catch and
infield-fly outs. `base-ground-left-center-b2-o2` retains its legal inning-ending
force at 5.043704 without the transient live uncovered-third snapshot.

## 3. Double-play comparisons

Each row tests ten contact locations at zero and one initial out (20 cases).
Counts are new outs, not final inning totals. The separate two-initial-out
matrix is also audited but cannot produce two additional outs.

| Contact | Runner | Tested | Before: 0 / 1 / 2 outs | After: 0 / 1 / 2 outs |
| --- | --- | ---: | ---: | ---: |
| soft | slow | 20 | 0 / 20 / 0 | 0 / 20 / 0 |
| soft | average | 20 | 2 / 18 / 0 | 2 / 18 / 0 |
| soft | fast | 20 | 10 / 10 / 0 | 10 / 10 / 0 |
| normal | slow | 20 | 0 / 0 / 20 | 0 / 0 / 20 |
| normal | average | 20 | 0 / 20 / 0 | 0 / 12 / 8 |
| normal | fast | 20 | 0 / 20 / 0 | 0 / 20 / 0 |
| hard | slow | 20 | 0 / 6 / 14 | 0 / 6 / 14 |
| hard | average | 20 | 2 / 18 / 0 | 2 / 6 / 12 |
| hard | fast | 20 | 6 / 14 / 0 | 6 / 14 / 0 |

These are measured final-engine counts. Faster/harder contact is not guaranteed
to help: interception geometry
changes. Soft and fast-runner cases remain sensitive to actual available time.

## 4. R3 bunt coverage

All 72 former baseline exclusions are exercised: four R3 occupancies × six bunt
directions × three out counts. Expansion also adds 144 soft/hard variants and
104 anticipated-bunt configurations, increasing total coverage by 320 to 2,522.
Tests independently check home force versus tag, actual unique outs, all-nine
jobs and Japanese explanations. Examples from the normal-contact baseline:

| Occupancy / outs | Case | Decision and outcome |
| --- | --- | --- |
| R3 / 0 | `base-bunt-first-line-b4-o0` | P throws to first, BR forced out; R3 holds |
| R1+R3 / 0 | `base-bunt-third-line-b5-o0` | P holds when no useful out is available; no run |
| R2+R3 / 0 | `base-bunt-pitcher-b6-o0` | P retires BR at first; R3 holds |
| Loaded / 0 | `base-bunt-catcher-b7-o0` | P fields the catcher-sector aim and forces R3 at home |
| R3 / 2 | `base-bunt-pitcher-b4-o2` | R3 advances; home out is a tag, ending the inning |

The expanded bunt cases actually include P, C, 1B and 3B fielders (396, 184, 40
and 28 configurations respectively). These are contact geometries, not commands
that force the named position to field. There is no dedicated squeeze strategy.

## 5. Full audit comparison

The preserved baseline has 2,202 configurations and 60 deterministic replays,
zero Critical findings, 51 H1 and 46 H2 flags (97 High scenarios), eight
relay forecast drift flags, 12 late-coverage, 1,812 late/space-limited support,
227 optional support and eight pop-priority review flags.

The final expanded run has zero Critical or High findings and no H1/H2/drift/
pop-priority flags. Each input-seed case is replayed identically, for 60 successful
determinism comparisons. The two original 576-case matrices also remain active.

| Finding / scope | Before (2,202) | After, common IDs (2,202) | After, expanded (2,522) |
| --- | ---: | ---: | ---: |
| Critical | 0 | 0 | 0 |
| High | 97 | 0 | 0 |
| H1 first touch | 51 | 0 | 0 |
| H2 stopped-receiver floor | 46 | 0 | 0 |
| Relay forecast drift | 8 | 0 | 0 |
| Pop-priority review | 8 | 0 | 0 |
| Late base coverage | 12 | 60 | 60 |
| Late/space-limited support | 1,812 | 1,774 | 2,074 |
| Optional support unavailable | 227 | 227 | 227 |
| Any flag, including advisories | 1,874 | 1,839 | 2,139 |

Late base coverage is deliberately **not** claimed fixed everywhere: six old
flagged cases clear, six remain, and 54 newly expose a timing gap. Earlier true
runner deadlines and separating a throwing 1B from first-base coverage reveal
late replacement receivers; early plate protection changes other rotations.
The final warning set includes first, second and third (15, 35 and ten cases;
some player counts overlap). RF emergency second coverage and P replacing a
fielding 1B are recurring constrained roles. No out is granted solely because
a role was assigned. The reviewed R1+R2 middle-infield example now keeps C home
and third covered while completing two legal outs; its real late backups remain.

Actual relevant base backups at glove contact were ready in 193/2,115 baseline
release assignments versus 193/2,262 expanded release assignments. This is not
a claimed support improvement or a population rate; routes/deadlines and scope
differ. Short plays often finish before distant support can arrive. The support
summarizer excludes optional intermediate and future-base jobs from this subset.
It still records changed assignments separately. No speed increase or teleported
backup was used to erase warnings.

Advisories are not automatic baseball failures and their counts overlap.
The old stopped-receiver lower bound applies only to stopped receptions; moving
forces additionally require physical bag contact and an explicit controlled
touch in the independent audit. Original hard integrity checks remain active.
Summary evidence includes a source-file SHA-256 in addition to checkout HEAD.

## 6. Verification

Completed local commands and remaining browser status:

| Check | Current evidence |
| --- | --- |
| Focused new V2 suite | 25 tests pass, including 72 R3 bunt configurations and near-home C/P claims |
| Existing baserunning + defensive audit suites | 83 tests pass after stationary-touch correction |
| `npm run build` | passes, TypeScript and Vite production output |
| `npm test` | 364 tests pass across 13 files, including localization and both original matrices |
| `npm run audit:defense:v2 -- --strict` | 2,522 generated, zero Critical/High, 60 matching replays |
| `npm run audit:defense:v2:summary` | all nine defenders analyzed across 2,522, 21 detailed examples |
| `npm run audit:defense -- --case double-play` | completed, all-nine routes/diagnostics inspected |
| `npm run test:browser` | passes in Chromium: 24 EN/JA plays, navigation, playback and six layouts |
| `npm run test:dynamic:browser` | passes: generated physical/rules scenarios, deterministic seeks, EN/JA and six layouts |
| `npm run test:mobile:browser` | passes: four phone viewports, persistent CTA, validation/loading/repeats, rendered text contrast, EN/JA and desktop |
| `npm run test:pages` | passes against production artifact at `/` and `/baseball/` |

Local server binding fails with `listen EPERM` and Chromium cannot start under
this sandbox. No browser pass is claimed from those attempts. The added
`Defensive V2 regression` workflow runs the same checks with Chromium in Actions
and retains browser screenshots plus audit summaries as artifacts.

The first Actions run passed unit/build/strict-audit/summary and the general
browser suite, then exposed a stale dynamic-browser assertion expecting
CF→1B→C at (558,284). Reproducing the same settings against untouched `8331a1c`
confirmed that both versions use CF→2B→C, with 1B as the separate inner cutoff,
and identical releases/receipts/tag timing. The assertion now matches that
production convention. This required no gameplay change. Browser suites run as
separate steps so one failure does not hide the remaining mobile/pages checks.
The next run caught an optional diagnostic field lacking a TypeScript assertion
in the additional pop-up test; that test-only annotation is corrected. Engine
and browser jobs now run independently, each retaining its own artifacts.
Another legacy browser assertion demanded a throw for an anticipated normal
bunt at (380,650). The original and corrected engines both hold after 3B secures
at 4.102247: first-base ball control needs 1.895249 s versus BR's remaining
1.597751 s. The browser now explicitly checks no throw/zero outs there, and the
mirrored (620,650) feed/one out, rather than weakening it to accept either result.
Screenshot inspection exposed pale hover/disabled Generate text; explicit colors
and an independent rendered-contrast check fix it. No gameplay changed for these
browser corrections.

Browser evidence: [Actions run 40957553034](https://github.com/Nakamashi/baseball/actions/runs/40957553034),
browser job 123741462280, tested source `16fd1ebbc3586d92818bc1be9b5d15e97fa42d3b`.
The `defensive-v2-browser` artifact contains inspected phone/desktop screenshots;
`audit/defensive-v2-after/verification/browser-ci.txt` retains the pass statements.
Both jobs in this final run completed successfully. Engine job 123741462460
independently confirms 364 tests, build, 2,522 scenarios, zero Critical/High,
60 matching replays and the all-nine summary; its pass statements are retained in
`verification/engine-ci.txt`. The final publication adds only documentation and
compact evidence to this tested source. Original report and raw baseline traces
remain intact; raw traces are not committed.

## 7. Mobile validation scope

`test:mobile:browser` covers 320×568, 375×667, 390×844 and 844×390; top/bottom
scrolling, final-setting clearance, one action control, ordinary R3 bunt,
disabled/loading/repeat prevention, visible validation error, EN/JA switching,
desktop placement at 1366×768 and removal in encyclopedia mode. It captures
phone and desktop screenshots. Real iOS keyboard/gesture behavior remains a
device-testing limitation even after Chromium passes.
The 390×844 Japanese phone and 1366×768 English desktop captures were downloaded
and visually inspected; the corrected action text is readable and the desktop
field/transport layout remains intact. Safe-area and visualViewport code were
reviewed; physical iOS/Android keyboards were not available for device testing.

## 8. Files, commits and limitations

Core: `src/dynamic/{runningGeometry,defense,receiving,provider,movement,
baserunning,airborne,timelineBuilder,types,messages}.ts`.
UI: `src/{App.tsx,styles.css}`, `components/DynamicControls.tsx`, `i18n/ui.ts`.
Tests/tools: `src/tests/{defensiveV2Corrections,relayPhysics,tacticalCorrectness}.test.ts`,
`scripts/{defensive-audit-v2,summarize-defensive-audit-v2,dynamic-browser-smoke,
mobile-generate-browser}.mjs`, `package.json`, `.github/workflows/defensive-v2.yml`.
Documentation includes this report plus current defensive, physics and running
notes. Compact baseline/after evidence is versioned; bulky raw traces stay local.

Local evidence preservation commit: `157411d`; local implementation `a1239dd`.
The exact published implementation tree is `a7783a9e75a78a695debf205acb7184fe11d0e88`,
also verified locally with `git write-tree`. GitHub implementation commit
`9181e4c2090518cbd2ddda2af9804fdf67045a35` includes that identical tree with the
preserved baseline evidence. The final evidence commit is identified in repository
history and the completion response. Further published test/CI/UI commits:
`505cda7`, `c272f70`, `fb9ac27`, `16fd1eb`. The unchanged final
production engine (`src/dynamic` and `src/simulation`, sorted tracked paths plus
NUL and file bytes) has SHA-256
`6f334eafcfaf1379fdd42b44b4439252793f1a2b17c8ae80cb3d7d0b25d0f19a`.
The local audit summary identifies the worktree snapshot used during testing,
before the subsequent test-only additions; the Actions artifact identifies its
exact tested merge commit. Both produce the same audit counts.
Existing point-marker limits,
provisional athlete/receiver calibration, no errors/full rundowns, no squeeze,
and finite relay bounds remain. Passing these checks does not certify every
continuous baseball situation or the empirically correct youth success rate.
