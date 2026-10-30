import {
  positions,
  type Point,
  type Position,
  type TimedPoint,
} from "../simulation/types";
import {
  bases,
  defaults,
  metres,
  mix,
  mixPhysical,
  beyond,
  isPlayable,
  toward,
} from "./geometry";
import { assumptions } from "./conventions";
import type { BattedBall, DynamicSettings } from "./types";
import { predictTrajectory, ballPhysics, isAirborneType } from "./trajectory";
import { sampleTimed } from "../simulation/timedPath";
import { arrivalTime, speedPlan } from "./locomotion";
export class MovementEngine {
  field(
    settings: DynamicSettings,
    starting: Record<Position, Point>,
  ): BattedBall {
    const trajectory = predictTrajectory(settings);
    const landing = trajectory.events.find(
      (e) => e.type === "landing" || e.type === "wall",
    );
    const boundary = trajectory.events.find(
      (e) => e.type === "home-run" || e.type === "ground-rule-double",
    );
    const candidates: NonNullable<BattedBall["candidates"]> = [];
    for (const player of positions) {
      let found = false;
      const opportunity = (frame: TimedPoint) => {
        const separation = metres(starting[player], frame.point);
        const bodyPoint = toward(
          starting[player],
          frame.point,
          Math.max(0, separation - assumptions.fieldingReach),
        );
        const distance = metres(starting[player], bodyPoint),
          ending = Math.min(
            3,
            Math.sqrt(2 * assumptions.defenderAcceleration * distance),
          );
        const safe =
          metres(bases.home, bodyPoint) <= 39 ||
          isPlayable(
            beyond(
              starting[player],
              bodyPoint,
              (ending * ending) / (2 * assumptions.defenderAcceleration),
            ),
          );
        const arrival = speedPlan(
          distance,
          0,
          assumptions.defenderSpeed,
          assumptions.defenderAcceleration,
          assumptions.reaction,
          safe ? ending : 0,
        ).duration;
        return {
          player,
          time: frame.t,
          point: frame.point,
          bodyPoint,
          endingSpeed: safe ? ending : 0,
          height: frame.height ?? 0,
          arrival,
          caught:
            isAirborneType(settings.ball.type) &&
            (!landing || frame.t < landing.t - 1e-8),
        };
      };
      let previous = 0;
      for (const frame of trajectory.frames) {
        if (boundary && frame.t >= boundary.t - 1e-8) break;
        if (
          frame.t < assumptions.reaction ||
          (frame.height ?? 0) > ballPhysics.maximumCatchHeight
        ) {
          previous = frame.t;
          continue;
        }
        const candidate = opportunity(frame);
        if (candidate.arrival <= frame.t + 1e-8) {
          let lo = previous,
            hi = frame.t;
          for (let i = 0; i < 18; i++) {
            const mid = (lo + hi) / 2,
              at = sampleTimed(trajectory.frames, mid),
              possible = opportunity(at);
            if (
              mid >= assumptions.reaction &&
              (at.height ?? 0) <= ballPhysics.maximumCatchHeight &&
              possible.arrival <= mid
            )
              hi = mid;
            else lo = mid;
          }
          candidates.push(opportunity(sampleTimed(trajectory.frames, hi)));
          found = true;
          break;
        }
        previous = frame.t;
      }
      if (!found && !boundary) {
        const end = trajectory.frames.at(-1)!;
        const arrival = arrivalTime(
          starting[player],
          end.point,
          assumptions.defenderSpeed,
          assumptions.defenderAcceleration,
          undefined,
          assumptions.reaction,
        );
        candidates.push({
          player,
          time: Math.max(end.t, arrival),
          point: end.point,
          height: 0,
          arrival,
          caught: false,
        });
      }
    }
    candidates.sort(
      (a, b) =>
        a.time - b.time ||
        metres(starting[a.player], a.point) -
          metres(starting[b.player], b.point) ||
        positions.indexOf(a.player) - positions.indexOf(b.player),
    );
    let first = candidates[0];
    let catchPriority: BattedBall["catchPriority"];
    if (first?.caught && settings.ball.type === "Pop-up") {
      // Perry Hill's priority, only among comparable controlled opportunities.
      // Reachability and a reasonable route take precedence over a position name.
      const priority: Position[] = ["CF", "LF", "RF", "SS", "2B", "3B", "1B", "C", "P"];
      const distance = metres(starting[first.player], first.point);
      const comparable = candidates.filter(c => c.caught && c.time <= first!.time + 0.08 &&
        metres(starting[c.player], c.point) <= Math.max(20, distance + 8));
      comparable.sort((a, b) => priority.indexOf(a.player) - priority.indexOf(b.player) || a.time - b.time);
      first = comparable[0] ?? first;
      if (comparable.length > 1) catchPriority = { convention: "reachable-priority",
        selected: first.player, yielded: comparable.filter(c => c !== first).map(c => c.player) };
    }
    const point = first?.point ?? boundary!.point;
    const fielder =
      first?.player ??
      positions
        .filter((p) => ["LF", "CF", "RF"].includes(p))
        .sort(
          (a, b) => metres(starting[a], point) - metres(starting[b], point),
        )[0];
    const touch = first?.time ?? boundary!.t;
    const bodyPoint = first?.bodyPoint ?? point;
    const stoppingDistance = Math.min(
      0.9,
      metres(starting[fielder], bodyPoint),
    );
    const moving =
      first &&
      (first.endingSpeed ?? 0) > 0 &&
      arrivalTime(
        starting[fielder],
        bodyPoint,
        assumptions.defenderSpeed,
        assumptions.defenderAcceleration,
        undefined,
        assumptions.reaction,
      ) >
        first.time + 1e-7;
    const pursuitTarget = moving
      ? beyond(starting[fielder], bodyPoint, stoppingDistance)
      : bodyPoint;
    const pursuitDelay = moving ? Math.max(0, first.time - first.arrival) : 0;
    return {
      catchPriority,
      type: settings.ball.type,
      origin: bases.home,
      destination: settings.ball.destination,
      strength: settings.ball.strength,
      path: [bases.home, point],
      travelTime: trajectory.duration,
      fieldingTime:
        touch +
        (first?.caught ? assumptions.catchTime : assumptions.fieldDelay),
      fielder,
      fieldingPoint: point,
      status: "rolling",
      trajectory,
      touchTime: touch,
      touchPoint: point,
      pursuitTarget,
      pursuitDelay,
      caught: first?.caught ?? false,
      boundary: first
        ? undefined
        : (boundary!.type as "home-run" | "ground-rule-double"),
      candidates,
    };
  }
  starting(settings: DynamicSettings): Record<Position, Point> {
    const result = structuredClone(defaults);
    result.C = beyond(bases[2], bases.home, assumptions.catcherDepth);
    const s = settings.state;
    const difference =
      s.fieldingTeam === "home"
        ? s.homeScore - s.awayScore
        : s.awayScore - s.homeScore;
    const infieldIn = s.strategy === "prevent" && !!s.runners.R3 && s.outs < 2;
    const halfway =
      s.strategy === "standard" &&
      !!s.runners.R3 &&
      s.outs < 2 &&
      s.inning >= 4 &&
      difference >= 0 &&
      difference <= 1;
    if (infieldIn || halfway) {
      for (const id of ["1B", "2B", "3B", "SS"] as const)
        result[id] = mix(result[id], bases.home, infieldIn ? 0.24 : 0.11);
    } else {
      if (s.runners.R1 && !s.runners.R2) result["1B"] = { x: 696, y: 558 };
      if (s.runners.R1 && s.outs < 2) {
        result["2B"] = { x: 575, y: 425 };
        result.SS = { x: 425, y: 425 };
      }
    }
    if (settings.anticipateBunt) {
      result["1B"] = { x: 670, y: 600 };
      result["3B"] = s.runners.R2 ? { x: 310, y: 555 } : { x: 330, y: 600 };
      result["2B"] = { x: 625, y: 450 };
      result.SS = { x: 425, y: 425 };
    }
    if (settings.state.strategy === "conservative") {
      for (const id of ["LF", "CF", "RF"] as const)
        result[id] = mixPhysical(bases.home, result[id], 1.08);
    }
    return result;
  }
}
