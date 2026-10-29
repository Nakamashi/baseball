import { describe, expect, it } from "vitest";
import { throwFlight, throwSamples, cutoffCrossing, throwPhysics, directThrowRange } from "../dynamic/throwing";
import { bases, fromWorld, metres, mixPhysical } from "../dynamic/geometry";
import { DynamicPlayProvider, defaultSettings } from "../dynamic/provider";
import { MovementEngine } from "../dynamic/movement";
import { BaserunningDecisionEngine } from "../dynamic/baserunning";
import { DefensiveDecisionEngine } from "../dynamic/defense";
import { duration, sample } from "../simulation/timeline";
import { validateScenario } from "../simulation/scenarioValidation";
import { positions } from "../simulation/types";
import { formatDynamic } from "../dynamic/messages";

const provider = new DynamicPlayProvider();
function gap(x = 635) {
  const s = defaultSettings();
  s.ball = { type: "Fly ball", destination: { x, y: 209 }, strength: "hard" };
  s.aggression = "aggressive";
  return s;
}

describe("thrown-ball flight", () => {
  it("loses horizontal velocity, has a gravity arc, and arrives at the receiving height", () => {
    const from = bases.home, to = fromWorld({ x: 0, y: -45 });
    const f = throwFlight(from, to, "CF");
    const samples = throwSamples(from, to, f);
    expect(f.reachable).toBe(true);
    expect(f.horizontalSpeed).toBeLessThan(f.releaseSpeed * Math.cos(f.angle));
    expect(f.arrivalSpeed).toBeLessThan(f.releaseSpeed);
    expect(f.duration).toBeGreaterThan(45 / f.releaseSpeed);
    expect(metres(samples.at(-1)!.point, to)).toBeLessThan(1e-6);
    expect(samples.at(-1)!.height).toBeCloseTo(throwPhysics.receivingHeight, 6);
    expect(Math.max(...samples.map(s => s.height!))).toBeGreaterThan(1.5);
    const early = metres(samples[5].point, samples[6].point);
    const late = metres(samples.at(-7)!.point, samples.at(-6)!.point);
    expect(early).toBeGreaterThan(late);
  });
  it("keeps short flight nearly uniform while a longer return loses more speed", () => {
    const short = throwFlight(bases.home, fromWorld({ x: 0, y: -5 }), "CF");
    const long = throwFlight(bases.home, fromWorld({ x: 0, y: -50 }), "CF");
    expect(short.horizontalSpeed / (short.releaseSpeed * Math.cos(short.angle))).toBeGreaterThan(0.97);
    expect(long.horizontalSpeed / (long.releaseSpeed * Math.cos(long.angle))).toBeLessThan(0.86);
    expect(directThrowRange("CF", "strong")).toBeGreaterThan(directThrowRange("CF", "developing"));
  });
  it("rejects an unreachable airborne throw instead of making it arrive", () => {
    const to = fromWorld({ x: 0, y: -115 });
    const flight = throwFlight(bases.home, to, "SS");
    expect(flight.reachable).toBe(false);
    expect(() => throwSamples(bases.home, to, flight)).toThrow(/unreachable/);
  });
  it("permits an on-line cutoff only when the flight is within receiving height", () => {
    const from = bases.home, to = fromWorld({ x: 0, y: -25 });
    const flight = throwFlight(from, to, "CF");
    expect(cutoffCrossing(from, to, mixPhysical(from, to, 0.55), flight)).toBeDefined();
    expect(cutoffCrossing(from, to, fromWorld({ x: 3, y: -12 }), flight)).toBeUndefined();
    const far = fromWorld({ x: 0, y: -60 });
    expect(cutoffCrossing(from, far, mixPhysical(from, far, 0.5), throwFlight(from, far, "CF"))).toBeUndefined();
  });
});

describe("manual-based gap returns and all-nine movement", () => {
  it.each([635, 365])("uses the ball-side middle infielder on the deep gap at x=%s", x => {
    const c = gap(x); c.throwTarget = "home";
    const s = provider.generate(c);
    const fielded = s.dynamic.diagnostics.find(f => f.trigger === "Ball secured / throwing target selected")!;
    expect(fielded.route.cutoff).toBe(x > 500 ? "2B" : "SS");
    expect(fielded.route.receiver).toBe("C");
    expect(fielded.route.relays!.length).toBeGreaterThan(0);
    expect(fielded.route.relays!.length).toBeLessThanOrEqual(2);
    for (const f of s.dynamic.diagnostics) {
      expect(new Set(f.assignments.map(a => a.player))).toEqual(new Set(positions));
      expect(f.route.relays?.length ?? 0).toBeLessThanOrEqual(2);
    }
    expect(validateScenario(s)).toEqual([]);
  });
  it("compiles two actual relay receptions in the reported play, with all receiving points reached", () => {
    const s = provider.generate(gap());
    expect(s.dynamic.events.some(e => e.type === "BallWallContact")).toBe(true);
    const receipts = s.dynamic.events.filter(e => e.type === "ThrowReceived");
    expect(receipts.slice(0, 3).map(e => e.player)).toEqual(["2B", "1B", "C"]);
    const fielded = s.dynamic.diagnostics.find(f => f.trigger === "Ball secured / throwing target selected")!;
    expect(fielded.route.relays!.map(s => s.player)).toEqual(["2B", "1B"]);
    expect(metres(bases.home, fielded.assignments.find(a => a.player === "2B")!.target))
      .toBeGreaterThan(metres(bases.home, fielded.assignments.find(a => a.player === "1B")!.target));
    for (const p of s.phases) {
      if (p.ball.kind === "travel" && p.ball.style === "throw" && p.ball.receiver) {
        const receiver = p.ball.receiver;
        const end = sample(s, p.start + p.duration - 1e-6);
        expect(metres(end.players.find(v => v.id === receiver)!.position, p.ball.path.at(-1)!)).toBeLessThan(0.001);
        expect(p.ball.samples!.every(v => v.height !== undefined)).toBe(true);
      }
      for (const r of Object.values(p.responsibilities))
        for (const text of Object.values(r)) expect(formatDynamic(text, "ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);
    }
    expect(validateScenario(s)).toEqual([]);
    const mid = sample(s, duration(s) * 0.6);
    sample(s, duration(s)); sample(s, 0);
    expect(sample(s, duration(s) * 0.6)).toEqual(mid);
  });
  it("establishes plate and third backup early and keeps second covered", () => {
    const s = provider.generate(gap());
    const frame = s.dynamic.diagnostics.find(f => f.target === "home")!;
    const job = (p: string) => frame.assignments.find(a => a.player === p)!;
    expect(frame.time - s.dynamic.contactTime).toBeLessThan(2);
    expect(job("P")).toMatchObject({ type: "BackupThrow", base: "home" });
    expect(job("LF")).toMatchObject({ type: "SupportBase", base: 3 });
    expect(job("SS")).toMatchObject({ type: "CoverBase", base: 2 });
    expect(job("3B")).toMatchObject({ type: "CoverBase", base: 3 });
    expect(job("C")).toMatchObject({ type: "CoverBase", base: "home" });
    expect(job("RF")).toMatchObject({ type: "BackupFielder", teammate: "CF" });
    expect(job("CF").type).toBe("FieldBall");
    expect(job("2B").type).toBe("Relay");
    expect(["Relay", "Cutoff"]).toContain(job("1B").type);
  });
  it("keeps an inner cutoff separate when only one relay is necessary", () => {
    const c = gap();
    const movement = new MovementEngine(), loc = movement.starting(c), ball = movement.field(c, loc);
    const runners = new BaserunningDecisionEngine().create(c);
    runners.forEach(r => { r.goal = r.id === "R1" ? 4 : 2; r.decision = "advance"; });
    loc.CF = fromWorld({ x: 10, y: -70 });
    const layout = new DefensiveDecisionEngine().assign(c, { ...ball, fieldingPoint: loc.CF }, "CF", "home", loc, "fielded", { runners, outs: 0 });
    expect(layout.route.relays!.map(s => s.player)).toEqual(["2B"]);
    expect(layout.route.innerCutoff).toBe("1B");
    expect(layout.assignments.find(a => a.player === "1B")).toMatchObject({ type: "Cutoff", reason: "innerCutoff" });
  });
  it("activates the fence trailer only with replacement second-base coverage", () => {
    const c = gap(); c.throwTarget = "home";
    const movement = new MovementEngine(), loc = movement.starting(c), ball = movement.field(c, loc);
    const runners = new BaserunningDecisionEngine().create(c);
    runners.forEach(r => { r.goal = r.id === "R1" ? 4 : 2; r.decision = "advance"; });
    const engine = new DefensiveDecisionEngine();
    const initial = engine.assign(c, ball, ball.fielder, "home", loc, "contact", { runners, outs: 0 });
    expect(initial.route.trailer).toBeUndefined();
    expect(initial.assignments.find(a => a.player === "SS")).toMatchObject({ type: "CoverBase", base: 2 });
    loc.LF = bases[2];
    const covered = engine.assign(c, ball, ball.fielder, "home", loc, "contact", { runners, outs: 0 });
    expect(covered.route.trailer).toBe("SS");
    expect(covered.assignments.find(a => a.player === "LF")).toMatchObject({ type: "CoverBase", base: 2 });
    expect(covered.assignments.find(a => a.player === "SS")).toMatchObject({ type: "RelayTrailer", reason: "relayTrailer" });
    expect(covered.route.legs).not.toContain("SS"); // Being a trailer is not an invented reception.
  });
  it("preserves the incoming plate lane after C has received", () => {
    const s = provider.generate(gap());
    const receipt = s.dynamic.events.find(e => e.type === "ThrowReceived" && e.player === "C")!;
    const f = s.dynamic.diagnostics.find(f => f.time >= receipt.time && f.trigger === "Base receiver has possession")!;
    const backup = f.assignments.find(a => a.player === "P")!;
    expect(backup.type).toBe("BackupThrow");
    expect(metres(backup.target, bases.home)).toBeGreaterThan(6);
    expect(backup.target.y).toBeGreaterThan(bases.home.y);
  });
  it("allows a ready cutoff to collect a through throw and choose another base", () => {
    const c = defaultSettings();
    c.state.runners = {};
    c.runnerSpeed = "fast";
    c.ball = { type: "Ground ball", destination: { x: 750, y: 300 }, strength: "normal" };
    const s = provider.generate(c);
    const cut = s.dynamic.events.find(e => e.type === "CutoffIntercepted")!;
    expect(cut).toMatchObject({ player: "2B", base: 2 });
    const glove = s.dynamic.events.find(e => e.type === "ThrowGloveContact")!;
    const reception = sample(s, glove.time);
    expect(reception.ballHeight).toBeLessThanOrEqual(2.25);
    expect(s.dynamic.events.filter(e => e.type === "ThrowStarted").map(e => [e.player, e.base]))
      .toEqual([["RF", 2], ["2B", 1]]);
    expect(validateScenario(s)).toEqual([]);
  });
  it.each([2, 3, "home"] as const)("reallocates a deep return toward %s without a tertiary relay", target => {
    for (const runners of [{}, { R1: 1 as const }]) {
      const c = gap(); c.state.runners = runners; c.throwTarget = target;
      const s = provider.generate(c);
      expect(validateScenario(s)).toEqual([]);
      for (const f of s.dynamic.diagnostics) {
        expect(f.route.relays?.length ?? 0).toBeLessThanOrEqual(2);
        expect((f.route.relaysUsed ?? 0) + (f.route.relays?.length ?? 0)).toBeLessThanOrEqual(2);
        expect(new Set(f.route.legs).size).toBe(f.route.legs.length);
        if (f.route.receiver && f.route.target !== "hold")
          expect(f.assignments.find(a => a.player === f.route.receiver)?.base).toBe(f.route.target);
      }
    }
  });
});
