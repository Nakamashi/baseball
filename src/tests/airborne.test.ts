import { describe, it, expect } from "vitest";
import { DynamicPlayProvider, defaultSettings } from "../dynamic/provider";
import { sample, duration } from "../simulation/timeline";
import { validateScenario } from "../simulation/scenarioValidation";
import { isForced } from "../dynamic/defense";
import { formatDynamic } from "../dynamic/messages";
import type { DynamicSettings } from "../dynamic/types";
const provider = new DynamicPlayProvider();
function settings(type: DynamicSettings["ball"]["type"], x: number, y: number) {
  const s = defaultSettings();
  // Rule fixtures explicitly use a low ordinary fence; the new default is a
  // separately tested keep-in-play training net for the reported home ground.
  s.field = { fenceHeight: 2.5, fenceMode: "standard" };
  s.ball = { type, destination: { x, y }, strength: "normal" };
  return s;
}
function validate(s: ReturnType<DynamicPlayProvider["generate"]>) {
  expect(validateScenario(s)).toEqual([]);
  for (const p of s.phases)
    for (const r of Object.values(p.responsibilities))
      for (const text of Object.values(r))
        expect(formatDynamic(text, "ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  const mid = sample(s, duration(s) * 0.53);
  sample(s, duration(s));
  sample(s, 0);
  expect(sample(s, duration(s) * 0.53)).toEqual(mid);
}
describe("airborne baseball rules", () => {
  it("records a completed fly catch as a batter out and removes forces", () => {
    const c = settings("Fly ball", 390, 390),
      s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    const caught = s.dynamic.events.find((e) => e.type === "BallCaught")!;
    expect(caught).toBeDefined();
    const frame = s.dynamic.diagnostics.find(
      (f) =>
        f.time >= caught.time &&
        f.runners.find((r) => r.id === "BR")?.status === "out",
    )!;
    expect(frame).toBeDefined();
    for (const r of frame.runners.filter((r) => r.status === "active"))
      expect(isForced(r, frame.runners, r.originBase + 1)).toBe(false);
    validate(s);
  });
  it("permits a realistic tag-up from third after first touch on a deep catch", () => {
    const c = settings("Fly ball", 500, 100);
    c.state.runners = { R3: 3 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    const touch = s.dynamic.events.find((e) => e.type === "BallTouched")!,
      caught = s.dynamic.events.find((e) => e.type === "BallCaught")!,
      tag = s.dynamic.events.find(
        (e) => e.type === "RunnerTaggedUp" && e.player === "R3",
      )!;
    expect(tag).toBeDefined();
    expect(tag.time).toBeCloseTo(touch.time, 5);
    expect(tag.time).toBeLessThan(caught.time);
    expect(
      s.dynamic.events.some((e) => e.type === "RunScored" && e.player === "R3"),
    ).toBe(true);
    validate(s);
  });
  it("holds at third when a shallow catch and return do not justify a tag-up", () => {
    const c = settings("Fly ball", 235, 360);
    c.state.runners = { R3: 3 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    expect(sample(s, duration(s)).state.runners.R3).toBe(3);
    expect(s.dynamic.events.some((e) => e.type === "RunScored")).toBe(false);
    validate(s);
  });
  it("qualifies infield fly only for a fair ordinary-effort fly with the required runners and outs", () => {
    const c = settings("Fly ball", 390, 390);
    c.state.runners = { R1: 1, R2: 2 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.infieldFly).toBe(true);
    expect(s.dynamic.events.some((e) => e.type === "InfieldFly")).toBe(true);
    expect(
      s.dynamic.events.filter(
        (e) => e.type === "RunnerOut" && e.player === "BR",
      ),
    ).toHaveLength(1);
    for (const patch of [
      { outs: 2, type: "Fly ball", runners: { R1: 1, R2: 2 } },
      { outs: 0, type: "Line drive", runners: { R1: 1, R2: 2 } },
      { outs: 0, type: "Fly ball", runners: { R1: 1 } },
    ]) {
      const q = structuredClone(c);
      q.state.outs = patch.outs;
      q.state.runners = patch.runners as DynamicSettings["state"]["runners"];
      q.ball.type = patch.type as typeof q.ball.type;
      expect(provider.generate(q).dynamic.ball.infieldFly).toBe(false);
    }
    validate(s);
  });
  it("cancels provisional runs when the caught batter is the third out", () => {
    const c = settings("Fly ball", 500, 100);
    c.state.runners = { R3: 3 };
    c.state.outs = 2;
    c.aggression = "aggressive";
    c.runnerSpeed = "fast";
    const s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    expect(sample(s, duration(s)).state.outs).toBe(3);
    expect(sample(s, duration(s)).state.runs).toBe(0);
    const out = s.dynamic.events.find((e) => e.type === "RunnerOut")!;
    expect(
      s.dynamic.events.filter(
        (e) => e.time > out.time && e.type === "ThrowStarted",
      ),
    ).toEqual([]);
    validate(s);
  });
  it("uses retouch-return instructions for a runner reading a caught line drive", () => {
    const c = settings("Line drive", 425, 350);
    c.ball.strength = "hard";
    c.aggression = "aggressive";
    const s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    const returns = s.dynamic.diagnostics
      .flatMap((f) => f.runners)
      .filter((r) => r.id === "R1" && r.retouchBase === 1);
    expect(returns.length).toBeGreaterThan(0);
    // A timely freeze/return can avoid the old fixture's unnecessary double-off.
    // Any actual appeal is a non-force; independent late-retouch tests exercise
    // the defensive appeal rule without requiring a runner to misread a catch.
    for (const d of s.dynamic.decisions.filter((d) => d.appeal))
      expect(d.force).toBe(false);
    const r1Out = s.dynamic.events.find(
      (e) => e.type === "RunnerOut" && e.player === "R1",
    );
    if (r1Out) expect(r1Out.force).toBe(false);
    validate(s);
  });
  it("supports untouched airborne boundary awards without inventing possession", () => {
    const c = settings("Fly ball", 500, 15);
    c.ball.strength = "hard";
    c.state.runners = { R1: 1, R2: 2, R3: 3 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.boundary).toBe("home-run");
    expect(sample(s, duration(s)).state.runs).toBe(4);
    expect(sample(s, duration(s)).owner).toBeUndefined();
    expect(s.dynamic.events.some((e) => e.type === "ThrowStarted")).toBe(false);
    validate(s);
  });
  it("awards exactly two bases from original occupancy after an uncaught ball bounces over the fence", () => {
    const c = settings("Fly ball", 887.52, 370.36);
    c.ball.strength = "hard";
    c.field = { fenceHeight: 1, fenceMode: "standard" };
    c.state.runners = { R1: 1, R2: 2, R3: 3 };
    const s = provider.generate(c),
      final = sample(s, duration(s));
    expect(s.dynamic.ball.boundary).toBe("ground-rule-double");
    expect(final.state.runs).toBe(2);
    expect(final.state.runners).toEqual({ R1: 3, BR: 2 });
    expect(final.owner).toBeUndefined();
    expect(s.dynamic.events.some((e) => e.type === "ThrowStarted")).toBe(false);
    validate(s);
  });
  it("truncates a projected boundary path on a real interception without awarding hypothetical bases", () => {
    const c = settings("Fly ball", 880, 370);
    c.state.runners = { R1: 1, R2: 2, R3: 3 };
    const s = provider.generate(c);
    expect(
      s.dynamic.ball.trajectory!.events.some(
        (e) => e.type === "ground-rule-double",
      ),
    ).toBe(true);
    expect(s.dynamic.ball.caught).toBe(true);
    expect(s.dynamic.ball.boundary).toBeUndefined();
    expect(s.dynamic.events.some((e) => e.type === "BallBoundary")).toBe(false);
    expect(sample(s, duration(s)).state.runs).toBe(0);
    validate(s);
  });
});
