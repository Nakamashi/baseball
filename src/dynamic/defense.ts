import {
  positions,
  type Base,
  type Point,
  type Position,
  type Responsibility,
} from "../simulation/types";
import { runningTime, runningAdvance } from "./runningGeometry";
import {
  arrivalTime,
  planMotion,
  sampleMotion,
  zeroVelocity,
} from "./locomotion";
import { assumptions, conventions } from "./conventions";
import { throwingProfile, directThrowRange, throwFlight, throwPhysics } from "./throwing";
import {
  bases,
  defaults,
  beyond,
  metres,
  mixPhysical,
  clamp,
  isOutfield,
  isOutfieldHit,
  runnerPoint,
  metresPerUnit,
  isPlayable,
  toward,
  toWorld,
  fromWorld,
  isInfieldDiamond,
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
  RelayStop,
} from "./types";
export function isForced(
  r: OffensiveRunner,
  runners: OffensiveRunner[],
  base: number,
) {
  if (
    r.forceRemoved ||
    base !== r.originBase + 1 ||
    r.status !== "active" ||
    r.progress >= base
  )
    return false;
  return Array.from({ length: r.originBase }, (_, i) => i).every((origin) =>
    runners.some((v) => v.originBase === origin && v.status !== "out"),
  );
}
export class ThrowingEngine {
  constructor(public settings?: DynamicSettings) {}
  arrival(from: Point, to: Point, owner: Position = "SS") {
    const profile = throwingProfile(
      from,
      to,
      owner,
      this.settings?.armStrength,
    );
    const flight = throwFlight(from, to, owner, this.settings?.armStrength);
    return flight.reachable ? profile.prepare + flight.duration + assumptions.catchTime
      : metres(from, to) / assumptions.defenderSpeed + profile.prepare;
  }
  returnTime(ball: BattedBall, base: number, targetHint: Base | "hold" = 2) {
    const point = bases[base === 4 ? "home" : (base as 1 | 2 | 3)];
    const estimate = (from: Point, to: Point, owner: Position = ball.fielder) => {
      const distance = metres(from, to);
      const legs = Math.min(3, Math.max(1, Math.ceil(distance / directThrowRange(owner, this.settings?.armStrength))));
      let total = 0;
      for (let i = 0; i < legs; i++) {
        total += this.arrival(mixPhysical(from, to, i / legs), mixPhysical(from, to, (i + 1) / legs), i === 0 ? owner : "2B");
        if (i < legs - 1) total += throwPhysics.relayRead;
      }
      return total;
    };
    const direct = estimate(ball.fieldingPoint, point);
    if (targetHint === "hold") return direct + 1.6;
    const hint = targetHint === "home" ? 4 : targetHint;
    return hint === base
      ? direct
      : Math.max(
          direct,
          estimate(ball.fieldingPoint, bases[targetHint]) +
            estimate(bases[targetHint], point, "SS"),
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
  relayTrailer: "trailerWhy",
  innerCutoff: "innerCutoffWhy",
  fieldBackup: "backupFieldWhy",
  throwBackup: "backupThrowWhy",
  anticipatedBackup: "anticipatedBackupWhy",
  catcherSupport: "catcherBackupWhy",
  homeGuard: "homeGuardWhy",
  secondSupport: "secondSupportWhy",
  trailing: "trailWhy",
  guardThird: "guardThirdWhy",
  thirdControl: "thirdControlWhy",
  guardSpace: "holdWhy",
  complete: "completeWhy",
  braking: "brakingWhy",
  boundaryTrack: "boundaryTrackWhy",
  buntCharge: "buntChargeWhy",
  buntRecoverThird: "buntRecoverThirdWhy",
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
    RelayTrailer: ["trailerAction", "relayNext"],
    BackupFielder: ["backupFieldAction", "backupNext"],
    BackupThrow: ["backupThrowAction", "backupNext"],
    HoldPosition: ["holdAction", "holdNext"],
    PrepareForThrow: ["receiveAction", "coverNext"],
    Communicate: ["holdAction", "holdNext"],
    Decelerate: ["brakingAction", "holdNext"],
    TrackBall: ["boundaryTrackAction", "backupNext"],
    ChargeBunt: ["buntChargeAction", "backupNext"],
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
  settings?: DynamicSettings;
  relayBudget = throwPhysics.maximumRelays;
  continuation?: { target: Base; stops: RelayStop[] };
  motion?: (player: Position) => {
    position: Point;
    velocity: Point;
    reaction: number;
  };
  travel(player: Position, from: Point, to: Point) {
    const state = this.motion?.(player),
      same = state && metres(state.position, from) < 0.0001;
    return arrivalTime(
      from,
      to,
      assumptions.defenderSpeed,
      assumptions.defenderAcceleration,
      same ? state.velocity : zeroVelocity(),
      same ? state.reaction : 0,
    );
  }
  release(player: Position, from: Point, to?: Point) {
    const state = this.motion?.(player),
      velocity =
        state && metres(state.position, from) < 0.001
          ? state.velocity
          : zeroVelocity();
    const speed = Math.hypot(velocity.x, velocity.y),
      brake = speed / assumptions.defenderAcceleration;
    const p = toWorld(from);
    return {
      time: Math.max(
        to
          ? throwingProfile(from, to, player, this.settings?.armStrength)
              .prepare
          : assumptions.transfer,
        brake,
      ),
      point: fromWorld({
        x: p.x + (velocity.x * brake) / 2,
        y: p.y + (velocity.y * brake) / 2,
      }),
    };
  }
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
    this.settings = settings;
    const throwing = new ThrowingEngine(settings);
    const candidates: ThrowCandidate[] = [];
    const context = { runners, outs };
    // Each base the runner is actually attempting is a possible challenge,
    // including home when the runner has not yet reached third.
    for (const actual of runners) {
      if (!active(actual)) continue;
      const pending =
        actual.retouchBase !== undefined &&
        (actual.afterRetouchGoal ?? 0) > actual.retouchBase;
      if (actual.decision === "retreat" && !pending) continue;
      const runner = pending
        ? {
            ...actual,
            progress: actual.originBase,
            goal: actual.afterRetouchGoal!,
            runVelocity: 0,
            startDelay: 0.1,
            decision: "advance" as const,
          }
        : actual;
      const retouchDelay = pending
        ? runningTime(actual, actual.retouchBase!)
        : 0;
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
            for (const a of approach.assignments) {
              const state = this.motion?.(a.player);
              const plan = planMotion(
                {
                  position: toWorld(locations[a.player]),
                  velocity: state?.velocity ?? zeroVelocity(),
                },
                toWorld(a.target),
                assumptions.defenderSpeed,
                assumptions.defenderAcceleration,
                Math.max(
                  state?.reaction ?? assumptions.reaction,
                  a.notBefore ?? 0,
                ),
              );
              readyLocations[a.player] = fromWorld(
                sampleMotion(plan, preparation.seconds).position,
              );
            }
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
        const runnerArrival = retouchDelay + runningTime(runner, next);
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
    for (const runner of runners) {
      if (
        !active(runner) ||
        runner.retouchBase === undefined ||
        runner.progress <= runner.retouchBase + 1e-5
      )
        continue;
      const target = runner.retouchBase as Base;
      const layout = locations
        ? this.assign(settings, ball, owner, target, locations, stage, context)
        : undefined;
      const elapsed = layout
        ? this.arrival(layout, locations!, owner)
        : throwing.arrival(ball.fieldingPoint, bases[target]);
      const runnerArrival = runningTime(runner, runner.retouchBase),
        margin = runnerArrival - elapsed;
      candidates.push({
        target,
        runner: runner.id,
        force: false,
        appeal: true,
        runnerArrival,
        ballArrival: elapsed,
        margin,
        viable: margin > 0.05,
        competitive: false,
        preventsRun:
          outs === 2 &&
          runners.some(
            (r) => active(r) && r.goal === 4 && runningTime(r, 4) > elapsed,
          ),
        score: Math.min(2, margin) + (outs === 2 ? 3 : 1),
        reason: margin > 0.05 ? "tag-opportunity" : "too-late",
        route: layout?.route.kind ?? "direct",
      });
    }
    // Assess the force and pivot as one possible sequence. This is a forecast;
    // the receiver still reevaluates the actual remaining time after the force.
    const br = runners.find((r) => r.id === "BR" && active(r));
    if (outs < 2 && br && locations && !isOutfieldHit(ball) && !ball.caught) {
      for (const c of candidates.filter(
        (c) => c.target === 2 && c.force && c.viable,
      )) {
        const first = this.assign(
          settings,
          ball,
          owner,
          2,
          locations,
          stage,
          context,
        );
        if (!first.receiver) continue;
        const projected = { ...locations };
        for (const a of first.assignments)
          projected[a.player] = fromWorld(
            sampleMotion(
              planMotion(
                {
                  position: toWorld(locations[a.player]),
                  velocity: this.motion?.(a.player)?.velocity ?? zeroVelocity(),
                },
                toWorld(a.target),
                assumptions.defenderSpeed,
                assumptions.defenderAcceleration,
              ),
              c.ballArrival,
            ).position,
          );
        projected[first.receiver] = bases[2];
        const nextRunners = structuredClone(runners);
        for (const r of nextRunners) {
          const next = runningAdvance(r, r.goal, c.ballArrival);
          r.progress = next.progress;
          r.runVelocity = next.velocity;
          r.startDelay = next.delay;
          if (r.id === c.runner) r.status = "out";
        }
        const nextBall = { ...ball, fieldingPoint: bases[2] };
        const second = this.assign(
          settings,
          nextBall,
          first.receiver,
          1,
          projected,
          "received",
          { runners: nextRunners, outs: outs + 1 },
        );
        const arrival =
            c.ballArrival + this.arrival(second, projected, first.receiver),
          runnerArrival = runningTime(br, 1),
          margin = runnerArrival - arrival;
        c.continuation = {
          target: 1,
          arrival,
          runnerArrival,
          margin,
          pivot: throwingProfile(
            bases[2],
            bases[1],
            first.receiver,
            settings.armStrength,
          ).prepare,
        };
        if (margin >= -0.25) c.score += 2;
        if (
          outs === 1 &&
          margin > 0.05 &&
          runners.some((r) => r.goal === 4 || r.status === "scored")
        ) {
          c.preventsRun = true;
          c.score += 3;
        }
      }
    }
    const wrap = (decision: ThrowDecision): ThrowDecision => ({
      ...decision,
      alternatives: candidates,
      rejections: ([1, 2, 3, "home"] as Base[]).map((target) => ({
        target,
        reason: candidates.some(
          (c) => c.target === target && (c.viable || c.competitive),
        )
          ? "Available timing opportunity"
          : candidates.some((c) => c.target === target)
            ? "Runner arrival or required tag precedes a reliable out"
            : decision.target === target && !decision.runner
              ? "Control return without an immediate out attempt"
              : "No active runner is challenging this base or requiring a retouch appeal",
      })),
    });
    if (settings.throwTarget === "hold")
      return wrap({
        target: "hold",
        force: false,
        reason: m("targetOverride"),
        override: true,
      });
    if (settings.throwTarget === "cutoff" && !isOutfieldHit(ball))
      return wrap({
        target: "hold",
        force: false,
        reason: m("cutoffUnavailable"),
        override: true,
      });
    if (settings.throwTarget !== "auto" && settings.throwTarget !== "cutoff") {
      const candidate = candidates
        .filter((c) => c.target === settings.throwTarget)
        .sort((a, b) => b.margin - a.margin)[0];
      return wrap({
        target: settings.throwTarget,
        runner: candidate?.runner,
        appeal: candidate?.appeal,
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
          !isOutfieldHit(ball),
      );
    if (best)
      return wrap({
        target: best.target,
        runner: best.runner,
        continuation: best.continuation,
        appeal: best.appeal,
        force: best.force,
        margin: best.margin,
        reason: m(
          best.continuation && best.continuation.margin >= -0.25
            ? "targetDoublePlay"
            : best.appeal
              ? "appealWhy"
              : best.competitive
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
    if (
      isOutfieldHit(ball) &&
      runners.some(active) &&
      (!locations ||
        ((["LF", "CF", "RF"].includes(owner) ||
          metres(locations[owner], bases.home) > 55) &&
          metres(locations[owner], bases[2]) > 2))
    )
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
    for (const [legIndex, player] of layout.route.legs.entries()) {
      const point = layout.assignments.find((a) => a.player === player)!.target;
      if (player === owner) {
        elapsed += Math.max(
          0.001,
          this.travel(player, legIndex === 0 ? locations[player] : from, point),
        );
      } else {
        const release =
          legIndex === 0
            ? this.release(owner, locations[owner], point)
            : {
                time: throwingProfile(
                  from,
                  point,
                  owner,
                  this.settings?.armStrength,
                ).prepare,
                point: from,
              };
        const trajectory = throwFlight(
          release.point,
          point,
          owner,
          this.settings?.armStrength,
        );
        if (!trajectory.reachable) return Infinity;
        const flight = trajectory.duration;
        const receiverTime = Math.max(
          0,
          this.travel(player, locations[player], point) - elapsed,
        );
        // A direct throw may pass a late optional cutoff. Only an actual
        // relay receiver imposes a receiving-readiness wait.
        const cutoffWait = 0;
        elapsed +=
          Math.max(release.time, receiverTime - flight, cutoffWait) +
          flight +
          assumptions.catchTime;
      }
      if (legIndex < layout.route.legs.length - 1 && player !== layout.receiver)
        elapsed += throwPhysics.relayRead;
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
    this.settings = settings;
    const map = new Map<Position, DefensiveAssignment>(),
      issues: CoverageIssue[] = [];
    const runners = context?.runners ?? [];
    const source =
      stage === "contact"
        ? ball.boundary
          ? toward(ball.fieldingPoint, bases.home, 2)
          : (ball.pursuitTarget ?? ball.fieldingPoint)
        : this.release(owner, locations[owner]).point;
    const outfield =
      ["LF", "CF", "RF"].includes(owner) ||
      metres(bases.home, source) > assumptions.relayDistance;
    const outfieldReturn = isOutfieldHit(ball);
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
      const motion = this.motion?.(player);
      if (
        stage !== "complete" &&
        context?.outs !== 3 &&
        (type === "HoldPosition" || type === "Communicate") &&
        motion &&
        Math.hypot(motion.velocity.x, motion.velocity.y) > 1e-8
      ) {
        type = "Decelerate";
        reason = "braking";
        point = this.release(player, locations[player]).point;
      }
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
      a.arrivalTime = this.travel(player, locations[player], a.target);
      a.explanation = assignmentText(a).why;
      map.set(player, a);
    };
    if (
      stage === "complete" ||
      context?.outs === 3 ||
      (context?.ballDead && stage !== "contact")
    ) {
      for (const p of positions)
        put(
          p,
          p === owner && !context?.ballDead ? "PossessBall" : "HoldPosition",
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
        ? ball.boundary
          ? "TrackBall"
          : "FieldBall"
        : context?.ballInFlight
          ? "ThrowBall"
          : "PossessBall",
      stage === "contact"
        ? ball.boundary
          ? toward(ball.fieldingPoint, bases.home, 2)
          : (ball.pursuitTarget ?? ball.fieldingPoint)
        : this.release(owner, locations[owner]).point,
      100,
      stage === "contact"
        ? ball.boundary
          ? "boundaryTrack"
          : "primary"
        : context?.ballInFlight
          ? "release"
          : "possession",
    );
    if (stage === "contact")
      map.get(owner)!.notBefore =
        assumptions.reaction + (ball.pursuitDelay ?? 0);
    // Read the bunt's side at contact. A nonfielding 3B has no useful pursuit
    // of a right-side bunt and must stay available for third immediately.
    const rightSideBunt =
      settings.ball.type === "Bunt" &&
      source.x > bases.home.x &&
      owner !== "3B";
    if (settings.ball.type === "Bunt" && stage === "contact") {
      for (const p of ["P", "1B", "3B"] as Position[]) {
        if (
          map.has(p) ||
          p === context?.fixedReceiver ||
          (p === "P" &&
            owner === "3B" &&
            runners.some(
              (r) => active(r) && r.originBase >= 2 && r.goal >= 3,
            )) ||
          (p === "3B" &&
            (rightSideBunt ||
              runners.some((r) => active(r) && r.originBase >= 2)))
        )
          continue;
        put(p, "ChargeBunt", toward(source, locations[p], 3), 82, "buntCharge");
      }
    }
    const liveAt = (base: Base) => {
      const n = baseNumber(base);
      return runners.some(
        (r) =>
          active(r) &&
          !(base === 1 && target === "home" && outfield && r.decision === "advance" && !r.firstTurn) &&
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
    const distanceToTarget = target === "hold" ? 0 : metres(source, bases[target]);
    const deepReturn = outfield && distanceToTarget > directThrowRange(owner, settings.armStrength);
    const ballSide: Position = source.x < 500 ? "SS" : "2B";
    const pending = target !== "hold" && this.continuation?.target === target
      ? this.continuation.stops : undefined;
    // The ball-side middle infielder leads a deep return in every sector.
    // A home cutoff is a separate, shallower job, not a substitute deep relay.
    const initialRelayPoint = target === "hold" ? source : toward(
      source, bases[target], Math.min(distanceToTarget * 0.55,
        directThrowRange(owner, settings.armStrength) * 0.95));
    // Choose the lane from the selected target, then reserve that specialist.
    // For second: ball-side middle infielder relays, opposite infielder receives.
    const needsCutoff =
      target !== "hold" &&
      this.relayBudget > 0 &&
      (stage !== "received" || deepReturn || !!pending?.length) &&
      outfield &&
      (metres(source, bases[target]) > assumptions.cutoffDistance ||
        settings.throwTarget === "cutoff");
    const preferredCutoff: Position =
      deepReturn ? ballSide : target === 2
        ? source.x < 500
          ? "SS"
          : "2B"
        : target === "hold"
          ? "2B"
          : conventions.cutoff[target];
    const cutoffCandidates = needsCutoff
      ? ([preferredCutoff, "SS", "2B", "1B", "3B"].filter(
          (p) =>
            !map.has(p as Position) &&
            p !== context?.fixedReceiver &&
            !(target === 1 && p === "1B") &&
            !(p === "3B" && (target === 3 || outfieldReturn)),
        ) as Position[])
      : [];
    let cutoff: Position | undefined;
    if (needsCutoff) {
      const lane = pending?.[0]?.point ?? (deepReturn ? initialRelayPoint : mixPhysical(source, bases[target as Base], 0.55));
      const available =
        (stage === "contact" ? ball.fieldingTime : 0) +
        assumptions.transfer +
        throwFlight(source, lane, owner, settings.armStrength).duration;
      const candidates = [...new Set(cutoffCandidates)];
      candidates.sort(
        (a, b) =>
          Number(this.travel(b, locations[b], lane) <= available) -
            Number(this.travel(a, locations[a], lane) <= available) ||
          cutoffCandidates.indexOf(a) * 0.25 +
            this.travel(a, locations[a], lane) -
            cutoffCandidates.indexOf(b) * 0.25 -
            this.travel(b, locations[b], lane),
      );
      cutoff =
        pending?.[0] && candidates.includes(pending[0].player)
          ? pending[0].player
          : context?.fixedCutoff && candidates.includes(context.fixedCutoff)
          ? context.fixedCutoff
          : cutoffCandidates[0] &&
              this.travel(
                cutoffCandidates[0],
                locations[cutoffCandidates[0]],
                lane,
              ) <= available
            ? cutoffCandidates[0]
            : candidates[0];
    }
    const relayPoint = cutoff ? (context?.fixedRelays?.find(s => s.player === cutoff)?.point ??
      pending?.[0]?.point ?? (deepReturn ? initialRelayPoint : mixPhysical(source, bases[target as Base], 0.55))) : undefined;
    const actualRelay = !!cutoff && (deepReturn || !!pending?.length);
    const relayStops: RelayStop[] = actualRelay ? [{ player: cutoff!, point: relayPoint! }] : [];
    const excluded = new Set<Position>([owner, ...(cutoff ? [cutoff] : [])]);
    if (actualRelay && this.relayBudget > 1 && target !== "hold") {
      const remainder = metres(relayPoint!, bases[target]);
      const secondary = pending?.[1] ?? context?.fixedRelays?.[1];
      const needsSecond = !!secondary || remainder > directThrowRange(cutoff!, settings.armStrength);
      if (needsSecond) {
        const candidates: Position[] = target === "home" ? ["1B", "SS", "2B"] : ["1B", "2B", "SS"];
        const player = secondary?.player ?? candidates.find(p => !excluded.has(p) && p !== context?.fixedReceiver &&
          !(target === 2 && p === (cutoff === "2B" ? "SS" : "2B")));
        if (player) {
          const point = secondary?.point ?? mixPhysical(relayPoint!, bases[target], 0.5);
          relayStops.push({ player, point });
          excluded.add(player);
        }
      }
    }
    // Page 17: 1B anticipates the home cutoff while a middle infielder relays.
    // First need not consume P when BR is committed beyond it on a deep hit.
    const innerCutoff = target === "home" && actualRelay && !excluded.has("1B") &&
      context?.fixedReceiver !== "1B" && !liveAt(1) ? "1B" as const : undefined;
    if (innerCutoff) excluded.add(innerCutoff);
    // A trailer may leave second only when a replacement is already there.
    // Keep this conditional rather than silently leaving second unprotected.
    const otherMiddle: Position = ballSide === "2B" ? "SS" : "2B";
    const replacement = (["LF", "RF", "CF"] as Position[]).find(p => p !== owner && metres(locations[p], bases[2]) < 1);
    const trailer = actualRelay && metres(bases.home, source) > 90 && replacement &&
      !excluded.has(otherMiddle) && target !== 2 ? otherMiddle : undefined;
    if (trailer) excluded.add(trailer);
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
      const deadline = Math.min(
        ...runners
          .filter(
            (r) =>
              active(r) &&
              r.decision !== "retreat" &&
              r.progress < baseNumber(base) &&
              (r.goal >= baseNumber(base) ||
                (reason === "buntRecoverThird" &&
                  r.originBase === 1 &&
                  r.goal >= 2)),
          )
          .map((r) =>
            runningTime(
              reason === "buntRecoverThird" && r.goal < 3
                ? { ...r, goal: 3 }
                : r,
              baseNumber(base),
            ),
          ),
      );
      const carry =
        stage !== "contact" &&
        (metres(locations[owner], bases[base]) < 0.1 ||
          (owner === "1B" &&
            base === 1 &&
            metres(locations[owner], bases[1]) < 4));
      const preferences =
        base === 2 && trailer && replacement
          ? [replacement, ...conventions.coverage[2]]
          : settings.ball.type === "Bunt" && base === 1 && map.has("1B")
          ? (["2B", "P", "SS", "1B", "C", "3B"] as Position[])
          : settings.ball.type === "Bunt" && base === 3 && owner === "3B"
            ? (["C", "P", "SS", "1B", "2B"] as Position[])
            : base === 1 && owner === "1B"
              ? (["P", "2B", "SS", "3B", "C"] as Position[])
              : conventions.coverage[base];
      const eligible = preferences.filter(
        (p) =>
          !map.has(p) &&
          !excluded.has(p) &&
          !(p === context?.fixedReceiver && base !== target) &&
          !(p === "C" && homeThreat && base !== "home"),
      );
      // Prefer conventional infield receivers, but retain an already-covered
      // base instead of recalling a more distant nominal position after a relay.
      const infield = eligible.filter((p) => !["LF", "CF", "RF"].includes(p));
      const middle = eligible.filter((p) => p === "2B" || p === "SS");
      const outfieldReceivers = eligible.filter(p => ["LF", "RF", "CF"].includes(p));
      const pool =
        base === 2 && trailer && replacement && eligible.includes(replacement)
          ? [replacement]
          : base === 2
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
          this.travel(a, locations[a], bases[base]) +
          preferences.indexOf(a) * 0.12 -
          this.travel(b, locations[b], bases[base]) -
          preferences.indexOf(b) * 0.12,
      );
      // The nonfielding third baseman returns to the bag. Use a replacement
      // only when a prior job reserves 3B, or another receiver can beat an
      // imminent round of second that 3B cannot reach in time.
      if (
        reason === "buntRecoverThird" &&
        pool.includes("3B") &&
        (this.travel("3B", locations["3B"], bases[3]) <= deadline ||
          this.travel(pool[0], locations[pool[0]], bases[3]) > deadline)
      )
        (pool.splice(pool.indexOf("3B"), 1), pool.unshift("3B"));
      // Conventional pivot: SS takes P/2B feeds; 2B takes SS/3B feeds.
      // Readiness still overrides a nominal position on an emergency play.
      const pivot: Position =
        settings.ball.type === "Bunt" || owner === "P" || owner === "2B"
          ? "SS"
          : "2B";
      if (base === 2 && !outfield && pool.includes(pivot)) {
        const deadline =
          (stage === "contact" ? ball.fieldingTime : 0) +
          throwingProfile(source, bases[2], owner, settings.armStrength)
            .prepare +
          throwFlight(source, bases[2], owner, settings.armStrength).duration;
        if (
          this.travel(pivot, locations[pivot], bases[2]) <=
          Math.max(
            deadline + 0.25,
            Math.min(
              ...pool.map((p) => this.travel(p, locations[p], bases[2])),
            ) + 0.12,
          )
        )
          (pool.splice(pool.indexOf(pivot), 1), pool.unshift(pivot));
      }
      const player =
        base === target &&
        context?.fixedReceiver &&
        pool.includes(context.fixedReceiver)
          ? context.fixedReceiver
          : carry
            ? owner
            : base === 1 &&
                owner === "1B" &&
                settings.ball.type !== "Bunt" &&
                pool.includes("P")
              ? "P"
              : pool[0];
      if (player) {
        if (carry) map.delete(owner);
        put(player, "CoverBase", bases[base], priority, reason, base);
        if (map.get(player)!.arrivalTime! > deadline)
          issues.push({
            kind: "late-coverage",
            base,
            player,
            detail:
              "Receiving assignment is in progress but cannot reach the base before the advancing runner under current timing.",
          });
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
      put(
        cutoff,
        actualRelay ? "Relay" : "Cutoff",
        relayPoint!,
        85,
        actualRelay ? "relayLane" : "cutoffLane",
        target as Base,
        owner,
      );
    }
    for (const stop of relayStops.slice(1))
      put(stop.player, "Relay", stop.point, 85, "relayLane", target as Base, cutoff);
    if (innerCutoff)
      put(innerCutoff, "Cutoff", toward(bases.home, relayPoint!, Math.min(18, metres(bases.home, relayPoint!) * 0.6)),
        84, "innerCutoff", "home", cutoff);
    if (trailer)
      put(trailer, "RelayTrailer", backupPoint(source, relayPoint!, 7.62), 83, "relayTrailer", target as Base, cutoff);
    if (deepReturn && (target === "home" || target === 3) && !map.has("P") && context?.fixedReceiver !== "P") {
      const incoming = relayStops.at(-1)?.point ?? context?.incomingFrom ?? source;
      put("P", "BackupThrow", backupPoint(incoming, bases[target]), 82, "throwBackup", target, receiver);
      map.get("P")!.throwOrigin = incoming;
      map.get("P")!.receivingPoint = bases[target];
    }
    // BR can round second even when the current plan stops there. Keep third
    // controlled before assigning any spare defender to an optional relay backup.
    if (outfieldReturn && target !== 3) cover(3, 81, "thirdControl");
    // Occupancy/advancement creates a coverage need. An empty, passed base does
    // not consume a defender simply because it exists on the diamond.
    for (const base of (outfield && target === "home" ? [2, 3, 1] : [1, 2, 3]) as (1 | 2 | 3)[])
      if (base !== target && liveAt(base)) cover(base, 80);
    // Control second on all outfield returns, even while BR is headed to first.
    if ((outfield || liveAt(1)) && target !== 2) cover(2, 78);
    if (deepReturn && source.x >= 500 && (target === "home" || target === 3) && !map.has("LF")) {
      put("LF", "SupportBase", backupPoint(relayPoint ?? source, bases[3], conventions.secondaryBackupDepth), 77, "throwBackup", 3);
      map.get("LF")!.throwOrigin = relayPoint ?? source;
    }
    // A sacrifice runner's current goal of second does not make third safe to
    // abandon. Read a right-side bunt immediately; otherwise recover once the
    // ball is secured. Keep the receiver ahead of backups while R1 can round
    // second. The owner and committed receivers retain their reserved jobs.
    if (
      settings.ball.type === "Bunt" &&
      (stage !== "contact" || rightSideBunt) &&
      runners.some(
        (r) => active(r) && r.originBase === 1 && r.goal >= 2 && r.progress < 3,
      )
    )
      cover(3, 80, "buntRecoverThird");
    if (context?.opportunitiesClosed) {
      for (const p of positions)
        if (!map.has(p)) put(p, "HoldPosition", locations[p], 20, "guardSpace");
      return {
        assignments: [...map.values()],
        issues,
        route: { kind: "hold", from: source, target: "hold", legs: [] },
      };
    }
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
                    directThrowRange(owner, settings.armStrength)
                  ? "relay"
                  : "through-cutoff"
              : "direct",
      from: source,
      target,
      receiver,
      cutoff,
      cutoffPoint: cutoff ? map.get(cutoff)?.target : undefined,
      relays: relayStops,
      relaysUsed: throwPhysics.maximumRelays - this.relayBudget,
      innerCutoff,
      trailer,
      legs: [],
    };
    route.legs =
      target === "hold" || !receiver
        ? []
        : route.kind === "cutoff-hold"
          ? [cutoff!]
          : route.kind === "relay"
            ? [...relayStops.map(s => s.player), receiver]
            : [receiver];
    // A ready inner cutoff can turn a return into a second actual relay. The
    // full sequence, including its transfer cost, is what choose() evaluates.
    if (innerCutoff && target !== "hold" && receiver && route.kind === "relay" && relayStops.length < this.relayBudget) {
      const first = relayStops.at(-1)!;
      const direct = throwFlight(first.point, bases[target], first.player, settings.armStrength);
      const inner = map.get(innerCutoff)!;
      const through = throwFlight(first.point, inner.target, first.player, settings.armStrength);
      const final = throwFlight(inner.target, bases[target], innerCutoff, settings.armStrength);
      if ((!direct.reachable || direct.angle > throwPhysics.accurateAngle) && through.reachable && final.reachable) {
        relayStops.push({ player: innerCutoff, point: inner.target });
        inner.type = "Relay";
        route.legs = [...relayStops.map(s => s.player), receiver];
      }
    }
    // A compulsory override still cannot make an impossible airborne throw.
    // Carry instead of inventing a third relay or teleporting the ball.
    if (target !== "hold" && route.legs.length) {
      let previous = source, thrower = owner;
      const possible = route.legs.every(player => {
        const point = map.get(player)!.target;
        const ok = player === thrower || throwFlight(previous, point, thrower, settings.armStrength).reachable;
        previous = point; thrower = player; return ok;
      });
      if (!possible) {
        map.delete(owner);
        if (receiver && receiver !== owner) map.delete(receiver);
        put(owner, "CoverBase", bases[target], 95, "receiver", target);
        receiver = owner;
        route.kind = "carry";
        route.receiver = owner;
        route.legs = [owner];
        route.relays = [];
      }
    }
    if (route.kind === "through-cutoff" && cutoff) {
      const deadline =
        (stage === "contact" ? ball.fieldingTime : 0) +
        throwingProfile(
          source,
          bases[target as Base],
          owner,
          settings.armStrength,
        ).prepare +
        throwFlight(source, route.cutoffPoint!, owner, settings.armStrength).duration;
      if (this.travel(cutoff, locations[cutoff], route.cutoffPoint!) > deadline)
        issues.push({
          kind: "late-cutoff",
          base: target as Base,
          player: cutoff,
          detail:
            "The direct throw can reach its base without waiting for this optional cutoff; alignment may be late.",
        });
    }
    const backed = new Set<Base>([...map.values()].filter(a => a.type === "BackupThrow" && a.base).map(a => a.base!));
    const backup = (
      base: Base,
      preferred: Position[],
      priority = 65,
      depth = conventions.backupDepth,
      receivingPoint = bases[base],
      receivingPlayer?: Position,
      reason: AssignmentReason = "throwBackup",
    ) => {
      let from =
        base === target
          ? source
          : stage === "contact"
            ? ball.fieldingPoint
            : locations[owner];
      if (metres(from, receivingPoint) < 0.1 && context?.incomingFrom)
        from = context.incomingFrom;
      const point = backupPoint(from, receivingPoint, depth);
      const receiving = [...map.values()].find(
        (a) => a.base === base && a.type === "CoverBase",
      );
      const receivingId = receivingPlayer ?? receiving?.player;
      const intermediateIndex = route.legs.findIndex(p => p === receivingId);
      const firstLeg = intermediateIndex >= 0 && receivingId !== receiver;
      const estimateLayout = {
        assignments: [...map.values()],
        route: firstLeg ? { ...route, legs: route.legs.slice(0, intermediateIndex + 1) } : route,
        receiver,
        cutoff,
        issues,
      };
      const neededIn =
        (receivingId ? context?.receptionTimes?.[receivingId] : undefined) ??
        (stage === "contact" ? ball.fieldingTime : 0) +
          this.arrival(estimateLayout, locations, owner);
      const travel = (p: Position) => this.travel(p, locations[p], point);
      const candidates = preferred.filter((p) =>
        !map.has(p) &&
        !(outfieldReturn && ["LF", "CF", "RF"].includes(p) && isInfieldDiamond(point)) &&
        // A distant optional backup must not consume a defender who cannot
        // reach the reception before the ball. Base backups may still develop.
        (!firstLeg || travel(p) <= neededIn + 0.05),
      );
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
          reason,
          base,
          receivingPlayer ?? receiving?.player,
        );
        map.get(player)!.throwOrigin = from;
        map.get(player)!.receivingPoint = receivingPoint;
        backed.add(base);
      }
      return player;
    };
    // Outfield returns reserve P for a base overthrow, never for the deep
    // middle-infielder's relay reception. A control return to second can leave
    // a developing third-base play as P's more useful anticipated backup.
    if (target !== "hold" && !map.has("P") &&
        (outfieldReturn || target === "home" || target === 3)) {
      let pitcherBase: Base = target;
      if (outfieldReturn && target === 2) {
        // A committed flight already has an arrival deadline. Reuse it instead
        // of charging a new complete return and changing P's read at release.
        const returnTime = (receiver ? context?.receptionTimes?.[receiver] : undefined) ??
          ((stage === "contact" ? ball.fieldingTime : 0) +
            this.arrival({ assignments: [...map.values()], route, receiver, cutoff, issues }, locations, owner));
        const secondOut = runners.some(r => active(r) && r.decision === "advance" &&
          r.progress < 2 && r.goal >= 2 &&
          runningTime(r, 2) - returnTime - (isForced(r, runners, 2) ? 0 : assumptions.tagTime) > 0.05);
        if (!secondOut && runners.some(r => active(r) && r.decision === "advance" && r.progress < 3 && r.goal >= 3))
          pitcherBase = 3;
      }
      backup(pitcherBase, ["P"], 74, conventions.backupDepth, bases[pitcherBase], undefined,
        pitcherBase === target ? "throwBackup" : "anticipatedBackup");
    }
    const firstPlay =
      !outfield &&
      route.kind !== "carry" &&
      target !== "hold" &&
      (target === 1 || liveAt(1));
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
          ? ["2B", "SS", "1B"]
          : ["CF", "RF", "LF", "2B", "SS", "1B"]
      ).filter((p) => !map.has(p as Position)) as Position[];
      if (!backup(target as Base, free, 66, 6, route.cutoffPoint!, cutoff))
        issues.push({
          kind: "unfulfilled",
          base: target as Base,
          detail:
            "No timely eligible defender can back the optional cutoff reception without abandoning base or outfield coverage.",
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
        // The pitcher backs the incoming outfield return. The far outfielder
        // shades behind second for a possible subsequent throw from the infield,
        // keeping outfield coverage instead of duplicating P inside the diamond.
        const secondOrigin = bases.home;
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
          [...map.values()].some(
            (a) =>
              ["LF", "CF", "RF"].includes(a.player) &&
              a.base === base &&
              (a.type === "SupportBase" ||
                (a.type === "BackupThrow" && (!a.receivingPoint || metres(a.receivingPoint, bases[base]) < 0.1))),
          )
        ) {
          put(p, "HoldPosition", locations[p], 20, "guardSpace");
          continue;
        }
        put(
          p,
          "SupportBase",
          backupPoint(base === 2 && outfieldReturn ? bases.home : source, bases[base], 12),
          40,
          base === 2 ? "secondSupport" : "throwBackup",
          base,
        );
        map.get(p)!.throwOrigin = base === 2 && outfieldReturn ? bases.home : source;
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
