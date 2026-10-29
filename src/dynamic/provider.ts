import {
  advanceProgress,
  baseTouchTime,
  remainingRunningTime,
  runningAdvance,
} from "./runningGeometry";
import type {
  BallEvent,
  Base,
  GameState,
  PlayProvider,
  Point,
  Position,
} from "../simulation/types";
import { sliceTimed } from "../simulation/timedPath";
import { sampleTimed } from "../simulation/timedPath";
import { isAirborneType, ballPhysics } from "./trajectory";
import {
  prepareAirReads,
  releaseTagUps,
  qualifiesInfieldFly,
  updateAirReads,
  type AirborneRead,
} from "./airborne";
import { MovementEngine } from "./movement";
import { BaserunningDecisionEngine } from "./baserunning";
import { DefensiveDecisionEngine, isForced } from "./defense";
import { TimelineBuilder } from "./timelineBuilder";
import { planMotion, sampleMotion } from "./locomotion";
import { throwingProfile, throwFlight, throwSamples, throwPhysics, cutoffCrossing } from "./throwing";
import { fieldConfiguration, defaultField } from "./fieldConfiguration";
import { assumptions, recommendStrategy } from "./conventions";
import {
  bases,
  isPlayable,
  isFairAim,
  isOutfield,
  isOutfieldHit,
  metres,
  runnerPoint,
  toWorld,
  fromWorld,
} from "./geometry";
import { message as m } from "./messages";
import type {
  DynamicScenario,
  DynamicSettings,
  ThrowDecision,
  DefensiveAuditFrame,
  RelayStop,
  ThrowRoute,
} from "./types";
export function defaultSettings(): DynamicSettings {
  return {
    field: { ...defaultField },
    state: {
      outs: 0,
      balls: 0,
      strikes: 0,
      runners: { R1: 1 },
      phase: "Ready",
      runs: 0,
      inning: 1,
      half: "top",
      homeScore: 0,
      awayScore: 0,
      fieldingTeam: "home",
      strategy: "standard",
    },
    ball: {
      type: "Ground ball",
      destination: { x: 396, y: 473 },
      strength: "normal",
    },
    aggression: "normal",
    runnerSpeed: "average",
    throwTarget: "auto",
  };
}
export function validateSettings(
  settings: DynamicSettings,
): string | undefined {
  const s = settings.state,
    values = Object.values(s.runners);
  if (
    !(isAirborneType(settings.ball.type)
      ? isFairAim(settings.ball.destination)
      : isPlayable(settings.ball.destination)) ||
    ![0, 1, 2].includes(s.outs) ||
    ![0, 1, 2, 3].includes(s.balls) ||
    ![0, 1, 2].includes(s.strikes) ||
    !Number.isInteger(s.inning) ||
    s.inning < 1 ||
    s.inning > 30 ||
    ![s.homeScore, s.awayScore].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 99,
    ) ||
    values.some((b) => ![1, 2, 3].includes(Number(b))) ||
    new Set(values).size !== values.length ||
    Object.entries(s.runners).some(([id, b]) => id !== `R${b}`) ||
    s.fieldingTeam !== (s.half === "top" ? "home" : "away") ||
    !["top", "bottom"].includes(s.half)
  )
    return m("invalid");
  if (
    !["Ground ball", "Fly ball", "Line drive", "Pop-up", "Bunt"].includes(
      settings.ball.type,
    )
  )
    return m("unsupported");
  if (
    (settings.field !== undefined &&
      (!Number.isFinite(settings.field.fenceHeight) ||
        settings.field.fenceHeight < 1 ||
        settings.field.fenceHeight > 30 ||
        !["standard", "keep-in-play"].includes(settings.field.fenceMode))) ||
    (settings.armStrength !== undefined &&
      !["developing", "standard", "strong"].includes(settings.armStrength)) ||
    !["soft", "normal", "hard"].includes(settings.ball.strength) ||
    !["conservative", "normal", "aggressive"].includes(settings.aggression) ||
    !["slow", "average", "fast"].includes(settings.runnerSpeed) ||
    !["standard", "prevent", "conservative"].includes(s.strategy) ||
    !["auto", "hold", "cutoff", "home", 1, 2, 3].includes(settings.throwTarget)
  )
    return m("invalid");
  if (
    settings.ball.type === "Bunt" &&
    metres(bases.home, settings.ball.destination) > 25
  )
    return m("buntScope");
}
export class DynamicPlayProvider implements PlayProvider {
  constructor(public settings: DynamicSettings = defaultSettings()) {}
  resolve(
    state: GameState,
    event: Pick<BallEvent, "type" | "direction"> & Partial<BallEvent>,
  ) {
    if (
      !event.location ||
      !["Ground ball", "Fly ball", "Line drive", "Pop-up", "Bunt"].includes(
        event.type,
      )
    )
      return { supported: false as const, reason: m("unsupported") };
    const settings = {
      ...this.settings,
      state: { ...this.settings.state, ...state },
      ball: {
        ...this.settings.ball,
        type: event.type as DynamicSettings["ball"]["type"],
        destination: event.location,
      },
    };
    const error = validateSettings(settings);
    if (error) return { supported: false as const, reason: error };
    return { supported: true as const, scenarios: [this.generate(settings)] };
  }
  generate(settings: DynamicSettings): DynamicScenario {
    const invalid = validateSettings(settings);
    if (invalid) throw new Error(invalid);
    settings = structuredClone({
      ...settings,
      ball: {
        ...settings.ball,
        destination: {
          x: settings.ball.destination.x,
          y: settings.ball.destination.y,
        },
      },
    });
    const movement = new MovementEngine(),
      running = new BaserunningDecisionEngine(),
      defense = new DefensiveDecisionEngine();
    const starting = movement.starting(settings),
      ball = movement.field(settings, starting),
      runners = running.create(settings);
    defense.settings = settings;
    const startingPositions: Record<string, Point> = {
      ...starting,
      ...Object.fromEntries(
        runners.map((r) => [r.id, runnerPoint(r.progress)]),
      ),
    };
    const builder = new TimelineBuilder(
      settings.state,
      startingPositions,
      runners,
    );
    const decisions: ThrowDecision[] = [],
      diagnostics: DefensiveAuditFrame[] = [];
    const holdingDecisions: ThrowDecision[] = [];
    const airborneReads: AirborneRead[] = [];
    defense.motion = (player) => ({
      position: builder.locations[player],
      velocity: builder.velocities[player],
      reaction: Math.max(0, assumptions.reaction - builder.liveTime),
      time: builder.liveTime,
    });
    ball.infieldFly = qualifiesInfieldFly(settings, ball);
    let closePlays = 0,
      owner = ball.fielder,
      inFlight = false;
    running.plan(settings, ball, runners, 0, true);
    prepareAirReads(settings, ball, runners);
    if (ball.boundary)
      for (const r of runners) {
        r.goal = Math.min(
          4,
          r.originBase + (ball.boundary === "home-run" ? 4 : 2),
        );
        r.approach = "round";
        r.decision = "advance";
        r.plan = {
          candidates: [],
          reason: m(
            ball.boundary === "home-run" ? "homeRunWhy" : "boundaryDoubleWhy",
          ),
        };
      }
    for (const r of runners) {
      startingPositions[r.id] = runnerPoint(r.progress);
      builder.locations[r.id] = runnerPoint(r.progress);
    }
    // Anticipate from the same decision rules, using projected runner positions.
    // This gets backups moving at contact rather than after the throw is released.
    const forecast = structuredClone(runners);
    for (const r of forecast) {
      const at = runningAdvance(r, r.goal, ball.fieldingTime);
      r.progress = at.progress;
      r.runVelocity = at.velocity;
      r.startDelay = at.delay;
      if (r.progress >= 4) r.status = "scored";
    }
    running.plan(settings, ball, forecast, ball.fieldingTime, true);
    let activeTarget = defense.choose(
      settings,
      ball,
      forecast,
      builder.state.outs,
      starting,
      owner,
      "fielded",
      { seconds: ball.fieldingTime, runners },
    ).target;
    if (ball.boundary) activeTarget = "hold";
    let activeBall = ball;
    let lockedCutoff: Position | undefined,
      lockedReceiver: Position | undefined;
    let lockedRelays: RelayStop[] | undefined;
    let lockedRouteKind: ThrowRoute["kind"] | undefined;
    let lockedReception: import("./types").AssignmentContext["fixedReception"];
    let incomingFrom: Point | undefined;
    let opportunitiesClosed = false;
    let deadlines: Partial<Record<Position, number>> = {};
    let stage: "contact" | "fielded" | "received" | "complete" = "contact";
    let layout = defense.assign(
      settings,
      activeBall,
      owner,
      activeTarget,
      builder.locations,
      stage,
      {
        runners,
        outs: builder.state.outs,
        ballInFlight: inFlight,
        ballDead: !!ball.boundary,
        receptionTimes: Object.fromEntries(
          Object.entries(deadlines).map(([p, t]) => [
            p,
            Math.max(0, t! - builder.time),
          ]),
        ),
      },
    );
    const reassess = (trigger: string) => {
      const latestBall = builder.phases.at(-1)?.ball;
      layout = defense.assign(
        settings,
        activeBall,
        owner,
        activeTarget,
        builder.locations,
        stage,
        {
          runners,
          outs: builder.state.outs,
          ballInFlight: inFlight,
          ballDead: !!ball.boundary,
          fixedCutoff: lockedCutoff,
          opportunitiesClosed,
          fixedReceiver: lockedReceiver,
          fixedRelays: lockedRelays,
          fixedRouteKind: lockedRouteKind,
          fixedReception: lockedReception,
          incomingFrom,
          receptionTimes: Object.fromEntries(
            Object.entries(deadlines).map(([p, t]) => [
              p,
              Math.max(0, t! - builder.time),
            ]),
          ),
        },
      );
      builder.assignments = layout.assignments;
      diagnostics.push(
        structuredClone({
          time: builder.time,
          trigger,
          state: {
            ...builder.state,
            phase: trigger,
            ballStatus:
              builder.time < 1
                ? "ready"
                : stage === "complete"
                  ? "complete"
                  : ball.status === "out-of-play"
                    ? "dead"
                    : inFlight
                      ? latestBall?.kind === "held" &&
                        latestBall.secure === false
                        ? "gathering"
                        : "throwing"
                      : stage === "contact"
                        ? builder.liveTime >= (ball.touchTime ?? Infinity)
                          ? "gathering"
                          : (sampleTimed(
                                ball.trajectory!.frames,
                                builder.liveTime,
                              ).height ?? 0) > 0.05
                            ? "airborne"
                            : "rolling"
                        : "held",
          },
          runners,
          owner,
          target: activeTarget,
          route: layout.route,
          assignments: layout.assignments,
          issues: layout.issues,
        }),
      );
    };
    const record = (decision: ThrowDecision) => {
      decision.time = builder.time;
      decision.owner = owner;
      decisions.push(decision);
      return decision;
    };
    builder.reassess = reassess;
    reassess("Initial contact plan");
    builder.interval(
      "Ready",
      m("ready"),
      1,
      { kind: "held", owner: "P" },
      false,
    );
    builder.event("BallContact", m("contact", { fielder: owner }));
    const touch = ball.touchTime!;
    const trajectory = ball.trajectory!;
    const cues: {
      t: number;
      kind: "bounce" | "landing" | "wall" | "passed" | "infield-fly" | "read";
    }[] = trajectory.events
      .filter(
        (e) =>
          (e.type === "landing" || e.type === "bounce" || e.type === "wall") &&
          e.t < touch - 1e-8,
      )
      .map((e) => ({
        t: e.t,
        kind:
          e.type === "wall"
            ? "wall"
            : e.type === "landing"
              ? "landing"
              : "bounce",
      }));
    if (
      ["Ground ball", "Bunt"].includes(settings.ball.type) &&
      isOutfield(ball.fieldingPoint)
    ) {
      const passed = trajectory.frames.find(
        (f) => metres(bases.home, f.point) > 39,
      );
      if (passed && passed.t < touch)
        cues.push({ t: passed.t, kind: "passed" });
    }
    if (ball.infieldFly) {
      const apex = trajectory.frames.reduce((a, b) =>
        (b.height ?? 0) > (a.height ?? 0) ? b : a,
      );
      cues.push({ t: Math.min(touch, apex.t), kind: "infield-fly" });
    }
    if (isAirborneType(settings.ball.type) && !ball.boundary)
      for (const t of [0.35, 0.7, 1.05, 1.6, 2.4])
        if (
          t < touch &&
          t <
            (trajectory.events.find((e) => e.type === "landing")?.t ?? Infinity)
        )
          cues.push({ t, kind: "read" });
    cues.sort((a, b) => a.t - b.t);
    let ballTime = 0;
    const follow = (end: number) => {
      if (end - ballTime < 1e-7) return;
      const samples = sliceTimed(trajectory.frames, ballTime, end);
      builder.interval(
        ballTime === 0 ? "Contact" : m("phaseFlight"),
        m("movingBallWhy", { fielder: owner }),
        end - ballTime,
        {
          kind: "travel",
          path: [samples[0].point, samples.at(-1)!.point],
          style: "hit",
          samples,
          receiver:
            Math.abs(end - touch) < 1e-8 && !ball.boundary ? owner : undefined,
        },
      );
      ballTime = end;
    };
    for (const cue of cues) {
      follow(cue.t);
      if (cue.kind === "read") {
        const read = updateAirReads(
          settings,
          ball,
          runners,
          builder.liveTime,
          builder.locations,
          airborneReads,
          builder.velocities,
        );
        if (read.classification === "uncatchable") {
          running.plan(settings, ball, runners, builder.liveTime, true);
          for (const r of runners) {
            r.airborneRead = "contact";
            if (r.status === "active")
              r.plan = { ...r.plan!, reason: m("readUncatchableWhy") };
          }
          const predicted = structuredClone(runners),
            remaining = Math.max(0, ball.fieldingTime - builder.liveTime);
          for (const r of predicted) {
            const at = runningAdvance(r, r.goal, remaining);
            r.progress = at.progress;
            r.runVelocity = at.velocity;
            r.startDelay = at.delay;
            if (r.progress >= 4) r.status = "scored";
          }
          running.plan(settings, ball, predicted, ball.fieldingTime, true);
          activeTarget = defense.choose(
            settings,
            ball,
            predicted,
            builder.state.outs,
            builder.locations,
            owner,
            "fielded",
            { seconds: remaining, runners },
          ).target;
        }
        airborneReads.push({
          ...read,
          time: builder.time,
          runners: runners.map((r) => ({
            player: r.id,
            progress: r.progress,
            goal: r.goal,
          })),
        });
        builder.event(
          "AirborneRead",
          m(
            read.classification === "uncatchable"
              ? "readUncatchableWhy"
              : read.classification === "catchable"
                ? "readCatchableWhy"
                : "readUncertainWhy",
          ),
        );
        reassess("Airborne read / runner goals updated");
      } else if (cue.kind === "infield-fly") {
        builder.event("InfieldFly", m("infieldFlyWhy"), "BR");
        builder.retire("BR", 1, false, "infield-fly");
        for (const r of runners) r.forceRemoved = true;
      } else if (cue.kind === "wall") {
        builder.event("BallWallContact", m("wallCaromWhy"));
        if (
          isAirborneType(settings.ball.type) &&
          !ball.caught &&
          !ball.boundary
        ) {
          running.plan(settings, ball, runners, builder.liveTime, true);
          for (const r of runners) r.airborneRead = "contact";
        }
        reassess("Wall carom / no airborne catch remains");
      } else if (cue.kind === "passed") {
        builder.event("BallPassedInfield", m("passedWhy"));
        reassess("Ball passed infield");
      } else {
        builder.event("BallBounce", m("bounceWhy"));
        if (
          cue.kind === "landing" &&
          isAirborneType(settings.ball.type) &&
          !ball.caught &&
          !ball.boundary
        ) {
          running.plan(settings, ball, runners, builder.liveTime, true);
          for (const r of runners) r.airborneRead = undefined;
          reassess("Landing / runners released");
        }
      }
    }
    follow(touch);
    if (ball.boundary) {
      ball.status = "out-of-play";
      builder.event(
        "BallBoundary",
        m(ball.boundary === "home-run" ? "homeRunWhy" : "boundaryDoubleWhy"),
      );
      stage = "received";
      reassess("Ball crossed boundary / award");
    } else {
      if (
        metres(builder.locations[owner], ball.touchPoint!) >
        assumptions.fieldingReach + 0.005
      )
        throw new Error(
          `Interception mismatch: ${owner} gap ${metres(builder.locations[owner], ball.touchPoint!)} body ${JSON.stringify(builder.locations[owner])} ball ${JSON.stringify(ball.touchPoint)} target ${JSON.stringify(ball.pursuitTarget)} delay ${ball.pursuitDelay}`,
        );
      builder.event("BallTouched", m("gatherWhy", { fielder: owner }), owner);
      if (ball.caught && (builder.state.outs < 2 || ball.infieldFly)) {
        releaseTagUps(settings, ball, runners, (runner, next) => {
          const target = next === 4 ? "home" : (next as 1 | 2 | 3);
          // Project the existing gather motion through control. Braking can
          // overlap catching; do not charge its full duration a second time.
          const ready = { ...builder.locations },
            velocities = { ...builder.velocities };
          for (const a of builder.assignments) {
            const at = sampleMotion(
              planMotion(
                {
                  position: toWorld(builder.locations[a.player]),
                  velocity: builder.velocities[a.player],
                },
                toWorld(a.reception?.throughPoint ?? a.target),
                assumptions.defenderSpeed,
                assumptions.defenderAcceleration,
                Math.max(
                  0,
                  assumptions.reaction - builder.liveTime,
                  (a.notBefore ?? 0) - builder.liveTime,
                ),
              ),
              assumptions.catchTime,
            );
            ready[a.player] = fromWorld(at.position);
            velocities[a.player] = at.velocity;
          }
          const predicted = runners.map((r) =>
            r.id === "BR"
              ? { ...r, status: "out" as const }
              : r === runner
                ? {
                    ...r,
                    progress: r.originBase,
                    goal: next,
                    runVelocity: 0,
                    startDelay: 0.1,
                    forceRemoved: true,
                  }
                : { ...r, forceRemoved: true },
          );
          const savedMotion = defense.motion;
          defense.motion = (p) => ({
            position: ready[p],
            velocity: velocities[p],
            reaction: 0,
          });
          try {
            const layout = defense.assign(
              settings,
              ball,
              owner,
              target,
              ready,
              "fielded",
              {
                runners: predicted,
                outs: builder.state.outs + (ball.infieldFly ? 0 : 1),
              },
            );
            return defense.arrival(layout, ready, owner);
          } finally {
            defense.motion = savedMotion;
          }
        });
        for (const r of runners)
          if (r.id !== "BR" && !r.retouchBase && r.goal > r.originBase)
            builder.event(
              "RunnerTaggedUp",
              m("tagUpWhy"),
              r.id,
              r.originBase as 1 | 2 | 3,
            );
      }
      builder.interval(
        m(ball.caught ? "phaseCatch" : "phaseGather"),
        m("gatherWhy", { fielder: owner }),
        ball.fieldingTime - touch,
        {
          kind: "held",
          owner,
          secure: false,
          height: sampleTimed(trajectory.frames, touch).height ?? 0,
          endHeight: 0.8,
          gloveOffset: {
            x:
              toWorld(ball.touchPoint!).x - toWorld(builder.locations[owner]).x,
            y:
              toWorld(ball.touchPoint!).y - toWorld(builder.locations[owner]).y,
          },
        },
      );
      stage = "fielded";
      if (ball.caught) {
        builder.event("BallCaught", m("catchOut", { runner: "BR" }), owner);
        builder.retire("BR", 1, false, "catch");
        for (const r of runners) r.forceRemoved = true;
      }
      builder.event("BallFielded", m("fielded", { fielder: owner }), owner);
      ball.status = ball.caught ? "caught" : "fielded";
      ball.fieldingPoint = { ...builder.locations[owner] };
      stage = "fielded";
      if (!ball.caught)
        running.plan(settings, ball, runners, builder.liveTime, true);
    }
    let decision = defense.choose(
      settings,
      ball,
      runners,
      builder.state.outs,
      builder.locations,
    );
    // A throw toward a lead runner can open an extra base for a trailing runner.
    // Preserve committed goals here; retreat is a separate cutoff decision.
    if (!ball.caught && !ball.boundary && decision.target !== "hold") {
      const committed = new Map(runners.map((r) => [r.id, r.goal]));
      running.plan(
        { ...settings, throwTarget: decision.target },
        ball,
        runners,
        builder.liveTime,
        true,
      );
      for (const r of runners) {
        r.goal = Math.max(committed.get(r.id)!, r.goal);
        r.decision =
          r.progress < r.goal
            ? "advance"
            : r.progress > r.goal
              ? "retreat"
              : "hold";
      }
      decision = defense.choose(
        settings,
        ball,
        runners,
        builder.state.outs,
        builder.locations,
      );
    }
    if (ball.boundary || builder.state.outs === 3)
      decision = {
        target: "hold",
        force: false,
        reason: m(
          ball.boundary
            ? ball.boundary === "home-run"
              ? "homeRunWhy"
              : "boundaryDoubleWhy"
            : "catchOut",
          { runner: "BR" },
        ),
        override: false,
        alternatives: [],
      };
    record(decision);
    let additionalOutfieldThrow = true;
    const performThrow = (next: ThrowDecision, directOnly = false, remaining?: RelayStop[], relayCount = 0): void => {
      if (ball.boundary || builder.state.outs >= 3) return;
      const target = next.target;
      activeTarget = target;
      deadlines = {};
      activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
      defense.relayBudget = Math.max(0, throwPhysics.maximumRelays - relayCount);
      defense.continuation = target !== "hold" && remaining?.length ? { target, stops: remaining } : undefined;
      stage = directOnly ? "received" : "fielded";
      reassess("Ball secured / throwing target selected");
      if (target === "hold") {
        builder.interval("Field & decide", next.reason, 0.4, {
          kind: "held",
          owner,
        });
        return;
      }
      const plan = layout;
      lockedCutoff = plan.cutoff;
      lockedReceiver = plan.receiver;
      lockedRouteKind = plan.route.kind;
      const receivingAssignment = plan.assignments.find(a => a.player === plan.receiver);
      lockedReception = receivingAssignment?.reception && plan.receiver
        ? { player: plan.receiver, reception: receivingAssignment.reception } : undefined;
      lockedRelays = plan.route.relays?.length ? plan.route.relays : plan.cutoff && plan.route.cutoffPoint
        ? [{ player: plan.cutoff, point: plan.route.cutoffPoint }] : undefined;
      const firstRoute = {
        ...plan,
        route: { ...plan.route, legs: plan.route.legs.slice(0, 1) },
      };
      if (plan.route.legs[0])
        deadlines[plan.route.legs[0]] =
          builder.time + defense.arrival(firstRoute, builder.locations, owner);
      if (plan.receiver && plan.route.kind !== "cutoff-hold")
        deadlines[plan.receiver] =
          builder.time + defense.arrival(plan, builder.locations, owner);
      for (const [i, stop] of (plan.route.relays ?? []).entries())
        deadlines[stop.player] = builder.time + defense.arrival(
          { ...plan, route: { ...plan.route, legs: plan.route.legs.slice(0, i + 1) } }, builder.locations, owner);
      reassess("Throw timing established");
      // A through-cutoff throw travels directly to the base. A relay or a
      // deliberate cutoff-and-hold really changes possession at the cutoff.
      let to = plan.route.legs[0];
      if (!to) return;
      const receiverAssignment = plan.assignments.find((a) => a.player === to)!;
      const destination = receiverAssignment.reception?.catchPoint ?? receiverAssignment.target;
      const carrying = owner === to;
      const release = defense.release(
        owner,
        builder.locations[owner],
        destination,
      );
      let trajectory = throwFlight(
        release.point,
        destination,
        owner,
        settings.armStrength,
      );
      let flight = trajectory.duration;
      let intercepted = false;
      let receivingHeight = throwPhysics.receivingHeight;
      const receiverTime = receiverAssignment.reception?.catchAfter ?? defense.travel(
        to,
        builder.locations[to],
        destination,
      );
      const cutoffWait = 0; // optional through-cutoff alignment never delays a ready base receiver
      const prepare = Math.max(
        release.time,
        carrying ? 0 : receiverTime - flight,
        cutoffWait,
      );
      if (carrying) {
        builder.interval(
          "Field & decide",
          m("carry", { base: target }),
          Math.max(
            0.001,
            defense.travel(owner, builder.locations[owner], bases[target]),
          ),
          { kind: "held", owner },
        );
      } else {
        builder.interval(
          "Field & decide",
          m("prepare", { base: target }),
          prepare,
          { kind: "held", owner },
        );
        const challenged = next.runner && runners.find(r => r.id === next.runner);
        const targetNumber = target === "home" ? 4 : target;
        const expired = challenged && (challenged.status !== "active" ||
          (next.appeal ? challenged.retouchBase !== targetNumber :
            next.force ? !isForced(challenged, runners, targetNumber) :
              challenged.goal < targetNumber || challenged.progress >= targetNumber));
        if (settings.throwTarget === "auto" && expired) {
          // Preparation is still reversible; released flights remain reserved.
          lockedCutoff = undefined; lockedReceiver = undefined;
          lockedRouteKind = undefined; lockedRelays = undefined; deadlines = {};
          lockedReception = undefined;
          activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
          const revised = defense.choose(settings, activeBall, runners,
            builder.state.outs, builder.locations, owner, "received");
          builder.event("ThrowCancelled", m("challengeExpired", { base: target }), owner, target);
          record(revised);
          performThrow(revised, true, undefined, relayCount);
          return;
        }
        // Preparation can include sub-millimetre stopping differences. Start
        // the actual flight at the compiled release, never an old forecast.
        trajectory = throwFlight(builder.locations[owner], destination, owner, settings.armStrength);
        flight = trajectory.duration;
        let samples = throwSamples(builder.locations[owner], destination, trajectory);
        if (settings.throwTarget === "auto" && plan.route.kind === "through-cutoff" && plan.cutoff &&
            relayCount < throwPhysics.maximumRelays && !runners.some(r => r.firstTurn && r.firstTurn.stage !== "complete")) {
          const cutoff = plan.cutoff;
          const point = plan.assignments.find(a => a.player === cutoff)!.target;
          const crossing = cutoffCrossing(builder.locations[owner], destination, point, trajectory);
          if (crossing && defense.travel(cutoff, builder.locations[cutoff], point) <= crossing.time) {
            const projected = structuredClone(runners);
            for (const r of projected) {
              if (r.status !== "active") continue;
              const at = runningAdvance(r, r.goal, crossing.time);
              r.progress = at.progress; r.runVelocity = at.velocity; r.startDelay = at.delay;
              if (r.progress >= 4) r.status = "scored";
            }
            const locations = { ...builder.locations, [cutoff]: point };
            const oldBudget = defense.relayBudget, oldContinuation = defense.continuation;
            defense.relayBudget = Math.max(0, throwPhysics.maximumRelays - relayCount - 1);
            defense.continuation = undefined;
            const read = defense.choose(settings, { ...ball, fieldingPoint: point }, projected,
              builder.state.outs, locations, cutoff, "received");
            defense.relayBudget = oldBudget; defense.continuation = oldContinuation;
            const originalStillAvailable = read.alternatives?.some(c => c.target === target && (c.viable || c.competitive));
            if (read.target !== target && !originalStillAvailable && (read.target === "hold" || !!read.runner)) {
              to = cutoff;
              flight = crossing.time;
              samples = sliceTimed(samples, 0, flight);
              intercepted = true;
              deadlines[cutoff] = builder.time + flight + assumptions.catchTime;
            }
          }
        }
        receivingHeight = samples.at(-1)!.height ?? throwPhysics.receivingHeight;
        builder.event(
          "ThrowStarted",
          m("throw", { from: owner, to }),
          owner,
          target,
        );
        // Reaffirm the support plan at release, preserving this flight's lane.
        activeBall = {
          ...ball,
          fieldingPoint: { ...builder.locations[owner] },
        };
        inFlight = true;
        incomingFrom = { ...builder.locations[owner] };
        reassess("ThrowStarted");
        builder.interval("Throw", m("throw", { from: owner, to }), flight, {
          kind: "travel",
          path: [builder.locations[owner], samples.at(-1)!.point],
          style: "throw",
          receiver: to,
          samples,
        });
        builder.event(
          "ThrowGloveContact",
          m("gloveContact", { player: to, base: target }),
          to,
          target,
        );
        builder.interval(
          "Receive",
          m("received", { player: to, base: target }),
          assumptions.catchTime,
          { kind: "held", owner: to, secure: false, height: receivingHeight, endHeight: throwPhysics.receivingHeight },
        );
      }
      inFlight = false;
      lockedCutoff = undefined;
      lockedReceiver = undefined;
      lockedRouteKind = undefined;
      lockedRelays = undefined;
      lockedReception = undefined;
      owner = to;
      if (intercepted)
        builder.event("CutoffIntercepted", m("cutoffIntercepted", { player: owner }), owner, target);
      builder.event(
        carrying ? "BaseTouched" : "ThrowReceived",
        m(carrying ? "carry" : "throwSecured", { player: owner, base: target }),
        owner,
        target,
      );
      if (!carrying && receiverAssignment.reception) {
        if (metres(builder.locations[owner], bases[target]) > 0.02)
          throw new Error("Moving receiver missed the scheduled force-base contact");
        builder.event("BaseTouched", m("baseContact", { player: owner, base: target }), owner, target);
      }
      activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
      stage = "received";
      if ((intercepted || ((plan.route.relays?.some(s => s.player === to) || to === plan.cutoff) && plan.route.kind !== "through-cutoff")) && !carrying) {
        running.reconsider(settings, runners, target, builder.locations[owner]);
        if (plan.route.kind === "cutoff-hold") {
          activeTarget = "hold";
          reassess("Cutoff holds the ball");
          builder.interval("Receive", m("received", { player: owner }), 0.15, {
            kind: "held",
            owner,
          });
          return;
        }
        const remainingStops = (plan.route.relays ?? []).slice(1);
        defense.relayBudget = Math.max(0, throwPhysics.maximumRelays - relayCount - 1);
        defense.continuation = remainingStops.length ? { target, stops: remainingStops } : undefined;
        // The physical read elapses before the decision reference instant.
        // Both runners and defenders advance, then the opportunity is ranked.
        reassess("Relay secured / reading live runners");
        builder.interval("Receive", m("received", { player: owner }), throwPhysics.relayRead, {
          kind: "held", owner,
        });
        activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
        // Read the live runners at every relay receipt. At most two intermediate
        // players may receive this return, including any redirected chain.
        const redirect =
          settings.throwTarget === "auto"
            ? defense.choose(
                settings,
                activeBall,
                runners,
                builder.state.outs,
                builder.locations,
                owner,
                "received",
              )
            : next;
        if (redirect.target !== next.target || redirect.runner !== next.runner)
          record(redirect);
        activeTarget = redirect.target;
        reassess("Relay received / target reconsidered");
        performThrow(redirect, true, redirect.target === target ? remainingStops : undefined, relayCount + 1);
        return;
      }
      // Resolve an immediately available force before allocating new live
      // coverage. A pre-out snapshot at this same instant invents late jobs
      // after a play that has already ended.
      const base = target === "home" ? 4 : target;
      const runner = next.runner
        ? runners.find((r) => r.id === next.runner)
        : runners.find(
            (r) => r.status === "active" && r.goal >= base && r.progress < base,
          );
      if (runner && runner.status === "active") {
        if (next.appeal) {
          if (runner.retouchBase === base && runner.progress > base + 0.00001)
            builder.retire(runner.id, target, false, "appeal");
        } else {
          const force = isForced(runner, runners, base);
          const remaining = baseTouchTime(runner, base);
          const crossing = builder.events.find(
            (e) =>
              e.type === "RunnerAdvanced" &&
              e.player === runner.id &&
              e.base === target,
          );
          const protectedOverrun =
            target === 1 &&
            runner.id === "BR" &&
            runner.progress >= 1 &&
            runner.firstTurn?.kind === "overrun";
          const tagRequired = !force && !protectedOverrun;
          const margin = crossing
            ? crossing.time -
              builder.time -
              (tagRequired ? assumptions.tagTime : 0)
            : remaining - (tagRequired ? assumptions.tagTime : 0);
          if (Math.abs(margin) < assumptions.closeMargin) closePlays++;
          if (tagRequired) {
            const attempting =
              runner.goal >= base && runner.decision !== "retreat";
            const wait =
              attempting && remaining > assumptions.tagTime + 0.02
                ? Math.max(assumptions.tagTime, remaining - 0.08)
                : assumptions.tagTime;
            builder.interval(
              "Receive",
              m("tag", { runner: runner.id, base: target }),
              wait,
              { kind: "held", owner },
            );
          }
          if (
            runner.progress < base - 0.00001 &&
            runner.goal >= base &&
            runner.decision !== "retreat"
          )
            builder.retire(runner.id, target, force);
        }
      }
      reassess("Receive / tag resolved");
      // A base receiver must read the next opportunity too, not only a player
      // labeled Cutoff/Relay. In particular, returning to second must not end
      // the play while a realistic home challenge is still available.
      if (
        settings.throwTarget === "auto" &&
        isOutfieldHit(ball) &&
        builder.state.outs < 3 &&
        additionalOutfieldThrow
      ) {
        const follow = defense.choose(
          settings,
          activeBall,
          runners,
          builder.state.outs,
          builder.locations,
          owner,
          "received",
        );
        if (
          follow.runner &&
          follow.target !== "hold" &&
          follow.target !== target
        ) {
          additionalOutfieldThrow = false;
          record(follow);
          performThrow(follow, true);
          return;
        }
      }
    };
    performThrow(decision);
    const br = runners.find((r) => r.id === "BR")!;
    if (
      ["Ground ball", "Bunt"].includes(settings.ball.type) &&
      !isOutfieldHit(ball) &&
      builder.state.outs > settings.state.outs &&
      builder.state.outs < 3 &&
      br.status === "active" &&
      br.progress < 1 &&
      decision.target !== 1
    ) {
      const currentBall = { ...ball, fieldingPoint: builder.locations[owner] };
      const secondPlan = defense.assign(
        settings,
        currentBall,
        owner,
        1,
        builder.locations,
        "received",
        {
          runners,
          outs: builder.state.outs,
          ballInFlight: inFlight,
          receptionTimes: Object.fromEntries(
            Object.entries(deadlines).map(([p, t]) => [
              p,
              Math.max(0, t! - builder.time),
            ]),
          ),
        },
      );
      const margin =
        baseTouchTime(br, 1) -
        defense.arrival(secondPlan, builder.locations, owner);
      if (margin > -0.35) {
        decision = record({
          target: 1,
          runner: "BR",
          force: true,
          margin,
          reason: m("targetForce"),
          override: false,
        });
        performThrow(decision, true);
      }
    }
    if (builder.state.outs < 3) {
      opportunitiesClosed = true;
      activeTarget = "hold";
      deadlines = {};
      activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
      stage = "received";
      reassess("Runners finishing / no further throw");
      // A live runner can still need coverage, but a throw that has already
      // arrived no longer needs a defender to finish a distant backup route.
      builder.assignments = builder.assignments.map((a) => {
        if (
          ![
            "BackupThrow",
            "BackupFielder",
            "SupportBase",
            "TrailRunner",
            "RecoverPosition",
          ].includes(a.type)
        )
          return a;
        const speed = Math.hypot(
          builder.velocities[a.player].x,
          builder.velocities[a.player].y,
        );
        return {
          ...a,
          type:
            speed > 1e-8 ? ("Decelerate" as const) : ("HoldPosition" as const),
          reason: speed > 1e-8 ? ("braking" as const) : ("guardSpace" as const),
          target:
            speed > 1e-8
              ? defense.release(a.player, builder.locations[a.player]).point
              : builder.locations[a.player],
          base: undefined,
          teammate: undefined,
          throwOrigin: undefined,
          receivingPoint: undefined,
          neededBy: undefined,
        };
      });
      const held = () =>
        ball.boundary
          ? {
              kind: "travel" as const,
              style: "hit" as const,
              dead: true,
              path: [ball.fieldingPoint, ball.fieldingPoint],
            }
          : { kind: "held" as const, owner };
      let lateThrowsRemaining = 2;
      for (let pass = 0; pass < 32; pass++) {
        if (builder.state.outs >= 3) break;
        if (
          !ball.boundary &&
          settings.throwTarget === "auto" &&
          lateThrowsRemaining > 0
        ) {
          const freshBall = {
            ...ball,
            fieldingPoint: builder.locations[owner],
          };
          const next = defense.choose(
            settings,
            freshBall,
            runners,
            builder.state.outs,
            builder.locations,
            owner,
            "received",
          );
          if (
            next.target === "hold" &&
            (holdingDecisions.at(-1)?.time ?? -1) <
              (decisions.at(-1)?.time ?? 0)
          )
            holdingDecisions.push({ ...next, time: builder.time, owner });
          if (next.runner && next.target !== "hold") {
            opportunitiesClosed = false;
            record(next);
            performThrow(next);
            lateThrowsRemaining--;
            opportunitiesClosed = true;
            activeTarget = "hold";
            deadlines = {};
            activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
            stage = "received";
            reassess("Runner event / renewed opportunity resolved");
            if (builder.state.outs >= 3) break;
          }
        }
        const remaining = Math.max(
          0,
          ...runners
            .filter((r) => r.status === "active" || r.retiredRunThrough)
            .map(remainingRunningTime),
          // Completing R1's advance to second must not cancel an already-live
          // recovery of third. Finish that receiving route, not obsolete
          // backups, before declaring the sacrifice play complete.
          ...builder.assignments
            .filter((a) => a.reason === "buntRecoverThird")
            .map((a) =>
              defense.travel(a.player, builder.locations[a.player], a.target),
            ),
        );
        if (remaining < 0.00001) break;
        builder.interval(
          "Hold the ball",
          ball.boundary
            ? m(
                ball.boundary === "home-run"
                  ? "homeRunWhy"
                  : "boundaryDoubleWhy",
              )
            : m("settle"),
          remaining,
          held(),
          true,
          false,
          true,
        );
        if (pass === 31) throw new Error("Runner resolution did not converge");
      }
      const settle = Math.max(
        0,
        ...Object.values(builder.velocities).map(
          (v) => Math.hypot(v.x, v.y) / assumptions.defenderAcceleration,
        ),
      );
      if (settle > 0.00001 && builder.state.outs < 3) {
        builder.assignments = builder.assignments.map((a) => {
          const speed = Math.hypot(
            builder.velocities[a.player].x,
            builder.velocities[a.player].y,
          );
          return {
            ...a,
            type:
              speed > 1e-8
                ? ("Decelerate" as const)
                : a.player === owner && !ball.boundary
                  ? ("PossessBall" as const)
                  : ("HoldPosition" as const),
            reason:
              speed > 1e-8
                ? ("braking" as const)
                : a.player === owner && !ball.boundary
                  ? ("possession" as const)
                  : ("complete" as const),
            target:
              speed > 1e-8
                ? defense.release(a.player, builder.locations[a.player]).point
                : builder.locations[a.player],
            throwOrigin: undefined,
            receivingPoint: undefined,
            neededBy: undefined,
            base: undefined,
            teammate: undefined,
            arrivalTime: speed / assumptions.defenderAcceleration,
          };
        });
        builder.interval("Hold the ball", m("settle"), settle, held());
      }
    }
    if (builder.state.outs === 3) {
      const stopTime = Math.max(
        0,
        ...Object.values(builder.velocities).map(
          (v) => Math.hypot(v.x, v.y) / assumptions.defenderAcceleration,
        ),
      );
      if (stopTime > 1e-5) {
        builder.assignments = builder.assignments.map((a) => {
          const speed = Math.hypot(
            builder.velocities[a.player].x,
            builder.velocities[a.player].y,
          );
          return {
            ...a,
            type:
              speed > 1e-8
                ? ("Decelerate" as const)
                : a.player === owner
                  ? ("PossessBall" as const)
                  : ("HoldPosition" as const),
            reason: speed > 1e-8 ? ("braking" as const) : ("complete" as const),
            target:
              speed > 1e-8
                ? defense.release(a.player, builder.locations[a.player]).point
                : builder.locations[a.player],
            base: undefined,
            throwOrigin: undefined,
            receivingPoint: undefined,
            teammate: undefined,
          };
        });
        builder.interval(
          m("phaseDecelerate"),
          m("postPlayBrakingWhy"),
          stopTime,
          { kind: "held", owner },
          false,
          true,
        );
      }
    }
    builder.state.runs = builder.forceThird ? 0 : builder.pendingRuns;
    if (builder.state.outs === 3) builder.state.runners = {};
    const scoreKey = settings.state.half === "top" ? "awayScore" : "homeScore";
    builder.state[scoreKey] =
      (settings.state[scoreKey] ?? 0) + builder.state.runs;
    const result = m("outcome", {
      outs: builder.state.outs - settings.state.outs,
      runs: builder.state.runs,
      safe: Object.keys(builder.state.runners).length,
    });
    builder.event("PlayCompleted", result);
    stage = "complete";
    reassess("PlayCompleted");
    builder.interval(
      "Outcome",
      result,
      1,
      ball.boundary
        ? {
            kind: "travel",
            style: "hit",
            dead: true,
            path: [ball.fieldingPoint, ball.fieldingPoint],
          }
        : { kind: "held", owner },
      false,
    );
    return {
      id: "dynamic",
      title: m("title", { fielder: ball.fielder, ball: settings.ball.type }),
      category: "Dynamic simulator",
      description: "",
      objective: decisions[0].reason,
      initial: structuredClone(settings.state),
      ballEvent: {
        type: settings.ball.type,
        direction:
          ball.destination.x < 400
            ? "Left field"
            : ball.destination.x > 600
              ? "Right field"
              : "Centre field",
        location: settings.ball.destination,
        outcome: ball.caught
          ? "caught"
          : isOutfieldHit(ball)
            ? "hit"
            : "fielded",
      },
      startingPositions,
      phases: builder.phases,
      result,
      notes: [
        m("model", {
          baseMetres: assumptions.baseMetres,
          cornerMetres: assumptions.field.cornerMetres,
          centreMetres: assumptions.field.centreMetres,
        }),
        m("convention"),
        m("physicsNote", {
          wallHeight: fieldConfiguration(settings).fenceHeight,
        }),
        ...(fieldConfiguration(settings).fenceMode === "keep-in-play"
          ? [m("trainingFenceWhy")]
          : []),
        ...(trajectory.launch.adjusted ? [m("trajectoryLimit")] : []),
        ...(closePlays ? [m("close")] : []),
        ...(builder.forceThird
          ? [
              m(
                builder.thirdOutReason === "catch"
                  ? "catchThirdResult"
                  : "forceResult",
              ),
            ]
          : []),
      ],
      alternatives: [m("alternative")],
      notation: "",
      dynamic: {
        holdingDecisions,
        airborneReads,
        terminationReason:
          builder.state.outs === 3
            ? "third-out"
            : ball.boundary
              ? "boundary-award"
              : "no-remaining-defensive-opportunity",
        modelVersion: trajectory.version,
        contactTime: builder.events.find((e) => e.type === "BallContact")!.time,
        settings,
        ball,
        events: builder.events,
        decisions,
        closePlays,
        diagnostics,
        convention: m("convention"),
      },
    };
  }
}
export { recommendStrategy };
