import type { Point } from "../simulation/types";
import { planMotion, sampleMotion, type MotionPlan } from "./locomotion";
import { assumptions } from "./conventions";
import { fromWorld, toWorld, metres, beyond } from "./geometry";

/** Controlled walking-speed passage across a force bag. Provisional, not a
 * measured youth benchmark. The same bounded braking plan drives all samples. */
export const pivotReceivingSpeed = 1.2;
export interface MovingReception {
  kind: "moving-pivot" | "moving-first";
  catchPoint: Point;
  basePoint: Point;
  throughPoint: Point;
  catchAfter: number;
  controlAfter: number;
  controlVelocity: Point;
  notBefore: number;
  plannedAt: number;
}

/** Earliest actual body crossing of a point on the motion's approach. A near
 * miss is not a base touch. Units here are world metres and seconds. */
export function motionPointTime(plan: MotionPlan, point: Point) {
  let earliest = Infinity;
  for (const leg of plan.legs) {
    const delta = { x: point.x - leg.origin.x, y: point.y - leg.origin.y };
    const axis = Math.abs(leg.velocity.x) + Math.abs(leg.acceleration.x) >
      Math.abs(leg.velocity.y) + Math.abs(leg.acceleration.y) ? "x" : "y";
    const a = leg.acceleration[axis], v = leg.velocity[axis], d = delta[axis];
    let roots: number[] = [];
    if (Math.abs(a) < 1e-10) {
      if (Math.abs(v) > 1e-10) roots = [d / v];
      else if (Math.hypot(delta.x, delta.y) < 1e-7) roots = [0];
    } else {
      const disc = v * v + 2 * a * d;
      if (disc >= -1e-8) roots = [(-v + Math.sqrt(Math.max(0, disc))) / a,
        (-v - Math.sqrt(Math.max(0, disc))) / a];
    }
    for (const dt of roots) {
      if (dt < -1e-8 || dt > leg.duration + 1e-8) continue;
      const at = sampleMotion(plan, leg.start + Math.max(0, dt));
      if (Math.hypot(at.position.x - point.x, at.position.y - point.y) < 1e-5)
        earliest = Math.min(earliest, leg.start + Math.max(0, dt));
    }
  }
  return earliest;
}

/** A catch starts before the bag and control completes at physical base
 * contact. Early waiting is allowed only at rest. A late/off-lane receiver
 * falls back to the ordinary stop-and-receive plan. */
export function planMovingReception(
  from: Point, velocity: Point, base: Point, reaction: number,
  earliestGlove: (catchPoint: Point) => number, elapsed = 0,
): MovingReception | undefined {
  const separation = metres(from, base);
  if (separation < 0.5) return undefined;
  const p = toWorld(from), b = toWorld(base), speed = Math.hypot(velocity.x, velocity.y);
  const dx = b.x - p.x, dy = b.y - p.y;
  if (speed > 1e-5 && (velocity.x * dx + velocity.y * dy <= 0 ||
    Math.abs(velocity.x * dy - velocity.y * dx) > speed * separation * 1e-4)) return undefined;
  const throughPoint = beyond(from, base,
    pivotReceivingSpeed ** 2 / (2 * assumptions.defenderAcceleration));
  let wait = reaction;
  let result: MovingReception | undefined;
  for (let i = 0; i < 4; i++) {
    const plan = planMotion({ position: p, velocity }, toWorld(throughPoint),
      assumptions.defenderSpeed, assumptions.defenderAcceleration, wait);
    const controlAfter = motionPointTime(plan, b), catchAfter = controlAfter - assumptions.catchTime;
    if (!Number.isFinite(controlAfter) || catchAfter < 0) return undefined;
    const glove = sampleMotion(plan, catchAfter), control = sampleMotion(plan, controlAfter);
    if (Math.hypot(glove.velocity.x, glove.velocity.y) > 3 + 1e-6) return undefined;
    result = { kind: "moving-pivot", catchPoint: fromWorld(glove.position),
      basePoint: base, throughPoint, catchAfter, controlAfter,
      controlVelocity: control.velocity, notBefore: elapsed + wait, plannedAt: elapsed };
    const late = earliestGlove(result.catchPoint) - catchAfter;
    if (late <= 1e-5) return result;
    if (speed > 1e-5) return undefined;
    wait += late;
  }
  return result && earliestGlove(result.catchPoint) <= result.catchAfter + 1e-5 ? result : undefined;
}
