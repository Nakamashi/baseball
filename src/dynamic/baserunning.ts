import type { Base } from "../simulation/types";
import type { BattedBall, DynamicSettings, OffensiveRunner } from "./types";
import { assumptions } from "./conventions";
import { isOutfield, isOutfieldHit, metres, bases } from "./geometry";
import { baseTouchTime, remainingRunningTime, runningTime, runningMetres } from "./runningGeometry";
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
    const hit =
        !["Ground ball", "Bunt"].includes(settings.ball.type) ||
        isOutfieldHit(ball),
      throwing = new ThrowingEngine(settings);
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
          baseTouchTime(r, 4) +
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
          const runnerTime = baseTouchTime(r, Math.max(r.progress, base));
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
        new ThrowingEngine(settings).arrival(from, bases[target]) +
        assumptions.tagTime;
      if (
        last > r.originBase &&
        fraction < 0.45 &&
        baseTouchTime(r, base) > throwTime + 0.6 &&
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

/** Error reads use one current loose-ball snapshot for every runner. The return
 * callback includes remaining recovery, gather, actual receiver readiness and tag.
 * It must not use the original clean contact-to-return estimate. */
export function readLooseThrow(
  settings: DynamicSettings,
  runners: OffensiveRunner[],
  returnTime: (base: Base, candidateRunners: OffensiveRunner[], runner: OffensiveRunner) => number,
) {
  const snapshot = structuredClone(runners);
  const updates: { id: OffensiveRunner['id']; goal: number; deferred: boolean; stopAtFirst: boolean;
    candidates: NonNullable<OffensiveRunner['plan']>['candidates'] }[] = [];
  let leadGoal = 5;
  const safety = {conservative:1.6,normal:0.4,aggressive:-0.65}[settings.aggression];
  for (const r of snapshot.filter(r=>r.status === 'active').sort((a,b)=>b.originBase-a.originBase)) {
    let goal = Math.max(r.afterFirstReturnGoal ?? r.goal, Math.floor(r.progress));
    const mustReturn = r.id === 'BR' && r.approach === 'straight' && goal === 1 &&
      (!r.firstTurn || r.firstTurn.stage !== 'complete');
    const candidates: NonNullable<OffensiveRunner['plan']>['candidates'] = [];
    // At most one discretionary extra base per observation; existing commitments
    // and live forces survive the read. This does not award a base.
    const next = Math.min(4, goal + 1);
    if (goal < 4 && next < (leadGoal === 4 ? 5 : leadGoal)) {
      const base: Base = next === 4 ? 'home' : next as 1|2|3;
      const runnerTime = looseThrowRunningTime(r, next);
      const proposed = snapshot.map(v=>v.id === r.id ? {...v,goal:next,
        afterFirstReturnGoal:undefined} : v);
      const defensiveTime = returnTime(base, proposed, r);
      const accepted = runnerTime + safety < defensiveTime;
      candidates.push({base,runnerTime,defensiveTime,margin:defensiveTime-runnerTime,accepted});
      if (accepted) goal = next;
    }
    const stopAtFirst=goal>1 && canStopAtFirst(r);
    updates.push({id:r.id,goal,deferred:mustReturn && goal>1 && !stopAtFirst,stopAtFirst,candidates});
    if(mustReturn && goal>1 && !stopAtFirst) r.afterFirstReturnGoal=goal;
    else r.goal=goal;
    leadGoal=goal;
  }
  for (const u of updates) {
    const r=runners.find(r=>r.id===u.id)!;
    if (u.deferred) r.afterFirstReturnGoal=u.goal;
    else {
      r.goal=u.goal;
      if(u.stopAtFirst) r.errorTurnAtFirst=true;
      if (r.id==='BR' && r.goal>1 && r.firstTurn?.stage==='complete') r.firstTurn=undefined;
      r.decision=r.progress<r.goal?'advance':r.progress>r.goal?'retreat':'hold';
    }
    r.plan={candidates:u.candidates,reason:m(u.candidates.some(c=>c.accepted)?'errorRunnerGo':'errorRunnerHold')};
  }
}

/** A straight run-through retains its existing physical stop/read/return. */
export function canStopAtFirst(r: OffensiveRunner) {
  return r.id==='BR' && r.approach==='straight' && r.progress<1 && !r.firstTurn &&
    Math.max(0,r.runVelocity ?? 0)**2/(2*assumptions.runnerAcceleration) <=
      runningMetres(r,r.progress,1)-0.01;
}
export function looseThrowRunningTime(r: OffensiveRunner, target: number) {
  if(canStopAtFirst(r)) return baseTouchTime({...r,goal:target,errorTurnAtFirst:true},target);
  if (r.id === 'BR' && r.approach === 'straight' && (r.goal === 1 || r.afterFirstReturnGoal) &&
      (!r.firstTurn || r.firstTurn.stage !== 'complete')) {
    return remainingRunningTime({...r,afterFirstReturnGoal:undefined}) +
      runningTime({...r,progress:1,goal:target,runVelocity:0,startDelay:0,
        firstTurn:undefined,afterFirstReturnGoal:undefined},target);
  }
  return baseTouchTime({...r,goal:target},target);
}
