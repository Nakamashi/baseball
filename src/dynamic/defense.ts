import {
  positions,
  type Base,
  type Point,
  type Position,
  type Responsibility,
} from "../simulation/types";
import { runningTime } from "./runningGeometry";
import { assumptions, conventions } from "./conventions";
import {
  bases,
  defaults,
  beyond,
  metres,
  mixPhysical,
  clamp,
  isOutfield,
  runnerPoint,
  metresPerUnit,
  isPlayable,
  toward,
  toWorld,
  fromWorld,
} from "./geometry";
import { message as m, type DynamicMessageKey } from "./messages";
import type {
  AssignmentContext,
  AssignmentReason,
  BattedBall,
  CoverageIssue,
  DefensiveAssignment,
  DefensiveLayout,
  DynamicSettings,
  OffensiveRunner,
  ThrowCandidate,
  ThrowDecision,
  ThrowRoute,
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
      (metres(ball.fieldingPoint, point) > assumptions.relayDistance
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
const reasonKeys: Record<AssignmentReason, DynamicMessageKey> = {
  primary: "fieldWhy",
  release: "releaseWhy",
  possession: "ownerWhy",
  receiver: "coverWhy",
  liveBase: "liveBaseWhy",
  homeThreat: "homeThreatWhy",
  cutoffLane: "cutoffWhy",
  wallSupport: "wallBackupWhy",
  relayLane: "relayWhy",
  fieldBackup: "backupFieldWhy",
  throwBackup: "backupThrowWhy",
  catcherSupport: "catcherBackupWhy",
  homeGuard: "homeGuardWhy",
  secondSupport: "secondSupportWhy",
  trailing: "trailWhy",
  guardThird: "guardThirdWhy",
  guardSpace: "holdWhy",
  complete: "completeWhy",
};
export function assignmentText(a: DefensiveAssignment): Responsibility {
  const vars = {
    base: a.base ?? 2,
    from: a.teammate ?? "CF",
    player: a.teammate ?? "CF",
    runner: a.runner ?? "BR",
  };
  const keys: Record<
    DefensiveAssignment["type"],
    readonly [DynamicMessageKey, DynamicMessageKey]
  > = {
    FieldBall: ["fieldAction", "fieldNext"],
    CoverBase: ["coverAction", "coverNext"],
    Cutoff: ["cutoffAction", "relayNext"],
    Relay: ["relayAction", "relayNext"],
    BackupFielder: ["backupFieldAction", "backupNext"],
    BackupThrow: ["backupThrowAction", "backupNext"],
    HoldPosition: ["holdAction", "holdNext"],
    PrepareForThrow: ["receiveAction", "coverNext"],
    Communicate: ["holdAction", "holdNext"],
    RecoverPosition: ["recoverHomeAction", "holdNext"],
    ThrowBall: ["releaseAction", "holdNext"],
    PossessBall: ["ownerAction", "fieldNext"],
    SupportBase: ["supportBaseAction", "backupNext"],
    TrailRunner: ["trailAction", "trailNext"],
  };
  const [action, support] = keys[a.type];
  return {
    action: m(
      a.reason === "wallSupport"
        ? "wallBackupAction"
        : a.type === "BackupThrow" &&
            a.receivingPoint &&
            a.base &&
            metres(a.receivingPoint, bases[a.base]) > 0.1
          ? "backupReceiverAction"
          : action,
      vars,
    ),
    why: m(reasonKeys[a.reason], vars),
    support: m(support, vars),
  };
}
const baseNumber = (b: Base) => (b === "home" ? 4 : b);
const active = (r: OffensiveRunner) => r.status === "active";
/** Extend the actual incoming lane. Foul territory is intentional; the SVG's
 * playable surroundings bound available space, including behind home plate. */
export function backupPoint(
  from: Point,
  target: Point,
  depth = conventions.backupDepth,
): Point {
  let point = beyond(from, target, depth);
  // A backup may use first/third-base foul ground, but cannot cross the modeled
  // outfield fence. Reduce depth when there is no space behind a deep receiver.
  for (let i = 1; i <= 20 && point.y < 350 && !isPlayable(point); i++)
    point = beyond(from, target, depth * (1 - i / 20));
  return point;
}
/** Outside the first-to-second running lane, behind (never on top of) BR. */
export function trailingPoint(runner: OffensiveRunner): Point {
  const p = runnerPoint(Math.max(1, Math.min(1.9, runner.progress - 0.2)));
  const world = toWorld(p);
  const offset = conventions.trailSeparation / Math.sqrt(2);
  return clamp(fromWorld({ x: world.x + offset, y: world.y - offset }));
}
export class DefensiveDecisionEngine {
  choose(
    settings: DynamicSettings,
    ball: BattedBall,
    runners: OffensiveRunner[],
    outs: number,
    locations?: Record<string, Point>,
    owner: Position = ball.fielder,
    stage: "fielded" | "received" = "fielded",
    preparation?: { seconds: number; runners: OffensiveRunner[] },
  ): ThrowDecision {
    const throwing = new ThrowingEngine();
    const candidates: ThrowCandidate[] = [];
    const context = { runners, outs };
    // Each base the runner is actually attempting is a possible challenge,
    // including home when the runner has not yet reached third.
    for (const runner of runners) {
      if (!active(runner) || runner.decision === "retreat") continue;
      for (
        let next = Math.floor(runner.progress + 0.00001) + 1;
        next <= Math.min(4, runner.goal);
        next++
      ) {
        const target: Base = next === 4 ? "home" : (next as Base);
        const force = isForced(runner, runners, next);
        let elapsed = throwing.arrival(ball.fieldingPoint, bases[target]);
        let route: ThrowRoute["kind"] = "direct";
        if (locations) {
          let readyLocations = locations;
          if (preparation) {
            // A contact forecast must advance supporting defenders as well as
            // runners. Evaluate each possible target with its own early duties,
            // rather than penalizing home because 1B is still standing at first.
            const approach = this.assign(
              settings,
              ball,
              owner,
              target,
              locations,
              "contact",
              { runners: preparation.runners, outs },
            );
            readyLocations = { ...locations };
            for (const a of approach.assignments)
              readyLocations[a.player] = toward(
                locations[a.player],
                a.target,
                assumptions.defenderSpeed * preparation.seconds,
              );
          }
          const layout = this.assign(
            settings,
            ball,
            owner,
            target,
            readyLocations,
            stage,
            context,
          );
          route = layout.route.kind;
          elapsed = this.arrival(layout, readyLocations, owner);
        }
        const runnerArrival = runningTime(runner, next);
        const margin =
          runnerArrival - elapsed - (force ? 0 : assumptions.tagTime);
        const viable =
          margin > (settings.state.strategy === "conservative" ? 0.8 : 0.05);
        // Receiving the ball before the runner reaches home is a competitive
        // tag opportunity even when the fixed tag-preparation allowance is
        // slightly longer. Keep it distinct from a clearly favorable estimate.
        const competitive =
          target === "home" &&
          !viable &&
          settings.state.strategy !== "conservative" &&
          elapsed < runnerArrival &&
          margin >= -assumptions.closeMargin;
        const difference =
          settings.state.fieldingTeam === "home"
            ? settings.state.homeScore - settings.state.awayScore
            : settings.state.awayScore - settings.state.homeScore;
        const critical =
          settings.state.inning >= 6 && difference >= 0 && difference <= 1;
        const certainty = Math.min(
          1,
          Math.max(0, target === "home" ? runnerArrival - elapsed : margin) /
            0.6,
        );
        // Timing remains a gate. Run prevention matters in every strategy, and
        // the sure third force out also cancels runs already across the plate.
        const score =
          Math.min(2, Math.max(-10, margin)) +
          (outs === 2
            ? (force ? 3 : 1) * certainty
            : force && target !== 1
              ? 1.4
              : 0) +
          (target === "home"
            ? (outs === 2
                ? 1
                : 3 +
                  (critical || settings.state.strategy === "prevent"
                    ? 1.5
                    : 0)) * certainty
            : 0);
        const scoring = runners.filter(
          (r) => active(r) && r.goal === 4 && r.decision !== "retreat",
        );
        const firstRun = Math.min(...scoring.map((r) => runningTime(r, 4)));
        // A non-force third out only stops a run if the tag happens before it
        // scores. An early catch at second is not itself an out: the receiver
        // must wait for the advancing runner to enter tagging reach.
        const outTime = force
          ? elapsed
          : Math.max(elapsed + assumptions.tagTime, runnerArrival - 0.08);
        const runsAtStake =
          scoring.length > 0 || runners.some((r) => r.status === "scored");
        const preventsRun =
          (scoring.length > 0 && runner.goal === 4) ||
          (outs === 2 &&
            (force ? runsAtStake : scoring.length > 0 && outTime < firstRun));
        candidates.push({
          target,
          runner: runner.id,
          force,
          runnerArrival,
          ballArrival: elapsed,
          margin,
          viable,
          competitive,
          preventsRun,
          score,
          route,
          reason: competitive
            ? "competitive-home"
            : !viable
              ? margin < 0
                ? "too-late"
                : "insufficient-margin"
              : outs === 2
                ? "third-out"
                : target === "home"
                  ? "timely-home"
                  : force
                    ? "lead-force"
                    : "tag-opportunity",
        });
      }
    }
    const wrap = (decision: ThrowDecision): ThrowDecision => ({
      ...decision,
      alternatives: candidates,
    });
    if (settings.throwTarget === "hold")
      return wrap({
        target: "hold",
        force: false,
        reason: m("targetOverride"),
        override: true,
      });
    if (settings.throwTarget !== "auto" && settings.throwTarget !== "cutoff") {
      const candidate = candidates
        .filter((c) => c.target === settings.throwTarget)
        .sort((a, b) => b.margin - a.margin)[0];
      return wrap({
        target: settings.throwTarget,
        runner: candidate?.runner,
        force: candidate?.force ?? false,
        margin: candidate?.margin,
        reason: m("targetOverride"),
        override: true,
      });
    }
    const opportunities = candidates
      .filter((c) => c.viable || c.competitive)
      .sort(
        (a, b) =>
          Number(b.preventsRun) - Number(a.preventsRun) ||
          b.score - a.score ||
          b.margin - a.margin,
      );
    const best =
      opportunities[0] ??
      candidates.find(
        (c) =>
          c.target === 1 &&
          c.runner === "BR" &&
          c.margin > -0.25 &&
          !isOutfield(ball.fieldingPoint),
      );
    if (best)
      return wrap({
        target: best.target,
        runner: best.runner,
        force: best.force,
        margin: best.margin,
        reason: m(
          best.competitive
            ? "targetHomeClose"
            : outs === 2
              ? "targetSure"
              : best.target === "home"
                ? "targetHome"
                : best.force
                  ? "targetForce"
                  : "targetTag",
        ),
        override: false,
      });
    if (isOutfield(ball.fieldingPoint))
      return wrap({
        target: 2,
        force: false,
        reason: m("targetReturn"),
        override: false,
      });
    return wrap({
      target: "hold",
      force: false,
      reason: m("targetHold"),
      override: false,
    });
  }
  /** Same route and receiver-readiness calculation used by the compiler. */
  arrival(
    layout: DefensiveLayout,
    locations: Record<string, Point>,
    owner: Position,
  ) {
    let elapsed = 0,
      from = layout.route.from;
    for (const player of layout.route.legs) {
      const point = layout.assignments.find((a) => a.player === player)!.target;
      if (player === owner) {
        elapsed += Math.max(
          assumptions.transfer + 0.12,
          metres(from, point) / assumptions.defenderSpeed,
        );
      } else {
        const flight =
          metres(from, point) / assumptions.throwSpeed + assumptions.catchTime;
        const receiverTime = Math.max(
          0,
          metres(locations[player], point) / assumptions.defenderSpeed -
            elapsed,
        );
        const cutoffWait =
          layout.route.kind === "through-cutoff" && layout.cutoff
            ? metres(locations[layout.cutoff], layout.route.cutoffPoint!) /
                assumptions.defenderSpeed -
              metres(from, layout.route.cutoffPoint!) / assumptions.throwSpeed
            : 0;
        elapsed +=
          Math.max(assumptions.transfer, receiverTime - flight, cutoffWait) +
          flight;
      }
      if (player === layout.cutoff && layout.route.kind === "relay")
        elapsed += 0.15;
      from = point;
      owner = player;
    }
    return elapsed;
  }
  assign(
    settings: DynamicSettings,
    ball: BattedBall,
    owner: Position,
    target: Base | "hold",
    locations: Record<string, Point>,
    stage: "contact" | "fielded" | "received" | "complete" = "contact",
    context?: AssignmentContext,
  ): DefensiveLayout {
    const map = new Map<Position, DefensiveAssignment>(),
      issues: CoverageIssue[] = [];
    const runners = context?.runners ?? [];
    const outfield = isOutfield(ball.fieldingPoint);
    const source = ball.fieldingPoint;
    const put = (
      player: Position,
      type: DefensiveAssignment["type"],
      point: Point,
      priority: number,
      reason: AssignmentReason,
      base?: Base,
      teammate?: Position,
    ) => {
      if (map.has(player)) return;
      const a: DefensiveAssignment = {
        player,
        type,
        target: clamp(point),
        priority,
        base,
        teammate,
        reason,
        replacesOn:
          "BallFielded, ThrowStarted, ThrowReceived, RunnerAdvanced, RunnerRetreated, RunnerOut, PlayCompleted",
        explanation: "",
      };
      a.arrivalTime =
        metres(locations[player], a.target) / assumptions.defenderSpeed;
      a.explanation = assignmentText(a).why;
      map.set(player, a);
    };
    if (stage === "complete" || context?.outs === 3) {
      for (const p of positions)
        put(
          p,
          p === owner ? "PossessBall" : "HoldPosition",
          locations[p],
          20,
          "complete",
        );
      return {
        assignments: [...map.values()],
        issues,
        route: { kind: "hold", target: "hold", from: source, legs: [] },
      };
    }
    put(
      owner,
      stage === "contact"
        ? "FieldBall"
        : context?.ballInFlight
          ? "ThrowBall"
          : "PossessBall",
      stage === "contact" ? ball.fieldingPoint : locations[owner],
      100,
      stage === "contact"
        ? "primary"
        : context?.ballInFlight
          ? "release"
          : "possession",
    );
    const liveAt = (base: Base) => {
      const n = baseNumber(base);
      return runners.some(
        (r) =>
          active(r) &&
          ((base === 1 &&
            r.firstTurn?.kind === "round" &&
            r.firstTurn.stage !== "complete" &&
            r.goal === 1) ||
            (r.decision === "retreat"
              ? r.goal === n
              : r.progress <= n + 0.08 && r.goal >= n)),
      );
    };
    const homeThreat = runners.some(
      (r) =>
        active(r) && (r.goal === 4 || r.progress >= 2.8 || r.originBase === 3),
    );
    // Choose the lane from the selected target, then reserve that specialist.
    // For second: ball-side middle infielder relays, opposite infielder receives.
    const needsCutoff =
      target !== "hold" &&
      stage !== "received" &&
      outfield &&
      (metres(source, bases[target]) > assumptions.cutoffDistance ||
        settings.throwTarget === "cutoff");
    const preferredCutoff: Position =
      target === 2
        ? source.x < 500
          ? "SS"
          : "2B"
        : target === "hold"
          ? "2B"
          : conventions.cutoff[target];
    let cutoff = needsCutoff
      ? ([preferredCutoff, "SS", "2B", "1B", "3B"].find(
          (p) =>
            !map.has(p as Position) &&
            !(target === 1 && p === "1B") &&
            !(target === 3 && p === "3B"),
        ) as Position | undefined)
      : undefined;
    const cover = (
      base: Base,
      priority: number,
      reason: AssignmentReason = "liveBase",
    ) => {
      const existing = [...map.values()].find(
        (a) =>
          a.base === base && ["CoverBase", "PrepareForThrow"].includes(a.type),
      );
      if (existing) return existing.player;
      const carry =
        stage !== "contact" &&
        (metres(locations[owner], bases[base]) < 0.1 ||
          (owner === "1B" &&
            base === 1 &&
            metres(locations[owner], bases[1]) < 4));
      const preferences =
        base === 1 && owner === "1B"
          ? (["P", "2B", "SS", "3B", "C"] as Position[])
          : conventions.coverage[base];
      const eligible = preferences.filter(
        (p) =>
          !map.has(p) &&
          p !== cutoff &&
          !(p === "C" && homeThreat && base !== "home"),
      );
      // Prefer conventional infield receivers, but retain an already-covered
      // base instead of recalling a more distant nominal position after a relay.
      const infield = eligible.filter((p) => !["LF", "CF", "RF"].includes(p));
      const middle = eligible.filter((p) => p === "2B" || p === "SS");
      const outfieldReceivers = eligible.filter(
        (p) => p === "RF" || p === "CF",
      );
      const pool =
        base === 2
          ? middle.length
            ? middle
            : outfieldReceivers.length
              ? outfieldReceivers
              : infield.length
                ? infield
                : eligible
          : infield.length
            ? infield
            : eligible;
      pool.sort(
        (a, b) =>
          metres(locations[a], bases[base]) / assumptions.defenderSpeed +
          preferences.indexOf(a) * 0.12 -
          metres(locations[b], bases[base]) / assumptions.defenderSpeed -
          preferences.indexOf(b) * 0.12,
      );
      const player = carry
        ? owner
        : base === 1 && owner === "1B" && pool.includes("P")
          ? "P"
          : pool[0];
      if (player) {
        if (carry) map.delete(owner);
        put(player, "CoverBase", bases[base], priority, reason, base);
      } else
        issues.push({
          kind: "unfulfilled",
          base,
          detail:
            "No free receiver without abandoning a higher-priority responsibility.",
        });
      return player;
    };
    let receiver: Position | undefined;
    // Home must remain protected before allocating any fallback receiver.
    if (homeThreat) cover("home", 94, "homeThreat");
    if (target !== "hold") receiver = cover(target, 95, "receiver");
    if (cutoff) {
      const point = mixPhysical(source, bases[target as Base], 0.55);
      const relay =
        metres(source, bases[target as Base]) > assumptions.relayDistance;
      put(
        cutoff,
        relay ? "Relay" : "Cutoff",
        point,
        85,
        relay ? "relayLane" : "cutoffLane",
        target as Base,
        owner,
      );
    }
    // Occupancy/advancement creates a coverage need. An empty, passed base does
    // not consume a defender simply because it exists on the diamond.
    for (const base of [1, 2, 3] as const)
      if (base !== target && liveAt(base)) cover(base, 80);
    // Control second on all outfield returns, even while BR is headed to first.
    if ((outfield || liveAt(1)) && target !== 2) cover(2, 78);
    const fieldBackup =
      stage === "contact"
        ? positions
            .filter((p) => ["LF", "CF", "RF"].includes(p) && !map.has(p))
            .sort(
              (a, b) =>
                metres(locations[a], source) - metres(locations[b], source),
            )[0]
        : undefined;
    if (fieldBackup) {
      let point = backupPoint(bases.home, source, outfield ? 7 : 5);
      const limited = outfield && metres(source, point) < 2;
      if (limited) {
        point = toward(source, locations[fieldBackup], 5);
        if (!isPlayable(point)) point = toward(source, bases.home, 5);
        issues.push({
          kind: "space-limited",
          player: fieldBackup,
          detail:
            "The modeled fence leaves insufficient space behind the fielder; support from inside the field, with receiving room.",
        });
      }
      put(
        fieldBackup,
        "BackupFielder",
        point,
        76,
        limited ? "wallSupport" : "fieldBackup",
        undefined,
        ball.fielder,
      );
    }
    const route: ThrowRoute = {
      kind:
        target === "hold"
          ? "hold"
          : receiver === owner
            ? "carry"
            : cutoff
              ? settings.throwTarget === "cutoff"
                ? "cutoff-hold"
                : metres(source, bases[target as Base]) >
                    assumptions.relayDistance
                  ? "relay"
                  : "through-cutoff"
              : "direct",
      from: source,
      target,
      receiver,
      cutoff,
      cutoffPoint: cutoff ? map.get(cutoff)?.target : undefined,
      legs: [],
    };
    route.legs =
      target === "hold" || !receiver
        ? []
        : route.kind === "cutoff-hold"
          ? [cutoff!]
          : route.kind === "relay"
            ? [cutoff!, receiver]
            : [receiver];
    const backed = new Set<Base>();
    const backup = (
      base: Base,
      preferred: Position[],
      priority = 65,
      depth = conventions.backupDepth,
      receivingPoint = bases[base],
      receivingPlayer?: Position,
    ) => {
      const from =
        base === target
          ? source
          : stage === "contact"
            ? ball.fieldingPoint
            : locations[owner];
      const point = backupPoint(from, receivingPoint, depth);
      const receiving = [...map.values()].find(
        (a) => a.base === base && a.type === "CoverBase",
      );
      const receivingId = receivingPlayer ?? receiving?.player;
      const firstLeg =
        receivingId === cutoff &&
        (route.kind === "relay" || route.kind === "cutoff-hold");
      const estimateLayout = {
        assignments: [...map.values()],
        route: firstLeg ? { ...route, legs: route.legs.slice(0, 1) } : route,
        receiver,
        cutoff,
        issues,
      };
      const neededIn =
        (receivingId ? context?.receptionTimes?.[receivingId] : undefined) ??
        (stage === "contact" ? ball.fieldingTime : 0) +
          this.arrival(estimateLayout, locations, owner);
      const travel = (p: Position) =>
        metres(locations[p], point) / assumptions.defenderSpeed;
      const candidates = preferred.filter((p) => !map.has(p));
      // A conventional preference must never select a late backup over an
      // eligible defender who can actually reach the receiving lane in time.
      candidates.sort(
        (a, b) =>
          Number(travel(b) <= neededIn) - Number(travel(a) <= neededIn) ||
          travel(a) +
            preferred.indexOf(a) * 0.12 -
            travel(b) -
            preferred.indexOf(b) * 0.12,
      );
      const player = candidates[0];
      if (player) {
        put(
          player,
          "BackupThrow",
          point,
          priority,
          "throwBackup",
          base,
          receivingPlayer ?? receiving?.player,
        );
        map.get(player)!.throwOrigin = from;
        map.get(player)!.receivingPoint = receivingPoint;
        backed.add(base);
      }
      return player;
    };
    // Pitcher backs first on routine grounders unless needed as its receiver.
    // Home/third throws have first call on the pitcher's backup responsibility.
    if ((target === "home" || target === 3) && !map.has("P"))
      backup(target, ["P"], 74);
    const firstPlay =
      !outfield && route.kind !== "carry" && (target === 1 || liveAt(1));
    if (firstPlay && !map.has("P")) backup(1, ["P"], 73);
    // Allocate the actual throw's backup before speculative secondary support.
    // On outfield returns the available outfielders get first call at second;
    // travel time selects among them rather than locking in the opposite one.
    if (target !== "hold" && !backed.has(target)) {
      const secondPool: Position[] = ["CF", "RF", "LF"].filter(
        (p) => !map.has(p as Position),
      ) as Position[];
      backup(
        target,
        target === 1
          ? ["RF", "C", "P", "CF", "LF", "3B", "SS", "2B"]
          : target === 2
            ? secondPool.length
              ? secondPool
              : ["P", "1B", "3B"]
            : ["P", "LF", "RF", "CF", "1B", "2B"],
        68,
      );
    }
    // A spare infielder can anticipate an actual relay reception at contact.
    // After fielding, outfielders can also transition from batted-ball backup.
    if (cutoff && (route.kind === "relay" || route.kind === "cutoff-hold")) {
      const free = (
        stage === "contact"
          ? ["3B", "2B", "SS", "1B", "P"]
          : ["CF", "RF", "LF", "3B", "2B", "SS", "1B", "P"]
      ).filter((p) => !map.has(p as Position)) as Position[];
      if (
        (free.length || stage !== "contact") &&
        !backup(target as Base, free, 66, 6, route.cutoffPoint!, cutoff)
      )
        issues.push({
          kind: "unfulfilled",
          base: target as Base,
          detail:
            "No free defender can back the cutoff reception without leaving a higher-priority role.",
        });
    }
    // The far outfielder supports second on an outfield hit; the adjacent one
    // has the batted-ball backup. A changed primary target changes this likely
    // secondary lane (for example a throw behind BR from the home cutoff).
    if (outfield) {
      const opposite: Position =
        ball.fielder === "LF"
          ? "RF"
          : ball.fielder === "RF"
            ? "LF"
            : source.x < 500
              ? "RF"
              : "LF";
      if (!map.has(opposite)) {
        const secondOrigin =
          target === "home" || target === 3
            ? (route.cutoffPoint ?? bases[target])
            : source;
        const point = backupPoint(
          secondOrigin,
          bases[2],
          backed.has(2)
            ? conventions.secondaryBackupDepth
            : conventions.backupDepth,
        );
        put(opposite, "SupportBase", point, 67, "secondSupport", 2);
        map.get(opposite)!.throwOrigin = secondOrigin;
      }
    }
    // A first-base throw can have layered backup: C advances in foul territory
    // only after home and the primary backup have been assigned.
    if (
      firstPlay &&
      conventions.catcherBackupFirst &&
      !homeThreat &&
      !map.has("C")
    ) {
      put(
        "C",
        "BackupThrow",
        backupPoint(source, bases[1], 5),
        61,
        "catcherSupport",
        1,
        [...map.values()].find((a) => a.base === 1 && a.type === "CoverBase")
          ?.player,
      );
      map.get("C")!.throwOrigin = source;
    }
    if (!outfield && stage !== "contact" && firstPlay && !map.has("RF")) {
      put(
        "RF",
        "BackupThrow",
        backupPoint(source, bases[1], conventions.secondaryBackupDepth),
        60,
        "throwBackup",
        1,
      );
      map.get("RF")!.throwOrigin = source;
    }
    const br = runners.find((r) => r.id === "BR" && active(r));
    if (
      !map.has("1B") &&
      outfield &&
      br &&
      br.progress > 1.08 &&
      br.goal >= 2 &&
      br.progress < 2.95 &&
      !liveAt(1)
    ) {
      put("1B", "TrailRunner", trailingPoint(br), 55, "trailing", 2);
      map.get("1B")!.runner = "BR";
    }
    // A nonreceiving catcher protects home and directs play. Deliberate holding
    // is explicit and has a stationary destination rather than hidden shading.
    if (!map.has("C"))
      put(
        "C",
        metres(locations.C, defaults.C) > 1
          ? "RecoverPosition"
          : "HoldPosition",
        metres(locations.C, defaults.C) > 1 ? defaults.C : locations.C,
        35,
        "homeGuard",
        "home",
      );
    for (const p of positions) {
      if (map.has(p)) continue;
      // Free outfielders still protect a possible next-base throw. Do not keep
      // pursuing a fielded ball or send all three outfielders across the field.
      if (
        ["LF", "CF", "RF"].includes(p) &&
        (liveAt(2) || liveAt(3) || (firstPlay && (p === "RF" || p === "CF")))
      ) {
        const base: Base =
          firstPlay && p === "RF" ? 1 : p === "LF" && liveAt(3) ? 3 : 2;
        if (
          base !== 1 &&
          [...map.values()].filter(
            (a) =>
              a.base === base &&
              ["SupportBase", "BackupThrow"].includes(a.type),
          ).length >= 2
        ) {
          put(p, "HoldPosition", locations[p], 20, "guardSpace");
          continue;
        }
        put(
          p,
          "SupportBase",
          backupPoint(source, bases[base], 12),
          40,
          base === 2 ? "secondSupport" : "throwBackup",
          base,
        );
        map.get(p)!.throwOrigin = source;
      } else
        put(
          p,
          "HoldPosition",
          locations[p],
          20,
          p === "3B" ? "guardThird" : "guardSpace",
        );
    }
    const result: DefensiveLayout = {
      assignments: [...map.values()],
      receiver,
      cutoff,
      route,
      issues,
    };
    const deadline =
      stage === "contact"
        ? ball.fieldingTime + this.arrival(result, locations, owner)
        : this.arrival(result, locations, owner);
    for (const a of result.assignments)
      if (
        ["BackupThrow", "SupportBase"].includes(a.type) &&
        a.base === target
      ) {
        const firstLeg =
          a.teammate === cutoff &&
          (route.kind === "relay" || route.kind === "cutoff-hold");
        const estimated = firstLeg
          ? (stage === "contact" ? ball.fieldingTime : 0) +
            this.arrival(
              { ...result, route: { ...route, legs: route.legs.slice(0, 1) } },
              locations,
              owner,
            )
          : deadline;
        a.neededBy = a.teammate
          ? (context?.receptionTimes?.[a.teammate] ?? estimated)
          : estimated;
        if ((a.arrivalTime ?? 0) > a.neededBy + 0.05)
          issues.push({
            kind: "late-backup",
            player: a.player,
            base: a.base,
            detail:
              "Moving toward backup; estimated arrival is after reception. This is support in progress, not guaranteed overthrow protection.",
          });
      }
    return result;
  }
}
