# Dynamic baserunning and home-ground calibration

This change improves the existing dynamic simulator. It preserves the shared field, playback controls and authored encyclopedia. The user's supplied home-ground dimensions are **90 m down the lines and 120 m to center**, with **27.43 m basepaths**. No errors, bobbles or overthrows are generated.

## Findings

The original dynamic geometry treated every display pixel as the same physical distance. That made the 90-foot diamond coexist with a fence only about 60 m at the corners and 69 m at center. A hard ball to a displayed deep corner could be gathered in about three seconds and returned before an average runner's roughly nine-second trip to second. Aggression could not overcome that mismatch without granting imaginary speed.

There were also runner-specific shortcuts: a 5.5-second retrieval threshold capped the possible extra bases; fielding-time replanning could force a runner to the next base after any small turn rather than allow a read and return; an unforced R3 mostly held on grounders until two outs; first-base movement ended at the bag; and the ball visually took the whole retrieval time to reach its destination, even when the fielder arrived later.

## Physical model

`src/dynamic/geometry.ts` maps schematic display coordinates into physical coordinates for the dynamic mode. The infield through 39 m from home keeps its existing scale, preserving every basepath. Beyond that, the outfield expands to the configured fence. Between the known corner and center dimensions, the model uses a smooth radial interpolation; it is not a survey of the actual park's gaps or wall shape.

`toWorld` and `fromWorld` are inverse mappings. Movement, throws, cutoff alignment, backups, interception checks, tags and running use physical distances. Interpolation during playback also happens in physical space. Displayed movement/throw polylines project those physical routes back into the compact SVG, so a physical straight lane may appear curved across its compressed outfield. The encyclopedia retains its original authored geometry and interpolation.

The calibration does **not** change runner, defender or throw speeds to award doubles. Current central assumptions remain 5.1 / 6.2 / 7.2 m/s for slow / average / fast runners, 6 m/s defender movement and 20 m/s throws. As before, ball strength supplies an effective travel speed to the prescribed fielding area. The timing model does not generate airborne trajectories, spin, terrain friction or wall rebounds. A very soft hit placed at a distant endpoint is a teaching input rather than a physical launch prediction.

When multiple outfielders could arrive before the ball, the nearest eligible pursuit wins the tie; a distant LF no longer takes a center-field ball merely because LF appears earlier in the position list. The batted ball reaches its area on the ball-travel clock, then waits without possession while the defender retrieves/gathers it. That interval supplies real time for runners; it is not an invented error.

## Extra-base decisions

Every active runner evaluates successive legal bases using remaining retrieval time, the configured return-route estimate, transfer/catch/tag assumptions, their speed, and aggression. The arbitrary 5.5-second extra-base cap is removed. Aggression changes the accepted timing margin, not running speed: conservative requires 1.6 seconds, normal 0.4 seconds, and aggressive may accept a deficit of 0.65 seconds. An accepted risk can end in a tag out. A needed force requires possession on the base instead of a tag.

The runner planner records each candidate's running time, estimated defensive time, margin and timing acceptance. Final goals also respect preceding runners and legal force chains, so timing acceptance alone does not promise a base. At contact and fielding, the runner can read a developing return, stop, or return to an already reached base instead of being forced onward just because they rounded it. A throw elsewhere can still open an extra base. Runner timing uses the actual route length, including the curved home-to-first approach, rather than assuming every route has the length of a straight basepath.

A hit down a line or into a deep gap can now produce a double on this ground because the retrieval/return route actually takes longer. A clean hit directly to a well-positioned outfielder can remain a single. A timely return can tag out an aggressive runner at second. No hit location guarantees a double, and no safe/out result is assigned from a location label.

The defensive priority fixes remain: available run-saving opportunities precede retiring a non-scoring runner, home can be challenged when competitive, and an ordinary return receiver can consider a further useful throw. The larger field legitimately changes some old coordinate examples. In particular `(530,134)` now represents a much deeper physical ball; an R2 who can score easily should be conceded. Home-play regressions use reachable plate opportunities on the calibrated field, and still check all nine defenders.

## Natural first-base movement

The supplied **FCA Baseball Handbook**, “Baserunning Basics” (PDF page 13), distinguishes a straight run-through on an infield play from a curved approach, turn/read and possible return on an outfield hit. This patch uses that distinction without adding fielding errors.

- A safe BR on an infield play sprints through first, slows beyond the bag, reads the ball and returns promptly without attempting second. This straight run-through is protected; the receiver is not instructed to tag that runner as though the force still exists.
- On an outfield single, BR takes a curved, timed approach to first, rounds about four metres toward second, reads for 0.35 seconds and returns if no extra base is available. The turn and return run on the same live clock as the ball and defenders. A genuine extra-base attempt continues along the basepath instead of performing a cosmetic stop at first.
- First is touched once. Rounding or running through does not create a phantom second-base advance or an extra run. A returning rounded runner keeps first-base coverage relevant. A runner can be released onward when a later read opens the next base.
- If BR is retired at first while outs remain, the out remains recorded and the marker finishes the sprint through first before clearing the play. It does not acquire legal occupancy or regain active status. The third out stops further live movement as before.

A round toward second does **not** have the run-through's protection. The current model does not generate throw-behind pickoffs or complete rundowns on those short reads/returns; it must not be used to teach that a rounded runner is immune. Collision/obstruction adjudication, sliding and detailed acceleration/footwork remain outside the point-marker model. No speculative error is used to grant an extra base.

## Contact reads from third

With fewer than two outs, aggressive mode now represents an eligible contact play on a ground ball beyond the pitcher to a middle infielder or first baseman. R3 breaks for home immediately; the defense can still get the tag out, especially with the infield in. This is a coaching convention with risk, not a baseball rule requiring a runner to go on every grounder.

Direct balls at P, C or 3B retain a freeze/read unless forced or there are two outs. Normal/conservative runners can also take a clear timing opportunity on an eligible grounder, using their larger safety margins. With two outs, ground-ball contact advances remain enabled. Forces and preceding runners take priority. The supplied FCA guidance explicitly cautions against blindly breaking on balls at the pitcher or third baseman and supports scoring reads on grounders beyond the pitcher/deep infield.

The action and reason are translated together. An aggressive contact attempt is labeled as a risk; holding/freeze explains why the runner reads the ball, and a fielding-time retreat no longer falsely claims a cutoff necessarily caused it.

## Diagnostics and validation

`npm run audit:defense -- --case center-home-close` exposes field dimensions, destination distance, runner plans/timing comparisons, actual sampled positions, first-base motion state and defensive decisions. The existing `--settings` input accepts the current situation controls; field dimensions are currently the central home-ground configuration, not a student form setting.

The baserunning suite checks calibrated fence/base distances and inverse projection; physical movement speed at intermediate scrub times; ball travel versus pickup possession; deep left/right double attempts; singles with controlled turns; tag outs at second; curved route timing; safe infield run-throughs and first-base return; finishing an already-retired run without acquiring a base; contact plays from third at different out counts; an infield-in home out; and freeze/read at the pitcher. All generated explanations are checked in Japanese, and playback must remain deterministic after backward seeks.

The existing all-nine defensive matrix remains, checking routes in physical space instead of assuming an unscaled SVG line is a real throwing lane. The production browser suite exercises a single's round/read/return, an extra-base advance and aggressive contact from third alongside the earlier home-play regressions, Japanese switching, compact layout and encyclopedia navigation.

Verification: all **184 automated tests** pass, including the existing 576-situation all-nine matrix. `npm run build`, `npm run test:dynamic:browser`, `npm run test:browser` and `npm run test:pages` pass. Static production artifacts load at both `/` and `/baseball/`; browser checks retain all 24 English/Japanese authored plays and field/control visibility at six screen sizes.
