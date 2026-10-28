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
import { bases, toward, interpolate, metres } from "./geometry";
import {
  advanceProgress,
  runnerRoute,
  runningTime,
  turnTime,
  turnSpeed,
  firstTurnPoint,
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
  assignments: DefensiveAssignment[] = [];
  state: GameState;
  locations: Record<string, Point>;
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
          r.retiredRunThrough
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
        support: m("runnerNext"),
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
  ) {
    let remaining = Math.max(0.001, round(duration)),
      elapsed = 0;
    const whole = remaining;
    const journeyId = `flight-${this.phases.length}`;
    while (remaining > 0.0000001) {
      let dt = remaining;
      if (run && this.state.outs < 3)
        for (const r of this.runners) {
          if (r.status !== "active" && !r.retiredRunThrough) continue;
          if (r.firstTurn && r.firstTurn.stage !== "complete" && r.goal === 1) {
            dt = Math.min(dt, turnTime(r));
            continue;
          }
          if (Math.abs(r.progress - r.goal) < 0.000001) continue;
          const next =
            r.goal > r.progress
              ? Math.min(r.goal, Math.floor(r.progress + 0.000001) + 1)
              : Math.max(r.goal, Math.ceil(r.progress - 0.000001) - 1);
          dt = Math.min(dt, runningTime(r, next));
        }
      dt = Math.max(0.000001, Math.min(remaining, round(dt)));
      for (const a of this.assignments) a.explanation = assignmentText(a).why;
      const movements: PlayPhase["movements"] = [];
      for (const assignment of title === "Ready" || this.state.outs === 3
        ? []
        : this.assignments) {
        const from = this.locations[assignment.player],
          to = toward(from, assignment.target, assumptions.defenderSpeed * dt);
        if (metres(from, to) > 0.00001)
          movements.push({ player: assignment.player, path: [from, to] });
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
            if (turn.stage === "outbound") {
              turn.travelled = Math.min(
                turn.extent,
                turn.travelled + turnSpeed(r) * dt,
              );
              if (turn.travelled >= turn.extent - 1e-5) {
                if (r.retiredRunThrough) {
                  turn.stage = "complete";
                  next.retiredRunThrough = false;
                } else turn.stage = "read";
              }
            } else if (turn.stage === "read") {
              turn.readRemaining = Math.max(0, turn.readRemaining - dt);
              if (turn.readRemaining < 1e-5) {
                turn.stage = "return";
                next.decision = "retreat";
              }
            } else {
              turn.travelled = Math.max(
                0,
                turn.travelled - assumptions.firstBase.returnSpeed * dt,
              );
              if (turn.travelled < 1e-5) {
                turn.travelled = 0;
                turn.stage = "complete";
                next.decision = "hold";
              }
            }
            next.progress =
              turn.kind === "round"
                ? 1 + turn.travelled / assumptions.baseMetres
                : 1;
            const end = firstTurnPoint(next);
            if (metres(before, end) > 1e-6)
              movements.push({ player: r.id, path: [before, end] });
            if (turn.kind === "round" && turn.stage !== "complete")
              delete this.state.runners[r.id];
          } else {
            next.progress = advanceProgress(r, r.goal, r.speed * dt);
            if (Math.abs(next.progress - r.progress) > 1e-8) {
              movements.push({
                player: r.id,
                path: runnerRoute(r, r.progress, next.progress),
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
              path: [
                interpolate(ball.path, elapsed / whole),
                interpolate(ball.path, Math.min(1, (elapsed + dt) / whole)),
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
                  ? "held"
                  : portion.style === "throw"
                    ? "throwing"
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
        r.retiredRunThrough = next.retiredRunThrough;
        r.progress = round(next.progress);
        if (Math.abs(r.progress - Math.round(r.progress)) < 0.00001)
          r.progress = Math.round(r.progress);
        if (r.firstTurn?.stage === "complete" && previousTurn !== "complete") {
          if (r.status === "out") {
            this.event("RunThroughAfterOut", m("runnerFinishOut"), r.id, 1);
            crossedBase = true;
            continue;
          }
          this.state.runners[r.id] = 1;
          this.event("RunnerReturned", m("runnerReturnFirst"), r.id, 1);
          crossedBase = true;
          continue;
        }
        if (r.progress !== before && Number.isInteger(r.progress)) {
          crossedBase = true;
          if (r.retiredRunThrough && r.progress === 1) {
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
          if (r.decision === "retreat") {
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
                extent:
                  kind === "round"
                    ? assumptions.firstBase.roundMetres
                    : assumptions.firstBase.overrunMetres,
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
      }
      if (crossedBase || readChanged)
        this.reassess?.(
          crossedBase
            ? "RunnerAdvanced or RunnerRetreated"
            : "First-base read/return",
        );
    }
  }
  retire(runner: Runner, base: Base, force: boolean) {
    const r = this.runners.find((r) => r.id === runner)!;
    if (r.status !== "active" || this.state.outs >= 3) return;
    r.status = "out";
    delete this.state.runners[r.id];
    this.state.outs++;
    if (
      runner === "BR" &&
      base === 1 &&
      r.progress < 1 &&
      this.state.outs < 3
    ) {
      r.retiredRunThrough = true;
      r.goal = 1;
    }
    this.event(
      "RunnerOut",
      m(force ? "forceOut" : "tagOut", { runner, base }),
      runner,
      base,
      force,
    );
    if (this.state.outs === 3) {
      this.forceThird = force || (runner === "BR" && base === 1);
      this.state.runners = {};
      if (!this.forceThird)
        this.pendingRuns = this.events.filter(
          (e) => e.type === "RunScored" && e.time < this.time - 0.000001,
        ).length;
      if (this.forceThird && this.pendingRuns) {
        this.event("RunDisallowed", m("forceResult"));
        this.pendingRuns = 0;
      }
    }
    this.reassess?.("RunnerOut");
  }
}
