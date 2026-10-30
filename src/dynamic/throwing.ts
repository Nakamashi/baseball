import type { Point, Position, TimedPoint } from "../simulation/types";
import type { DynamicSettings } from "./types";
import { metres, bases, mixPhysical } from "./geometry";
/** Provisional release profiles, NOT radar-release population norms.
 * Academy peak velocities supplied by the user only bound plausibility. */
export const throwProfiles = {
  feed: { speed: 16, prepare: 0.2 },
  infield: { speed: 23, prepare: 0.3 },
  pivot: { speed: 23, prepare: 0.22 },
  relay: { speed: 28, prepare: 0.26 },
  outfield: { speed: 30, prepare: 0.38 },
};
export function throwingProfile(
  from: Point,
  to: Point,
  owner: Position = "SS",
  strength: DynamicSettings["armStrength"] = "standard",
) {
  const distance = metres(from, to),
    outfielder = ["LF", "CF", "RF"].includes(owner),
    pivot =
      !outfielder &&
      ["SS", "2B"].includes(owner) &&
      metres(from, bases[2]) < 1.5;
  const kind = outfielder
    ? "outfield"
    : distance <= 12
      ? "feed"
      : pivot
        ? "pivot"
        : metres(from, bases.home) > 45
          ? "relay"
          : "infield";
  const delta = strength === "developing" ? -2 : strength === "strong" ? 2 : 0;
  return {
    kind,
    speed: throwProfiles[kind].speed + delta,
    prepare: throwProfiles[kind].prepare,
  };
}
/** Linear air drag is a deliberately simple aerodynamic approximation. These
 * coefficients need local calibration; no wind, spin or throwing errors. */
export const throwPhysics = {
  gravity: 9.81,
  drag: 0.08,
  releaseHeight: 0.8,
  receivingHeight: 0.8,
  accurateAngle: (25 * Math.PI) / 180,
  maximumAngle: Math.PI / 4,
  relayRead: 0.15,
  maximumRelays: 2,
};
export interface ThrowFlight {
  duration: number;
  reachable: boolean;
  angle: number;
  releaseSpeed: number;
  arrivalSpeed: number;
  horizontalSpeed: number;
}
const heightAt = (speed: number, angle: number, t: number) => {
  const { drag: k, gravity: g, releaseHeight } = throwPhysics;
  return releaseHeight +
    ((speed * Math.sin(angle) + g / k) * -Math.expm1(-k * t)) / k - g * t / k;
};
function crossingTime(distance: number, speed: number, angle: number) {
  const fraction = throwPhysics.drag * distance / (speed * Math.cos(angle));
  return fraction >= 1 ? Infinity : -Math.log1p(-fraction) / throwPhysics.drag;
}
const flights = new Map<string, ThrowFlight>();
/** Low-arc solution at fixed release speed. Forecasts and compilation use this
 * exact same calculation; unreachable throws must become a relay or carry. */
export function throwFlight(
  from: Point,
  to: Point,
  owner: Position = "SS",
  strength: DynamicSettings["armStrength"] = "standard",
): ThrowFlight {
  const distance = metres(from, to), speed = throwingProfile(from, to, owner, strength).speed;
  const key = `${distance}:${speed}`;
  const cached = flights.get(key);
  if (cached) return cached;
  let low = 0, high = throwPhysics.maximumAngle;
  const reachable = heightAt(speed, high, crossingTime(distance, speed, high)) >= throwPhysics.receivingHeight - 1e-8;
  if (reachable)
    for (let i = 0; i < 28; i++) {
      const angle = (low + high) / 2;
      if (heightAt(speed, angle, crossingTime(distance, speed, angle)) < throwPhysics.receivingHeight) low = angle;
      else high = angle;
    }
  const angle = reachable ? (low + high) / 2 : high;
  const duration = crossingTime(distance, speed, angle);
  const horizontalSpeed = speed * Math.cos(angle) * Math.exp(-throwPhysics.drag * duration);
  const vertical = (speed * Math.sin(angle) + throwPhysics.gravity / throwPhysics.drag) *
    Math.exp(-throwPhysics.drag * duration) - throwPhysics.gravity / throwPhysics.drag;
  const result = { duration, reachable, angle, releaseSpeed: speed,
    arrivalSpeed: Math.hypot(horizontalSpeed, vertical), horizontalSpeed };
  if (flights.size > 4096) flights.clear();
  flights.set(key, result);
  return result;
}
export function throwSamples(from: Point, to: Point, flight: ThrowFlight): TimedPoint[] {
  if (!flight.reachable) throw new Error("Cannot compile an unreachable throw");
  const distance = metres(from, to), count = Math.max(1, Math.ceil(flight.duration * 60));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = flight.duration * i / count;
    const travelled = flight.releaseSpeed * Math.cos(flight.angle) *
      -Math.expm1(-throwPhysics.drag * t) / throwPhysics.drag;
    return { t, point: mixPhysical(from, to, distance < 1e-8 ? 1 : Math.min(1, travelled / distance)),
      height: Math.max(throwPhysics.receivingHeight, heightAt(flight.releaseSpeed, flight.angle, t)) };
  });
}
/** A cutoff may intercept only where the actual flight crosses its receiving
 * point at a catchable height. Merely standing on the diagram line is not enough. */
export function cutoffCrossing(from: Point, to: Point, cutoff: Point, flight: ThrowFlight) {
  const full = metres(from, to), first = metres(from, cutoff), last = metres(cutoff, to);
  if (!flight.reachable || first < 0.1 || last < 0.1 || Math.abs(first + last - full) > 0.001) return undefined;
  const time = crossingTime(first, flight.releaseSpeed, flight.angle);
  const height = heightAt(flight.releaseSpeed, flight.angle, time);
  return time < flight.duration && height >= 0.3 && height <= 2.25 ? { time, height } : undefined;
}
/** Range of a controlled, low-arc return at the actual release profile. */
export function directThrowRange(
  owner: Position,
  strength: DynamicSettings["armStrength"] = "standard",
) {
  const speed = (owner === "LF" || owner === "CF" || owner === "RF" ? throwProfiles.outfield.speed : throwProfiles.relay.speed) +
    (strength === "strong" ? 2 : strength === "developing" ? -2 : 0);
  let lo = 0, hi = 8;
  for (let i = 0; i < 28; i++) {
    const t = (lo + hi) / 2;
    if (heightAt(speed, throwPhysics.accurateAngle, t) > throwPhysics.receivingHeight) lo = t;
    else hi = t;
  }
  return speed * Math.cos(throwPhysics.accurateAngle) *
    -Math.expm1(-throwPhysics.drag * (lo + hi) / 2) / throwPhysics.drag;
}

/** Exact isotropic linear-drag flight, including vertical drag, as in throwing.ts.
 * Arbitrary world position/velocity are retained; this is not a new batted ball. */
export function advanceThrownBall(p: Point, height: number,
  velocity: {x:number;y:number;z:number}, dt: number) {
  const k = throwPhysics.drag, g = throwPhysics.gravity;
  const decay = Math.exp(-k * dt), integral = -Math.expm1(-k * dt) / k;
  return {
    position: { x: p.x + velocity.x * integral, y: p.y + velocity.y * integral },
    height: height + (velocity.z + g / k) * integral - g * dt / k,
    velocity: { x: velocity.x * decay, y: velocity.y * decay,
      z: (velocity.z + g / k) * decay - g / k },
  };
}
