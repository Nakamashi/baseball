import type { Point } from "../simulation/types";
import type { OffensiveRunner } from "./types";
import { bases, interpolate, metres, fromWorld, toWorld } from "./geometry";
import { assumptions } from "./conventions";
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
export const runningTime = (r: OffensiveRunner, target: number) =>
  runningMetres(r, r.progress, target) / r.speed;
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
    ? (turn.extent - turn.travelled) / turnSpeed(r)
    : turn.stage === "read"
      ? turn.readRemaining
      : turn.stage === "return"
        ? turn.travelled / assumptions.firstBase.returnSpeed
        : 0;
}
export function remainingRunningTime(r: OffensiveRunner): number {
  if (r.status !== "active" && !r.retiredRunThrough) return 0;
  if (r.retiredRunThrough)
    return r.firstTurn
      ? turnTime(r)
      : runningTime(r, 1) + assumptions.firstBase.overrunMetres / turnSpeed(r);
  const turn = r.firstTurn;
  if (turn && turn.stage !== "complete" && r.goal === 1)
    return (
      turnTime(r) +
      (turn.stage === "outbound"
        ? assumptions.firstBase.readTime +
          turn.extent / assumptions.firstBase.returnSpeed
        : turn.stage === "read"
          ? turn.travelled / assumptions.firstBase.returnSpeed
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
      extent / turnSpeed(r) +
      assumptions.firstBase.readTime +
      extent / assumptions.firstBase.returnSpeed
    );
  }
  return approach;
}
