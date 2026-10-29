import { describe, it, expect } from "vitest";
import { DynamicPlayProvider, defaultSettings } from "../dynamic/provider";
import { BaserunningDecisionEngine } from "../dynamic/baserunning";
import { MovementEngine } from "../dynamic/movement";
import { assumptions } from "../dynamic/conventions";
import {
  bases,
  metres,
  toWorld,
  fromWorld,
  mixPhysical,
} from "../dynamic/geometry";
import { runningTime, pathMetres, legPath } from "../dynamic/runningGeometry";
import { sample, duration } from "../simulation/timeline";
import { validateScenario } from "../simulation/scenarioValidation";
import { formatDynamic } from "../dynamic/messages";
import { inspectDefense } from "../dynamic/diagnostics";
import type { DynamicSettings, DynamicScenario } from "../dynamic/types";
const provider = new DynamicPlayProvider();
function settings(x: number, y: number): DynamicSettings {
  const c = defaultSettings();
  c.state.runners = {};
  c.aggression = "aggressive";
  c.ball = { type: "Ground ball", destination: { x, y }, strength: "hard" };
  return c;
}
function validate(s: DynamicScenario) {
  expect(validateScenario(s)).toEqual([]);
  for (const p of s.phases) {
    const before = sample(s, p.start);
    expect(p.assignments).toHaveLength(9);
    for (const m of p.movements) {
      const start = before.players.find((q) => q.id === m.player)!.position;
      expect(metres(start, m.path[0])).toBeLessThan(0.001);
      const speed = ["BR", "R1", "R2", "R3"].includes(m.player)
        ? assumptions.runnerSpeed[s.dynamic.settings.runnerSpeed]
        : assumptions.defenderSpeed;
      expect(pathMetres(m.path)).toBeLessThanOrEqual(
        speed * p.duration + 0.001,
      );
      // Interpolation is in physical space, not uniform pixels on the schematic.
      const q1 = sample(s, p.start + p.duration * 0.25).players.find(
        (q) => q.id === m.player,
      )!;
      const q3 = sample(s, p.start + p.duration * 0.75).players.find(
        (q) => q.id === m.player,
      )!;
      expect(metres(q1.position, q3.position)).toBeLessThanOrEqual(
        speed * p.duration * 0.5 + 0.002,
      );
    }
    for (const r of Object.values(p.responsibilities))
      for (const text of Object.values(r))
        expect(formatDynamic(text, "ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  }
  const mid = sample(s, duration(s) * 0.46);
  sample(s, duration(s));
  sample(s, 0);
  expect(sample(s, duration(s) * 0.46)).toEqual(mid);
}
describe("home-ground distances and one physical clock", () => {
  it("keeps regulation basepaths and models 90 m corners and 120 m centre", () => {
    for (const [a, b] of [
      [bases.home, bases[1]],
      [bases[1], bases[2]],
      [bases[2], bases[3]],
      [bases[3], bases.home],
    ])
      expect(metres(a, b)).toBeCloseTo(27.43, 6);
    expect(metres(bases.home, { x: 62, y: 332 })).toBeCloseTo(90, 5);
    expect(metres(bases.home, { x: 938, y: 332 })).toBeCloseTo(90, 5);
    expect(metres(bases.home, { x: 500, y: 60 })).toBeCloseTo(120, 5);
    for (const p of [
      bases[1],
      { x: 80, y: 330 },
      { x: 530, y: 134 },
      { x: 830, y: 200 },
    ]) {
      const q = fromWorld(toWorld(p));
      expect(q.x).toBeCloseTo(p.x, 6);
      expect(q.y).toBeCloseTo(p.y, 6);
    }
  });
  it("uses the same running speed for decisions, actual curved paths, and throws", () => {
    const c = settings(920, 330),
      r = new BaserunningDecisionEngine().create(c)[0];
    const b = new MovementEngine().field(c, new MovementEngine().starting(c));
    new BaserunningDecisionEngine().plan(c, b, [r], 0, true);
    expect(pathMetres(legPath(r, 0))).toBeGreaterThan(assumptions.baseMetres);
    const s = provider.generate(c);
    const first = s.dynamic.events.find(
      (e) => e.type === "RunnerAdvanced" && e.player === "BR" && e.base === 1,
    )!;
    expect(first.time - 1).toBeCloseTo(
      runningTime({ ...r, progress: 0 }, 1),
      4,
    );
    validate(s);
  });
  it("keeps a hard ball moving beyond the aim until interception", () => {
    const c = settings(920, 330),
      s = provider.generate(c),
      touch = s.dynamic.events.find((e) => e.type === "BallTouched")!;
    const a = sample(s, 1 + (touch.time - 1) * 0.4),
      b = sample(s, 1 + (touch.time - 1) * 0.7);
    expect(metres(a.ball, b.ball)).toBeGreaterThan(1);
    expect(a.owner).toBeUndefined();
    expect(b.owner).toBeUndefined();
    expect(s.dynamic.ball.trajectory!.events.at(-1)!.type).toBe("stop");
    validate(s);
  });
});
describe("extra-base reads", () => {
  it.each([
    { x: 636, y: 172, speed: "fast" as const },
    { x: 374, y: 291, speed: "average" as const },
    { x: 661, y: 300, speed: "fast" as const },
    { x: 638, y: 174, speed: "fast" as const },
  ])("evaluates a real double window at $x,$y", (point) => {
    const c = settings(point.x, point.y);
    c.ball.type = "Line drive";
    c.runnerSpeed = point.speed;
    const s = provider.generate(c);
    const r = s.dynamic.diagnostics
      .find((f) => f.trigger === "Initial contact plan")!
      .runners.find((r) => r.id === "BR")!;
    expect(r.goal).toBeGreaterThanOrEqual(2);
    expect(r.plan!.candidates.find((p) => p.base === 2)!.accepted).toBe(true);
    expect(
      s.dynamic.events.some(
        (e) => e.type === "RunnerAdvanced" && e.player === "BR" && e.base === 1,
      ),
    ).toBe(true);
    expect(
      s.dynamic.events.some(
        (e) =>
          e.player === "BR" &&
          e.base === 2 &&
          ["RunnerAdvanced", "RunnerOut"].includes(e.type),
      ),
    ).toBe(true);
    validate(s);
  });
  it("does not award a double for an ordinary clean hit at a waiting outfielder", () => {
    const c = settings(765, 280);
    c.ball.strength = "normal";
    const s = provider.generate(c);
    expect(sample(s, duration(s)).state.runners.BR).toBe(1);
    expect(s.dynamic.events.some((e) => e.type === "FirstBaseRounded")).toBe(
      true,
    );
    validate(s);
  });
  it("a timely throw to second can tag out an aggressive extra-base attempt", () => {
    const c = settings(170, 350);
    c.ball.type = "Line drive";
    c.runnerSpeed = "fast";
    c.armStrength = "strong";
    const s = provider.generate(c),
      tag = s.dynamic.events.find(
        (e) => e.type === "RunnerOut" && e.player === "BR" && e.base === 2,
      )!;
    expect(tag).toBeDefined();
    expect(tag.force).toBe(false);
    expect(
      metres(
        sample(s, tag.time).players.find((p) => p.id === "BR")!.position,
        bases[2],
      ),
    ).toBeLessThan(1);
    validate(s);
  });
  it("does not send two active runners to the same held base", () => {
    const c = settings(530, 270);
    c.state.runners = { R1: 1, R2: 2 };
    c.ball.strength = "normal";
    const s = provider.generate(c);
    for (const p of s.phases)
      expect(new Set(Object.values(p.state.runners)).size).toBe(
        Object.keys(p.state.runners).length,
      );
    validate(s);
  });
});
describe("first-base footwork and legal base progress", () => {
  it("runs through first on a close infield hit, then looks and returns without a second-base advance", () => {
    const c = settings(360, 440);
    c.ball.type = "Ground ball";
    c.ball.strength = "normal";
    c.runnerSpeed = "fast";
    const s = provider.generate(c),
      event = s.dynamic.events.find((e) => e.type === "FirstBaseOverrun")!;
    expect(event).toBeDefined();
    const turn = s.dynamic.diagnostics.find(
      (f) =>
        f.time > event.time &&
        f.runners.some((r) => r.id === "BR" && r.firstTurn?.travelled! > 0),
    );
    expect(turn).toBeDefined();
    expect(
      s.dynamic.events.some(
        (e) => e.type === "RunnerAdvanced" && e.player === "BR" && e.base === 2,
      ),
    ).toBe(false);
    expect(
      s.dynamic.events.some(
        (e) => e.type === "RunnerReturned" && e.player === "BR",
      ),
    ).toBe(true);
    expect(sample(s, duration(s)).state.runners.BR).toBe(1);
    validate(s);
  });
  it("rounds on an outfield single and returns on the same clock instead of stopping at first", () => {
    const c = settings(765, 280);
    c.ball.strength = "normal";
    const s = provider.generate(c),
      event = s.dynamic.events.find((e) => e.type === "FirstBaseRounded")!;
    expect(event).toBeDefined();
    const returned = s.dynamic.events.find(
      (e) => e.type === "RunnerReturned" && e.player === "BR",
    )!;
    const positions = s.phases
      .filter((p) => p.start >= event.time && p.start < returned.time)
      .map(
        (p) =>
          sample(s, p.start + p.duration / 2).players.find(
            (q) => q.id === "BR",
          )!.position,
      );
    expect(
      Math.max(...positions.map((p) => metres(p, bases[1]))),
    ).toBeGreaterThan(2);
    expect(
      s.dynamic.events.filter(
        (e) => e.type === "RunnerAdvanced" && e.player === "BR" && e.base === 1,
      ),
    ).toHaveLength(1);
    expect(
      metres(
        sample(s, duration(s)).players.find((p) => p.id === "BR")!.position,
        bases[1],
      ),
    ).toBeLessThan(0.001);
    validate(s);
  });
});
describe("contact reads from third", () => {
  it.each([0, 1, 2])(
    "aggressive R3 breaks on a deep second-base grounder with %i outs",
    (outs) => {
      const c = settings(610, 430);
      c.ball.type = "Ground ball";
      c.state.runners = { R3: 3 };
      c.state.outs = outs;
      const s = provider.generate(c),
        contact = s.phases.find((p) => p.title === "Contact")!;
      expect(contact.movements.some((m) => m.player === "R3")).toBe(true);
      const r = s.dynamic.diagnostics[0].runners.find((r) => r.id === "R3")!;
      expect(r.goal).toBe(4);
      if (outs < 2)
        expect(formatDynamic(r.plan!.reason, "en")).toMatch(/contact play/);
      validate(s);
    },
  );
  it("keeps the plate defended and permits the contact runner to be retired with the infield in", () => {
    const c = settings(610, 430);
    c.ball.type = "Ground ball";
    c.state.runners = { R3: 3 };
    c.state.strategy = "prevent";
    const s = provider.generate(c);
    expect(
      s.phases
        .find((p) => p.title === "Contact")!
        .assignments!.find((a) => a.player === "C")!.base,
    ).toBe("home");
    expect(
      s.dynamic.events.some(
        (e) => e.type === "RunnerOut" && e.player === "R3" && e.base === "home",
      ),
    ).toBe(true);
    validate(s);
  });
  it("does not call a blind contact play on a ball directly at the pitcher", () => {
    const c = settings(500, 590);
    c.ball.type = "Ground ball";
    c.state.runners = { R3: 3 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.fielder).toBe("P");
    expect(
      s.dynamic.diagnostics[0].runners.find((r) => r.id === "R3")!.goal,
    ).toBe(3);
  });
  it("exposes the dimensions and runner timing comparisons in diagnostics", () => {
    const s = provider.generate(settings(920, 330)),
      info = inspectDefense(s, 1);
    expect(info.fieldDimensions).toMatchObject({
      baseMetres: 27.43,
      cornerMetres: 90,
      centreMetres: 120,
    });
    expect(
      info.runners
        .find((r) => r.id === "BR")!
        .plan!.candidates.some((c) => c.base === 2),
    ).toBe(true);
  });
});

it("finishes the sprint after a first-base out without restoring legal base occupancy", () => {
  const c = settings(360, 440);
  c.ball.type = "Ground ball";
  c.ball.strength = "normal";
  const s = provider.generate(c),
    out = s.dynamic.events.find(
      (e) => e.type === "RunnerOut" && e.player === "BR",
    )!;
  expect(out).toBeDefined();
  expect(s.dynamic.events.some((e) => e.type === "RunThroughAfterOut")).toBe(
    true,
  );
  expect(
    s.phases.some(
      (p) => p.start >= out.time && p.movements.some((m) => m.player === "BR"),
    ),
  ).toBe(true);
  expect(sample(s, duration(s)).state.runners.BR).toBeUndefined();
  expect(
    sample(s, duration(s)).players.find((p) => p.id === "BR")!.status,
  ).toBe("out");
  validate(s);
});
it("stops all runner motion at the third out", () => {
  const c = settings(396, 473);
  c.ball.type = "Ground ball";
  c.state.outs = 2;
  const s = provider.generate(c),
    out = s.dynamic.events.find((e) => e.type === "RunnerOut")!;
  expect(
    s.phases
      .filter((p) => p.start >= out.time)
      .flatMap((p) => p.movements)
      .filter(
        (m) => m.player === "BR" || ["R1", "R2", "R3"].includes(m.player),
      ),
  ).toEqual([]);
});

it("chooses the nearer outfielder when multiple defenders can arrive before the ball", () => {
  const c = settings(530, 210);
  c.ball.type = "Fly ball";
  c.ball.strength = "normal";
  const m = new MovementEngine(),
    starting = m.starting(c),
    ball = m.field(c, starting);
  expect(ball.fielder).toBe("CF");
  expect(metres(starting.CF, ball.fieldingPoint)).toBeLessThan(
    metres(starting.LF, ball.fieldingPoint),
  );
});
