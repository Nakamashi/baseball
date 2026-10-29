import type { Point } from "../simulation/types";
import type { OffensiveRunner } from "./types";
import { bases, interpolate, metres, fromWorld, toWorld } from "./geometry";
import { assumptions } from "./conventions";
import { speedPlan, sampleSpeed } from "./locomotion";
const basePoint = (n: number) =>
  bases[n === 0 || n === 4 ? "home" : (n as 1 | 2 | 3)];
export function legPath(r: OffensiveRunner, leg: number): Point[] {
  if (leg === 0 && r.id === "BR" && r.approach === "round")
    return [
      bases.home,
      { x: 610, y: 702 },
      { x: 690, y: 650 },
      { x: 716, y: 609 },
      bases[1],
    ];
  return [basePoint(leg), basePoint(leg + 1)];
}
export const pathMetres = (path: Point[]) =>
  path.slice(1).reduce((n, p, i) => n + metres(path[i], p), 0);
export function runnerPointAt(r: OffensiveRunner, progress: number): Point {
  if (progress >= 4) return bases.home;
  const leg = Math.max(0, Math.floor(progress));
  return interpolate(legPath(r, leg), progress - leg);
}
function slicePath(path: Point[], from: number, to: number): Point[] {
  if (from > to) return slicePath(path, to, from).reverse();
  const total = pathMetres(path);
  const result = [interpolate(path, from)];
  let travelled = 0;
  for (let i = 1; i < path.length - 1; i++) {
    travelled += metres(path[i - 1], path[i]);
    if (travelled / total > from + 1e-8 && travelled / total < to - 1e-8)
      result.push(path[i]);
  }
  result.push(interpolate(path, to));
  return result;
}
export function runnerRoute(
  r: OffensiveRunner,
  from: number,
  to: number,
): Point[] {
  if (from > to) return runnerRoute(r, to, from).reverse();
  const result: Point[] = [];
  let current = Math.max(0, from);
  while (current < to - 1e-8) {
    const leg = Math.floor(current + 1e-8),
      end = Math.min(to, leg + 1);
    const points = slicePath(legPath(r, leg), current - leg, end - leg);
    result.push(...(result.length ? points.slice(1) : points));
    current = end;
  }
  return result.length ? result : [runnerPointAt(r, from)];
}
export function runningMetres(
  r: OffensiveRunner,
  from: number,
  to: number,
): number {
  if (from > to) return runningMetres(r, to, from);
  let current = from,
    total = 0;
  while (current < to - 1e-8) {
    const leg = Math.floor(current + 1e-8),
      end = Math.min(to, leg + 1);
    total += pathMetres(legPath(r, leg)) * (end - current);
    current = end;
  }
  return total;
}
export function runningPlan(r: OffensiveRunner, target: number) {
  const direction = Math.sign(target - r.progress) || 1;
  const ending =
    target === 4 || target < r.goal
      ? false
      : r.id === "BR" && target === 1
        ? r.approach === "round"
          ? assumptions.firstBase.turnSpeed
          : false
        : true;
  const sliding = r.originBase > 0 && ending === true && direction > 0 &&
    (target === 2 || target === 3) && r.retouchBase === undefined &&
    r.decision !== "retreat";
  return speedPlan(
    runningMetres(r, r.progress, target),
    (r.runVelocity ?? r.speed) * direction,
    r.speed,
    assumptions.runnerAcceleration,
    r.startDelay ?? 0,
    ending,
    sliding ? assumptions.slideDeceleration : assumptions.runnerAcceleration,
  );
}
export const runningTime = (r: OffensiveRunner, target: number) =>
  runningPlan(r, target).duration;
/** Earliest crossing of a signed route distance, including a crossing before
 * an overshoot/return finishes. The compiler and tactical forecasts share this
 * event definition; settling duration remains available as runningTime. */
export function firstDistanceCrossing(
  plan: ReturnType<typeof runningPlan>, distance: number, after = -1e-8,
) {
  let earliest = Infinity;
  for (const leg of plan.legs) {
    const delta = distance - leg.distance;
    let roots: number[] = [];
    if (Math.abs(leg.acceleration) < 1e-10) {
      if (Math.abs(leg.speed) > 1e-10) roots = [delta / leg.speed];
      else if (Math.abs(delta) < 1e-8) roots = [0];
    } else {
      const disc = leg.speed ** 2 + 2 * leg.acceleration * delta;
      if (disc >= -1e-8) {
        const root = Math.sqrt(Math.max(0, disc));
        roots = [(-leg.speed + root) / leg.acceleration,
          (-leg.speed - root) / leg.acceleration];
      }
    }
    for (const dt of roots) {
      // Starting at a base and waiting/reacting there is not a new touch.
      // Keep the next-event compiler from splitting the Contact phase at
      // the end of a stationary delay, before anyone has actually moved.
      if (after >= 0 && Math.abs(distance) < 1e-8 &&
          Math.abs(leg.distance) < 1e-8 && Math.abs(leg.speed) < 1e-8 &&
          dt < 1e-6) continue;
      const time = leg.start + dt;
      if (dt >= -1e-8 && dt <= leg.duration + 1e-8 && time > after)
        earliest = Math.min(earliest, Math.max(0, time));
    }
  }
  return earliest;
}
/** Time to the next physical touch, not the subsequent stop/read/return.
 * Retouch legality is supplied by the caller's retouch state; a previous
 * first-base touch never creates a new force on an overrun/rounding runner. */
export function baseTouchTime(r: OffensiveRunner, target: number) {
  if (Math.abs(target - r.progress) < 1e-8) return 0;
  const plan = runningPlan(r, target);
  const distance = runningMetres(r, r.progress, target);
  // runningPlan measures distance positively in its chosen direction.
  const touch = firstDistanceCrossing(plan, distance);
  return Number.isFinite(touch) ? touch : plan.duration;
}
/** Compiler boundary roots use the same crossing calculation as forecasts. */
export function nextRunnerBoundaryTime(r: OffensiveRunner, maximum: number) {
  const plan = runningPlan(r, r.goal), direction = Math.sign(r.goal - r.progress) || 1;
  let earliest = Math.min(maximum, plan.duration || maximum);
  for (let base = 0; base <= 4; base++) {
    const distance = runningMetres(r, r.progress, base) *
      Math.sign((base - r.progress) * direction);
    earliest = Math.min(earliest, firstDistanceCrossing(plan, distance, 1e-6));
  }
  return earliest;
}
export function runningAdvance(
  r: OffensiveRunner,
  target: number,
  time: number,
) {
  const direction = Math.sign(target - r.progress) || 1;
  const at = sampleSpeed(runningPlan(r, target), time);
  const signed = at.distance * direction;
  return {
    progress: advanceProgress(
      r,
      Math.max(0, Math.min(4, r.progress + Math.sign(signed) * 4)),
      Math.abs(signed),
    ),
    velocity: at.speed * direction,
    delay: Math.max(0, (r.startDelay ?? 0) - time),
  };
}
export function advanceProgress(
  r: OffensiveRunner,
  target: number,
  distance: number,
): number {
  let current = r.progress;
  const direction = Math.sign(target - current);
  while (Math.abs(target - current) > 1e-8 && distance > 1e-8) {
    const leg =
      direction > 0
        ? Math.floor(current + 1e-8)
        : Math.ceil(current - 1e-8) - 1;
    const boundary =
      direction > 0 ? Math.min(target, leg + 1) : Math.max(target, leg);
    const length = pathMetres(legPath(r, leg));
    const use = Math.min(distance, Math.abs(boundary - current) * length);
    current += (direction * use) / length;
    distance -= use;
  }
  return current;
}
export const turnSpeed = (r: OffensiveRunner) =>
  Math.min(r.speed, assumptions.firstBase.turnSpeed);
export function firstTurnPoint(r: OffensiveRunner): Point {
  const turn = r.firstTurn!;
  if (turn.kind === "round")
    return runnerPointAt(r, 1 + turn.travelled / assumptions.baseMetres);
  const first = toWorld(bases[1]),
    offset = turn.travelled / Math.sqrt(2);
  return fromWorld({ x: first.x + offset, y: first.y - offset });
}
export function turnTime(r: OffensiveRunner): number {
  const turn = r.firstTurn!;
  return turn.stage === "outbound"
    ? speedPlan(
        turn.extent - turn.travelled,
        Math.max(0, r.runVelocity ?? 0),
        Math.max(turnSpeed(r), Math.abs(r.runVelocity ?? 0)),
        assumptions.runnerAcceleration,
      ).duration
    : turn.stage === "read"
      ? turn.readRemaining
      : turn.stage === "return"
        ? speedPlan(
            turn.travelled,
            Math.max(0, -(r.runVelocity ?? 0)),
            assumptions.firstBase.returnSpeed,
            assumptions.runnerAcceleration,
          ).duration
        : 0;
}
export function remainingRunningTime(r: OffensiveRunner): number {
  if (r.status !== "active" && !r.retiredRunThrough) return 0;
  if (r.retiredRunThrough)
    return r.firstTurn
      ? turnTime(r)
      : runningTime(r, 1) +
          speedPlan(
            assumptions.firstBase.overrunMetres,
            sampleSpeed(runningPlan(r, 1), runningTime(r, 1)).speed,
            r.speed,
            assumptions.runnerAcceleration,
          ).duration;
  const turn = r.firstTurn;
  if (turn && turn.stage !== "complete" && r.goal === 1)
    return (
      turnTime(r) +
      (turn.stage === "outbound"
        ? assumptions.firstBase.readTime +
          speedPlan(
            turn.extent,
            0,
            assumptions.firstBase.returnSpeed,
            assumptions.runnerAcceleration,
          ).duration
        : turn.stage === "read"
          ? speedPlan(
              turn.travelled,
              0,
              assumptions.firstBase.returnSpeed,
              assumptions.runnerAcceleration,
            ).duration
          : 0)
    );
  const approach = runningTime(r, r.goal);
  if (r.id === "BR" && r.goal === 1 && !turn) {
    const extent =
      r.approach === "round"
        ? assumptions.firstBase.roundMetres
        : assumptions.firstBase.overrunMetres;
    return (
      approach +
      speedPlan(
        extent,
        sampleSpeed(runningPlan(r, 1), approach).speed,
        Math.max(turnSpeed(r), sampleSpeed(runningPlan(r, 1), approach).speed),
        assumptions.runnerAcceleration,
      ).duration +
      assumptions.firstBase.readTime +
      speedPlan(
        extent,
        0,
        assumptions.firstBase.returnSpeed,
        assumptions.runnerAcceleration,
      ).duration
    );
  }
  return (
    approach +
    (r.afterRetouchGoal !== undefined && r.afterRetouchGoal !== r.goal
      ? runningTime(
          { ...r, progress: r.goal, runVelocity: 0, startDelay: 0.1 },
          r.afterRetouchGoal,
        )
      : 0)
  );
}
