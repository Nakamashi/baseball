import type { Point, TimedPoint } from "../simulation/types";
import { fromWorld, toWorld } from "./geometry";

/** SI units. A plan is immutable; neither prediction nor playback integrates frames. */
export interface MotionState {
  position: Point;
  velocity: Point;
}
export interface MotionLeg {
  start: number;
  duration: number;
  origin: Point;
  velocity: Point;
  acceleration: Point;
}
export interface MotionPlan {
  legs: MotionLeg[];
  duration: number;
  target: Point;
}
export interface SpeedLeg {
  start: number;
  duration: number;
  distance: number;
  speed: number;
  acceleration: number;
}
export interface SpeedPlan {
  legs: SpeedLeg[];
  duration: number;
  distance: number;
}
const length = (p: Point) => Math.hypot(p.x, p.y);
const add = (a: Point, b: Point, factor = 1): Point => ({
  x: a.x + b.x * factor,
  y: a.y + b.y * factor,
});
export const zeroVelocity = (): Point => ({ x: 0, y: 0 });

/** Fastest bounded-acceleration trip that stops at the target. */
export function speedPlan(
  distance: number,
  speed: number,
  maximum: number,
  acceleration: number,
  delay = 0,
  stop: boolean | number = true,
  brakingAcceleration = acceleration,
): SpeedPlan {
  const legs: SpeedLeg[] = [];
  let time = 0,
    travelled = 0,
    v = speed;
  const push = (duration: number, a: number) => {
    if (duration <= 1e-10) return;
    legs.push({
      start: time,
      duration,
      distance: travelled,
      speed: v,
      acceleration: a,
    });
    travelled += v * duration + (a * duration * duration) / 2;
    v += a * duration;
    time += duration;
  };
  if (delay > 0) push(delay, 0);
  if (distance <= 1e-9 && Math.abs(v) < 1e-5)
    return { legs, duration: time, distance: 0 };
  if (v < 0) push(-v / acceleration, acceleration);
  const remaining = Math.max(0, distance - travelled);
  if (stop === false) {
    const ramp = Math.max(0, (maximum - v) / acceleration);
    const rampDistance = ((v + maximum) * ramp) / 2;
    if (remaining <= rampDistance)
      push(
        (Math.sqrt(v * v + 2 * acceleration * remaining) - v) / acceleration,
        acceleration,
      );
    else {
      push(ramp, acceleration);
      push((distance - travelled) / maximum, 0);
    }
  } else {
    const ending = Math.min(
      typeof stop === "number" ? stop : 0,
      maximum,
      Math.sqrt(v * v + 2 * acceleration * remaining),
    );
    if (v * v > ending * ending + 2 * brakingAcceleration * remaining + 1e-14) {
      push(v / brakingAcceleration, -brakingAcceleration);
      const back = speedPlan(
        travelled - distance,
        0,
        maximum,
        acceleration,
        0,
        true,
        brakingAcceleration,
      );
      for (const leg of back.legs) push(leg.duration, -leg.acceleration);
      return { legs, duration: time, distance };
    }
    const peak = Math.min(
      maximum,
      Math.sqrt((2 * acceleration * brakingAcceleration * remaining +
        brakingAcceleration * v * v + acceleration * ending * ending) /
        (acceleration + brakingAcceleration)),
    );
    if (peak < v - 1e-8)
      throw new Error(
        "Stopping distance exceeds route; brake before planning the return",
      );
    push((peak - v) / acceleration, acceleration);
    push(
      Math.max(
        0,
        (distance -
          travelled -
          (peak * peak - ending * ending) / (2 * brakingAcceleration)) /
          Math.max(peak, 1e-9),
      ),
      0,
    );
    push((peak - ending) / brakingAcceleration, -brakingAcceleration);
  }
  return { legs, duration: time, distance };
}
export function sampleSpeed(plan: SpeedPlan, time: number) {
  const leg =
    plan.legs.find((l) => time < l.start + l.duration - 1e-10) ??
    plan.legs.at(-1);
  if (!leg) return { distance: 0, speed: 0 };
  const dt = Math.max(0, Math.min(leg.duration, time - leg.start));
  return {
    distance: leg.distance + leg.speed * dt + (leg.acceleration * dt * dt) / 2,
    speed: leg.speed + leg.acceleration * dt,
  };
}
/** Turning uses a real braking segment along the old velocity, then a new approach. */
export function planMotion(
  state: MotionState,
  target: Point,
  maximum: number,
  acceleration: number,
  delay = 0,
): MotionPlan {
  const legs: MotionLeg[] = [];
  let p = { ...state.position },
    v = { ...state.velocity },
    time = 0;
  const push = (duration: number, a: Point) => {
    if (duration <= 1e-10) return;
    legs.push({
      start: time,
      duration,
      origin: { ...p },
      velocity: { ...v },
      acceleration: a,
    });
    p = add(add(p, v, duration), a, (duration * duration) / 2);
    v = add(v, a, duration);
    time += duration;
  };
  if (delay > 0 && length(v) < 1e-8) push(delay, zeroVelocity());
  let delta = add(target, p, -1),
    distance = length(delta),
    speed = length(v);
  let aligned =
    speed < 1e-8 ||
    (distance > 1e-8 &&
      v.x * delta.x + v.y * delta.y > 0 &&
      Math.abs(v.x * delta.y - v.y * delta.x) <= 1e-8 * Math.max(1, distance));
  // Small lane corrections steer by cancelling lateral velocity with bounded
  // acceleration. Large changes still plant/brake before a new approach.
  if (
    !aligned &&
    distance > (2 * speed * speed) / acceleration &&
    speed > 1e-8 &&
    (v.x * delta.x + v.y * delta.y) / (speed * distance) > Math.cos(Math.PI / 6)
  ) {
    for (let i = 0; i < 20; i++) {
      const u = { x: delta.x / distance, y: delta.y / distance },
        parallel = v.x * u.x + v.y * u.y;
      const lateral = { x: v.x - u.x * parallel, y: v.y - u.y * parallel },
        amount = length(lateral);
      if (amount < 1e-10) {
        aligned = true;
        break;
      }
      push(amount / acceleration, {
        x: (-lateral.x / amount) * acceleration,
        y: (-lateral.y / amount) * acceleration,
      });
      delta = add(target, p, -1);
      distance = length(delta);
      speed = length(v);
    }
    aligned =
      speed < 1e-8 ||
      (distance > 1e-8 &&
        v.x * delta.x + v.y * delta.y > 0 &&
        Math.abs(v.x * delta.y - v.y * delta.x) <=
          1e-8 * Math.max(1, distance));
  }
  if (
    speed > 1e-8 &&
    (!aligned ||
      (speed * speed) / (2 * acceleration) > distance + 1e-8 ||
      speed > maximum + 1e-8)
  ) {
    push(speed / acceleration, {
      x: (-v.x / speed) * acceleration,
      y: (-v.y / speed) * acceleration,
    });
    v = zeroVelocity();
    delta = add(target, p, -1);
    distance = length(delta);
    speed = 0;
  }
  if (distance > 1e-8) {
    const direction = { x: delta.x / distance, y: delta.y / distance };
    const plan = speedPlan(distance, speed, maximum, acceleration);
    for (const leg of plan.legs)
      push(leg.duration, {
        x: direction.x * leg.acceleration,
        y: direction.y * leg.acceleration,
      });
  }
  return { legs, duration: time, target: { ...target } };
}
export function sampleMotion(plan: MotionPlan, time: number): MotionState {
  if (time >= plan.duration - 1e-9)
    return { position: { ...plan.target }, velocity: zeroVelocity() };
  const leg = plan.legs.find((l) => time < l.start + l.duration)!;
  const dt = Math.max(0, time - leg.start);
  return {
    position: add(
      add(leg.origin, leg.velocity, dt),
      leg.acceleration,
      (dt * dt) / 2,
    ),
    velocity: add(leg.velocity, leg.acceleration, dt),
  };
}
export function motionSamples(
  plan: MotionPlan,
  duration: number,
): TimedPoint[] {
  const times = new Set([
    0,
    duration,
    ...plan.legs
      .flatMap((l) => [l.start, l.start + l.duration])
      .filter((t) => t > 0 && t < duration),
  ]);
  for (let t = 1 / 60; t < Math.min(duration, plan.duration); t += 1 / 60)
    times.add(t);
  return [...times]
    .sort((a, b) => a - b)
    .map((t) => ({ t, point: fromWorld(sampleMotion(plan, t).position) }));
}
export function arrivalTime(
  from: Point,
  to: Point,
  maximum: number,
  acceleration: number,
  velocity = zeroVelocity(),
  delay = 0,
) {
  return planMotion(
    { position: toWorld(from), velocity },
    toWorld(to),
    maximum,
    acceleration,
    delay,
  ).duration;
}
