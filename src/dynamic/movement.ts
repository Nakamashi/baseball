import { positions, type Point, type Position } from "../simulation/types";
import { bases, defaults, metres, mix } from "./geometry";
import { assumptions } from "./conventions";
import type { BattedBall, DynamicSettings } from "./types";
export class MovementEngine {
  field(
    settings: DynamicSettings,
    starting: Record<Position, Point>,
  ): BattedBall {
    const destination = settings.ball.destination,
      travelTime =
        metres(bases.home, destination) /
        (settings.ball.type === "Base hit"
          ? assumptions.outfieldBallSpeed
          : assumptions.ballSpeed)[settings.ball.strength];
    const pool: Position[] =
      settings.ball.type === "Base hit" ? ["LF", "CF", "RF"] : [...positions];
    const opportunities: { id: Position; point: Point; time: number }[] = [];
    for (const id of pool) {
      if (settings.ball.type === "Ground ball")
        for (let i = 2; i <= 40; i++) {
          const fraction = i / 40,
            point = mix(bases.home, destination, fraction),
            time = travelTime * fraction;
          if (
            assumptions.reaction +
              Math.max(0, metres(starting[id], point) - 0.7) /
                assumptions.defenderSpeed <=
            time
          ) {
            opportunities.push({
              id,
              point,
              time: time + assumptions.fieldDelay,
            });
            break;
          }
        }
      opportunities.push({
        id,
        point: destination,
        time:
          Math.max(
            travelTime,
            assumptions.reaction +
              metres(starting[id], destination) / assumptions.defenderSpeed,
          ) + assumptions.fieldDelay,
      });
    }
    opportunities.sort(
      (a, b) =>
        a.time - b.time || positions.indexOf(a.id) - positions.indexOf(b.id),
    );
    const best = opportunities[0];
    return {
      type: settings.ball.type,
      origin: bases.home,
      destination,
      strength: settings.ball.strength,
      path: [bases.home, best.point],
      travelTime,
      fieldingTime: best.time,
      fielder: best.id,
      fieldingPoint: best.point,
      status: "rolling",
    };
  }
  starting(settings: DynamicSettings): Record<Position, Point> {
    const result = structuredClone(defaults);
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
    if (settings.state.strategy === "conservative") {
      for (const id of ["LF", "CF", "RF"] as const)
        result[id] = mix(bases.home, result[id], 1.08);
    }
    return result;
  }
}
