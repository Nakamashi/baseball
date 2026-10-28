import { interpolate } from "./geometry";
import type { PlayScenario, PlayerId, Point, Snapshot } from "./types";
export function duration(s: PlayScenario) {
  return Number(
    (s.phases.at(-1)!.start + s.phases.at(-1)!.duration).toFixed(6),
  );
}
// Sampling always starts from authored initial state. Seeking never depends on playback history.
export function sample(s: PlayScenario, time: number): Snapshot {
  const t = Math.max(0, Math.min(duration(s), time));
  const phase = s.phases.reduce(
    (active, p) => (p.start <= t ? p : active),
    s.phases[0],
  );
  const locations: Record<string, Point> = structuredClone(s.startingPositions);
  for (const p of s.phases) {
    if (p.start > t) break;
    const u = Math.min(1, (t - p.start) / p.duration);
    for (const m of p.movements) locations[m.player] = interpolate(m.path, u);
  }
  const progress = Math.min(1, (t - phase.start) / phase.duration);
  const owner =
    phase.ball.kind === "held"
      ? phase.ball.owner
      : progress >= 1
        ? phase.ball.receiver
        : undefined;
  const ball = owner
    ? locations[owner]
    : phase.ball.kind === "travel"
      ? interpolate(phase.ball.path, progress)
      : locations[phase.ball.owner];
  return {
    time: t,
    phase,
    ball,
    owner,
    state: structuredClone(phase.state),
    players: Object.entries(locations).map(([id, position]) => ({
      id: id as PlayerId,
      position,
      hasBall: owner === id,
      action: phase.responsibilities[id]?.action ?? "",
      status: phase.statuses[id as "BR"] ?? "active",
    })),
  };
}
export function stepTime(s: PlayScenario, t: number, direction: 1 | -1) {
  const stops = [...s.phases.map((p) => p.start), duration(s)];
  return direction === 1
    ? (stops.find((v) => v > t + 0.01) ?? duration(s))
    : (stops.filter((v) => v < t - 0.01).at(-1) ?? 0);
}
export function advance(
  t: number,
  delta: number,
  speed: number,
  total: number,
  playing: boolean,
) {
  return playing ? Math.min(total, t + Math.max(0, delta) * speed) : t;
}
