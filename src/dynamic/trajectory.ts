import type { Point, TimedPoint } from "../simulation/types";
import type { DynamicSettings } from "./types";
import { bases, toWorld, fromWorld, fieldRadius } from "./geometry";
import { fieldConfiguration } from "./fieldConfiguration";

export const ballPhysics = {
  version: "trajectory-2-tactics",
  gravity: 9.81,
  step: 1 / 120,
  wallHeight: 2.5,
  bounceRestitution: 0.42,
  impactRetention: 0.82,
  airDrag: 0.015,
  dirtRollingDeceleration: 1.2,
  grassRollingDeceleration: 1.8,
  contactHeight: 0.8,
  maximumCatchHeight: 2.25,
  horizon: 30,
};
export type TrajectoryEventType =
  | "landing"
  | "bounce"
  | "roll"
  | "wall"
  | "home-run"
  | "ground-rule-double"
  | "stop";
export interface TrajectoryEvent {
  t: number;
  type: TrajectoryEventType;
  point: Point;
  height: number;
}
export interface BallFrame extends TimedPoint {
  velocity: { x: number; y: number; z: number };
  state: "airborne" | "bouncing" | "rolling" | "stopped";
}
export interface BallTrajectory {
  version: string;
  frames: BallFrame[];
  events: TrajectoryEvent[];
  duration: number;
  launch: {
    speed: number;
    angle: number;
    requestedDistance: number;
    adjusted: boolean;
    type: string;
  };
}
const hypot = (p: Point) => Math.hypot(p.x, p.y);
const airborne = (type: string) =>
  type === "Fly ball" || type === "Line drive" || type === "Pop-up";
export function isAirborneType(type: string) {
  return airborne(type);
}

/** Click is an aim lane for grounders and first untouched landing for airborne balls.
 * A bounded launch profile can constrain an airborne request; the preview reports it. */
export function predictTrajectory(settings: DynamicSettings): BallTrajectory {
  const destination = toWorld(settings.ball.destination),
    range = hypot(destination);
  const direction = { x: destination.x / range, y: destination.y / range };
  if (!Number.isFinite(range) || range < 0.01)
    throw new Error("Invalid trajectory aim");
  const type = settings.ball.type,
    strength = settings.ball.strength,
    air = airborne(type);
  const theta =
    ((type === "Pop-up"
      ? { soft: 78, normal: 75, hard: 72 }
      : type === "Fly ball"
        ? { soft: 55, normal: 45, hard: 35 }
        : { soft: 28, normal: 20, hard: 12 })[strength] *
      Math.PI) /
    180;
  let speed =
    (type === "Bunt"
      ? { soft: 5, normal: 7, hard: 9 }
      : { soft: 11, normal: 23, hard: 32 })[strength] *
    Math.max(0.92, Math.min(1.12, 0.92 + range / 350));
  let adjusted = false;
  if (air) {
    const flightRange = (v: number) => {
      const vz = v * Math.sin(theta),
        t =
          (vz +
            Math.sqrt(
              vz * vz + 2 * ballPhysics.gravity * ballPhysics.contactHeight,
            )) /
          ballPhysics.gravity;
      return (
        (v * Math.cos(theta) * (1 - Math.exp(-ballPhysics.airDrag * t))) /
        ballPhysics.airDrag
      );
    };
    let lo = 0,
      hi = 70;
    for (let i = 0; i < 45; i++) {
      const mid = (lo + hi) / 2;
      if (flightRange(mid) < range) lo = mid;
      else hi = mid;
    }
    const required = (lo + hi) / 2;
    const limits = { soft: [8, 24], normal: [12, 34], hard: [16, 43] }[
      strength
    ];
    speed = Math.max(limits[0], Math.min(limits[1], required));
    adjusted = Math.abs(speed - required) > 0.01;
  }
  let p = { x: 0, y: 0 },
    z = ballPhysics.contactHeight;
  let v = {
    x: direction.x * speed * (air ? Math.cos(theta) : 1),
    y: direction.y * speed * (air ? Math.cos(theta) : 1),
    z: air ? speed * Math.sin(theta) : -1,
  };
  let t = 0,
    impacts = 0,
    rolling = false,
    stopped = false;
  const frames: BallFrame[] = [],
    events: TrajectoryEvent[] = [];
  const record = () =>
    frames.push({
      t,
      point: fromWorld(p),
      height: Math.max(0, z),
      velocity: { ...v },
      state: stopped
        ? "stopped"
        : rolling
          ? "rolling"
          : impacts
            ? "bouncing"
            : "airborne",
    });
  const event = (type: TrajectoryEventType) =>
    events.push({ t, type, point: fromWorld(p), height: Math.max(0, z) });
  record();
  while (t < ballPhysics.horizon && !stopped) {
    let dt = Math.min(ballPhysics.step, ballPhysics.horizon - t);
    if (!rolling) {
      const impact =
        (v.z + Math.sqrt(v.z * v.z + 2 * ballPhysics.gravity * z)) /
        ballPhysics.gravity;
      if (impact > 1e-9) dt = Math.min(dt, impact);
    }
    const old = { ...p },
      oldZ = z;
    const horizontal = hypot(v);
    if (rolling) {
      const decel =
        hypot(p) < 39
          ? ballPhysics.dirtRollingDeceleration
          : ballPhysics.grassRollingDeceleration;
      dt = Math.min(dt, horizontal / decel);
      const distance = Math.max(0, horizontal * dt - (decel * dt * dt) / 2),
        factor = horizontal > 0 ? distance / horizontal : 0;
      p = { x: p.x + v.x * factor, y: p.y + v.y * factor };
      const retain =
        horizontal > 0 ? Math.max(0, 1 - (decel * dt) / horizontal) : 0;
      v = { x: v.x * retain, y: v.y * retain, z: 0 };
      z = 0;
    } else {
      const factor =
        (1 - Math.exp(-ballPhysics.airDrag * dt)) / ballPhysics.airDrag;
      p = { x: p.x + v.x * factor, y: p.y + v.y * factor };
      z += v.z * dt - (ballPhysics.gravity * dt * dt) / 2;
      v = {
        x: v.x * Math.exp(-ballPhysics.airDrag * dt),
        y: v.y * Math.exp(-ballPhysics.airDrag * dt),
        z: v.z - ballPhysics.gravity * dt,
      };
    }
    t += dt;
    const angle = Math.atan2(p.x, -p.y);
    const radius = fieldRadius(angle);
    if (hypot(p) > radius) {
      let lo = 0,
        hi = 1;
      for (let i = 0; i < 25; i++) {
        const u = (lo + hi) / 2,
          q = { x: old.x + (p.x - old.x) * u, y: old.y + (p.y - old.y) * u };
        if (hypot(q) > fieldRadius(Math.atan2(q.x, -q.y))) hi = u;
        else lo = u;
      }
      const u = (lo + hi) / 2;
      p = { x: old.x + (p.x - old.x) * u, y: old.y + (p.y - old.y) * u };
      z = oldZ + (z - oldZ) * u;
      t -= dt * (1 - u);
      if (
        fieldConfiguration(settings).fenceMode === "standard" &&
        z > fieldConfiguration(settings).fenceHeight
      ) {
        event(impacts === 0 ? "home-run" : "ground-rule-double");
        stopped = true;
        v = { x: 0, y: 0, z: 0 };
      } else {
        event("wall");
        const a = Math.atan2(p.x, -p.y),
          eps = 0.0001;
        const edge = (a: number) => ({
          x: fieldRadius(a) * Math.sin(a),
          y: -fieldRadius(a) * Math.cos(a),
        });
        const left = edge(a - eps),
          right = edge(a + eps),
          tangent = { x: right.x - left.x, y: right.y - left.y };
        const n = {
          x: tangent.y / hypot(tangent),
          y: -tangent.x / hypot(tangent),
        };
        const dot = v.x * n.x + v.y * n.y;
        v = {
          x: (v.x - 1.45 * dot * n.x) * 0.75,
          y: (v.y - 1.45 * dot * n.y) * 0.75,
          z: v.z,
        };
        const radial = hypot(p);
        p = { x: p.x * (1 - 0.002 / radial), y: p.y * (1 - 0.002 / radial) };
      }
    }
    if (!stopped && !rolling && z <= 1e-8 && v.z < 0) {
      z = 0;
      impacts++;
      event(impacts === 1 ? "landing" : "bounce");
      v = {
        x: v.x * ballPhysics.impactRetention,
        y: v.y * ballPhysics.impactRetention,
        z: -v.z * ballPhysics.bounceRestitution,
      };
      if ((v.z * v.z) / (2 * ballPhysics.gravity) < 0.045) {
        rolling = true;
        v.z = 0;
        event("roll");
      }
    }
    if (!stopped && rolling && hypot(v) < 0.04) {
      stopped = true;
      v = { x: 0, y: 0, z: 0 };
      event("stop");
    }
    record();
  }
  if (!stopped) throw new Error("Trajectory exceeded bounded horizon");
  return {
    version: ballPhysics.version,
    frames,
    events,
    duration: t,
    launch: {
      speed,
      angle: air
        ? (theta * 180) / Math.PI
        : (Math.atan2(-1, speed) * 180) / Math.PI,
      requestedDistance: range,
      adjusted,
      type,
    },
  };
}
