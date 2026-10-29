import { bases, defaults } from "../simulation/geometry";
import type { Point } from "../simulation/types";
import { assumptions } from "./conventions";
import type { BattedBall } from "./types";
export { bases, defaults };
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const metresPerUnit = 27.43 / distance(bases.home, bases[1]);
// The compact display is schematic. Preserve the regulation diamond, then
// map its compressed outfield onto the configured home-ground dimensions.
export function toWorld(p: Point): Point {
  const dx = (p.x - bases.home.x) * metresPerUnit;
  const dy = (p.y - bases.home.y) * metresPerUnit;
  const r = Math.hypot(dx, dy);
  if (r <= assumptions.field.infieldMetres) return { x: dx, y: dy };
  const angle = Math.atan2(dx, -dy);
  const edge = diagramFenceRadius(angle);
  const worldEdge = fieldRadius(angle);
  const radius =
    assumptions.field.infieldMetres +
    ((r - assumptions.field.infieldMetres) *
      (worldEdge - assumptions.field.infieldMetres)) /
      (edge - assumptions.field.infieldMetres);
  return { x: (dx * radius) / r, y: (dy * radius) / r };
}
export function fromWorld(p: Point): Point {
  const r = Math.hypot(p.x, p.y);
  let radius = r;
  if (r > assumptions.field.infieldMetres) {
    const angle = Math.atan2(p.x, -p.y);
    radius =
      assumptions.field.infieldMetres +
      ((r - assumptions.field.infieldMetres) *
        (diagramFenceRadius(angle) - assumptions.field.infieldMetres)) /
        (fieldRadius(angle) - assumptions.field.infieldMetres);
  }
  const scale = r > 0 ? radius / r / metresPerUnit : 0;
  return { x: bases.home.x + p.x * scale, y: bases.home.y + p.y * scale };
}
export const metres = (a: Point, b: Point) => distance(toWorld(a), toWorld(b));
/** Interior of the four-base diamond, excluding its boundary. Outfield support
 * may shade the grass or foul ground, but should not crowd the basepath square. */
export function isInfieldDiamond(p: Point) {
  const point = toWorld(p), centre = toWorld(bases[2]).y / 2;
  return Math.abs(point.x) + Math.abs(point.y - centre) < -centre - 0.01;
}
export const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const mixPhysical = (a: Point, b: Point, t: number): Point =>
  fromWorld(mix(toWorld(a), toWorld(b), t));
export const toward = (a: Point, b: Point, m: number) =>
  mixPhysical(a, b, Math.min(1, m / Math.max(0.0001, metres(a, b))));
export function interpolate(path: Point[], progress: number): Point {
  const world = path.map(toWorld);
  const lengths = world.slice(1).map((p, i) => distance(world[i], p));
  let remaining =
    Math.max(0, Math.min(1, progress)) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 0 && remaining <= lengths[i])
      return fromWorld(mix(world[i], world[i + 1], remaining / lengths[i]));
    remaining -= lengths[i];
  }
  return { ...path[path.length - 1] };
}
export function physicalPolyline(path: Point[]): Point[] {
  return path.flatMap((p, i) =>
    i === 0
      ? [p]
      : Array.from({ length: 12 }, (_, n) =>
          mixPhysical(path[i - 1], p, (n + 1) / 12),
        ),
  );
}
export const clamp = (p: Point): Point => ({
  x: Math.max(35, Math.min(965, p.x)),
  y: Math.max(50, Math.min(855, p.y)),
});
export function beyond(from: Point, target: Point, m: number) {
  return clamp(
    mixPhysical(from, target, 1 + m / Math.max(0.001, metres(from, target))),
  );
}
const quadratic = (a: Point, c: Point, b: Point, t: number) =>
  mix(mix(a, c, t), mix(c, b, t), t);
const fence = [
  bases.home,
  { x: 62, y: 332 },
  ...Array.from({ length: 20 }, (_, i) =>
    quadratic(
      { x: 62, y: 332 },
      { x: 125, y: 64 },
      { x: 500, y: 60 },
      (i + 1) / 20,
    ),
  ),
  ...Array.from({ length: 20 }, (_, i) =>
    quadratic(
      { x: 500, y: 60 },
      { x: 875, y: 64 },
      { x: 938, y: 332 },
      (i + 1) / 20,
    ),
  ),
];
const angularSteps = 256;
const fenceDepths = Array.from({ length: angularSteps + 1 }, (_, i) => {
  const angle = -Math.PI / 4 + ((i / angularSteps) * Math.PI) / 2;
  const ray = { x: Math.sin(angle), y: -Math.cos(angle) };
  let nearest = Infinity;
  for (let j = 0; j < fence.length; j++) {
    const a = fence[j],
      b = fence[(j + 1) % fence.length];
    const sx = b.x - a.x,
      sy = b.y - a.y;
    const den = ray.x * sy - ray.y * sx;
    if (Math.abs(den) < 1e-9) continue;
    const ax = a.x - bases.home.x,
      ay = a.y - bases.home.y;
    const t = (ax * sy - ay * sx) / den;
    const u = (ax * ray.y - ay * ray.x) / den;
    if (t > 1e-5 && u >= -1e-8 && u <= 1 + 1e-8) nearest = Math.min(nearest, t);
  }
  return nearest * metresPerUnit;
});
const fairAngle = (angle: number) =>
  Math.max(-Math.PI / 4, Math.min(Math.PI / 4, angle));
function diagramFenceRadius(angle: number) {
  const index =
    ((fairAngle(angle) + Math.PI / 4) / (Math.PI / 2)) * angularSteps;
  const lower = Math.min(angularSteps - 1, Math.floor(index));
  return (
    fenceDepths[lower] +
    (fenceDepths[lower + 1] - fenceDepths[lower]) * (index - lower)
  );
}
export function fieldRadius(angle: number) {
  return (
    assumptions.field.cornerMetres +
    (assumptions.field.centreMetres - assumptions.field.cornerMetres) *
      Math.cos(2 * fairAngle(angle))
  );
}
export function isPlayable(p: Point) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  let inside = false;
  for (let i = 0, j = fence.length - 1; i < fence.length; j = i++) {
    const a = fence[i],
      b = fence[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  const boundary = fence.some((a, i) => {
    const b = fence[(i + 1) % fence.length],
      dx = b.x - a.x,
      dy = b.y - a.y,
      u = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
    return distance(p, { x: a.x + u * dx, y: a.y + u * dy }) < 0.1;
  });
  return (inside || boundary) && metres(bases.home, p) > 1;
}
export const isOutfield = (p: Point) => metres(bases.home, p) > 39;
/** An infielder on the grass still makes an infield play; crossing a drawn
 * grass edge must not invent an outfield relay or change a contact read. */
export const isOutfieldHit = (ball: BattedBall) =>
  ["LF", "CF", "RF"].includes(ball.fielder) ||
  metres(bases.home, ball.touchPoint ?? ball.fieldingPoint) >
    assumptions.relayDistance;
export function isFairAim(p: Point) {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    p.x < 0 ||
    p.x > 1000 ||
    p.y < 0 ||
    p.y > 900
  )
    return false;
  const world = toWorld(p),
    distance = Math.hypot(world.x, world.y);
  return (
    distance > 1 &&
    distance <= 160 &&
    world.y < 0 &&
    Math.abs(world.x) <= -world.y + 0.00001
  );
}
export function runnerPoint(progress: number): Point {
  const i = Math.max(0, Math.min(4, progress));
  if (i >= 4) return bases.home;
  const n = Math.floor(i);
  return mix(
    n === 0 ? bases.home : bases[n as 1 | 2 | 3],
    n + 1 === 4 ? bases.home : bases[(n + 1) as 1 | 2 | 3],
    i - n,
  );
}
export function runnerPath(from: number, to: number) {
  const path = [runnerPoint(from)];
  if (to >= from) {
    for (let i = Math.floor(from) + 1; i < to; i++) path.push(runnerPoint(i));
  } else {
    for (let i = Math.ceil(from) - 1; i > to; i--) path.push(runnerPoint(i));
  }
  path.push(runnerPoint(to));
  return path;
}
