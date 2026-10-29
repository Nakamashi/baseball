# Throwing flight and coordinated gap relays

This update uses the user's attached **Inside Baseball Cut-Off & Relay Manual**,
read locally. Page 17 covers right-center with R1; pages 14–16 cover the related
left-center and bases-empty patterns. Pages 18–19 distinguish right-field-line
plays. No online coaching guide was fetched. The manual supports assignments,
not the numerical throwing parameters below.

## Adopted movement

For a deep right-center return, 2B leads the relay, 1B establishes a shallower
home cutoff, SS controls second, 3B covers third, C protects home, P anticipates
the plate/third backup, CF/RF retrieve and back each other, and LF supports the
third-base area. The primary middle infielder reverses on a left-center return.
These jobs begin from the anticipated play and update with the ball and runners.
The landing aim is not assumed to be the retrieval point; wall caroms matter.

Third remains a control base throughout an outfield return even when BR's current
goal is second. Its coverage takes priority over optional relay backup. 3B is not
a spare deep relay/trailer; genuine primary fielding or a committed receiving job
requires replacement coverage. Optional intermediate-reception backup is assigned
only if it can reach the reception in time. Otherwise report missing support and
retain useful coverage. The far outfielder's second-base support stays on the
outfield side for a potential next throw from the infield, rather than duplicating
P behind an outfield return inside the diamond. This is not a ban on outfielders
fielding a ball, receiving at a vacated base, or backing first/third in foul ground.
Only one outfielder supplies the secondary support at a given base; the others
retain field coverage instead of converging on an already-supported lane.

P is excluded from backing an intermediate relay reception. On a return to
second, P backs the actual second-base receiver; when that return offers no
timely out and a runner is advancing to third, P can anticipate third instead.
An actual third/home target establishes backup there. These are base overthrow
jobs, distinct from a middle-infielder trailer. Fielding and required base
coverage still take priority. An unavailable relay backup remains explicitly
unfulfilled rather than becoming an outfield pursuit for the pitcher.

The system distinguishes an actual relay receiver, an optional cutoff and a
trailer. A sufficiently deep return can use both the primary relay and the inner
cutoff as actual receivers. Shorter returns may go through an optional cutoff.
An aligned player does not acquire possession without a real reception.

SS initially retains second on the right-center play. A fence-depth trailer can
activate only when a replacement outfielder is already covering second. This is
a deliberate coverage safeguard: page 17 describes the trailer but does not
explicitly fill second while 1B remains on the home line. Allowing a ready LF to
take second is a declared team variation, which supersedes LF's third-backup
job in that rotation. The engine does not claim that the manual explicitly
assigns LF second, or pretend that a distant replacement is already ready.

First is not reserved merely because an advancing runner will pass it while a
home return is developing. Actual returns/rounding still create first-base
coverage needs. Second and third coverage precede speculative first coverage on
a home return, preventing a temporary first assignment from consuming the
pitcher or the remaining middle infielder. Existing late/unfulfilled diagnostics
remain visible. The last meaningful incoming lane is retained through a
receiver's tag, so plate backup does not collapse onto the catcher.

An optional inner home cutoff also yields to a genuine runner return at first.
This preserves live base coverage while the initial airborne read is unresolved;
1B can establish the inner cutoff once first is released.

## Bounded routes and cutoff decisions

`ThrowRoute.relays` records the planned possession-changing intermediate
receivers. There can be **at most two** per return, including an intentional
interception followed by a redirected route. `relaysUsed` records prior
intermediate receptions during continuation. An ordinary base play followed by
a new throw is a separate defensive play. There is no tertiary-relay planner.

Relay depth follows the source-to-target line and the thrower's controlled range,
not one universal 55% point. Forecasts include every leg, receiving readiness,
preparation, catching and a 0.15-second relay read. Each receiver reevaluates the
live runners and can continue, redirect or hold. Fixed receivers and remaining
relay points are reserved through each committed flight.

Before commitment, a late relay's preferred depth can move toward the infield
within controlled throwing range. The selected infielder's actual stopping point
is another candidate when it makes progress toward the target. Current velocity,
braking, receiver travel and flight time determine whether the ball can leave
promptly; the infielder need not be at the reception point at release. Receivers
still reach the actual glove-contact point in time. A ready preferred relay stays
in place. If a relay still requires extra waiting, a physically reachable direct
base return can pass the optional cutoff when its complete arrival is faster.
That comparison includes the higher arc's actual flight duration; controlled
range remains the preference for a ready relay, not an absolute airborne limit.
Route kind is reserved along with the receiver/points so live runner updates
cannot turn an already committed through throw back into a mandatory relay.

For the bases-loaded hard fly at 509,91 with aggressive average runners, control
is at 5.083 s and CF releases at 5.563 s (including braking), instead of 8.881 s.
The return is CF–2B–SS at second; SS controls it at 8.867 s and R3 still scores.
The correction gets the ball in promptly without inventing a play at home.

A ready optional cutoff can intercept a through throw when its actual trajectory
crosses the receiving point between 0.3 and 2.25 m high and a better redirection
or hold is available after the original out disappears. The event history records
`CutoffIntercepted`. A late cutoff or a ball passing overhead cannot intercept.
The coach's cutoff-hold setting continues to request a deliberate reception.
If an airborne route is physically unreachable within the two-relay limit, the
holder carries rather than generating an impossible throw or another relay.

## Flight model

Predictions, runner return estimates and compiled throwing samples use
`throwing.ts`. Throws have gravity (9.81 m/s²) and isotropic linear drag
(0.08 s⁻¹). The analytic model solves the low-angle launch to a receiving height
of 0.8 m, with a maximum supported angle of 45 degrees. Horizontal velocity
decreases throughout flight. Playback uses timed samples from that same model,
not constant-speed interpolation. Physics samples do not create teaching phases.

Standard provisional **release** speeds are feed 16, infield/pivot 23, relay 28
and outfield 30 m/s; developing/strong profiles subtract/add 2 m/s. These replace
the old effective flight velocities and are engineering assumptions, not measured
youth averages. Preparation times remain 0.20/0.30/0.22/0.26/0.38 seconds,
respectively, with additional braking/readiness waits when required. Controlled
range derives from a 25-degree trajectory rather than a fixed 75 m distance.

The model approximates aerodynamics; it does not include wind, spin, throwing
errors, intentional one-hop throws, or thrown-ball bounce/roll recovery. A
trailer is a distinct supporting role; the generator does not invent a bad throw
to make that player touch the ball. A terminal play tableau is still separate
from next-pitch recovery. BR's existing aggression policy remains; this change
does not introduce the separately discussed per-runner "advance only on a home
commitment" policy.

## Verification

`relayPhysics.test.ts` checks drag and gravity, short/long flight, unreachable
throws, cutoff height, real cutoff interception/redirection, all-nine right/left
gap roles, two actual intermediate receptions, early backup, optional inner
cutoffs, replacement coverage before trailing, incoming-lane preservation,
destination/occupancy changes, receiving positions and deterministic seeks.
Responsibilities and new events have matching English/Japanese templates.

The existing tactical tests retain catches, tag-ups, bunts, force continuations,
holds/redirections and both 576-case matrices. Some fixture speeds/strengths are
adjusted to keep testing their stated situation under the new flight timing;
no runner or outcome is forced in the engine to preserve an old result.

Run `npm test`, `npm run build` and `npm run audit:defense` with
`--settings path.json --time seconds` to inspect an exact play. Browser suites
require a running local dev server and Chromium. Passing tests establish model
consistency, not empirical calibration against real throws.
