import { sample, duration } from "../simulation/timeline";
import { positions } from "../simulation/types";
import { metres } from "./geometry";
import { assignmentText } from "./defense";
import { formatDynamic } from "./messages";
import type { DynamicScenario } from "./types";
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
    phase: snapshot.phase.title,
    state: snapshot.state,
    settings: scenario.dynamic.settings,
    ball: {
      ...scenario.dynamic.ball,
      position: snapshot.ball,
      owner: snapshot.owner,
      status: snapshot.state.ballStatus,
      selectedPrimaryFielder: scenario.dynamic.ball.fielder,
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
