import type { Base } from "../simulation/types";
import type { BattedBall, DynamicSettings, OffensiveRunner } from "./types";
import { assumptions } from "./conventions";
import { isOutfield, metres, bases } from "./geometry";
import { isForced, ThrowingEngine } from "./defense";
export class BaserunningDecisionEngine {
  create(settings: DynamicSettings): OffensiveRunner[] {
    return [
      {
        id: "BR" as const,
        originBase: 0,
        progress: 0,
        goal: 1,
        speed: assumptions.runnerSpeed[settings.runnerSpeed],
        decision: "advance" as const,
        status: "active" as const,
      },
      ...Object.entries(settings.state.runners).map(([id, base]) => ({
        id: id as OffensiveRunner["id"],
        originBase: Number(base),
        progress: Number(base) + 0.08,
        goal: Number(base),
        speed: assumptions.runnerSpeed[settings.runnerSpeed],
        decision: "hold" as const,
        status: "active" as const,
      })),
    ].sort((a, b) => b.originBase - a.originBase);
  }
  plan(
    settings: DynamicSettings,
    ball: BattedBall,
    runners: OffensiveRunner[],
    elapsed: number,
    upgrade: boolean,
  ) {
    const hit =
        settings.ball.type === "Base hit" || isOutfield(ball.fieldingPoint),
      throwing = new ThrowingEngine();
    let leadGoal = 5;
    const hint =
      settings.throwTarget === "auto" || settings.throwTarget === "cutoff"
        ? 2
        : settings.throwTarget;
    for (const r of runners) {
      if (r.status !== "active") continue;
      let goal = r.originBase;
      if (r.id === "BR" || isForced(r, runners, r.originBase + 1) || hit)
        goal = Math.min(4, r.originBase + 1);
      if (!hit && settings.state.outs === 2 && r.originBase === 3) goal = 4;
      if (
        !hit &&
        r.originBase === 2 &&
        ball.fieldingPoint.x > 560 &&
        ball.fielder !== "3B" &&
        ball.fielder !== "SS"
      )
        goal = 3;
      if (hit && upgrade) {
        const max =
          r.originBase === 0
            ? ball.fieldingTime > 5.5
              ? 3
              : 2
            : r.originBase === 1
              ? ball.fieldingTime > 5.5
                ? 4
                : 3
              : 4;
        const safety = { conservative: 1.6, normal: 0.4, aggressive: -0.65 }[
          settings.aggression
        ];
        for (let base = goal + 1; base <= max; base++) {
          const runnerTime =
            (Math.max(0, base - r.progress) * assumptions.baseMetres) / r.speed;
          const defensiveTime =
            Math.max(0, ball.fieldingTime - elapsed) +
            throwing.returnTime(ball, base, hint) +
            (settings.state.outs === 2 ? 0.35 : 0);
          if (runnerTime + safety < defensiveTime) goal = base;
          else break;
        }
      }
      goal = Math.min(goal, leadGoal === 4 ? 4 : leadGoal - 1);
      goal = Math.max(
        r.progress > r.originBase + 0.1
          ? Math.ceil(r.progress - 0.000001)
          : r.originBase,
        goal,
      );
      r.goal = goal;
      r.decision =
        r.progress < goal ? "advance" : r.progress > goal ? "retreat" : "hold";
      leadGoal = goal;
    }
  }
  reconsider(
    settings: DynamicSettings,
    runners: OffensiveRunner[],
    target: Base,
    from: { x: number; y: number },
  ) {
    if (settings.aggression === "aggressive") return [];
    const base = target === "home" ? 4 : target,
      changed: OffensiveRunner[] = [];
    for (const r of runners) {
      if (
        r.status !== "active" ||
        r.goal !== base ||
        isForced(r, runners, base) ||
        base - r.progress <= 0.05
      )
        continue;
      const last = Math.floor(r.progress),
        fraction = r.progress - last;
      const throwTime =
        new ThrowingEngine().arrival(from, bases[target]) + assumptions.tagTime;
      if (
        last > r.originBase &&
        fraction < 0.45 &&
        ((base - r.progress) * assumptions.baseMetres) / r.speed >
          throwTime + 0.6 &&
        !runners.some(
          (v) => v !== r && v.status === "active" && v.goal === last,
        )
      ) {
        r.goal = last;
        r.decision = "retreat";
        changed.push(r);
      }
    }
    return changed;
  }
}
