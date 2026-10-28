import {
  positions,
  type Base,
  type Point,
  type Position,
  type Responsibility,
  type Runner,
} from "../simulation/types";
import { assumptions, conventions } from "./conventions";
import { bases, beyond, metres, mix, clamp, isOutfield } from "./geometry";
import { message as m } from "./messages";
import type {
  BattedBall,
  DefensiveAssignment,
  DynamicSettings,
  OffensiveRunner,
  ThrowDecision,
} from "./types";
export function isForced(
  r: OffensiveRunner,
  runners: OffensiveRunner[],
  base: number,
) {
  if (base !== r.originBase + 1 || r.status !== "active" || r.progress >= base)
    return false;
  return Array.from({ length: r.originBase }, (_, i) => i).every((origin) =>
    runners.some((v) => v.originBase === origin && v.status !== "out"),
  );
}
export class ThrowingEngine {
  arrival(from: Point, to: Point) {
    return (
      assumptions.transfer +
      metres(from, to) / assumptions.throwSpeed +
      assumptions.catchTime
    );
  }
  returnTime(ball: BattedBall, base: number, targetHint: Base | "hold" = 2) {
    const point = bases[base === 4 ? "home" : (base as 1 | 2 | 3)];
    const direct =
      this.arrival(ball.fieldingPoint, point) +
      (metres(ball.fieldingPoint, point) > assumptions.cutoffDistance
        ? assumptions.transfer
        : 0);
    if (targetHint === "hold") return direct + 1.6;
    const hint = targetHint === "home" ? 4 : targetHint;
    return hint === base
      ? direct
      : Math.max(
          direct,
          this.arrival(ball.fieldingPoint, bases[targetHint]) +
            this.arrival(bases[targetHint], point),
        );
  }
}
export function assignmentText(a: DefensiveAssignment): Responsibility {
  const vars = {
    base: a.base ?? 2,
    from: a.teammate ?? "CF",
    player: a.teammate ?? "CF",
  };
  const keys = {
    FieldBall: ["fieldAction", "fieldWhy", "fieldNext"],
    CoverBase: ["coverAction", "coverWhy", "coverNext"],
    Cutoff: ["cutoffAction", "cutoffWhy", "relayNext"],
    Relay: ["relayAction", "relayWhy", "relayNext"],
    BackupFielder: ["backupFieldAction", "backupFieldWhy", "backupNext"],
    BackupThrow: ["backupThrowAction", "backupThrowWhy", "backupNext"],
    HoldPosition: ["holdAction", "holdWhy", "holdNext"],
    PrepareForThrow: ["receiveAction", "coverWhy", "coverNext"],
    Communicate: ["holdAction", "holdWhy", "holdNext"],
  } as const;
  const [action, why, support] = keys[a.type];
  return {
    action: m(action, vars),
    why: m(why, vars),
    support: m(support, vars),
  };
}
export class DefensiveDecisionEngine {
  choose(
    settings: DynamicSettings,
    ball: BattedBall,
    runners: OffensiveRunner[],
    outs: number,
    locations?: Record<string, Point>,
  ): ThrowDecision {
    if (settings.throwTarget === "hold")
      return {
        target: "hold",
        force: false,
        reason: m("targetOverride"),
        override: true,
      };
    if (settings.throwTarget !== "auto" && settings.throwTarget !== "cutoff") {
      const base = settings.throwTarget === "home" ? 4 : settings.throwTarget;
      const runner = runners.find(
        (r) => r.status === "active" && r.goal >= base && r.progress < base,
      );
      return {
        target: settings.throwTarget,
        runner: runner?.id,
        force: runner ? isForced(runner, runners, base) : false,
        reason: m("targetOverride"),
        override: true,
      };
    }
    const throwing = new ThrowingEngine();
    const arrival = (target: Base) => {
      if (!locations)
        return throwing.arrival(ball.fieldingPoint, bases[target]);
      const layout = this.assign(
        settings,
        ball,
        ball.fielder,
        target,
        locations,
        "fielded",
      );
      const legs = layout.cutoff
        ? [layout.cutoff, layout.receiver!]
        : [layout.receiver!];
      let elapsed = 0,
        from = ball.fieldingPoint;
      for (const player of legs) {
        const point = layout.assignments.find(
          (a) => a.player === player,
        )!.target;
        if (player === ball.fielder) {
          elapsed += Math.max(
            0.12,
            metres(from, point) / assumptions.defenderSpeed,
          );
          continue;
        }
        const flight =
          metres(from, point) / assumptions.throwSpeed + assumptions.catchTime;
        const receiverTime = Math.max(
          0,
          metres(locations[player], point) / assumptions.defenderSpeed -
            elapsed,
        );
        elapsed +=
          Math.max(assumptions.transfer, receiverTime - flight) + flight;
        if (player === layout.cutoff) elapsed += 0.15;
        from = point;
      }
      return elapsed;
    };
    const candidates: ThrowDecision[] = [];
    for (const runner of runners) {
      if (runner.status !== "active" || runner.decision === "retreat") continue;
      const next = Math.floor(runner.progress + 0.00001) + 1;
      if (next > runner.goal || next > 4) continue;
      const target: Base = next === 4 ? "home" : (next as Base),
        force = isForced(runner, runners, next);
      const margin =
        ((next - runner.progress) * assumptions.baseMetres) / runner.speed -
        arrival(target) -
        (force ? 0 : assumptions.tagTime);
      if (margin > -0.25)
        candidates.push({
          target,
          runner: runner.id,
          force,
          margin,
          reason: m(
            outs === 2
              ? "targetSure"
              : target === "home" && settings.state.strategy === "prevent"
                ? "targetHome"
                : force
                  ? "targetForce"
                  : "targetTag",
          ),
          override: false,
        });
    }
    const viable = candidates.filter(
      (c) =>
        (c.margin ?? 0) >
        (settings.state.strategy === "conservative" ? 0.8 : 0.05),
    );
    viable.sort((a, b) => {
      const score = (c: ThrowDecision) =>
        (outs === 2 ? 0 : c.force && c.target !== 1 ? 1.4 : 0) +
        (c.target === "home" && settings.state.strategy === "prevent" ? 4 : 0) +
        Math.min(3, c.margin ?? 0);
      return score(b) - score(a);
    });
    if (viable[0]) return viable[0];
    const close = candidates.find((c) => c.target === 1 && c.runner === "BR");
    if (close && !isOutfield(ball.fieldingPoint)) return close;
    if (isOutfield(ball.fieldingPoint))
      return {
        target: 2,
        force: false,
        reason: m("targetReturn"),
        override: false,
      };
    return {
      target: "hold",
      force: false,
      reason: m("targetHold"),
      override: false,
    };
  }
  assign(
    settings: DynamicSettings,
    ball: BattedBall,
    owner: Position,
    target: Base | "hold",
    locations: Record<string, Point>,
    stage: "contact" | "fielded" | "received" = "contact",
  ) {
    const map = new Map<Position, DefensiveAssignment>();
    const put = (
      player: Position,
      type: DefensiveAssignment["type"],
      point: Point,
      priority: number,
      base?: Base,
      teammate?: Position,
    ) => {
      const a: DefensiveAssignment = {
        player,
        type,
        target: clamp(point),
        priority,
        base,
        teammate,
        replacesOn:
          "BallFielded, ThrowReceived, RunnerOut, or coach regeneration",
        explanation: "",
      };
      a.explanation = assignmentText(a).why;
      if (!map.has(player) || map.get(player)!.priority < priority)
        map.set(player, a);
    };
    put(owner, "FieldBall", locations[owner] ?? ball.fieldingPoint, 100);
    if (stage === "contact") map.get(owner)!.target = ball.fieldingPoint;
    const cover = (base: Base, priority: number) => {
      const own =
        stage !== "contact" &&
        base === 1 &&
        owner === "1B" &&
        metres(locations[owner], bases[1]) < 4;
      const reserveCutoff =
        base === 2 &&
        target === 2 &&
        isOutfield(ball.fieldingPoint) &&
        (metres(ball.fieldingPoint, bases[2]) > assumptions.cutoffDistance ||
          settings.throwTarget === "cutoff");
      const candidates =
        base === 1 && owner === "1B"
          ? (["P", "2B", "SS", "3B", "C"] as Position[])
          : conventions.coverage[base];
      const player = own
        ? owner
        : candidates.find((p) => !map.has(p) && (!reserveCutoff || p !== "2B"));
      if (player) {
        if (own) map.delete(owner);
        put(player, "CoverBase", bases[base], priority, base);
      }
      return player;
    };
    let receiver: Position | undefined, cutoff: Position | undefined;
    if (target !== "hold") receiver = cover(target, 95);
    if (
      target !== "hold" &&
      isOutfield(ball.fieldingPoint) &&
      (metres(ball.fieldingPoint, bases[target]) > assumptions.cutoffDistance ||
        settings.throwTarget === "cutoff")
    ) {
      cutoff = [conventions.cutoff[target], "SS", "2B", "1B", "3B"].find(
        (p) => !map.has(p as Position),
      ) as Position | undefined;
      if (cutoff)
        put(
          cutoff,
          metres(ball.fieldingPoint, bases[target]) > assumptions.relayDistance
            ? "Relay"
            : "Cutoff",
          mix(ball.fieldingPoint, bases[target], 0.55),
          85,
          target,
          owner,
        );
    }
    for (const base of [1, 2, 3, "home"] as const)
      if (base !== target) cover(base, 70);
    if ((target === "home" || target === 3) && !map.has("P"))
      put(
        "P",
        "BackupThrow",
        beyond(ball.fieldingPoint, bases[target], 8),
        65,
        target,
        receiver,
      );
    const free = positions.filter((p) => !map.has(p));
    if (
      target !== "hold" &&
      free.length &&
      ![...map.values()].some((a) => a.type === "BackupThrow")
    ) {
      const backup = [...free].sort(
        (a, b) =>
          metres(locations[a], beyond(ball.fieldingPoint, bases[target], 8)) -
          metres(locations[b], beyond(ball.fieldingPoint, bases[target], 8)),
      )[0];
      if (backup)
        put(
          backup,
          "BackupThrow",
          beyond(ball.fieldingPoint, bases[target], 8),
          60,
          target,
          receiver,
        );
    }
    const fieldBackup = positions
      .filter((p) => !map.has(p) && ["LF", "CF", "RF"].includes(p))
      .sort(
        (a, b) =>
          metres(locations[a], ball.fieldingPoint) -
          metres(locations[b], ball.fieldingPoint),
      )[0];
    for (const p of positions) {
      if (map.has(p)) continue;
      if (stage === "contact" && p === fieldBackup)
        put(
          p,
          "BackupFielder",
          clamp({
            ...beyond(bases.home, ball.fieldingPoint, 4),
            x: ball.fieldingPoint.x + (p === "LF" ? -45 : p === "RF" ? 45 : 0),
          }),
          55,
          undefined,
          ball.fielder,
        );
      else
        put(
          p,
          "HoldPosition",
          stage === "contact" && ["LF", "CF", "RF"].includes(p)
            ? mix(locations[p], bases[p === "LF" ? 3 : p === "RF" ? 1 : 2], 0.2)
            : locations[p],
          20,
        );
    }
    return { assignments: [...map.values()], receiver, cutoff };
  }
}
