# Bunt fielding and stable return support

Follow-up to the user's LF 757,131, catcher and fast-runner audits, implemented
with approval on October 30. Base engine: Defensive V2 `cacc939`; current UI/main
`74249a0` is preserved. The existing V2 report records provenance for the four
supplied coaching PDFs. Those references support coverage, communication and
backup principles; they do not establish the numerical presets below.

## Changes

- Dynamic C starts **1.5 m behind home**, independent of the authored diagram's
  4.364 m marker. Home recovery uses that same physical stance. It applies to
  every contact type, without a bunt-only starting-position advantage.
- Soft bunt horizontal launch is **3 m/s** before the unchanged 0.92–1.12
  depth-intent multiplier, rather than 5 m/s. This represents a deadened bunt;
  normal/hard remain 7/9 m/s. Gravity, contact height, bounce, rolling resistance
  and aim semantics are unchanged. Untouched Soft rollout in the dense grid is
  **3.074–3.412 m**, rather than roughly 6.7–7.3 m. A click is never a forced stop.
- At contact, P/1B/3B charge only if their own feasible interception is within
  **0.30 s** of the selected primary. A noncompetitive 1B stays available for
  first; 2B rotates when 1B actually fields or has a credible charging duty.
  Live third/home coverage and committed receivers retain higher priority.
- First-base bunt forces can use the existing bounded receiving approach:
  glove contact **0.12 s before secure control and physical bag contact**, crossing
  at **1.2 m/s**, then braking 0.144 m beyond. This is point-marker footwork,
  not an anatomical stretch model. Early receivers stop/wait if that is faster;
  moving catches are used only when they improve controlled arrival. Off-lane
  approaches retain ordinary reception. Glove contact alone never awards a force.
- C can release an aligned bunt throw while finishing the same braking plan:
  initial speed <=3 m/s, direction within **20 degrees**, release speed <=1.2 m/s,
  and full nominal preparation still required. Sideways/turning throws plant.
  Shared prediction and compiled motion use the same physical release point;
  there is no arm-speed or runner-speed change. This is a bounded approximation
  of a moving transfer, not a complete catcher footwork/throwing biomechanics model.
- Deep-return support derives from the immutable original fielder and actual
  original touch point, combined with the current ultimate receiving base.
  Relay range still uses each current throw. LF's third support and P's base
  backup survive an intermediate reception; far-outfielder selection uses the
  original sector. The final incoming lane can adjust the support point.
  Redirection, resolved threats, higher-priority coverage, receiver reservations,
  dead balls and completion still release or replace support. No mutable job
  history is introduced into hypothetical forecasts.
- Reserved receivers remain eligible even outside the normal position preference
  pool. A real emergency receiving job can supersede LF's secondary support.
- The timeline retains micrometre-sized final movement. Previously, discarding
  movement under 0.01 mm could leave third recovery forever incomplete. A precise
  anticipated hard-bunt case at depth 10 m / angle -15 degrees exposed this;
  a focused regression now verifies completion and the actual third-base position.

All numerical fielding/contact/footwork values are provisional engineering
assumptions requiring local coaching calibration. The existing 5.3/4.7/4.2 s
contact-to-first profiles, running acceleration, defender top speed, throw launch
speeds, drag, gravity, force/tag rules and authored encyclopedia are preserved.
Existing typed bilingual messages describe the revised duties; EN/JA coverage
remains tested. Browser fixtures now reflect the closer C winning reachable
pickups, with separate fast-runner and LF support checks.

## Measured outcomes

The comparable grid has nine aim depths (1.1–20 m), seven angles (-42–42 degrees),
three strengths and surprise/anticipated positioning, with average/fast runners
and empty bases/R1, zero outs: **1,512 plays**. These are deterministic scenario
counts, not estimated real-world bunt success percentages.

Bases empty, fast runner, surprise bunt, first-base outs in 63 cases per strength:

| Strength | Before | After |
| --- | ---: | ---: |
| Soft | 0 | 63 |
| Normal | 0 | 21 |
| Hard | 0 | 36 |

Thus the original blanket failure (0/189 outs) becomes **120/189 outs**. The 69
safe results remain governed by placement, fielding and throwing timing. Average
runner results on that grid remain 63/45/54 outs. With anticipation the fast
empty-base results are 63/23/45. With R1, all 63 surprise Soft cases now retire the
lead runner while BR reaches first; those are successful lead forces, not failed
first-base plays. The engine does not force a double play or demand a futile throw.

Concrete straight-ahead 3 m aim, fast runner, empty bases; seconds **after contact**:

| Strength | Fielder touch | Secure pickup | Release | First control | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Soft | C 1.581596 | 1.831596 | 2.181596 | 3.495183 | BR force out |
| Normal | P 2.471257 | 2.721256 | 3.071257 | 4.202217 | BR safe |
| Hard | P 2.143979 | 2.393979 | 2.743979 | 3.829256 | BR force out |

The previous hard-bunt play held because 2B could not control first until 4.577 s.
Now the same ball genuinely reaches ready 1B at 3.829 s. The normal case remains
just late against the unchanged fast BR's 4.200 s touch; it is not rounded into
an out. In the Soft R1 case C releases toward second at 2.131596 s and SS controls
at 4.063990 s, recording the lead force. The physical release retains approximately
0.25 m/s C momentum; unaligned C-to-first preparation still takes 0.35 s.

For the original normal fly 757,131, fast/aggressive, empty bases/zero outs,
CF–2B control remains **10.303544 playback seconds**, 2B–3B control **12.583139**,
and BR's tag **12.964146**. LF reaches the third support point around **10.524**
and holds it through the tag; he no longer heads across the diamond for second.
The 49 neighboring inputs and 38 broader/other-sector cases show no same-return
third-to-second role flip. These times include the one-second Ready phase.

## Verification and reproduction

- `npm test`: **375/375 passed**; includes both original 576-case matrices plus dedicated all-nine,
  force/base-contact, catcher transfer, legitimate safe bunt, receiver reservation,
  near-grid LF and finishing-loop regressions.
- `npm run build`: passed; production TypeScript/Vite artifact.
- `npm run audit:bunts`: **3,360 distinct full bunt plays**, zero generation or
  implemented integrity errors. Includes the comparable grid and a seven-angle
  cross-product covering every occupancy, out count, strength, anticipation and
  average/fast speed at 3 m aim depth. Checks all-nine uniqueness, sampled defender
  speed caps, force possession/base contact, and reported outcomes. Also checks
  **2,760 valid Soft fielding inputs** (all C) and **87 LF return plays**.
- `npm run audit:defense:v2 -- --strict`: full 2,522-case regression with 60
  deterministic replays: **2,522/2,522 generated; 0 Critical, 0 High**. The 2,169
  Medium advisory scenarios retain late/optional coverage for review rather than
  hiding them. Local source-file hash is recorded alongside the base checkout
  commit in `defensive-v2-summary.json`; CI records the published commit.
- All five existing browser suites run in the GitHub regression workflow before
  main deployment. Dynamic checks additionally cover fast Soft/hard bunt outs,
  EN/JA first coverage and LF holding third across relay control/tag.

The initial CI browser run passed the gameplay, encyclopedia, field editor and
static-hosting suites but exposed a mobile resize-test race: scrolling before
responsive reflow finished left the document short of its new bottom. The mobile
test now re-establishes the bottom while awaiting actual note/bar clearance and
retains its overlap assertion. No product layout or padding was changed for this.

Compact measured evidence is in `audit/bunts-and-support/summary.json` and
`lf.json`. The reproducible audit writes full per-case rows to `cases.json`;
CI uploads those with its other artifacts. Existing historical V2 baseline
summaries remain untouched. Passing these checks establishes model consistency,
not empirical baseball accuracy. GitHub Pages remains the production deployment
path; the user-approved main merge triggers it after regression checks pass.
