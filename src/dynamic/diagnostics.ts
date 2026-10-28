import { sample, duration } from "../simulation/timeline";
import { positions } from "../simulation/types";
import { assumptions } from "./conventions";
import { metres } from "./geometry";
import { assignmentText } from "./defense";
import { formatDynamic } from "./messages";
import type { DynamicScenario } from "./types";
import { ballPhysics } from "./trajectory";
import { sampleTimed } from "../simulation/timedPath";
/** Developer API: pure JSON, no production UI or browser global. Times include
 * the one-second Ready phase, just like playback and recorded events. */
export function inspectDefense(scenario: DynamicScenario, requestedTime = 0) {
  const time = Math.max(0, Math.min(duration(scenario), requestedTime));
  const snapshot = sample(scenario, time);
  const frame = scenario.dynamic.diagnostics
    .filter((f) => f.time <= time)
    .at(-1)!;
  const decision = scenario.dynamic.decisions
    .filter((d) => (d.time ?? 0) <= time)
    .at(-1);
  const translate = (text: string) => formatDynamic(text, "en") ?? text;
  return {
    time,
    contactTime:
      scenario.dynamic.events.find((e) => e.type === "BallContact")?.time ?? 1,
    timeSinceContact: Math.max(
      0,
      time -
        (scenario.dynamic.events.find((e) => e.type === "BallContact")?.time ??
          1),
    ),
    model: {
      version: ballPhysics.version,
      parameters: assumptions,
      ballPhysics,
      calibration:
        "Provisional coaching profiles; no published population-average claim.",
    },
    timingLedger: {
      contact: scenario.dynamic.events.find((e) => e.type === "BallContact")
        ?.time,
      firstTouch: scenario.dynamic.events.find(
        (e) => e.type === "BallTouched" || e.type === "BallBoundary",
      )?.time,
      secured: scenario.dynamic.events.find((e) => e.type === "BallFielded")
        ?.time,
      initialReaction: assumptions.reaction,
      interceptionCandidates: scenario.dynamic.ball.candidates ?? [],
      rejectedInterceptors: positions
        .filter(
          (p) => !scenario.dynamic.ball.candidates?.some((c) => c.player === p),
        )
        .map((player) => ({
          player,
          reason: "No reachable, controllable point before the boundary.",
        })),
      throws: scenario.dynamic.events
        .filter((e) => e.type === "ThrowStarted")
        .map((e) => {
          const glove = scenario.dynamic.events.find(
            (v) => v.type === "ThrowGloveContact" && v.time >= e.time,
          );
          const secured = scenario.dynamic.events.find(
            (v) => v.type === "ThrowReceived" && v.time >= e.time,
          );
          return {
            release: e.time,
            glove: glove?.time,
            secured: secured?.time,
            from: e.player,
            target: e.base,
            flight: glove ? glove.time - e.time : undefined,
            receivingControl:
              glove && secured ? secured.time - glove.time : undefined,
          };
        }),
      baseTouches: scenario.dynamic.events
        .filter(
          (e) =>
            e.type === "RunnerAdvanced" ||
            e.type === "RunnerBaseTouch" ||
            e.type === "RunnerTaggedUp" ||
            e.type === "RunnerOut",
        )
        .map((e) => ({
          type: e.type,
          player: e.player,
          base: e.base,
          timeSinceContact: e.time - 1,
          force: e.force,
        })),
    },
    phase: snapshot.phase.title,
    state: snapshot.state,
    settings: scenario.dynamic.settings,
    fieldDimensions: {
      baseMetres: assumptions.baseMetres,
      ...assumptions.field,
    },
    runners: frame.runners.map((r) => ({
      ...r,
      position: snapshot.players.find((p) => p.id === r.id)?.position,
      instruction: r.plan ? translate(r.plan.reason) : undefined,
    })),
    ball: {
      ...scenario.dynamic.ball,
      position: snapshot.ball,
      height: snapshot.ballHeight ?? 0,
      unobstructedPrediction: scenario.dynamic.ball.trajectory
        ? sampleTimed(
            scenario.dynamic.ball.trajectory.frames,
            Math.max(0, time - 1),
          )
        : undefined,
      owner: snapshot.owner,
      status: snapshot.state.ballStatus,
      selectedPrimaryFielder: scenario.dynamic.ball.boundary
        ? undefined
        : scenario.dynamic.ball.fielder,
      boundaryTracker: scenario.dynamic.ball.boundary
        ? scenario.dynamic.ball.fielder
        : undefined,
      destinationMetresFromHome: metres(
        scenario.dynamic.ball.origin,
        scenario.dynamic.ball.destination,
      ),
    },
    preferredThrow: decision
      ? { ...decision, reason: translate(decision.reason) }
      : {
          target: frame.target,
          reason:
            "Anticipated at contact; reevaluated when the ball is secured.",
        },
    alternativeTargets: decision?.alternatives ?? [],
    route: frame.route,
    lastReassessment: { time: frame.time, trigger: frame.trigger },
    assignments: positions.map((player) => {
      const a = snapshot.phase.assignments!.find((a) => a.player === player)!;
      const position = snapshot.players.find((p) => p.id === player)!.position;
      const text = assignmentText(a);
      return {
        ...a,
        position,
        hasBall: snapshot.owner === player,
        remainingMetres: metres(position, a.target),
        explanation: translate(a.explanation),
        instruction: Object.fromEntries(
          Object.entries(text).map(([key, value]) => [key, translate(value)]),
        ),
      };
    }),
    coverageIssues: frame.issues,
    // Review all events and assignment transitions without stepping the UI.
    reassessments: scenario.dynamic.diagnostics,
    events: scenario.dynamic.events.map((e) => ({
      ...e,
      explanation: translate(e.explanation),
    })),
  };
}
