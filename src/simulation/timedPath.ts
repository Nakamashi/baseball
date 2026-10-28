import type { TimedPoint } from "./types";
import { mixPhysical } from "../dynamic/geometry";
export function sampleTimed(samples: TimedPoint[], time: number): TimedPoint {
  if (time <= samples[0].t) return { ...samples[0], t: time };
  let lo = 0,
    hi = samples.length - 1;
  if (time >= samples[hi].t) return { ...samples[hi], t: time };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = samples[lo],
    b = samples[hi],
    u = (time - a.t) / (b.t - a.t);
  return {
    t: time,
    point: mixPhysical(a.point, b.point, u),
    height: (a.height ?? 0) + ((b.height ?? 0) - (a.height ?? 0)) * u,
  };
}
export function sliceTimed(
  samples: TimedPoint[],
  start: number,
  end: number,
): TimedPoint[] {
  return [
    sampleTimed(samples, start),
    ...samples.filter((p) => p.t > start + 1e-9 && p.t < end - 1e-9),
    sampleTimed(samples, end),
  ].map((p) => ({ ...p, t: p.t - start }));
}
