import { describe, it, expect } from "vitest";
import { DynamicPlayProvider, defaultSettings } from "../dynamic/provider";
import { validateScenario } from "../simulation/scenarioValidation";
import { sample, duration } from "../simulation/timeline";
import { positions } from "../simulation/types";
import { assumptions } from "../dynamic/conventions";
import { ballPhysics } from "../dynamic/trajectory";
import { metres } from "../dynamic/geometry";
import { formatDynamic } from "../dynamic/messages";
const provider = new DynamicPlayProvider();
describe("physical and baseball invariants across 576 trajectories", () => {
  it.each(
    (["Ground ball", "Line drive", "Fly ball"] as const).flatMap((type) =>
      Array.from({ length: 8 }, (_, mask) => [type, mask] as const),
    ),
  )(
    "validates all nine and all out states for %s, occupancy mask %s",
    (type, mask) => {
      const points =
        type === "Ground ball"
          ? [
              [396, 473],
              [610, 430],
              [80, 340],
              [920, 340],
            ]
          : type === "Line drive"
            ? [
                [425, 350],
                [170, 430],
                [670, 340],
                [530, 200],
              ]
            : [
                [390, 390],
                [500, 100],
                [890, 360],
                [500, 15],
              ];
      for (let outs = 0; outs < 3; outs++)
        for (const [x, y] of points)
          for (const strength of ["normal", "hard"] as const) {
            const c = defaultSettings();
            c.state.runners = Object.fromEntries(
              [1, 2, 3]
                .filter((n) => mask & (1 << (n - 1)))
                .map((n) => [`R${n}`, n]),
            );
            c.state.outs = outs;
            c.ball = { type, strength, destination: { x, y } };
            c.aggression = "aggressive";
            const s = provider.generate(c),
              label = `${type} ${x},${y} ${strength} mask ${mask} outs ${outs}`;
            expect(validateScenario(s), label).toEqual([]);
            for (const p of s.phases) {
              expect(
                new Set(p.assignments!.map((a) => a.player)),
                label,
              ).toEqual(new Set(positions));
              for (const a of p.assignments!)
                expect(a.priority, label).toBeGreaterThan(0);
              for (const r of Object.values(p.responsibilities))
                for (const text of Object.values(r))
                  expect(formatDynamic(text, "ja"), label).toMatch(
                    /[ぁ-んァ-ヶ一-龯]/,
                  );
            }
            const touch = s.dynamic.events.find(
              (e) => e.type === "BallTouched",
            );
            if (touch) {
              const snap = sample(s, touch.time),
                fielder = snap.players.find(
                  (p) => p.id === s.dynamic.ball.fielder,
                )!;
              expect(
                metres(snap.ball, fielder.position),
                label,
              ).toBeLessThanOrEqual(assumptions.fieldingReach + 0.006);
              expect(snap.ballHeight, label).toBeLessThanOrEqual(
                ballPhysics.maximumCatchHeight + 0.001,
              );
            }
            if (s.dynamic.ball.caught) {
              const contact = s.dynamic.ball.trajectory!.events.find(
                (e) => e.type === "landing" || e.type === "wall",
              );
              expect(s.dynamic.ball.touchTime!, label).toBeLessThan(
                contact?.t ?? Infinity,
              );
              expect(
                s.dynamic.events.filter(
                  (e) => e.type === "RunnerOut" && e.player === "BR",
                ),
                label,
              ).toHaveLength(1);
            }
            if (s.dynamic.ball.boundary)
              expect(
                s.dynamic.events.some((e) => e.type === "ThrowStarted"),
                label,
              ).toBe(false);
            const middle = sample(s, duration(s) * 0.417);
            sample(s, duration(s));
            sample(s, 0);
            expect(sample(s, duration(s) * 0.417), label).toEqual(middle);
          }
    },
    30000,
  );
});
