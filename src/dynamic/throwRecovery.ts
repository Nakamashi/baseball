import { positions, type Point, type Position } from '../simulation/types';
import { bases, fromWorld, toWorld, metres, isPlayable, fieldRadius } from './geometry';
import { throwPhysics, throwingProfile, throwFlight, advanceThrownBall } from './throwing';
import { ballPhysics, type BallFrame, type TrajectoryEvent } from './trajectory';
import { planMotion, sampleMotion } from './locomotion';
import type { DefensiveAssignment } from './types';
import { assumptions } from './conventions';

export const errorPolicy = {
  version: 'central-overthrow-1',
  missHeight: 3.2,
  readDelay: 0.25,
  horizon: 25,
  maximumActions: 12,
  maximumLiveTime: 60,
} as const;

/** Failure is never a successful completion or a substitute safe/out result. */
export class ErrorRecoveryFailure extends Error {
  constructor(detail: string) { super(detail); this.name = 'ErrorRecoveryFailure'; }
}
export interface Overthrow {
  outcome: 'missed';
  angle: number;
  releaseSpeed: number;
  missTime: number;
  missHeight: number;
  frames: BallFrame[];
  events: TrajectoryEvent[];
}
export type ThrowOutcome = { outcome: 'received' } | Overthrow;

/** The initial feature has no foul/dead-ball geometry: reject, never clamp. */
export function supportedLoosePoint(point: Point) {
  const p = toWorld(point), radius = Math.hypot(p.x, p.y);
  return isPlayable(point) && p.y < -3 && p.y > -95 &&
    Math.abs(p.x) < 30 && Math.abs(p.x) < -p.y - 2 &&
    radius < fieldRadius(Math.atan2(p.x, -p.y)) - 10;
}

/** Elevated launch at the existing release speed. Choose the smallest angle
 * producing the disclosed miss height; the entire untouched path must stay safe. */
export function elevatedOverthrow(from: Point, to: Point, owner: Position,
  strength: Parameters<typeof throwingProfile>[3]): ThrowOutcome {
  const a = toWorld(from), b = toWorld(to), distance = metres(from, to);
  if (distance < 15 || distance > 38 || a.y > -4 || a.y < -37 || Math.abs(a.x) > 15 ||
      b.y >= a.y || Math.abs(b.x - a.x) / distance > 0.55 || !supportedLoosePoint(from))
    return { outcome: 'received' };
  const speed = throwingProfile(from, to, owner, strength).speed;
  const crossing = (angle: number) => {
    const fraction = throwPhysics.drag * distance / (speed * Math.cos(angle));
    return fraction >= 1 ? Infinity : -Math.log1p(-fraction) / throwPhysics.drag;
  };
  const at = (angle: number) => advanceThrownBall(a, throwPhysics.releaseHeight,
    { x: speed * Math.cos(angle) * (b.x - a.x) / distance,
      y: speed * Math.cos(angle) * (b.y - a.y) / distance,
      z: speed * Math.sin(angle) }, crossing(angle));
  let lo = throwFlight(from, to, owner, strength).angle, hi = throwPhysics.maximumAngle;
  if (!Number.isFinite(crossing(hi)) || at(hi).height < errorPolicy.missHeight)
    return { outcome: 'received' };
  for (let i = 0; i < 35; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid).height < errorPolicy.missHeight) lo = mid; else hi = mid;
  }
  const angle = (lo + hi) / 2, missTime = crossing(angle);
  let p = a, z = throwPhysics.releaseHeight, t = 0;
  let v = { x: speed * Math.cos(angle) * (b.x - a.x) / distance,
    y: speed * Math.cos(angle) * (b.y - a.y) / distance, z: speed * Math.sin(angle) };
  let rolling = false, impacts = 0;
  const frames: BallFrame[] = [], events: TrajectoryEvent[] = [];
  const record = () => frames.push({t, point: fromWorld(p), height: z,
    velocity: {...v}, state: rolling ? (Math.hypot(v.x, v.y) < 1e-8 ? 'stopped' : 'rolling') : impacts ? 'bouncing' : 'airborne'});
  record();
  while (t < errorPolicy.horizon) {
    let dt = Math.min(ballPhysics.step, errorPolicy.horizon - t);
    if (t < missTime - 1e-10) dt = Math.min(dt, missTime - t);
    if (rolling) {
      const speedNow = Math.hypot(v.x, v.y);
      if (speedNow < 1e-8) break;
      const decel = Math.hypot(p.x, p.y) < 39 ? ballPhysics.dirtRollingDeceleration : ballPhysics.grassRollingDeceleration;
      dt = Math.min(dt, speedNow / decel);
      const travel = speedNow * dt - decel * dt * dt / 2;
      p = {x: p.x + v.x / speedNow * travel, y: p.y + v.y / speedNow * travel};
      const retain = Math.max(0, 1 - decel * dt / speedNow);
      v = {x: v.x * retain, y: v.y * retain, z: 0};
      t += dt;
    } else {
      let next = advanceThrownBall(p, z, v, dt);
      if (next.height < 0) {
        let lower = 0, upper = dt;
        for (let i = 0; i < 35; i++) {
          const mid = (lower + upper) / 2;
          if (advanceThrownBall(p, z, v, mid).height > 0) lower = mid; else upper = mid;
        }
        dt = (lower + upper) / 2;
        next = advanceThrownBall(p, z, v, dt);
      }
      p = next.position; z = Math.max(0, next.height); v = next.velocity; t += dt;
      if (z < 1e-8 && v.z < 0) {
        // A ground impulse legitimately changes velocity; airborne phase splits do not.
        z = 0; impacts++;
        events.push({t, type: impacts === 1 ? 'landing' : 'bounce', point: fromWorld(p), height: 0});
        v = {x: v.x * ballPhysics.impactRetention, y: v.y * ballPhysics.impactRetention,
          z: -v.z * ballPhysics.bounceRestitution};
        if (v.z * v.z / (2 * throwPhysics.gravity) < 0.045) { rolling = true; v.z = 0; }
      }
    }
    if (!supportedLoosePoint(fromWorld(p))) return {outcome: 'received'};
    // One frame per timestamp; impact frames contain the post-impact velocity.
    if (Math.abs((frames.at(-1)?.t ?? -1) - t) < 1e-10) frames.pop();
    record();
    if (rolling && Math.hypot(v.x, v.y) < 1e-8) {
      events.push({t, type:'stop',point:fromWorld(p),height:0});
      return {outcome:'missed', angle, releaseSpeed:speed, missTime, missHeight:at(angle).height, frames, events};
    }
  }
  throw new ErrorRecoveryFailure('Overthrow trajectory did not stop within its physical horizon');
}

export interface RecoveryCandidate {
  player: Position;
  time: number; // seconds since release
  point: Point;
  height: number;
  arrival: number;
}
/** Conservative controlled interception: stop at the ball's actual point. No
 * guaranteed backup catch, no reset of a moving defender's velocity. */
export function recoveryCandidates(throwing: Overthrow, elapsed: number,
  locations: Record<string, Point>, velocities: Record<string, Point>, eligible: Position[] = [...positions]) {
  const result: RecoveryCandidate[] = [];
  for (const player of eligible) {
    const arrival = (point: Point) => planMotion({position:toWorld(locations[player]),velocity:velocities[player]},
      toWorld(point), assumptions.defenderSpeed, assumptions.defenderAcceleration).duration;
    let found: RecoveryCandidate | undefined;
    for (const f of throwing.frames) {
      if (f.t < elapsed || (f.height ?? 0) > ballPhysics.maximumCatchHeight) continue;
      const time = arrival(f.point);
      if (time <= f.t - elapsed) { found = {player,time:f.t,point:f.point,height:f.height ?? 0,arrival:time}; break; }
    }
    if (!found) {
      const last = throwing.frames.at(-1)!;
      const time = Math.max(last.t, elapsed + arrival(last.point));
      found = {player,time,point:last.point,height:0,arrival:time-elapsed};
    }
    result.push(found);
  }
  result.sort((a,b)=>a.time-b.time || metres(locations[a.player],a.point)-metres(locations[b.player],b.point) || positions.indexOf(a.player)-positions.indexOf(b.player));
  if (!result.length || result[0].time - elapsed > errorPolicy.horizon)
    throw new ErrorRecoveryFailure('No eligible defender can recover this loose throw');
  return result;
}

/** Do not manufacture a missed catch when an actual pre-recognition route
 * already intersects this released ball at a reachable height. */
export function missClearsDefenders(throwing: Overthrow, thrower: Position,
  locations: Record<string,Point>, velocities: Record<string,Point>,
  assignments: DefensiveAssignment[], liveTime: number) {
  const plans=assignments.filter(a=>a.player!==thrower).map(a=>planMotion(
    {position:toWorld(locations[a.player]),velocity:velocities[a.player]},
    toWorld(a.reception?.throughPoint ?? a.target),assumptions.defenderSpeed,
    assumptions.defenderAcceleration,Math.max(0,(a.notBefore ?? 0)-liveTime)));
  for(const frame of throwing.frames) {
    if(frame.t>throwing.missTime+errorPolicy.readDelay) break;
    if((frame.height ?? 0)>ballPhysics.maximumCatchHeight) continue;
    if(plans.some(plan=>metres(fromWorld(sampleMotion(plan,frame.t).position),frame.point)<=assumptions.fieldingReach)) return false;
  }
  return true;
}
