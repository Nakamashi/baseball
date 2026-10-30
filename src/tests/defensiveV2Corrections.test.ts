import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicPlayProvider, defaultSettings, validateSettings } from "../dynamic/provider";
import { baseTouchTime, runningTime, runningAdvance } from "../dynamic/runningGeometry";
import { assumptions } from "../dynamic/conventions";
import { calibratedMaximum } from "../dynamic/calibration";
import { BaserunningDecisionEngine } from "../dynamic/baserunning";
import { sample, duration } from "../simulation/timeline";
import { bases, fromWorld, metres, toWorld } from "../dynamic/geometry";
import { validateScenario } from "../simulation/scenarioValidation";
import { formatDynamic } from "../dynamic/messages";
import type { DynamicScenario, DynamicSettings, OffensiveRunner } from "../dynamic/types";
import { isForced } from "../dynamic/defense";

const provider = new DynamicPlayProvider();
afterEach(() => { vi.restoreAllMocks(); return new Promise<void>(r => setTimeout(r, 0)); });
const settings = (x = 425, y = 425, type: DynamicSettings["ball"]["type"] = "Ground ball") => {
  const c = defaultSettings(); c.ball = { type, destination: { x, y }, strength: "hard" }; return c;
};
const events = (s: DynamicScenario, type: string) => s.dynamic.events.filter(e => e.type === type);
function integrity(s: DynamicScenario) {
  expect(validateScenario(s)).toEqual([]);
  expect(new Set(events(s, "RunnerOut").map(e => e.player)).size).toBe(events(s, "RunnerOut").length);
  for (const p of s.phases) {
    expect(new Set(p.assignments!.map(a => a.player)).size).toBe(9);
    for (const r of Object.values(p.responsibilities))
      for (const v of Object.values(r)) expect(formatDynamic(v, "ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  }
}
describe("V2 earliest touches and live decisions", () => {
  it("forecasts the first crossing before an overshoot/stop/return finishes", () => {
    const r: OffensiveRunner = { id: "BR", originBase: 0, progress: 0.928179, goal: 1,
      speed: assumptions.runnerSpeed.average, runVelocity: 6.337838227767871,
      startDelay: 0, approach: "round", decision: "advance", status: "active" };
    const touch = baseTouchTime(r, 1);
    expect(touch).toBeCloseTo(0.425058, 5);
    expect(runningTime(r, 1) - touch).toBeGreaterThan(1.7);
    expect(runningAdvance(r, 1, touch - 0.001).progress).toBeLessThan(1);
    expect(runningAdvance(r, 1, touch + 0.001).progress).toBeGreaterThan(1);
    const returning = { ...r, id: "R1" as const, originBase: 1, progress: 1.1,
      retouchBase: 1, forceRemoved: true, decision: "retreat" as const, runVelocity: -2 };
    expect(baseTouchTime(returning, 1)).toBeGreaterThan(0);
    expect(runningAdvance(returning, 1, baseTouchTime(returning, 1)).progress).toBeCloseTo(1, 6);
    expect(isForced(returning, [returning, r], 2)).toBe(false);
  });
  it.each(["slow", "average", "fast"] as const)("declines the audited futile force for %s runners at every out count", speed => {
    for (const outs of [0, 1, 2]) {
      const c = settings(639.4496484048682, 470.94926393313546); c.ball.strength = "normal";
      c.runnerSpeed = speed; c.state.outs = outs;
      const s = provider.generate(c);
      const touches = s.dynamic.events.filter(e => ["RunnerAdvanced", "RunnerBaseTouch"].includes(e.type) && e.player === "BR" && e.base === 1);
      for (const d of s.dynamic.decisions.filter(d => d.target === 1 && d.runner === "BR")) {
        const candidate = d.alternatives?.find(a => a.target === 1 && a.runner === "BR");
        const touch = touches.find(e => e.time > d.time!);
        if (candidate && touch) expect(Math.abs(candidate.runnerArrival - (touch.time - d.time!))).toBeLessThan(0.02);
      }
      if (speed === "average" && outs < 2) {
        expect(events(s, "ThrowStarted").some(e => e.base === 1)).toBe(false);
        const hold = s.dynamic.decisions.find(d => d.owner === "2B" && d.target === "hold")!;
        expect(hold.alternatives!.find(a => a.target === 1)!.margin).toBeLessThan(-1);
        const read = s.dynamic.diagnostics.find(f => f.trigger === "Relay secured / reading live runners")!;
        expect(hold.time! - read.time).toBeCloseTo(0.15, 6);
      }
      integrity(s);
    }
  });
  it.each(["straight", "round"] as const)("preserves %s first-touch timing, continuing advances and post-catch retouches", approach => {
    for (const speed of ["slow", "average", "fast"] as const) {
      const r: OffensiveRunner = { id: "BR", originBase: 0, progress: 0, goal: 1,
        speed: assumptions.runnerSpeed[speed], runVelocity: 0, startDelay: 0.1,
        approach, decision: "advance", status: "active" };
      const t = baseTouchTime(r, 1);
      expect(runningAdvance(r, 1, t).progress).toBeCloseTo(1, 6);
      if (approach === "straight") expect(t).toBeCloseTo(assumptions.homeToFirst[speed], 5);
      const continuing = { ...r, goal: 2 };
      expect(baseTouchTime(continuing, 1)).toBeLessThan(baseTouchTime(continuing, 2));
      expect(isForced({ ...r, progress: 1.1, firstTurn: { kind: "round", stage: "outbound", travelled: 2, extent: 4, readRemaining: 0.35 } }, [r], 1)).toBe(false);
    }
  });
});

describe("V2 moving receivers, forces and pivots", () => {
  it.each([[425, 425, "SS", "2B"], [575, 425, "2B", "SS"], [500, 590, "P", "SS"]] as const)(
    "turns a favourable average-runner feed at %s,%s with real moving control", (x, y, fielder, receiver) => {
      const s = provider.generate(settings(x, y));
      const [feed, pivot] = events(s, "ThrowStarted"), [glove] = events(s, "ThrowGloveContact");
      const force = events(s, "RunnerOut").find(e => e.player === "R1")!;
      expect(feed.player).toBe(fielder); expect(pivot.player).toBe(receiver);
      expect(sample(s, duration(s)).state.outs).toBe(2);
      expect(glove.time).toBeLessThan(force.time);
      expect(force.time - glove.time).toBeCloseTo(0.12, 6);
      expect(events(s, "BaseTouched").some(e => e.player === receiver && e.base === 2 && e.time === force.time)).toBe(true);
      const atGlove = sample(s, glove.time), atForce = sample(s, force.time);
      expect(atGlove.owner).toBeUndefined(); expect(atForce.owner).toBe(receiver);
      expect(metres(atForce.players.find(p => p.id === receiver)!.position, bases[2])).toBeLessThan(0.002);
      expect(metres(atGlove.players.find(p => p.id === receiver)!.position, bases[2])).toBeGreaterThan(0.1);
      const velocity = (t: number) => {
        const a = toWorld(sample(s, t - 0.001).players.find(p => p.id === receiver)!.position);
        const b = toWorld(sample(s, t + 0.001).players.find(p => p.id === receiver)!.position);
        return { x: (b.x - a.x) / 0.002, y: (b.y - a.y) / 0.002 };
      };
      const v = velocity(force.time); expect(Math.hypot(v.x, v.y)).toBeCloseTo(1.2, 1);
      const before = velocity(force.time - 0.002), after = velocity(force.time + 0.002);
      expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.06);
      expect(pivot.time - force.time).toBeGreaterThanOrEqual(0.239);
      integrity(s);
    });
  it("keeps both sides of a near-tie at first governed by actual control and crossing", () => {
    const reference = provider.generate(settings());
    const control = events(reference, "ThrowReceived").filter(e => e.base === 1).at(-1)!.time;
    const original = BaserunningDecisionEngine.prototype.create;
    for (const offset of [-0.003, 0.003]) {
      const spy = vi.spyOn(BaserunningDecisionEngine.prototype, "create").mockImplementation(function(this: BaserunningDecisionEngine, c) {
        const runners = original.call(this, c);
        runners.find(r => r.id === "BR")!.speed = calibratedMaximum(27.43, control - 1 + offset, assumptions.runnerAcceleration, 0.1);
        return runners;
      });
      const s = provider.generate(settings()); spy.mockRestore();
      const touch = s.dynamic.events.find(e => ["RunnerAdvanced", "RunnerBaseTouch"].includes(e.type) && e.player === "BR" && e.base === 1)!;
      const received = events(s, "ThrowReceived").filter(e => e.base === 1).at(-1)!;
      expect(Math.abs(touch.time - received.time)).toBeLessThan(0.004);
      expect(events(s, "RunnerOut").some(e => e.player === "BR")).toBe(received.time < touch.time);
      integrity(s);
    }
  });
  it("distinguishes bilingual glove, secured reception and the legal force", () => {
    const s = provider.generate(settings()), glove = events(s, "ThrowGloveContact")[0], control = events(s, "ThrowReceived")[0];
    for (const locale of ["en", "ja"] as const) {
      expect(formatDynamic(glove.explanation, locale)).not.toBe(formatDynamic(control.explanation, locale));
      expect(formatDynamic(glove.explanation, locale)).toMatch(locale === "en" ? /glove/ : /グラブ/);
      expect(formatDynamic(control.explanation, locale)).toMatch(locale === "en" ? /secures/ : /保持/);
    }
    expect(events(s, "RunnerOut")[0].time).toBe(control.time);
  });
});

describe("V2 ordinary R3 bunts and cooperative pop-ups", () => {
  it.each([[430, 650, "C", "soft"], [470, 650, "C", "soft"], [500, 730, "P", "hard"], [500, 700, "P", "hard"]] as const)(
    "uses reachable C/P priority without delaying a clearly earlier pitcher catch at %s,%s", (x, y, owner, strength) => {
      const c = settings(x, y, "Pop-up"); c.ball.strength = strength; c.state.runners = {};
      const s = provider.generate(c);
      expect(s.dynamic.ball.caught).toBe(true);
      expect(s.dynamic.ball.fielder).toBe(owner);
      if (owner === "C") {
        expect(s.dynamic.ball.candidates).toBeDefined();
        const candidates = s.dynamic.ball.candidates!.filter(a => a.caught);
        const pitcher = candidates.find(a => a.player === "P")!;
        const catcher = candidates.find(a => a.player === "C")!;
        expect(catcher.time - pitcher.time).toBeLessThanOrEqual(0.08);
        expect(s.dynamic.ball.catchPriority?.yielded).toContain("P");
      }
      integrity(s);
    });
  it.each([4, 5, 6, 7])("executes all 18 formerly excluded base/out/bunt combinations for mask %s", mask => {
    for (const [angle, depth] of [[-42, 10], [-25, 22], [0, 14], [25, 22], [42, 10], [0, 3]])
      for (const outs of [0, 1, 2]) {
        const c = settings(); c.ball = { type: "Bunt", strength: "normal", destination: fromWorld({ x: depth * Math.sin(angle * Math.PI / 180), y: -depth * Math.cos(angle * Math.PI / 180) }) };
        c.state.runners = Object.fromEntries([1, 2, 3].filter(b => mask & (1 << (b - 1))).map(b => [`R${b}`, b])); c.state.outs = outs;
        expect(validateSettings(c)).toBeUndefined();
        const s = provider.generate(c);
        for (const e of events(s, "RunnerOut").filter(e => e.player === "R3" && e.base === "home")) expect(e.force).toBe(mask === 7);
        expect(s.dynamic.diagnostics.some(f => f.time <= 1 && f.assignments.some(a => a.base === "home" && a.type === "CoverBase"))).toBe(true);
        if (mask === 4 && outs < 2 && ["P", "C", "3B"].includes(s.dynamic.ball.fielder))
          expect(events(s, "RunScored").some(e => e.player === "R3")).toBe(false);
        integrity(s);
      }
  });
  it.each([{}, { R1: 1 as const }, { R1: 1 as const, R2: 2 as const }, { R1: 1 as const, R2: 2 as const, R3: 3 as const }])(
    "uses a reachable middle-infield claim and rotates vacated coverage", runners => {
      for (const outs of [0, 1, 2]) {
        const c = settings(500, 584.3941369105671, "Pop-up"); c.ball.strength = "normal"; c.state.runners = runners; c.state.outs = outs;
        const s = provider.generate(c);
        if (runners.R1 && outs < 2) expect(s.dynamic.ball.fielder).toBe("SS");
        expect(s.dynamic.ball.catchPriority?.selected ?? s.dynamic.ball.fielder).toBe(s.dynamic.ball.fielder);
        if (runners.R1 && outs < 2) expect(s.phases[0].assignments!.some(a => a.type === "CoverBase" && a.base === 2 && a.player !== "SS")).toBe(true);
        integrity(s);
      }
    });
  it("suppresses the meaningless pre-third-out coverage transition, retaining real warnings", () => {
    const c = settings(313.5685576818844, 196.2230191656978); c.ball.strength = "normal";
    c.state.runners = { R2: 2 }; c.state.outs = 2;
    const s = provider.generate(c), out = events(s, "RunnerOut")[0];
    expect(s.dynamic.diagnostics.filter(f => f.time === out.time && f.state.outs < 3).flatMap(f => f.issues).some(i => i.kind === "late-coverage")).toBe(false);
    expect(s.dynamic.diagnostics.some(f => f.issues.some(i => i.kind === "late-backup"))).toBe(true);
    integrity(s);
  });
  it("keeps C near home and third covered while R2 advances during a double play", () => {
    const c = settings(313.5685576818844, 196.2230191656978); c.ball.strength = "normal";
    c.state.runners = { R1: 1, R2: 2 };
    const s = provider.generate(c);
    const live = s.dynamic.diagnostics.filter(f => f.time >= 1 && f.runners.some(r => r.id === "R2" && r.status === "active" && r.goal === 3));
    expect(live.length).toBeGreaterThan(0);
    for (const f of live) {
      expect(f.assignments.find(a => a.player === "C")?.reason).not.toBe("catcherSupport");
      expect(f.issues.some(i => i.kind === "late-coverage" && i.base === 3)).toBe(false);
    }
    integrity(s);
  });
});
