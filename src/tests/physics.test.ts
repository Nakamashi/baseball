import { describe, it, expect } from "vitest";
import { assumptions } from "../dynamic/conventions";
import {
  speedPlan,
  sampleSpeed,
  planMotion,
  sampleMotion,
} from "../dynamic/locomotion";
import { predictTrajectory, ballPhysics } from "../dynamic/trajectory";
import { DynamicPlayProvider, defaultSettings } from "../dynamic/provider";
import { BaserunningDecisionEngine } from "../dynamic/baserunning";
import { runningTime, runningPlan, runnerPointAt } from "../dynamic/runningGeometry";
import { metres, bases, toWorld, defaults } from "../dynamic/geometry";
import { TimelineBuilder } from "../dynamic/timelineBuilder";
import { message } from "../dynamic/messages";
import { sample, duration } from "../simulation/timeline";
import { validateScenario } from "../simulation/scenarioValidation";
import type { DynamicSettings } from "../dynamic/types";
const provider = new DynamicPlayProvider();
it("slides into second and third while preserving reactions and retouches", () => {
  const c = defaultSettings();
  const r = new BaserunningDecisionEngine().create(c).find(r => r.id === "R1")!;
  for (const base of [2, 3]) {
    const runner = { ...r, originBase: base - 1, progress: base - 1 + 0.08, goal: base };
    const plan = runningPlan(runner, base);
    expect(plan.duration).toBeCloseTo(4.704857, 4);
    expect(plan.legs[0].duration).toBe(assumptions.reaction);
    expect(plan.legs.at(-1)!.acceleration).toBe(-assumptions.slideDeceleration);
    expect(sampleSpeed(plan, plan.duration).distance).toBeCloseTo(27.43 * 0.92, 6);
    expect(sampleSpeed(plan, plan.duration).speed).toBeCloseTo(0, 6);
    expect(runningTime({ ...runner, retouchBase: base as 2 | 3 }, base)).toBeGreaterThan(plan.duration);
  }
  c.ball = { type: "Bunt", destination: { x: 500, y: 650 }, strength: "soft" };
  c.aggression = "aggressive";
  const s = provider.generate(c);
  expect(s.dynamic.decisions[0].target).toBe(2);
  expect(s.dynamic.events.some(e => e.type === "RunnerOut" && e.player === "R1" && e.force)).toBe(true);
  expect(validateScenario(s)).toEqual([]);
});
function settings(
  type: DynamicSettings["ball"]["type"] = "Ground ball",
  x = 396,
  y = 473,
) {
  const s = defaultSettings();
  s.state.runners = {};
  s.ball = { type, destination: { x, y }, strength: "hard" };
  return s;
}
describe("one SI motion model", () => {
  it("distinguishes numeric zero final speed from a non-stopping trip", () => {
    const stopped = speedPlan(10, 0, 6, 5, 0, 0),
      through = speedPlan(10, 0, 6, 5, 0, false);
    expect(stopped.duration).toBeGreaterThan(through.duration);
    expect(sampleSpeed(stopped, stopped.duration).speed).toBeCloseTo(0, 8);
    expect(sampleSpeed(through, through.duration).speed).toBeGreaterThan(0);
    const tiny = speedPlan(0, 0.00004, 6, 5, 0, true);
    expect(Number.isFinite(tiny.duration)).toBe(true);
    // The route solver's sub-nanometre distance tolerance is well below any
    // visible or tactical resolution; this must remain finite and near zero.
    expect(sampleSpeed(tiny, tiny.duration).distance).toBeCloseTo(0, 8);
  });
  it.each(["slow", "average", "fast"] as const)(
    "fits the entire %s contact-to-first interval",
    (profile) => {
      const s = settings();
      s.runnerSpeed = profile;
      const r = new BaserunningDecisionEngine().create(s)[0];
      expect(runningTime(r, 1)).toBeCloseTo(
        assumptions.homeToFirst[profile],
        8,
      );
      const plan = speedPlan(
        27.43,
        0,
        r.speed,
        assumptions.runnerAcceleration,
        assumptions.batterStart,
        false,
      );
      expect(sampleSpeed(plan, 0.05).distance).toBe(0);
      expect(sampleSpeed(plan, 0.6).speed).toBeLessThan(r.speed);
      expect(sampleSpeed(plan, plan.duration).distance).toBeCloseTo(27.43, 8);
      const scenario = provider.generate(s);
      const physicalTouch = scenario.dynamic.events.find(
        (e) =>
          (e.type === "RunnerBaseTouch" || e.type === "RunnerAdvanced") &&
          e.player === "BR" &&
          e.base === 1,
      )!;
      expect(physicalTouch).toBeDefined();
      expect(physicalTouch.time - 1).toBeCloseTo(
        assumptions.homeToFirst[profile],
        4,
      );
    },
  );
  it("keeps momentum when replanning the same route", () => {
    const state = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
    const a = planMotion(state, { x: 30, y: 0 }, 6, 5, 0.25);
    const middle = sampleMotion(a, 1),
      b = planMotion(middle, { x: 30, y: 0 }, 6, 5);
    expect(sampleMotion(a, 1.5).position.x).toBeCloseTo(
      sampleMotion(b, 0.5).position.x,
      8,
    );
  });
  it("brakes along the old velocity before a reversal", () => {
    const plan = planMotion(
      { position: { x: 0, y: 0 }, velocity: { x: 6, y: 0 } },
      { x: -10, y: 0 },
      6,
      5,
    );
    expect(sampleMotion(plan, 0.2).position.x).toBeGreaterThan(0);
    expect(sampleMotion(plan, 0.2).velocity.x).toBeGreaterThan(0);
    expect(sampleMotion(plan, plan.duration).position).toEqual({
      x: -10,
      y: 0,
    });
  });
  it("steers a small lane correction without an unnecessary complete stop", () => {
    const plan = planMotion(
      { position: { x: 0, y: 0 }, velocity: { x: 6, y: 0 } },
      { x: 30, y: 1 },
      6,
      5,
    );
    const at = sampleMotion(plan, 0.2);
    expect(at.velocity.x).toBeGreaterThan(5.5);
    expect(at.velocity.y).toBeGreaterThan(0);
    for (let t = 0; t < plan.duration; t += 0.02) {
      const state = sampleMotion(plan, t);
      expect(
        Math.hypot(state.velocity.x, state.velocity.y),
      ).toBeLessThanOrEqual(6.000001);
    }
    expect(sampleMotion(plan, plan.duration).position).toEqual({ x: 30, y: 1 });
  });
  it("arrives early and waits instead of stretching a short movement", () => {
    const plan = planMotion(
      { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
      { x: 1, y: 0 },
      6,
      5,
    );
    expect(plan.duration).toBeLessThan(1);
    expect(sampleMotion(plan, 2)).toEqual({
      position: { x: 1, y: 0 },
      velocity: { x: 0, y: 0 },
    });
  });
  it("records first touch before the return when a late stop cannot cancel momentum", () => {
    const c = settings();
    c.runnerSpeed = "fast";
    const r = new BaserunningDecisionEngine().create(c)[0];
    Object.assign(r, {
      progress: 0.97,
      goal: 1,
      runVelocity: 8,
      startDelay: 0,
      approach: "round",
    });
    const b = new TimelineBuilder(
      c.state,
      { ...defaults, BR: runnerPointAt(r, r.progress) },
      [r],
    );
    b.interval("Contact", message("runnerWhy"), 0.5, {
      kind: "held",
      owner: "1B",
    });
    const touch = b.events.find(
      (e) => e.type === "RunnerAdvanced" && e.player === "BR" && e.base === 1,
    )!;
    expect(touch).toBeDefined();
    expect(touch.time).toBeGreaterThan(0);
    expect(touch.time).toBeLessThan(0.2);
    expect(r.firstTurn?.extent).toBeGreaterThanOrEqual(
      (r.runVelocity ?? 0) ** 2 / (2 * assumptions.runnerAcceleration),
    );
  });
});
describe("unobstructed ball trajectories", () => {
  it("continues a hard grounder beyond the selected aim point", () => {
    const s = settings(),
      t = predictTrajectory(s);
    expect(metres(bases.home, t.frames.at(-1)!.point)).toBeGreaterThan(
      metres(bases.home, s.ball.destination) + 15,
    );
    expect(t.events.some((e) => e.type === "landing")).toBe(true);
    expect(t.events.some((e) => e.type === "roll")).toBe(true);
    expect(t.frames.at(-1)!.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });
  it("soft contact loses momentum and stops earlier than hard contact", () => {
    const s = settings();
    s.ball.strength = "soft";
    const soft = predictTrajectory(s);
    s.ball.strength = "hard";
    const hard = predictTrajectory(s);
    expect(metres(bases.home, soft.frames.at(-1)!.point)).toBeLessThan(
      metres(bases.home, hard.frames.at(-1)!.point),
    );
  });
  it("keeps physical positions and time continuous with decreasing bounce peaks", () => {
    const t = predictTrajectory(settings());
    const peaks: number[] = [];
    let peak = 0;
    for (let i = 1; i < t.frames.length; i++) {
      const a = t.frames[i - 1],
        b = t.frames[i];
      expect(b.t).toBeGreaterThan(a.t);
      expect(b.height).toBeGreaterThanOrEqual(0);
      expect(metres(a.point, b.point)).toBeLessThan(45 * (b.t - a.t) + 0.003);
      peak = Math.max(peak, b.height ?? 0);
      if ((a.height ?? 0) > 0 && (b.height ?? 0) < 1e-8) {
        peaks.push(peak);
        peak = 0;
      }
    }
    for (let i = 1; i < peaks.length; i++)
      expect(peaks[i]).toBeLessThan(peaks[i - 1]);
  });
  it.each(["Fly ball", "Line drive"] as const)(
    "lands %s near the feasible selected first-contact point",
    (type) => {
      const s = settings(type, 600, 400);
      s.ball.strength = "normal";
      const t = predictTrajectory(s);
      expect(t.launch.adjusted).toBe(false);
      const landing = t.events.find((e) => e.type === "landing")!;
      expect(metres(landing.point, s.ball.destination)).toBeLessThan(0.02);
      expect(Math.max(...t.frames.map((f) => f.height ?? 0))).toBeGreaterThan(
        1,
      );
    },
  );
  it("reports constrained airborne requests instead of promising an unreachable landing", () => {
    const s = settings("Line drive", 500, 61);
    s.ball.strength = "soft";
    const t = predictTrajectory(s);
    expect(t.launch.adjusted).toBe(true);
    expect(
      metres(
        t.events.find((e) => e.type === "landing")!.point,
        s.ball.destination,
      ),
    ).toBeGreaterThan(10);
  });
  it("reflects a low ball at the wall instead of stopping at the fence", () => {
    const s = settings("Ground ball", 920, 340);
    const t = predictTrajectory(s);
    const wall = t.events.find((e) => e.type === "wall")!;
    expect(wall).toBeDefined();
    const after = t.frames.find((f) => f.t > wall.t + 0.15)!;
    expect(metres(after.point, wall.point)).toBeGreaterThan(0.1);
  });
});
describe("physical fielding and deterministic compilation", () => {
  it("retires the fast aggressive batter on the reported routine shortstop grounder", () => {
    const s = settings();
    s.aggression = "aggressive";
    s.runnerSpeed = "fast";
    const p = provider.generate(s);
    expect(p.dynamic.ball.fielder).toBe("SS");
    expect(
      p.dynamic.events.some(
        (e) => e.type === "RunnerOut" && e.player === "BR" && e.base === 1,
      ),
    ).toBe(true);
    expect(
      metres(p.dynamic.ball.touchPoint!, s.ball.destination),
    ).toBeGreaterThan(1);
    expect(validateScenario(p)).toEqual([]);
  });
  it.each(["Ground ball", "Fly ball", "Line drive"] as const)(
    "samples %s identically after backward seeks",
    (type) => {
      const p = provider.generate(settings(type, 600, 400));
      const a = sample(p, duration(p) * 0.47);
      sample(p, duration(p));
      sample(p, 0);
      expect(sample(p, duration(p) * 0.47)).toEqual(a);
      expect(validateScenario(p)).toEqual([]);
    },
  );
  it("keeps reaction stationary and the ball moving before pursuit begins", () => {
    const p = provider.generate(settings());
    const early = sample(p, 1 + assumptions.reaction / 2);
    expect(
      metres(
        early.players.find((p) => p.id === "SS")!.position,
        p.startingPositions.SS,
      ),
    ).toBeLessThan(1e-9);
    expect(metres(early.ball, bases.home)).toBeGreaterThan(0);
    expect(early.owner).toBeUndefined();
  });
  it("touches the moving ball before secure possession", () => {
    const p = provider.generate(settings());
    const touch = p.dynamic.events.find((e) => e.type === "BallTouched")!,
      secure = p.dynamic.events.find((e) => e.type === "BallFielded")!;
    expect(secure.time - touch.time).toBeCloseTo(assumptions.fieldDelay, 5);
    expect(sample(p, (touch.time + secure.time) / 2).owner).toBeUndefined();
    expect(sample(p, secure.time + 0.001).owner).toBe(p.dynamic.ball.fielder);
    const releases = p.dynamic.diagnostics.filter(
      (f) => f.trigger === "ThrowStarted",
    );
    expect(releases.length).toBeGreaterThan(0);
    expect(releases.every((f) => f.state.ballStatus === "throwing")).toBe(true);
  });
});
