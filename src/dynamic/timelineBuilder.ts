import {
  positions,
  type BallAction,
  type Base,
  type GameState,
  type PlayPhase,
  type Point,
  type Position,
  type Responsibility,
  type Runner,
} from "../simulation/types";
import { bases, interpolate, metres, toWorld, fromWorld } from "./geometry";
import {
  planMotion,
  sampleMotion,
  motionSamples,
  zeroVelocity,
  speedPlan,
  sampleSpeed,
} from "./locomotion";
import { sliceTimed } from "../simulation/timedPath";
import {
  advanceProgress,
  runnerRoute,
  runningTime,
  turnTime,
  turnSpeed,
  firstTurnPoint,
  runningAdvance,
  runnerPointAt,
  nextRunnerBoundaryTime,
} from "./runningGeometry";
import { assumptions } from "./conventions";
import { assignmentText, isForced } from "./defense";
import { message as m } from "./messages";
import type {
  DefensiveAssignment,
  OffensiveRunner,
  SimulationEvent,
} from "./types";
const round = (n: number) => Number(n.toFixed(6));
export class TimelineBuilder {
  phases: PlayPhase[] = [];
  events: SimulationEvent[] = [];
  time = 0;
  liveTime = 0;
  pendingRuns = 0;
  forceThird = false;
  thirdOutReason?: "force" | "batter-before-first" | "catch";
  assignments: DefensiveAssignment[] = [];
  state: GameState;
  locations: Record<string, Point>;
  velocities: Record<string, Point> = Object.fromEntries(
    positions.map((p) => [p, zeroVelocity()]),
  );
  runners: OffensiveRunner[];
  reassess?: (trigger: string) => void;
  constructor(
    state: GameState,
    starting: Record<string, Point>,
    runners: OffensiveRunner[],
  ) {
    this.state = structuredClone(state);
    this.locations = structuredClone(starting);
    this.runners = runners;
  }
  event(
    type: SimulationEvent["type"],
    explanation: string,
    player?: SimulationEvent["player"],
    base?: Base,
    force?: boolean,
  ) {
    this.events.push({
      id: `event-${this.events.length}`,
      time: this.time,
      type,
      explanation,
      player,
      base,
      force,
    });
  }
  responsibilities(owner?: Position) {
    const result: Record<string, Responsibility> = {};
    for (const assignment of this.assignments)
      result[assignment.player] = assignmentText(assignment);
    if (
      owner &&
      result[owner] &&
      ["FieldBall", "Cutoff", "Relay"].includes(
        this.assignments.find((a) => a.player === owner)?.type ?? "",
      )
    )
      result[owner] = {
        action: m("ownerAction"),
        why: m("ownerWhy"),
        support: m("fieldNext"),
      };
    for (const r of this.runners) {
      const force = isForced(r, this.runners, r.originBase + 1);
      result[r.id] = {
        action: m(
          r.retouchBase !== undefined
            ? "retouchAction"
            : r.airborneRead === "read"
              ? "airReadAction"
              : r.airborneRead === "tag"
                ? "tagReadyAction"
                : r.retiredRunThrough
                  ? "runnerFinishOut"
                  : r.status === "active" &&
                      r.firstTurn &&
                      r.firstTurn.stage !== "complete" &&
                      r.goal === 1
                    ? r.firstTurn.stage === "return"
                      ? "runnerReturnFirst"
                      : r.firstTurn.kind === "overrun"
                        ? "runnerOverrun"
                        : "runnerRound"
                    : r.status === "out"
                      ? "runnerOut"
                      : r.status === "scored"
                        ? "runnerScored"
                        : r.decision === "retreat"
                          ? "runnerRetreat"
                          : r.progress === r.goal
                            ? "runnerHold"
                            : "runnerAdvance",
          { base: r.goal === 4 ? "home" : r.goal },
        ),
        why: r.retiredRunThrough
          ? m("runnerFinishOutWhy")
          : force
            ? m("runnerForce")
            : r.firstTurn && r.firstTurn.stage !== "complete" && r.goal === 1
              ? m(
                  r.firstTurn.kind === "overrun"
                    ? "runnerOverrunWhy"
                    : "runnerRoundWhy",
                )
              : (r.plan?.reason ?? m("runnerWhy")),
        support: m(r.status === "out" ? "runnerOut" : "runnerNext"),
      };
    }
    return result;
  }
  // Split at runner base crossings so runners keep their physical speed, and state
  // changes occur exactly at phase boundaries rather than at arbitrary render frames.
  interval(
    title: string,
    explanation: string,
    duration: number,
    ball: BallAction,
    run = true,
    deadDeceleration = false,
    stopOnRunnerEvent = false,
  ) {
    let remaining = Math.max(0.001, round(duration)),
      elapsed = 0;
    const whole = remaining;
    const journeyId = (ball.kind === "travel" && ball.journeyId) || `flight-${this.phases.length}`;
    while (remaining > 0.0000001) {
      let dt = remaining;
      if (run && this.state.outs < 3)
        for (const r of this.runners) {
          if (r.status !== "active" && !r.retiredRunThrough) continue;
          if (r.firstTurn && r.firstTurn.stage !== "complete" && r.goal === 1) {
            dt = Math.min(dt, turnTime(r));
            continue;
          }
          if (
            Math.abs(r.progress - r.goal) < 0.000001 &&
            Math.abs(r.runVelocity ?? 0) < 1e-5
          )
            continue;
          dt = Math.min(dt, nextRunnerBoundaryTime(r, dt));
        }
      dt = Math.max(0.000001, Math.min(remaining, round(dt)));
      for (const a of this.assignments) a.explanation = assignmentText(a).why;
      const movements: PlayPhase["movements"] = [];
      for (const assignment of (!run && !deadDeceleration) ||
      title === "Ready" ||
      (this.state.outs === 3 && !deadDeceleration)
        ? []
        : this.assignments) {
        const from = this.locations[assignment.player];
        const plan = planMotion(
          {
            position: toWorld(from),
            velocity: this.velocities[assignment.player],
          },
          toWorld(assignment.reception?.throughPoint ?? assignment.target),
          assumptions.defenderSpeed,
          assumptions.defenderAcceleration,
          Math.max(
            0,
            assumptions.reaction - this.liveTime,
            (assignment.notBefore ?? 0) - this.liveTime,
          ),
        );
        const end = sampleMotion(plan, dt);
        this.velocities[assignment.player] = end.velocity;
        const samples = motionSamples(plan, dt);
        // Retain sub-millimetre completion too: dropping the last few microns
        // leaves base recovery permanently pending in the finishing loop.
        if (samples.some((p) => metres(from, p.point) > 1e-9))
          movements.push({
            player: assignment.player,
            path: samples.map((p) => p.point),
            samples,
          });
      }
      const nextRunners = new Map<OffensiveRunner, OffensiveRunner>();
      if (run && this.state.outs < 3)
        for (const r of this.runners) {
          if (r.status !== "active" && !r.retiredRunThrough) continue;
          const next: OffensiveRunner = {
            ...r,
            firstTurn: r.firstTurn ? { ...r.firstTurn } : undefined,
          };
          const turn = next.firstTurn;
          if (turn && turn.stage !== "complete" && r.goal === 1) {
            const before = firstTurnPoint(r);
            const returning = turn.stage === "return";
            const plan =
              turn.stage === "read"
                ? undefined
                : speedPlan(
                    returning ? turn.travelled : turn.extent - turn.travelled,
                    Math.max(0, (r.runVelocity ?? 0) * (returning ? -1 : 1)),
                    returning
                      ? assumptions.firstBase.returnSpeed
                      : Math.max(turnSpeed(r), Math.abs(r.runVelocity ?? 0)),
                    assumptions.runnerAcceleration,
                  );
            const at = plan ? sampleSpeed(plan, dt) : { distance: 0, speed: 0 };
            if (turn.stage === "outbound") {
              turn.travelled = Math.min(
                turn.extent,
                turn.travelled + at.distance,
              );
              next.runVelocity = at.speed;
              if (turn.travelled >= turn.extent - 1e-5) {
                next.runVelocity = 0;
                if (r.retiredRunThrough) {
                  turn.stage = "complete";
                  next.retiredRunThrough = false;
                } else turn.stage = "read";
              }
            } else if (turn.stage === "read") {
              next.runVelocity = 0;
              turn.readRemaining = Math.max(0, turn.readRemaining - dt);
              if (turn.readRemaining < 1e-5) {
                turn.stage = "return";
                next.decision = "retreat";
              }
            } else {
              turn.travelled = Math.max(0, turn.travelled - at.distance);
              next.runVelocity = -at.speed;
              if (turn.travelled < 1e-5) {
                turn.travelled = 0;
                turn.stage = "complete";
                next.decision = "hold";
                next.runVelocity = 0;
              }
            }
            next.progress =
              turn.kind === "round"
                ? 1 + turn.travelled / assumptions.baseMetres
                : 1;
            const end = firstTurnPoint(next);
            if (metres(before, end) > 1e-6) {
              const samples = Array.from(
                { length: Math.max(1, Math.ceil(dt * 60)) + 1 },
                (_, i) => {
                  const t = (dt * i) / Math.max(1, Math.ceil(dt * 60));
                  const distance = plan ? sampleSpeed(plan, t).distance : 0;
                  const travelled = Math.max(
                    0,
                    Math.min(
                      turn.extent,
                      r.firstTurn!.travelled +
                        (returning ? -distance : distance),
                    ),
                  );
                  return {
                    t,
                    point: firstTurnPoint({
                      ...r,
                      firstTurn: { ...r.firstTurn!, travelled },
                    }),
                  };
                },
              );
              movements.push({
                player: r.id,
                path: samples.map((p) => p.point),
                samples,
              });
            }
            if (turn.kind === "round" && turn.stage !== "complete")
              delete this.state.runners[r.id];
          } else {
            const at = runningAdvance(r, r.goal, dt);
            next.progress = at.progress;
            next.runVelocity = at.velocity;
            next.startDelay = at.delay;
            if (
              Math.abs(next.progress - r.progress) > 1e-8 ||
              Math.abs(r.runVelocity ?? 0) > 1e-5
            ) {
              const samples = Array.from(
                { length: Math.max(1, Math.ceil(dt * 60)) + 1 },
                (_, i) => {
                  const t = (dt * i) / Math.max(1, Math.ceil(dt * 60));
                  return {
                    t,
                    point: runnerPointAt(
                      r,
                      runningAdvance(r, r.goal, t).progress,
                    ),
                  };
                },
              );
              movements.push({
                player: r.id,
                path: samples.map((p) => p.point),
                samples,
              });
              delete this.state.runners[r.id];
            }
          }
          nextRunners.set(r, next);
        }
      const portion: BallAction =
        ball.kind === "held"
          ? ball
          : {
              ...ball,
              journeyId,
              samples: ball.samples
                ? sliceTimed(
                    ball.samples,
                    elapsed,
                    Math.min(whole, elapsed + dt),
                  )
                : undefined,
              path: [
                ball.samples
                  ? sliceTimed(ball.samples, elapsed, elapsed + dt)[0].point
                  : interpolate(ball.path, elapsed / whole),
                ball.samples
                  ? sliceTimed(ball.samples, elapsed, elapsed + dt).at(-1)!
                      .point
                  : interpolate(ball.path, Math.min(1, (elapsed + dt) / whole)),
              ],
              receiver: remaining - dt < 0.000001 ? ball.receiver : undefined,
            };
      this.phases.push({
        id: `dynamic-phase-${this.phases.length}`,
        assignments: structuredClone(this.assignments),
        title,
        start: this.time,
        duration: dt,
        explanation,
        movements,
        ball: portion,
        responsibilities: this.responsibilities(
          ball.kind === "held" ? (ball.owner as Position) : undefined,
        ),
        state: structuredClone({
          ...this.state,
          phase: title,
          ballStatus:
            title === "Ready"
              ? "ready"
              : title === "Outcome"
                ? "complete"
                : portion.kind === "held"
                  ? portion.secure === false
                    ? "gathering"
                    : "held"
                  : portion.loose
                    ? "loose"
                  : portion.style === "throw"
                    ? "throwing"
                    : portion.dead
                      ? "dead"
                      : (portion.samples?.[0].height ?? 0) > 0.05
                        ? "airborne"
                        : "rolling",
        }),
        statuses: Object.fromEntries(
          this.runners
            .filter((r) => r.status !== "active")
            .map((r) => [r.id, r.status]),
        ),
      });
      for (const move of movements)
        this.locations[move.player] = move.path[move.path.length - 1];
      this.time = round(this.time + dt);
      if (run) this.liveTime += dt;
      remaining = Math.max(0, remaining - dt);
      elapsed += dt;
      let crossedBase = false,
        readChanged = false;
      for (const [r, next] of nextRunners) {
        const before = r.progress;
        const previousTurn = r.firstTurn?.stage;
        r.firstTurn = next.firstTurn;
        if (previousTurn && previousTurn !== r.firstTurn?.stage)
          readChanged = true;
        r.decision = next.decision;
        r.runVelocity = next.runVelocity;
        if (Math.abs(r.runVelocity ?? 0) < 1e-5) r.runVelocity = 0;
        r.startDelay = next.startDelay;
        r.retiredRunThrough = next.retiredRunThrough;
        // A controlled stop at first approaches the bag at zero speed. Keep
        // its physical progress: the normal display-oriented snap tolerance
        // would manufacture an early touch while still braking.
        r.progress = r.errorTurnAtFirst ? next.progress : round(next.progress);
        if (Math.abs(r.progress - Math.round(r.progress)) < (r.errorTurnAtFirst ? 1e-12 : 0.00001))
          r.progress = Math.round(r.progress);
        if (r.firstTurn?.stage === "complete" && previousTurn !== "complete") {
          if (r.status === "out") {
            this.event("RunThroughAfterOut", m("runnerFinishOut"), r.id, 1);
            crossedBase = true;
            continue;
          }
          this.state.runners[r.id] = 1;
          this.event("RunnerReturned", m("runnerReturnFirst"), r.id, 1);
          if (r.afterFirstReturnGoal !== undefined) {
            r.goal = r.afterFirstReturnGoal;
            r.afterFirstReturnGoal = undefined;
            r.firstTurn = undefined;
            r.decision = "advance";
          }
          crossedBase = true;
          continue;
        }
        if (r.progress !== before && Number.isInteger(r.progress)) {
          crossedBase = true;
          if (r.retiredRunThrough && r.progress === 1) {
            this.event("RunnerBaseTouch", m("runnerFinishOut"), r.id, 1);
            r.firstTurn = {
              kind: "overrun",
              stage: "outbound",
              travelled: 0,
              extent: assumptions.firstBase.overrunMetres,
              readRemaining: 0,
            };
            continue;
          }
          const base: Base =
            r.progress === 4 ? "home" : (r.progress as 1 | 2 | 3);
          if (r.retouchBase === r.progress) {
            r.retouchBase = undefined;
            r.runVelocity = 0;
            r.goal = r.afterRetouchGoal ?? r.progress;
            r.afterRetouchGoal = undefined;
            r.decision = r.goal > r.progress ? "advance" : "hold";
            this.event(
              r.goal > r.progress ? "RunnerTaggedUp" : "RunnerRetouched",
              m(r.goal > r.progress ? "tagUpWhy" : "retouchCompleted"),
              r.id,
              base,
            );
          } else if (r.progress < before) {
            r.decision = "hold";
            this.event(
              "RunnerRetreated",
              m("runnerRetreat", { base }),
              r.id,
              base,
            );
          } else
            this.event(
              "RunnerAdvanced",
              m("runnerAdvance", { base }),
              r.id,
              base,
            );
          if (r.progress === 4) {
            r.status = "scored";
            this.pendingRuns++;
            delete this.state.runners[r.id];
            this.event("RunScored", m("runnerScored"), r.id, "home");
          } else if (r.progress === r.goal) {
            r.decision = "hold";
            this.state.runners[r.id] = base;
            if (r.id === "BR" && base === 1 && !r.firstTurn) {
              const kind = r.approach === "round" ? "round" : "overrun";
              r.firstTurn = {
                kind,
                stage: "outbound",
                travelled: 0,
                extent: Math.max(
                  kind === "round"
                    ? assumptions.firstBase.roundMetres
                    : assumptions.firstBase.overrunMetres,
                  (r.runVelocity ?? 0) ** 2 /
                    (2 * assumptions.runnerAcceleration) +
                    0.05,
                ),
                readRemaining: assumptions.firstBase.readTime,
              };
              r.decision = "advance";
              this.event(
                kind === "round" ? "FirstBaseRounded" : "FirstBaseOverrun",
                m(kind === "round" ? "runnerRound" : "runnerOverrun"),
                r.id,
                1,
              );
            }
          }
        }
        if (
          r.status === "active" &&
          r.progress === r.goal &&
          Number.isInteger(r.goal) &&
          r.goal > 0 &&
          r.goal < 4 &&
          r.runVelocity === 0 &&
          (!r.firstTurn || r.firstTurn.stage === "complete")
        )
          this.state.runners[r.id] = r.goal as 1 | 2 | 3;
      }
      if (crossedBase || readChanged)
        this.reassess?.(
          crossedBase
            ? "RunnerAdvanced or RunnerRetreated"
            : "First-base read/return",
        );
      if (stopOnRunnerEvent && (crossedBase || readChanged)) break;
    }
  }
  retire(
    runner: Runner,
    base: Base,
    force: boolean,
    reason?: "catch" | "infield-fly" | "appeal",
  ) {
    const r = this.runners.find((r) => r.id === runner)!;
    if (r.status !== "active" || this.state.outs >= 3) return;
    r.status = "out";
    r.plan = {
      candidates: r.plan?.candidates ?? [],
      reason: m(
        reason === "catch"
          ? "catchOut"
          : reason === "infield-fly"
            ? "infieldFlyWhy"
            : reason === "appeal"
              ? "appealOut"
              : force
                ? "forceOut"
                : "tagOut",
        { runner, base },
      ),
    };
    delete this.state.runners[r.id];
    this.state.outs++;
    if (
      runner === "BR" &&
      base === 1 &&
      r.progress < 1 &&
      !reason &&
      this.state.outs < 3
    ) {
      r.retiredRunThrough = true;
      r.goal = 1;
    }
    this.event(
      "RunnerOut",
      m(
        reason === "catch"
          ? "catchOut"
          : reason === "infield-fly"
            ? "infieldFlyWhy"
            : reason === "appeal"
              ? "appealOut"
              : force
                ? "forceOut"
                : "tagOut",
        { runner, base },
      ),
      runner,
      base,
      force,
    );
    if (this.state.outs === 3) {
      this.forceThird = force || (runner === "BR" && base === 1);
      this.thirdOutReason =
        reason === "catch"
          ? "catch"
          : force
            ? "force"
            : runner === "BR" && base === 1
              ? "batter-before-first"
              : undefined;
      this.state.runners = {};
      if (!this.forceThird)
        this.pendingRuns = this.events.filter(
          (e) => e.type === "RunScored" && e.time < this.time - 0.000001,
        ).length;
      if (this.forceThird && this.pendingRuns) {
        this.event(
          "RunDisallowed",
          m(
            this.thirdOutReason === "catch"
              ? "catchThirdResult"
              : "forceResult",
          ),
        );
        this.pendingRuns = 0;
      }
    }
    this.reassess?.("RunnerOut");
  }
}
