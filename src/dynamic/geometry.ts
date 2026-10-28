import { bases, defaults, interpolate } from "../simulation/geometry";
import type { Point } from "../simulation/types";
export { bases, defaults, interpolate };
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const metresPerUnit = 27.43 / distance(bases.home, bases[1]);
export const metres = (a: Point, b: Point) => distance(a, b) * metresPerUnit;
export const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const toward = (a: Point, b: Point, m: number) =>
  mix(a, b, Math.min(1, m / Math.max(0.0001, metres(a, b))));
export const clamp = (p: Point): Point => ({
  x: Math.max(35, Math.min(965, p.x)),
  y: Math.max(50, Math.min(855, p.y)),
});
export function beyond(from: Point, target: Point, m: number) {
  return clamp(
    mix(from, target, 1 + m / Math.max(0.001, metres(from, target))),
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
