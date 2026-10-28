import type { BattedBall, DynamicSettings, OffensiveRunner } from "./types";
import { assumptions } from "./conventions";
import { isAirborneType } from "./trajectory";
import { runningTime } from "./runningGeometry";
import { ThrowingEngine } from "./defense";
import { message as m } from "./messages";

export function qualifiesInfieldFly(
  settings: DynamicSettings,
  ball: BattedBall,
) {
  if (
    settings.ball.type !== "Fly ball" ||
    settings.state.outs >= 2 ||
    !settings.state.runners.R1 ||
    !settings.state.runners.R2
  )
    return false;
  const landing = ball.trajectory?.events.find(
    (e) => e.type === "landing" || e.type === "wall",
  );
  return !!ball.candidates?.some(
    (c) =>
      ["P", "C", "1B", "2B", "3B", "SS"].includes(c.player) &&
      c.caught &&
      c.arrival + 0.6 < c.time &&
      (!landing || c.time < landing.t),
  );
}
export function prepareAirReads(
  settings: DynamicSettings,
  ball: BattedBall,
  runners: OffensiveRunner[],
) {
  if (!isAirborneType(settings.ball.type)) return;
  for (const r of runners) {
    if (r.id === "BR" || settings.state.outs === 2) {
      r.airborneRead = "contact";
      continue;
    }
    if (settings.ball.type === "Fly ball") {
      r.goal = r.originBase;
      r.airborneRead = "tag";
    } else {
      r.goal =
        settings.aggression === "aggressive"
          ? r.originBase + 0.18
          : r.originBase;
      r.airborneRead = "read";
    }
    r.decision =
      r.goal > r.progress
        ? "advance"
        : r.goal < r.progress
          ? "retreat"
          : "hold";
    r.plan = { candidates: [], reason: m("airReadWhy") };
  }
}
/** Called at first touch, not at completion of the catch. */
export function releaseTagUps(
  settings: DynamicSettings,
  ball: BattedBall,
  runners: OffensiveRunner[],
) {
  for (const r of runners) {
    if (r.id === "BR" || r.status !== "active") continue;
    const next = Math.min(4, r.originBase + 1),
      base = next === 4 ? "home" : (next as 1 | 2 | 3);
    const returnRunner = {
      ...r,
      progress: r.originBase,
      runVelocity: 0,
      startDelay: 0.1,
    };
    const offensive = runningTime(returnRunner, next);
    const defense =
      assumptions.catchTime +
      new ThrowingEngine().returnTime(ball, next, base) +
      assumptions.tagTime;
    const safety = { conservative: 0.8, normal: 0.4, aggressive: -0.15 }[
      settings.aggression
    ];
    const accepted = offensive + safety < defense;
    r.plan = {
      candidates: [
        {
          base,
          runnerTime: offensive,
          defensiveTime: defense,
          margin: defense - offensive,
          accepted,
        },
      ],
      reason: m("tagUpWhy"),
    };
    r.airborneRead = undefined;
    r.forceRemoved = true;
    if (r.progress > r.originBase + 1e-5) {
      r.retouchBase = r.originBase;
      r.afterRetouchGoal = accepted ? next : r.originBase;
      r.goal = r.originBase;
      r.decision = "retreat";
    } else {
      r.progress = r.originBase;
      r.goal = accepted ? next : r.originBase;
      r.runVelocity = 0;
      r.startDelay = 0.1;
      r.decision = accepted ? "advance" : "hold";
    }
  }
  // A following runner cannot occupy a held base. Process from front to back.
  let lead = 5;
  for (const r of runners) {
    if (r.id === "BR" || r.status !== "active") continue;
    const goal = r.afterRetouchGoal ?? r.goal;
    const legal = Math.min(goal, lead === 4 ? 4 : lead - 1);
    if (r.afterRetouchGoal !== undefined) r.afterRetouchGoal = legal;
    else r.goal = legal;
    lead = legal;
  }
}
