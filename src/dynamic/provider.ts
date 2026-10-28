import {
  advanceProgress,
  runningTime,
  remainingRunningTime,
} from "./runningGeometry";
import type {
  BallEvent,
  Base,
  GameState,
  PlayProvider,
  Point,
  Position,
} from "../simulation/types";
import { MovementEngine } from "./movement";
import { BaserunningDecisionEngine } from "./baserunning";
import { DefensiveDecisionEngine, isForced } from "./defense";
import { TimelineBuilder } from "./timelineBuilder";
import { assumptions, recommendStrategy } from "./conventions";
import { bases, isPlayable, isOutfield, metres, runnerPoint } from "./geometry";
import { message as m } from "./messages";
import type {
  DynamicScenario,
  DynamicSettings,
  ThrowDecision,
  DefensiveAuditFrame,
} from "./types";
export function defaultSettings(): DynamicSettings {
  return {
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
      type: "Base hit",
      destination: { x: 790, y: 290 },
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
    !isPlayable(settings.ball.destination) ||
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
  if (!["Ground ball", "Base hit"].includes(settings.ball.type))
    return m("unsupported");
  if (
    settings.ball.type === "Base hit" &&
    !isOutfield(settings.ball.destination)
  )
    return m("infieldHit");
  if (
    !["soft", "normal", "hard"].includes(settings.ball.strength) ||
    !["conservative", "normal", "aggressive"].includes(settings.aggression) ||
    !["slow", "average", "fast"].includes(settings.runnerSpeed) ||
    !["standard", "prevent", "conservative"].includes(s.strategy) ||
    !["auto", "hold", "cutoff", "home", 1, 2, 3].includes(settings.throwTarget)
  )
    return m("invalid");
}
export class DynamicPlayProvider implements PlayProvider {
  constructor(public settings: DynamicSettings = defaultSettings()) {}
  resolve(
    state: GameState,
    event: Pick<BallEvent, "type" | "direction"> & Partial<BallEvent>,
  ) {
    if (!event.location || !["Ground ball", "Base hit"].includes(event.type))
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
    let closePlays = 0,
      owner = ball.fielder,
      inFlight = false;
    running.plan(settings, ball, runners, 0, true);
    // Anticipate from the same decision rules, using projected runner positions.
    // This gets backups moving at contact rather than after the throw is released.
    const forecast = structuredClone(runners);
    for (const r of forecast) {
      r.progress = advanceProgress(r, r.goal, ball.fieldingTime * r.speed);
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
    let activeBall = ball;
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
        receptionTimes: Object.fromEntries(
          Object.entries(deadlines).map(([p, t]) => [
            p,
            Math.max(0, t! - builder.time),
          ]),
        ),
      },
    );
    const reassess = (trigger: string) => {
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
            ballStatus: inFlight
              ? "throwing"
              : stage === "contact"
                ? builder.time < 1
                  ? "ready"
                  : "rolling"
                : stage === "complete"
                  ? "complete"
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
    const ballArrival =
      (ball.travelTime * metres(bases.home, ball.fieldingPoint)) /
      metres(bases.home, ball.destination);
    builder.interval("Contact", m("contact", { fielder: owner }), ballArrival, {
      kind: "travel",
      path: [bases.home, ball.fieldingPoint],
      style: "hit",
    });
    builder.interval(
      "Retrieve & align",
      m("retrieve", { fielder: owner }),
      Math.max(0.001, ball.fieldingTime - ballArrival),
      {
        kind: "travel",
        path: [ball.fieldingPoint, ball.fieldingPoint],
        style: "hit",
        receiver: owner,
      },
    );
    builder.event("BallFielded", m("fielded", { fielder: owner }), owner);
    ball.status = "fielded";
    stage = "fielded";
    running.plan(settings, ball, runners, builder.liveTime, true);
    let decision = defense.choose(
      settings,
      ball,
      runners,
      builder.state.outs,
      builder.locations,
    );
    // A throw toward a lead runner can open an extra base for a trailing runner.
    // Preserve committed goals here; retreat is a separate cutoff decision.
    if (decision.target !== "hold") {
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
    record(decision);
    let additionalOutfieldThrow = true;
    const performThrow = (next: ThrowDecision, directOnly = false): void => {
      const target = next.target;
      activeTarget = target;
      deadlines = {};
      activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
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
      reassess("Throw timing established");
      // A through-cutoff throw travels directly to the base. A relay or a
      // deliberate cutoff-and-hold really changes possession at the cutoff.
      const to = plan.route.legs[0];
      if (!to) return;
      const destination = plan.assignments.find((a) => a.player === to)!.target;
      const carrying = owner === to;
      const flight =
        metres(builder.locations[owner], destination) / assumptions.throwSpeed +
        assumptions.catchTime;
      const receiverTime =
        metres(builder.locations[to], destination) / assumptions.defenderSpeed;
      const cutoffWait =
        plan.route.kind === "through-cutoff" && plan.cutoff
          ? metres(builder.locations[plan.cutoff], plan.route.cutoffPoint!) /
              assumptions.defenderSpeed -
            metres(builder.locations[owner], plan.route.cutoffPoint!) /
              assumptions.throwSpeed
          : 0;
      const prepare = Math.max(
        assumptions.transfer,
        carrying ? 0 : receiverTime - flight,
        cutoffWait,
      );
      builder.interval(
        "Field & decide",
        m(carrying ? "carry" : "prepare", { base: target }),
        prepare,
        { kind: "held", owner },
      );
      if (carrying) {
        builder.interval(
          "Field & decide",
          m("carry", { base: target }),
          Math.max(
            0.12,
            metres(builder.locations[owner], bases[target]) /
              assumptions.defenderSpeed,
          ),
          { kind: "held", owner },
        );
      } else {
        builder.event(
          "ThrowStarted",
          m("throw", { from: owner, to }),
          owner,
          target,
        );
        // Reaffirm the support plan at release, preserving this flight's lane.
        inFlight = true;
        reassess("ThrowStarted");
        builder.interval("Throw", m("throw", { from: owner, to }), flight, {
          kind: "travel",
          path: [builder.locations[owner], destination],
          style: "throw",
          receiver: to,
        });
      }
      inFlight = false;
      owner = to;
      builder.event(
        carrying ? "BaseTouched" : "ThrowReceived",
        m(carrying ? "carry" : "received", { player: owner, base: target }),
        owner,
        target,
      );
      activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
      stage = "received";
      if (to === plan.cutoff && plan.route.kind !== "through-cutoff") {
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
        // One long relay, followed by a direct final leg. The relay can redirect
        // or hold when the original out has disappeared; no arbitrary extra relay.
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
        builder.interval("Receive", m("received", { player: owner }), 0.15, {
          kind: "held",
          owner,
        });
        performThrow(redirect, true);
        return;
      }
      reassess("Base receiver has possession");
      const base = target === "home" ? 4 : target;
      const runner = next.runner
        ? runners.find((r) => r.id === next.runner)
        : runners.find(
            (r) => r.status === "active" && r.goal >= base && r.progress < base,
          );
      if (runner && runner.status === "active") {
        const force = isForced(runner, runners, base);
        const remaining = runningTime(runner, base);
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
      reassess("Receive / tag resolved");
      // A base receiver must read the next opportunity too, not only a player
      // labeled Cutoff/Relay. In particular, returning to second must not end
      // the play while a realistic home challenge is still available.
      if (
        settings.throwTarget === "auto" &&
        isOutfield(ball.fieldingPoint) &&
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
      builder.interval("Receive", m("received", { player: owner }), 0.18, {
        kind: "held",
        owner,
      });
    };
    performThrow(decision);
    const br = runners.find((r) => r.id === "BR")!;
    if (
      settings.ball.type === "Ground ball" &&
      !isOutfield(ball.fieldingPoint) &&
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
        runningTime(br, 1) -
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
      activeTarget = "hold";
      deadlines = {};
      activeBall = { ...ball, fieldingPoint: builder.locations[owner] };
      stage = "received";
      reassess("Runners finishing / no further throw");
      const remaining = Math.max(
        0,
        ...runners
          .filter((r) => r.status === "active" || r.retiredRunThrough)
          .map((r) => remainingRunningTime(r)),
      );
      if (remaining > 0.000001)
        builder.interval("Hold the ball", m("settle"), remaining, {
          kind: "held",
          owner,
        });
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
    builder.interval("Outcome", result, 1, { kind: "held", owner }, false);
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
        outcome: settings.ball.type === "Base hit" ? "hit" : "fielded",
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
        ...(closePlays ? [m("close")] : []),
        ...(builder.forceThird ? [m("forceResult")] : []),
      ],
      alternatives: [m("alternative")],
      notation: "",
      dynamic: {
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
