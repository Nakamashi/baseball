import type { Base } from "../simulation/types";
import type { BattedBall, DynamicSettings, OffensiveRunner } from "./types";
import { assumptions } from "./conventions";
import { isOutfield, isOutfieldHit, metres, bases } from "./geometry";
import { runningTime } from "./runningGeometry";
import { message as m } from "./messages";
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
        runVelocity: 0,
        startDelay: assumptions.batterStart,
      },
      ...Object.entries(settings.state.runners).map(([id, base]) => ({
        id: id as OffensiveRunner["id"],
        originBase: Number(base),
        progress:
          Number(base) +
          assumptions.secondaryLeadMetres / assumptions.baseMetres,
        goal: Number(base),
        speed: assumptions.runnerSpeed[settings.runnerSpeed],
        decision: "hold" as const,
        status: "active" as const,
        runVelocity: 0,
        startDelay: assumptions.reaction,
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
    const hit = settings.ball.type !== "Ground ball" || isOutfieldHit(ball),
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
      if (r.id === "BR") r.approach = hit ? "round" : "straight";
      const contactRead =
        !hit &&
        r.originBase === 3 &&
        settings.state.outs < 2 &&
        !["P", "C", "3B"].includes(ball.fielder);
      const contactGo =
        contactRead &&
        (settings.aggression === "aggressive" ||
          runningTime(r, 4) +
            (settings.aggression === "conservative" ? 1.6 : 0.4) <
            Math.max(0, ball.fieldingTime - elapsed) +
              throwing.returnTime(ball, 4, "home") +
              assumptions.tagTime);
      if (!hit && (settings.state.outs === 2 || contactGo))
        goal = Math.min(4, r.originBase + 1);
      const candidates: NonNullable<OffensiveRunner["plan"]>["candidates"] = [];
      if (
        !hit &&
        r.originBase === 2 &&
        ball.fieldingPoint.x > 560 &&
        ball.fielder !== "3B" &&
        ball.fielder !== "SS"
      )
        goal = 3;
      if (hit && upgrade) {
        const max = 4;
        const safety = { conservative: 1.6, normal: 0.4, aggressive: -0.65 }[
          settings.aggression
        ];
        for (let base = goal + 1; base <= max; base++) {
          const runnerTime = runningTime(r, Math.max(r.progress, base));
          const defensiveTime =
            Math.max(0, ball.fieldingTime - elapsed) +
            throwing.returnTime(ball, base, hint) +
            (isForced(r, runners, base) ? 0 : assumptions.tagTime);
          const accepted = runnerTime + safety < defensiveTime;
          candidates.push({
            base: base === 4 ? "home" : (base as Base),
            runnerTime,
            defensiveTime,
            margin: defensiveTime - runnerTime,
            accepted,
          });
          if (accepted) goal = base;
          else break;
        }
      }
      goal = Math.min(goal, leadGoal === 4 ? 4 : leadGoal - 1);
      goal = Math.max(Math.floor(r.progress + 0.000001), goal);
      if (r.firstTurn?.kind === "overrun" && r.firstTurn.stage !== "complete")
        goal = 1;
      if (goal > 1 && r.firstTurn?.kind === "round") r.firstTurn = undefined;
      const blockedOrHeld =
        goal <
        (candidates.at(-1)?.base === "home"
          ? 4
          : Number(candidates.at(-1)?.base ?? goal));
      const freeze =
        !hit &&
        r.originBase === 3 &&
        settings.state.outs < 2 &&
        !contactGo &&
        !isForced(r, runners, 4);
      r.plan = {
        candidates,
        reason: m(
          contactGo
            ? settings.aggression === "aggressive"
              ? "runnerContactWhy"
              : "runnerContactReadWhy"
            : freeze
              ? "runnerFreezeWhy"
              : blockedOrHeld
                ? "runnerHoldWhy"
                : "runnerWhy",
        ),
      };
      r.goal = goal;
      r.decision =
        r.progress < goal ? "advance" : r.progress > goal ? "retreat" : "hold";
      if (r.firstTurn && r.goal === 1 && r.firstTurn.stage !== "complete")
        r.decision = r.firstTurn.stage === "return" ? "retreat" : "advance";
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
        runningTime(r, base) > throwTime + 0.6 &&
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
