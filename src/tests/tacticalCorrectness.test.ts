import { describe, it, expect, afterEach, vi } from "vitest";
import {
  DynamicPlayProvider,
  defaultSettings,
  validateSettings,
} from "../dynamic/provider";
import { sample, duration } from "../simulation/timeline";
import { positions, type Position } from "../simulation/types";
import { validateScenario } from "../simulation/scenarioValidation";
import { formatDynamic } from "../dynamic/messages";
import { DefensiveDecisionEngine } from "../dynamic/defense";
import { MovementEngine } from "../dynamic/movement";
import { BaserunningDecisionEngine } from "../dynamic/baserunning";
import type { DynamicSettings, DynamicScenario } from "../dynamic/types";
import { throwingProfile } from "../dynamic/throwing";
import { metres, bases } from "../dynamic/geometry";
import { planMotion, sampleMotion } from "../dynamic/locomotion";
import { message } from "../dynamic/messages";
import { runningTime } from "../dynamic/runningGeometry";
const provider = new DynamicPlayProvider();
afterEach(() => new Promise<void>((r) => setTimeout(r, 0)));
function make(
  x = 425,
  y = 425,
  type: DynamicSettings["ball"]["type"] = "Ground ball",
) {
  const c = defaultSettings();
  c.ball = { type, destination: { x, y }, strength: "hard" };
  c.aggression = "aggressive";
  return c;
}
function audit(s: DynamicScenario) {
  expect(validateScenario(s)).toEqual([]);
  for (const p of s.phases) {
    expect(new Set(p.assignments!.map((a) => a.player))).toEqual(
      new Set(positions),
    );
    for (const r of Object.values(p.responsibilities))
      for (const v of Object.values(r)) {
        expect(formatDynamic(v, "en")).not.toMatch(/@v2:|\{\w+\}/);
        expect(formatDynamic(v, "ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);
      }
  }
  const t = duration(s) * 0.43,
    a = sample(s, t);
  sample(s, duration(s));
  sample(s, 0);
  expect(sample(s, t)).toEqual(a);
}
const throws = (s: DynamicScenario) =>
  s.dynamic.events.filter((e) => e.type === "ThrowStarted");
describe("baseball tactical correctness: force continuations and finishing", () => {
  it.each([423, 425, 427])(
    "attempts the 6-4-3 at nearby x=%s when both timings permit",
    (x) => {
      const c = make(x);
      c.runnerSpeed = "slow";
      const s = provider.generate(c);
      expect(throws(s).map((e) => [e.player, e.base])).toEqual([
        ["SS", 2],
        ["2B", 1],
      ]);
      expect(s.dynamic.decisions[0].continuation).toBeDefined();
      expect(sample(s, duration(s)).state.outs).toBe(2);
      audit(s);
    },
  );
  it.each(["slow", "average", "fast"] as const)(
    "evaluates the full sequence and actual second-throw timing for a %s BR",
    (speed) => {
      const c = make();
      c.runnerSpeed = speed;
      const s = provider.generate(c),
        d = s.dynamic.decisions[0];
      expect(
        d.alternatives?.find((a) => a.target === 2)?.continuation,
      ).toBeDefined();
      const out = s.dynamic.events.find((e) => e.type === "RunnerOut");
      if (throws(s).length > 1) {
        expect(out!.time).toBeLessThan(throws(s)[1].time);
        expect(throws(s)[1].time - out!.time).toBeLessThan(0.8);
      } else expect(d.continuation!.margin).toBeLessThan(0);
      audit(s);
    },
  );
  it("secures the third out and generates no unnecessary relay", () => {
    const c = make();
    c.state.outs = 2;
    c.runnerSpeed = "slow";
    const s = provider.generate(c);
    const out = s.dynamic.events.find((e) => e.type === "RunnerOut")!;
    expect(sample(s, duration(s)).state.outs).toBe(3);
    expect(throws(s).filter((e) => e.time > out.time)).toEqual([]);
    audit(s);
  });
  it("cancels obsolete pitcher/OF backup assignments once all throw opportunities close", () => {
    const c = make(396, 473);
    c.state.runners = {};
    const s = provider.generate(c);
    const done = s.phases.find((p) => p.title === "Hold the ball")!;
    expect(done).toBeDefined();
    for (const p of s.phases.filter((p) => p.start >= done.start))
      for (const a of p.assignments!)
        expect([
          "BackupThrow",
          "BackupFielder",
          "SupportBase",
          "TrailRunner",
        ]).not.toContain(a.type);
    audit(s);
  });
  it("covers third for an imminent advancing R2 even when the chosen return is to second", () => {
    const c = make(200, 230, "Line drive"),
      move = new MovementEngine(),
      loc = move.starting(c),
      ball = move.field(c, loc),
      r = new BaserunningDecisionEngine().create(c);
    r[0] = {
      ...r[0],
      id: "R2",
      originBase: 2,
      progress: 2.4,
      goal: 3,
      decision: "advance",
    };
    const a = new DefensiveDecisionEngine().assign(
      c,
      ball,
      ball.fielder,
      2,
      loc,
      "contact",
      { runners: r, outs: 0 },
    );
    expect(
      a.assignments.some((a) => a.type === "CoverBase" && a.base === 3),
    ).toBe(true);
  });
  it("records all meaningful targets and rejected alternatives for a deliberate hold", () => {
    const c = make();
    c.throwTarget = "hold";
    const s = provider.generate(c);
    expect(throws(s)).toEqual([]);
    expect(s.dynamic.decisions[0].rejections?.map((r) => r.target)).toEqual([
      1,
      2,
      3,
      "home",
    ]);
    audit(s);
  });
});

describe("baseball tactical correctness: developing reads, profiles and new contacts", () => {
  it("uses a real 4-6-3 pivot rather than merely assigning second-base coverage", () => {
    const s = provider.generate(make(575, 425));
    expect(throws(s).map((e) => [e.player, e.base])).toEqual([
      ["2B", 2],
      ["SS", 1],
    ]);
    audit(s);
  });
  it("uses a ready SS for a pitcher force/pivot opportunity", () => {
    const s = provider.generate(make(500, 590));
    expect(throws(s).map((e) => [e.player, e.base])).toEqual([
      ["P", 2],
      ["SS", 1],
    ]);
    audit(s);
  });
  it("allows a poor bunt to be challenged at a lead force and keeps first covered", () => {
    const c = make(500, 650, "Bunt");
    c.anticipateBunt = true;
    const s = provider.generate(c);
    expect(throws(s)[0].base).toBe(2);
    expect(
      s.phases
        .find((p) => p.title === "Contact")!
        .assignments!.find((a) => a.player === "2B"),
    ).toMatchObject({ type: "CoverBase", base: 1 });
    audit(s);
  });
  it.each([
    [380, 650, "3B"],
    [620, 650, "1B"],
  ] as const)("coordinates a fair sacrifice bunt at %s,%s", (x, y, fielder) => {
    const c = make(x, y, "Bunt");
    c.ball.strength = "normal";
    c.anticipateBunt = true;
    const s = provider.generate(c),
      a = s.phases.find((p) => p.title === "Contact")!.assignments!;
    expect(s.dynamic.ball.fielder).toBe(fielder);
    expect(a.find((a) => a.player === "2B")).toMatchObject({
      type: "CoverBase",
      base: 1,
    });
    expect(a.find((a) => a.player === "SS")).toMatchObject({
      type: "CoverBase",
      base: 2,
    });
    expect(a.some((a) => a.type === "ChargeBunt")).toBe(true);
    expect(throws(s).length).toBeGreaterThan(0);
    audit(s);
  });
  it.each([636, 637, 638])(
    "covers third from contact behind an R1 sacrifice bunt toward %s,620",
    (x) => {
      const c = make(x, 620, "Bunt");
      c.ball.strength = "normal";
      c.aggression = "normal";
      const s = provider.generate(c);
      expect(s.dynamic.ball.fielder).toBe("P");
      expect(throws(s).map((e) => e.base)).toEqual([1]);
      const secured = s.dynamic.events.find((e) => e.type === "BallFielded")!;
      for (const p of s.phases.filter((p) => p.start < secured.time))
        expect(p.assignments!.find((a) => a.player === "3B")).toMatchObject({
          type: "CoverBase",
          base: 3,
          target: bases[3],
        });
      const recover = s.dynamic.diagnostics.find(
        (f) => f.trigger === "Ball secured / throwing target selected",
      )!;
      expect(recover.assignments.find((a) => a.player === "3B")).toMatchObject({
        type: "CoverBase",
        base: 3,
        target: bases[3],
      });
      expect(recover.runners.find((r) => r.id === "R1")!.goal).toBe(2);
      expect(
        recover.assignments.find((a) => a.player === "3B")!.arrivalTime,
      ).toBeLessThan(
        runningTime(
          { ...recover.runners.find((r) => r.id === "R1")!, goal: 3 },
          3,
        ),
      );
      expect(recover.assignments.find((a) => a.player === "2B")).toMatchObject({
        type: "CoverBase",
        base: 1,
      });
      expect(recover.assignments.find((a) => a.player === "SS")).toMatchObject({
        type: "CoverBase",
        base: 2,
      });
      const start = sample(s, secured.time).players.find((p) => p.id === "3B")!;
      const end = sample(s, duration(s));
      expect(metres(start.position, bases[3])).toBeLessThan(0.1);
      expect(
        metres(end.players.find((p) => p.id === "3B")!.position, bases[3]),
      ).toBeLessThan(0.1);
      expect(end.state.outs).toBe(1);
      expect(end.state.runners.R1).toBe(2);
      audit(s);
    },
  );
  it.each([0, 1] as const)(
    "retains third-base recovery with anticipated bunt positioning and %s outs",
    (outs) => {
      const c = make(637, 620, "Bunt");
      c.ball.strength = "normal";
      c.aggression = "normal";
      c.anticipateBunt = true;
      c.state.outs = outs;
      c.throwTarget = 1;
      const s = provider.generate(c);
      const recovery = s.dynamic.diagnostics.find(
        (f) => f.trigger === "Ball secured / throwing target selected",
      )!;
      expect(
        recovery.assignments.some(
          (a) => a.base === 3 && a.type === "CoverBase",
        ),
      ).toBe(true);
      const end = sample(s, duration(s));
      expect(
        metres(end.players.find((p) => p.id === "3B")!.position, bases[3]),
      ).toBeLessThan(0.1);
      expect(end.state.outs).toBe(outs + 1);
      audit(s);
    },
  );
  it("does not invent a third-base recovery for an empty-base bunt or continue it after the third out", () => {
    const c = make(637, 620, "Bunt");
    c.ball.strength = "normal";
    c.state.runners = {};
    const empty = provider.generate(c);
    expect(
      empty.phases
        .flatMap((p) => p.assignments!)
        .some((a) => a.reason === "buntRecoverThird"),
    ).toBe(false);
    audit(empty);
    c.state.runners = { R1: 1 };
    c.state.outs = 2;
    const thirdOut = provider.generate(c);
    const out = thirdOut.dynamic.events.find((e) => e.type === "RunnerOut")!;
    expect(sample(thirdOut, duration(thirdOut)).state.outs).toBe(3);
    expect(
      thirdOut.phases
        .filter((p) => p.start >= out.time)
        .flatMap((p) => p.assignments!)
        .some((a) => a.reason === "buntRecoverThird"),
    ).toBe(false);
    audit(thirdOut);
  });
  it("releases a forced runner on an uncatchable line drive before the first landing", () => {
    const c = make(700, 150, "Line drive"),
      s = provider.generate(c),
      landing = s.dynamic.ball.trajectory!.events.find(
        (e) => e.type === "landing",
      )!;
    expect(s.dynamic.ball.caught).toBe(false);
    const reads = s.dynamic.airborneReads!,
      commit = reads.find((r) => r.classification === "uncatchable")!;
    expect(commit).toBeDefined();
    expect(commit.time - 1).toBeLessThan(landing.t);
    expect(reads[0].classification).not.toBe("uncatchable");
    expect(
      commit.runners.find((r) => r.player === "R1")!.goal,
    ).toBeGreaterThanOrEqual(2);
    expect(
      s.dynamic.events.some(
        (e) =>
          e.type === "RunnerOut" &&
          e.player === "R1" &&
          e.base === 2 &&
          e.force,
      ),
    ).toBe(false);
    audit(s);
  });
  it("takes direction-dependent safe fly-ball leads and preserves a legal return", () => {
    const goals = [235, 500, 765].map((x) => {
      const s = provider.generate(make(x, 200, "Fly ball"));
      audit(s);
      return s.dynamic.airborneReads![0].runners.find((r) => r.player === "R1")!
        .goal;
    });
    expect(goals[0]).toBeGreaterThan(goals[1]);
    expect(goals[1]).toBeGreaterThan(goals[2]);
  });
  it("runs on contact with two outs and freezes live action on a catch", () => {
    const c = make(500, 100, "Fly ball");
    c.state.outs = 2;
    const s = provider.generate(c);
    expect(
      s.dynamic.diagnostics[0].runners.find((r) => r.id === "R1")!.goal,
    ).toBeGreaterThan(1);
    const out = s.dynamic.events.find((e) => e.type === "RunnerOut")!;
    expect(throws(s).some((e) => e.time > out.time)).toBe(false);
    audit(s);
  });
  it("uses a steep, high pop-up and declares infield fly only under qualifying conditions", () => {
    const c = make(450, 430, "Pop-up");
    c.state.runners = { R1: 1, R2: 2 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.trajectory!.launch.angle).toBeGreaterThan(65);
    expect(
      Math.max(...s.dynamic.ball.trajectory!.frames.map((f) => f.height ?? 0)),
    ).toBeGreaterThan(15);
    expect(s.dynamic.ball.infieldFly).toBe(true);
    expect(
      s.dynamic.events.filter(
        (e) => e.type === "RunnerOut" && e.player === "BR",
      ),
    ).toHaveLength(1);
    audit(s);
    c.state.outs = 2;
    expect(provider.generate(c).dynamic.ball.infieldFly).toBe(false);
  });
  it("returns an otherwise boundary-clearing ball from the high training net into a playable carom", () => {
    const c = make(887.52, 370.36, "Fly ball");
    const s = provider.generate(c);
    expect(s.dynamic.ball.boundary).toBeUndefined();
    expect(
      s.dynamic.ball.trajectory!.events.some((e) => e.type === "wall"),
    ).toBe(true);
    expect(s.dynamic.events.some((e) => e.type === "BallFielded")).toBe(true);
    const wall = s.dynamic.events.find((e) => e.type === "BallWallContact")!;
    expect(wall).toBeDefined();
    expect(
      s.dynamic.events.find((e) => e.type === "BallFielded")!.time,
    ).toBeGreaterThan(wall.time);
    expect(s.dynamic.ball.caught).toBe(false);
    audit(s);
  });
  it("preserves genuine boundary awards with an explicitly configured low fence", () => {
    const c = make(500, 15, "Fly ball");
    c.field = { fenceHeight: 2.5, fenceMode: "standard" };
    const s = provider.generate(c);
    expect(s.dynamic.ball.boundary).toBe("home-run");
    expect(sample(s, duration(s)).state.runs).toBe(2);
    audit(s);
  });
  it("protects a committed first-base receiver when a new home threat develops", () => {
    const c = make(640, 430);
    c.state.runners = { R1: 1, R2: 2 };
    c.ball.strength = "normal";
    audit(provider.generate(c));
  });
});

describe("baseball tactical correctness: run prevention and calibration", () => {
  it.each([
    [232, 173, "LF", "fast"],
    [558, 284, "CF", "average"],
    [814, 219, "RF", "fast"],
  ] as const)(
    "challenges a realistic home opportunity from %s,%s (%s)",
    (x, y, fielder, speed) => {
      for (const dx of [-1, 0, 1]) {
        const c = make(x + dx, y);
        c.state.runners = { R2: 2 };
        c.runnerSpeed = speed;
        const s = provider.generate(c);
        expect(s.dynamic.ball.fielder).toBe(fielder);
        const d = s.dynamic.decisions[0];
        expect(d.target).toBe("home");
        const home = d.alternatives!.find((a) => a.target === "home")!;
        expect(home.viable || home.competitive).toBe(true);
        expect(home.preventsRun).toBe(true);
        expect(throws(s).some((e) => e.base === "home")).toBe(true);
        const a = s.phases.find(
          (p) => p.title === "Field & decide",
        )!.assignments!;
        expect(a.find((a) => a.player === "P")).toMatchObject({
          type: "BackupThrow",
          base: "home",
        });
        expect(a.some((a) => a.player === "C" && a.base === "home")).toBe(true);
        audit(s);
      }
    },
  );
  it("concedes a runner already certain to score rather than forcing a hopeless home throw", () => {
    const c = make(80, 340);
    c.state.runners = { R3: 3 };
    c.runnerSpeed = "fast";
    const s = provider.generate(c);
    expect(s.dynamic.decisions[0].target).not.toBe("home");
    expect(
      s.dynamic.events.some((e) => e.type === "RunScored" && e.player === "R3"),
    ).toBe(true);
    audit(s);
  });
  it("makes a shallow caught-fly tag attempt a timing-based risk against a strong return", () => {
    const c = make(500, 212, "Fly ball");
    c.runnerSpeed = "fast";
    c.armStrength = "strong";
    c.state.runners = { R3: 3 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    expect(
      s.dynamic.events.some(
        (e) => e.type === "RunnerTaggedUp" && e.player === "R3",
      ),
    ).toBe(true);
    expect(throws(s)[0].base).toBe("home");
    expect(
      s.dynamic.events.some(
        (e) => e.type === "RunnerOut" && e.player === "R3" && !e.force,
      ),
    ).toBe(true);
    audit(s);
  });
  it("allows a deep catch to yield a successful tag-up instead of a guaranteed plate out", () => {
    const c = make(500, 174, "Fly ball");
    c.ball.strength = "normal";
    c.state.runners = { R3: 3 };
    c.runnerSpeed = "fast";
    c.armStrength = "strong";
    const s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    expect(
      s.dynamic.events.some((e) => e.type === "RunScored" && e.player === "R3"),
    ).toBe(true);
    audit(s);
  });
  it("does not describe a retouch-and-hold as a tag-up departure", () => {
    const c = make(500, 307, "Fly ball");
    c.ball.strength = "soft";
    c.state.runners = { R3: 3 };
    const s = provider.generate(c);
    expect(s.dynamic.ball.caught).toBe(true);
    expect(s.dynamic.events.some((e) => e.type === "RunnerRetouched")).toBe(
      true,
    );
    expect(s.dynamic.events.some((e) => e.type === "RunnerTaggedUp")).toBe(
      false,
    );
    audit(s);
  });
  it("retains a timely non-force appeal when a runner has not retouched", () => {
    const c = make(),
      move = new MovementEngine(),
      loc = move.starting(c),
      ball = move.field(c, loc),
      rs = new BaserunningDecisionEngine().create(c);
    const br = rs.find((r) => r.id === "BR")!;
    br.status = "out";
    const r = rs.find((r) => r.id === "R1")!;
    r.progress = 1.5;
    r.goal = 1;
    r.decision = "retreat";
    r.retouchBase = 1;
    r.forceRemoved = true;
    loc["1B"] = { x: 700, y: 570 };
    ball.fieldingPoint = loc["1B"];
    ball.caught = true;
    const d = new DefensiveDecisionEngine().choose(
      c,
      ball,
      rs,
      1,
      loc,
      "1B",
      "received",
    );
    expect(d).toMatchObject({ target: 1, appeal: true, force: false });
  });
});

describe("shared tactical timing and live-play reevaluation", () => {
  it("distinguishes feeds, pivots and full outfield flight instead of one universal velocity", () => {
    expect(throwingProfile(bases[2], bases[1], "SS").kind).toBe("pivot");
    expect(throwingProfile(bases[2], { x: 520, y: 390 }, "SS").kind).toBe(
      "feed",
    );
    expect(
      throwingProfile({ x: 765, y: 295 }, bases.home, "RF").speed,
    ).toBeGreaterThan(
      throwingProfile({ x: 390, y: 390 }, bases[1], "SS").speed,
    );
    for (const strength of ["developing", "standard", "strong"] as const) {
      const c = make(814, 219);
      c.state.runners = { R2: 2 };
      c.runnerSpeed = "fast";
      c.armStrength = strength;
      const s = provider.generate(c);
      for (const e of throws(s)) {
        const glove = s.dynamic.events.find(
          (g) => g.type === "ThrowGloveContact" && g.time >= e.time,
        )!;
        const phases = s.phases.filter(
          (p) =>
            p.ball.kind === "travel" &&
            p.ball.style === "throw" &&
            p.start >= e.time - 1e-6 &&
            p.start < glove.time - 1e-6,
        );
        const from = (phases[0].ball as { path: { x: number; y: number }[] })
            .path[0],
          to = (
            phases.at(-1)!.ball as { path: { x: number; y: number }[] }
          ).path.at(-1)!;
        expect(glove.time - e.time).toBeCloseTo(
          metres(from, to) /
            throwingProfile(from, to, e.player as Position, strength).speed,
          4,
        );
      }
      audit(s);
    }
  });
  it("steers a modest lane correction without an unnecessary complete stop", () => {
    const p = planMotion(
      { position: { x: 0, y: 0 }, velocity: { x: 6, y: 0 } },
      { x: 30, y: 10 },
      6,
      5,
    );
    for (let t = 0; t < 1; t += 0.1)
      expect(
        Math.hypot(...Object.values(sampleMotion(p, t).velocity)),
      ).toBeGreaterThan(4);
    for (const l of p.legs)
      expect(
        Math.hypot(l.acceleration.x, l.acceleration.y),
      ).toBeLessThanOrEqual(5.00001);
  });
  it("reconsiders a live home opportunity after an initial hold instead of ending the play", () => {
    const c = make(500, 212, "Fly ball");
    c.state.runners = { R3: 3 };
    c.runnerSpeed = "fast";
    c.armStrength = "strong";
    const original = DefensiveDecisionEngine.prototype.choose,
      spy = vi
        .spyOn(DefensiveDecisionEngine.prototype, "choose")
        .mockImplementation(function (this: DefensiveDecisionEngine, ...args) {
          const d = original.apply(this, args);
          return args[6] === "received"
            ? d
            : {
                ...d,
                target: "hold",
                runner: undefined,
                reason: message("targetHold"),
              };
        });
    try {
      const s = provider.generate(c);
      expect(s.dynamic.decisions[0].target).toBe("hold");
      expect(throws(s).some((e) => e.base === "home")).toBe(true);
      audit(s);
    } finally {
      spy.mockRestore();
    }
  });
  it("rejects unsupported squeezes and impossible fence values explicitly", () => {
    const c = make(500, 650, "Bunt");
    c.state.runners = { R3: 3 };
    expect(validateSettings(c)).toBeDefined();
    c.state.runners = { R1: 1 };
    c.field = { fenceHeight: 0, fenceMode: "standard" };
    expect(validateSettings(c)).toBeDefined();
  });
});

describe("independent coaching cases across feeds and runner profiles", () => {
  it.each([313, 315, 317])(
    "attempts an available 5-4-3 across nearby third-base grounders (%s)",
    (x) => {
      const c = make(x, 520);
      c.runnerSpeed = "slow";
      const s = provider.generate(c);
      expect(
        throws(s)
          .slice(0, 2)
          .map((e) => [e.player, e.base]),
      ).toEqual([
        ["3B", 2],
        ["2B", 1],
      ]);
      audit(s);
    },
  );
  it.each(["soft", "normal", "hard"] as const)(
    "evaluates both throws with %s contact and three runner speeds",
    (strength) => {
      for (const speed of ["slow", "average", "fast"] as const) {
        const c = make();
        c.ball.strength = strength;
        c.runnerSpeed = speed;
        const s = provider.generate(c),
          d = s.dynamic.decisions[0];
        if (d.continuation && d.continuation.margin > 0.3)
          expect(throws(s).some((e) => e.base === 1)).toBe(true);
        for (const e of s.dynamic.events.filter(
          (e) => e.type === "RunnerOut" && e.player === "BR" && e.base === 1,
        )) {
          const firstTouch = s.dynamic.events.find(
            (v) =>
              (v.type === "RunnerAdvanced" || v.type === "RunnerBaseTouch") &&
              v.player === "BR" &&
              v.base === 1,
          );
          if (firstTouch) expect(e.time).toBeLessThanOrEqual(firstTouch.time);
        }
        audit(s);
      }
    },
  );
  it("does not add a second throw after an inning-ending 4-6 force", () => {
    const c = make(575, 425);
    c.runnerSpeed = "slow";
    c.state.outs = 2;
    const s = provider.generate(c),
      out = s.dynamic.events.find((e) => e.type === "RunnerOut")!;
    expect(throws(s).filter((e) => e.time > out.time)).toEqual([]);
    expect(
      s.phases
        .filter((p) => p.start >= out.time)
        .flatMap((p) => p.assignments!)
        .every((a) =>
          ["Decelerate", "HoldPosition", "PossessBall"].includes(a.type),
        ),
    ).toBe(true);
    audit(s);
  });
  it("keeps third covered on an ordinary first-and-second sacrifice defense", () => {
    const c = make(500, 650, "Bunt");
    c.state.runners = { R1: 1, R2: 2 };
    c.anticipateBunt = true;
    const s = provider.generate(c);
    const phase = s.phases.find((p) => p.title === "Contact")!;
    expect(
      phase.assignments!.some((a) => a.type === "CoverBase" && a.base === 3),
    ).toBe(true);
    audit(s);
  });
});

it("weighs an attainable inning-ending double-play sequence against a scoring threat", () => {
  const c = make(575, 425);
  c.state.runners = { R1: 1, R3: 3 };
  c.state.outs = 1;
  const s = provider.generate(c),
    d = s.dynamic.decisions[0];
  expect(d.target).toBe(2);
  expect(d.continuation!.margin).toBeGreaterThan(0);
  expect(d.alternatives!.find((a) => a.target === 2)!.preventsRun).toBe(true);
  expect(
    throws(s)
      .slice(0, 2)
      .map((e) => e.base),
  ).toEqual([2, 1]);
  expect(sample(s, duration(s)).state.outs).toBe(3);
  expect(sample(s, duration(s)).state.runs).toBe(0);
  audit(s);
});

it("holds on a shallower caught fly when the strong return makes a tag-up unjustified", () => {
  const c = make(500, 231, "Fly ball");
  c.state.runners = { R3: 3 };
  c.runnerSpeed = "fast";
  c.armStrength = "strong";
  const s = provider.generate(c);
  expect(s.dynamic.ball.caught).toBe(true);
  expect(s.dynamic.events.some((e) => e.type === "RunnerTaggedUp")).toBe(false);
  expect(sample(s, duration(s)).state.runners.R3).toBe(3);
  audit(s);
});

it("reserves a timely third-base replacement ahead of a redundant bunt charge", () => {
  const c = make(380, 650, "Bunt");
  c.state.runners = { R1: 1, R2: 2 };
  c.anticipateBunt = true;
  const move = new MovementEngine(),
    loc = move.starting(c),
    ball = move.field(c, loc),
    rs = new BaserunningDecisionEngine().create(c);
  new BaserunningDecisionEngine().plan(c, ball, rs, 0, true);
  ball.fielder = "3B";
  ball.fieldingPoint = { x: 350, y: 620 };
  ball.pursuitTarget = ball.fieldingPoint;
  const a = new DefensiveDecisionEngine().assign(
    c,
    ball,
    "3B",
    2,
    loc,
    "contact",
    { runners: rs, outs: 0 },
  );
  expect(a.assignments.find((a) => a.player === "P")).toMatchObject({
    type: "CoverBase",
    base: 3,
  });
  expect(a.assignments.find((a) => a.player === "SS")).toMatchObject({
    type: "CoverBase",
    base: 2,
  });
});
