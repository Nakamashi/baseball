import type { BattedBall, DynamicSettings, OffensiveRunner } from "./types";
import { assumptions } from "./conventions";
import { isAirborneType, ballPhysics } from "./trajectory";
import { positions } from "../simulation/types";
import { metres, bases, toward } from "./geometry";
import { arrivalTime } from "./locomotion";
import { baseTouchTime } from "./runningGeometry";
import { ThrowingEngine } from "./defense";
import { message as m } from "./messages";

export function qualifiesInfieldFly(
  settings: DynamicSettings,
  ball: BattedBall,
) {
  if (
    !["Fly ball", "Pop-up"].includes(settings.ball.type) ||
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
    if (settings.ball.type !== "Line drive") {
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
  returnEstimate?: (runner: OffensiveRunner, next: number) => number,
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
    const offensive =
      (r.progress > r.originBase + 1e-5 ? baseTouchTime(r, r.originBase) : 0) +
      baseTouchTime(returnRunner, next);
    const defense =
      assumptions.catchTime +
      (returnEstimate?.(r, next) ??
        new ThrowingEngine(settings).returnTime(ball, next, base)) +
      assumptions.tagTime;
    const safety = { conservative: 0.8, normal: 0.4, aggressive: -0.4 }[
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

export interface AirborneRead {
  time: number;
  classification: "catchable" | "uncertain" | "uncatchable";
  optimisticCatch: boolean;
  controllableCatch: boolean;
  runners: { player: string; progress: number; goal: number }[];
}
/** Observe the developing flight. An impossible catch needs two observations;
 * no decision consults the generator's final caught/uncaught result. */
export function updateAirReads(
  settings: DynamicSettings,
  ball: BattedBall,
  runners: OffensiveRunner[],
  elapsed: number,
  locations: Record<string, import("../simulation/types").Point>,
  history: AirborneRead[],
  velocities?: Record<string, import("../simulation/types").Point>,
) {
  const firstLanding =
    ball.trajectory!.events.find(
      (e) => e.type === "landing" || e.type === "wall" || e.type === "home-run",
    )?.t ?? ball.trajectory!.duration;
  let optimistic = false,
    controllable = false;
  for (const frame of ball.trajectory!.frames.filter(
    (f, i) =>
      i % 4 === 0 &&
      f.t > elapsed &&
      f.t < firstLanding &&
      (f.height ?? 0) <= ballPhysics.maximumCatchHeight,
  ))
    for (const p of positions) {
      const distance = Math.max(
          0,
          metres(locations[p], frame.point) - assumptions.fieldingReach,
        ),
        available = frame.t - elapsed;
      if (distance <= assumptions.defenderSpeed * available) {
        optimistic = true;
        const point = toward(locations[p], frame.point, distance);
        if (
          arrivalTime(
            locations[p],
            point,
            assumptions.defenderSpeed,
            assumptions.defenderAcceleration,
            velocities?.[p],
          ) <= available
        )
          controllable = true;
      }
    }
  const prior = history.at(-1),
    confirmed =
      elapsed >= 0.65 && !optimistic && prior && !prior.optimisticCatch;
  const classification: AirborneRead["classification"] = confirmed
    ? "uncatchable"
    : controllable && elapsed >= 0.65
      ? "catchable"
      : "uncertain";
  if (classification === "uncatchable")
    return {
      classification,
      optimisticCatch: optimistic,
      controllableCatch: controllable,
    };
  for (const r of runners) {
    if (
      r.status !== "active" ||
      r.id === "BR" ||
      settings.state.outs === 2 ||
      r.airborneRead === "contact"
    )
      continue;
    const isLine = settings.ball.type === "Line drive";
    const point =
      ball.trajectory!.events.find((e) => e.type === "landing")?.point ??
      ball.destination;
    const depth = metres(bases.home, point);
    let lead = isLine
      ? classification === "catchable"
        ? 0
        : assumptions.baseMetres * 0.12
      : r.originBase === 1
        ? point.x < 420
          ? 13.716
          : point.x > 580
            ? 4.572
            : 9.144
        : r.originBase === 2
          ? Math.min(12, depth * 0.12)
          : 3.5;
    if (r.originBase === 3 && !isLine && depth >= 65) lead = 0;
    lead *=
      settings.aggression === "conservative"
        ? 0.7
        : settings.aggression === "aggressive"
          ? 1
          : 0.85;
    const returnWindow = new ThrowingEngine(settings).arrival(
      point,
      bases[r.originBase as 1 | 2 | 3],
      ball.fielder,
    );
    while (
      lead > 0.3 &&
      baseTouchTime(
        {
          ...r,
          progress: r.originBase + lead / assumptions.baseMetres,
          goal: r.originBase,
          runVelocity: 0,
          startDelay: 0.15,
        },
        r.originBase,
      ) +
        0.4 >
        returnWindow
    )
      lead -= 0.3;
    r.goal = r.originBase + Math.max(0, lead) / assumptions.baseMetres;
    r.decision =
      r.goal > r.progress
        ? "advance"
        : r.goal < r.progress
          ? "retreat"
          : "hold";
    r.airborneRead = r.goal === r.originBase ? "tag" : "read";
    r.plan = {
      candidates: [],
      reason: m(
        classification === "catchable"
          ? "readCatchableWhy"
          : "readUncertainWhy",
      ),
    };
  }
  return {
    classification,
    optimisticCatch: optimistic,
    controllableCatch: controllable,
  };
}
