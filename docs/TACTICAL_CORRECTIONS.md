# Tactical correctness corrections

Baseline: `75896bf`. Work is on a review branch; main and deployment remain unchanged.

## Offline evidence and coherent conventions

The attached *Baseball Positive Coaching Manual* (2013) was examined directly. PDF pages 12 and 83–89 support ball/base/backup duties, live-base coverage and backup alignment; page 100 covers middle-infielder double-play practice; pages 107–115 distinguish relay alignment, redirection and holding; pages 137–138 cover first-base movement and direction/depth-dependent fly-ball leads. These are teaching conventions, not universal rules. The manual primarily addresses younger youth players; its distances are guidance rather than measurements for this 90-foot junior-high field.

The previously supplied *Perry Hill Infield System Training Manual* is available locally. PDF pages 23–28 distinguish double-play feeds and pivots; page 47 describes bunt responsibilities. The existing first-baseman home-cutoff convention remains: Baseball Positive's pitcher-cutoff system (pages 84, 107, 113) is a legitimate alternative, not personnel to mix into the adopted FCA-based system. The user's instruction that deliberate holding can be correct takes precedence over interpreting the manual's “all nine move” teaching phrase literally.

The user supplied summaries of Coleman (2025) and Spaniol et al. (2024 NSCA), including their timing/protocol and academy-selection limitations. These are user-supplied research summaries, not independently retrieved publications. No web research is attempted and no new normative measurements are claimed.

## Reproductions and corrections

- **Double plays:** reproduced a missing second throw against a fast BR at 425,425, while slow-runner fixtures turned two. At other coordinates the hard ball legitimately passes a differently positioned infielder; a clicked shortstop area does not prove SS actually fields it. The baseline tests primarily established a slow-runner 6-4-3. An unnecessary 0.18 s receive pause is removed; initial selection now records the projected force/pivot/first sequence and the actual receiver reevaluates remaining time. An unachievable second out is not guaranteed.
- **Holding:** candidates and rejection explanations now cover all four meaningful target bases, including absent runner threats. A return receiver already controlling second does not generate a pointless return to that same location merely because the original hit was in the outfield. Explicit coach hold/cutoff overrides remain.
- **Threatened bases:** tests independently check third-base receiving responsibility while R2 is approaching, including when the chosen throw is elsewhere. Coverage continues to use runner goals and live return threats rather than occupancy alone.
- **Obsolete movements:** reproduced continuing first-base backup duties while an already-retired BR finished a permitted sprint. Once defensive throw opportunities close, old support jobs are cancelled, moving players decelerate and meaningful live-base coverage is retained. Tactical reassessment cannot recreate cancelled backups during that finishing interval.

The dedicated `tacticalCorrectness.test.ts` checks actual throws, runner profiles, force continuation timing, nearby coordinates, inning-ending action, third coverage, intentional holds, cancellation, all-nine assignments, bilingual explanations and deterministic seeks. Full release validation is performed after the remaining correction stages.
