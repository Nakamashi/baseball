import type {
  BallEvent,
  Base,
  GameState,
  PlayProvider,
  Point,
  Position,
} from "../simulation/types";
import { positions } from "../simulation/types";
import { MovementEngine } from "./movement";
import { BaserunningDecisionEngine } from "./baserunning";
import { DefensiveDecisionEngine, ThrowingEngine, isForced } from "./defense";
import { TimelineBuilder } from "./timelineBuilder";
import { assumptions, recommendStrategy } from "./conventions";
import { bases, isPlayable, isOutfield, metres, runnerPoint } from "./geometry";
import { message as m } from "./messages";
import type { DynamicScenario, DynamicSettings, ThrowDecision } from "./types";
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
      defense = new DefensiveDecisionEngine(),
      throwing = new ThrowingEngine();
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
    const decisions: ThrowDecision[] = [];
    let closePlays = 0,
      owner = ball.fielder;
    const provisional =
      settings.throwTarget === "auto" || settings.throwTarget === "cutoff"
        ? settings.state.strategy === "prevent" && settings.state.runners.R3
          ? "home"
          : 2
        : settings.throwTarget;
    let layout = defense.assign(
      settings,
      ball,
      owner,
      provisional,
      builder.locations,
    );
    builder.assignments = layout.assignments;
    builder.interval(
      "Ready",
      m("ready"),
      1,
      { kind: "held", owner: "P" },
      false,
    );
    running.plan(settings, ball, runners, 0, true);
    builder.event("BallContact", m("contact", { fielder: owner }));
    builder.interval(
      "Contact",
      m("contact", { fielder: owner }),
      ball.fieldingTime,
      {
        kind: "travel",
        path: [bases.home, ball.fieldingPoint],
        style: "hit",
        receiver: owner,
      },
    );
    builder.event("BallFielded", m("fielded", { fielder: owner }), owner);
    ball.status = "fielded";
    running.plan(settings, ball, runners, builder.liveTime, true);
    let decision = defense.choose(
      settings,
      ball,
      runners,
      builder.state.outs,
      builder.locations,
    );
    decisions.push(decision);
    const performThrow = (next: ThrowDecision, second = false) => {
      const target = next.target;
      if (target === "hold") return;
      const currentBall = { ...ball, fieldingPoint: builder.locations[owner] };
      layout = defense.assign(
        settings,
        currentBall,
        owner,
        target,
        builder.locations,
        "fielded",
      );
      builder.assignments = layout.assignments;
      const receiver = layout.receiver!;
      let cutoff = second ? undefined : layout.cutoff;
      const legs: Position[] = cutoff ? [cutoff, receiver] : [receiver];
      if (settings.throwTarget === "cutoff" && !second && cutoff) legs.pop();
      for (const to of legs) {
        if (builder.state.outs >= 3) break;
        const destination = builder.assignments.find(
          (a) => a.player === to,
        )!.target;
        const distance = metres(builder.locations[owner], destination);
        const flight =
          distance / assumptions.throwSpeed + assumptions.catchTime;
        const receiverTime =
          metres(builder.locations[to], destination) /
          assumptions.defenderSpeed;
        const prepare = Math.max(assumptions.transfer, receiverTime - flight);
        const carrying = owner === to;
        builder.interval(
          "Field & decide",
          m(carrying ? "carry" : "prepare", { base: target }),
          prepare,
          { kind: "held", owner },
        );
        if (!carrying)
          builder.event(
            "ThrowStarted",
            m("throw", { from: owner, to }),
            owner,
            target,
          );
        if (owner === to) {
          builder.assignments.find((a) => a.player === owner)!.target =
            bases[target];
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
        } else
          builder.interval("Throw", m("throw", { from: owner, to }), flight, {
            kind: "travel",
            path: [builder.locations[owner], destination],
            style: "throw",
            receiver: to,
          });
        const previousOwner = builder.assignments.find(
          (a) => a.player === owner,
        );
        if (previousOwner && owner !== to) {
          previousOwner.type = "HoldPosition";
          previousOwner.priority = 20;
          previousOwner.target = builder.locations[owner];
        }
        owner = to;
        builder.event(
          carrying ? "BaseTouched" : "ThrowReceived",
          m(carrying ? "carry" : "received", { player: owner, base: target }),
          owner,
          target,
        );
        if (to === cutoff && to !== receiver) {
          running.reconsider(
            settings,
            runners,
            target,
            builder.locations[owner],
          );
          // The cutoff's immediate assignment becomes the next throw, while all base
          // coverage and backups remain attached to their unique players.
          const a = builder.assignments.find((a) => a.player === owner)!;
          a.target = builder.locations[owner];
          builder.interval("Receive", m("received", { player: owner }), 0.15, {
            kind: "held",
            owner,
          });
          continue;
        }
        const base = target === "home" ? 4 : target;
        const runner = next.runner
          ? runners.find((r) => r.id === next.runner)
          : runners.find(
              (r) =>
                r.status === "active" && r.goal >= base && r.progress < base,
            );
        if (runner && runner.status === "active") {
          const force = isForced(runner, runners, base);
          const remaining =
            ((base - runner.progress) * assumptions.baseMetres) / runner.speed;
          const crossing = builder.events.find(
            (e) =>
              e.type === "RunnerAdvanced" &&
              e.player === runner.id &&
              e.base === target,
          );
          const margin = crossing
            ? crossing.time - builder.time - (force ? 0 : assumptions.tagTime)
            : remaining - (force ? 0 : assumptions.tagTime);
          if (Math.abs(margin) < assumptions.closeMargin) closePlays++;
          if (!force) {
            // A tag out requires the runner to enter the receiver's reach. An
            // early throw is not itself a tag. Stop just short of the base only
            // when the receiver had enough time to prepare the tag.
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
        const a = builder.assignments.find((a) => a.player === owner)!;
        a.type = "PrepareForThrow";
        a.target = builder.locations[owner];
        builder.interval("Receive", m("received", { player: owner }), 0.18, {
          kind: "held",
          owner,
        });
      }
    };
    if (decision.target !== "hold") performThrow(decision);
    else {
      builder.assignments = defense.assign(
        settings,
        ball,
        owner,
        "hold",
        builder.locations,
        "fielded",
      ).assignments;
      builder.interval("Field & decide", m("targetHold"), 0.4, {
        kind: "held",
        owner,
      });
    }
    // Attempt a second out only after securing a lead force, and only while there
    // is still time. With two outs initially, the first out ends all live decisions.
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
      const margin =
        ((1 - br.progress) * assumptions.baseMetres) / br.speed -
        throwing.arrival(builder.locations[owner], bases[1]);
      if (margin > -0.35) {
        decision = {
          target: 1,
          runner: "BR",
          force: true,
          margin,
          reason: m("targetForce"),
          override: false,
        };
        decisions.push(decision);
        performThrow(decision, true);
      }
    }
    if (builder.state.outs < 3) {
      const remaining = Math.max(
        0,
        ...runners
          .filter((r) => r.status === "active")
          .map(
            (r) =>
              (Math.abs(r.goal - r.progress) * assumptions.baseMetres) /
              r.speed,
          ),
      );
      if (remaining > 0.001)
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
        m("model"),
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
        convention: m("convention"),
      },
    };
  }
}
export { recommendStrategy };
