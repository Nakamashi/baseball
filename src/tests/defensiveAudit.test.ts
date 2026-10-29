import {
  runningTime as importedRunningTime,
  advanceProgress,
  runningAdvance,
} from "../dynamic/runningGeometry";
import { describe, expect, it, vi, afterEach } from "vitest";
import { defensiveAuditCases } from "../dynamic/auditCases";
import { DynamicPlayProvider, defaultSettings } from "../dynamic/provider";
import {
  DefensiveDecisionEngine,
  assignmentText,
  backupPoint,
} from "../dynamic/defense";
import { planMotion, sampleMotion } from "../dynamic/locomotion";
import { MovementEngine } from "../dynamic/movement";
import { BaserunningDecisionEngine } from "../dynamic/baserunning";
import { inspectDefense } from "../dynamic/diagnostics";
import { throwingProfile } from "../dynamic/throwing";
import { assumptions, conventions } from "../dynamic/conventions";
import {
  bases,
  defaults,
  isOutfield,
  isPlayable,
  metres,
  toWorld,
  fromWorld,
} from "../dynamic/geometry";
import { positions, type Position } from "../simulation/types";
import { sample, duration } from "../simulation/timeline";
import { validateScenario } from "../simulation/scenarioValidation";
import { formatDynamic, message } from "../dynamic/messages";
import type { DynamicScenario, DynamicSettings } from "../dynamic/types";
const provider = new DynamicPlayProvider(),
  engine = new DefensiveDecisionEngine();
const cases = defensiveAuditCases();
// These CPU-heavy matrices can occupy a worker for over a minute on CI.
// Yield between tests so Vitest can deliver its queued IPC/report updates.
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const assignment = (s: DynamicScenario, player: Position, phase = "Contact") =>
  s.phases
    .find((p) => p.title === phase)!
    .assignments!.find((a) => a.player === player)!;
const fieldedTime = (s: DynamicScenario) =>
  s.dynamic.events.find((e) => e.type === "BallFielded")!.time;
const fielded = (s: DynamicScenario, player: Position) =>
  s.phases
    .find((p) => p.start >= fieldedTime(s))!
    .assignments!.find((a) => a.player === player)!;
/** Independent physical checks, applied to every player in every phase of every
 * review fixture. These do not assume every valid responsibility requires motion. */
function auditAllNine(s: DynamicScenario) {
  expect(validateScenario(s)).toEqual([]);
  for (const phase of s.phases) {
    const before = sample(s, phase.start);
    expect(phase.assignments).toHaveLength(9);
    expect(new Set(phase.assignments!.map((a) => a.player))).toEqual(
      new Set(positions),
    );
    for (const a of phase.assignments!) {
      expect(Number.isFinite(a.target.x) && Number.isFinite(a.target.y)).toBe(
        true,
      );
      expect(a.priority).toBeGreaterThan(0);
      expect(a.reason).toBeTruthy();
      const text = assignmentText(a);
      expect(a.explanation).toBe(text.why);
      for (const value of Object.values(text))
        for (const locale of ["en", "ja"] as const) {
          const translated = formatDynamic(value, locale)!;
          expect(translated).not.toMatch(/@v2:|\{\w+\}/);
          if (locale === "ja") expect(translated).toMatch(/[ぁ-んァ-ヶ一-龯]/);
        }
      const move = phase.movements.find((m) => m.player === a.player);
      const start = before.players.find((p) => p.id === a.player)!.position;
      if (a.type === "HoldPosition") {
        expect(move).toBeUndefined();
        expect(metres(start, a.target)).toBeLessThan(0.001);
      }
      if (move) {
        expect(metres(move.path[0], start)).toBeLessThan(0.001);
        const end = move.path.at(-1)!;
        expect(metres(start, end)).toBeLessThanOrEqual(
          assumptions.defenderSpeed * phase.duration + 0.001,
        );
        // Momentum may initially carry a reassigned player away from the new target.
        // Check the actual timed route rather than assuming instantaneous turns.
        const samples = move.samples;
        if (samples)
          for (let i = 1; i < samples.length; i++) {
            const dt = samples[i].t - samples[i - 1].t;
            expect(
              metres(samples[i - 1].point, samples[i].point),
            ).toBeLessThanOrEqual(assumptions.defenderSpeed * dt + 0.00001);
          }
      }
      if (a.throwOrigin && a.base) {
        const b = toWorld(a.receivingPoint ?? bases[a.base]),
          from = toWorld(a.throwOrigin),
          target = toWorld(a.target);
        // Behind the receiver, along THIS throw's extension, not a base constant.
        const dot =
          (target.x - b.x) * (b.x - from.x) + (target.y - b.y) * (b.y - from.y);
        expect(dot).toBeGreaterThanOrEqual(-0.001);
        const cross =
          (target.x - b.x) * (b.y - from.y) - (target.y - b.y) * (b.x - from.x);
        expect(Math.abs(cross)).toBeLessThan(0.001);
      }
      if (phase.title !== "Ready" && a.type === "PossessBall")
        expect(before.owner).toBe(a.player);
    }
    if (phase.ball.kind === "travel" && phase.ball.receiver) {
      const end = sample(s, phase.start + phase.duration);
      const destination = phase.ball.path.at(-1)!;
      const receivingPlayer = end.players.find(
        (p) => p.id === (phase.ball as { receiver: Position }).receiver,
      )!;
      expect(metres(receivingPlayer.position, destination)).toBeLessThan(
        phase.ball.style === "hit" ? assumptions.fieldingReach + 0.001 : 0.01,
      );
    }
  }
  // Scrubbing cannot mutate compiled assignments or replay decisions.
  const middle = sample(s, duration(s) * 0.43);
  sample(s, duration(s));
  sample(s, 0);
  expect(sample(s, duration(s) * 0.43)).toEqual(middle);
}
describe("defensive fundamentals review situations", () => {
  it.each(Object.keys(cases))("audits all nine throughout %s", (name) =>
    auditAllNine(provider.generate(cases[name])),
  );
  it("1: ground ball to second backs the ball first, then the throw", () => {
    const s = provider.generate(cases["ground-second"]);
    expect(s.dynamic.ball.fielder).toBe("2B");
    expect(assignment(s, "1B")).toMatchObject({ type: "CoverBase", base: 1 });
    expect(assignment(s, "P")).toMatchObject({ type: "BackupThrow", base: 1 });
    expect(assignment(s, "C")).toMatchObject({
      type: "BackupThrow",
      base: 1,
      reason: "catcherSupport",
    });
    expect(assignment(s, "RF")).toMatchObject({
      type: "BackupFielder",
      teammate: "2B",
    });
    expect(fielded(s, "RF")).toMatchObject({ type: "BackupThrow", base: 1 });
    expect(fielded(s, "RF").target).not.toEqual(assignment(s, "RF").target);
    for (const id of ["P", "C", "RF"] as const)
      expect(
        s.phases
          .find((p) => p.title === "Contact")!
          .movements.some((m) => m.player === id),
      ).toBe(true);
  });
  it("2: shortstop grounder has catcher, pitcher and right-field support at first", () => {
    const s = provider.generate(cases["ground-short"]);
    expect(s.dynamic.ball.fielder).toBe("SS");
    for (const id of ["C", "P", "RF"] as const)
      expect(assignment(s, id).base).toBe(1);
    expect(assignment(s, "2B")).toMatchObject({ type: "CoverBase", base: 2 });
  });
  it("3: a possible 6-4-3 has distinct fielding, pivot, first and backup jobs", () => {
    const s = provider.generate(cases["double-play"]);
    expect(assignment(s, "SS").type).toBe("FieldBall");
    expect(assignment(s, "2B")).toMatchObject({ type: "CoverBase", base: 2 });
    expect(assignment(s, "1B")).toMatchObject({ type: "CoverBase", base: 1 });
    expect(s.dynamic.decisions.map((d) => d.target)).toEqual([2, 1]);
    expect(
      s.phases.some((p) =>
        p.assignments!.some((a) => a.type === "BackupThrow" && a.base === 2),
      ),
    ).toBe(true);
  });
  it("4: a runner at third protects the catcher from the optional first-base job", () => {
    const s = provider.generate(cases["third-ground-second"]);
    expect(assignment(s, "C")).toMatchObject({
      type: "CoverBase",
      base: "home",
      reason: "homeThreat",
    });
    for (const p of s.phases.filter((p) => p.title !== "Outcome"))
      expect(p.assignments!.find((a) => a.player === "C")!.reason).not.toBe(
        "catcherSupport",
      );
  });
  it("5: a left-field single has CF ball backup and RF second-base support", () => {
    const s = provider.generate(cases["single-left"]);
    expect(assignment(s, "CF")).toMatchObject({
      type: "BackupFielder",
      teammate: "LF",
    });
    expect(assignment(s, "RF")).toMatchObject({ type: "SupportBase", base: 2 });
    expect(assignment(s, "P")).toMatchObject({ type: "BackupThrow", base: 2, receivingPoint: bases[2] });
    expect(
      s.phases
        .find((p) => p.title === "Contact")!
        .movements.some((m) => m.player === "RF"),
    ).toBe(true);
    expect(assignment(s, "3B")).toMatchObject({
      type: "CoverBase",
      base: 3,
      reason: "thirdControl",
    });
  });
  it("6: on a left-field single, ball-side SS cuts while 2B receives", () => {
    const s = provider.generate(cases["first-single-left"]);
    expect(assignment(s, "SS")).toMatchObject({ type: "Cutoff", base: 2 });
    expect(assignment(s, "2B")).toMatchObject({ type: "CoverBase", base: 2 });
    expect(assignment(s, "RF").base).toBe(2);
    expect(
      s.dynamic.diagnostics.some((f) => f.route.kind === "through-cutoff"),
    ).toBe(true);
    expect(
      s.dynamic.events
        .filter((e) => e.type === "ThrowReceived")
        .map((e) => e.player),
    ).toEqual(["2B"]);
  });
  it("7 and 11: a scoring attempt is compared with BR's second-base attempt", () => {
    const s = provider.generate(cases["aggressive-home"]),
      d = s.dynamic.decisions[0];
    expect(d.target).toBe("home");
    expect(
      d.alternatives!.some((a) => a.target === 2 && a.runner === "BR"),
    ).toBe(true);
    expect(d.alternatives!.find((a) => a.target === "home")!.viable).toBe(true);
    expect(fielded(s, "P")).toMatchObject({
      type: "BackupThrow",
      base: "home",
    });
    expect(fielded(s, "1B")).toMatchObject({ type: "Cutoff", base: "home" });
    expect(
      s.dynamic.events.some(
        (e) => e.type === "RunnerOut" && e.player === "R2" && e.base === "home",
      ),
    ).toBe(true);
    expect(sample(s, duration(s)).state.runs).toBe(0);
  });
  it("8: 1B is released to trail only after first is no longer threatened", () => {
    const s = provider.generate(cases["extra-base-trail"]);
    expect(assignment(s, "1B")).toMatchObject({ type: "CoverBase", base: 1 });
    const p = s.phases.find((p) =>
      p.assignments!.some((a) => a.player === "1B" && a.type === "TrailRunner"),
    )!;
    expect(p).toBeDefined();
    const snap = sample(s, p.start),
      br = snap.players.find((p) => p.id === "BR")!;
    expect(metres(br.position, bases.home)).toBeGreaterThan(
      assumptions.baseMetres,
    );
    const a = p.assignments!.find((a) => a.player === "1B")!;
    // First-to-second lane is x-y=130; trailing target stays four metres outside.
    const world = toWorld(a.target),
      first = toWorld(bases[1]);
    expect(
      Math.abs(world.x - world.y - (first.x - first.y)) / Math.sqrt(2),
    ).toBeCloseTo(4, 4);
    const home = provider.generate(cases["aggressive-home"]);
    expect(["Cutoff", "Relay"]).toContain(
      home.phases
        .find((p) => p.title === "Field & decide")!
        .assignments!.find((a) => a.player === "1B")!.type,
    );
    expect(
      home.phases
        .filter(
          (p) =>
            p.start <
            (home.dynamic.events.find(
              (e) => e.type === "ThrowReceived" && e.player === "C",
            )?.time ?? 0),
        )
        .flatMap((p) => p.assignments!)
        .some((a) => a.player === "1B" && a.type === "TrailRunner"),
    ).toBe(false);
  });
  it("9: a long relay home keeps separate receivers, live bases and backups", () => {
    const s = provider.generate(cases["deep-left-centre"]);
    const contact = s.phases.find((p) => p.title === "Contact")!;
    const relay = contact.assignments!.find(
      (a) => a.type === "Relay" && a.base === "home",
    )!;
    expect(relay).toBeDefined();
    expect(relay.player).not.toBe(s.dynamic.ball.fielder);
    for (const base of [1, 2, "home"] as const)
      expect(
        contact.assignments!.some(
          (a) => a.type === "CoverBase" && a.base === base,
        ),
      ).toBe(true);
    expect(
      s.dynamic.events
        .filter((e) => e.type === "ThrowReceived")
        .map((e) => e.player),
    ).toEqual([relay.player, "C"]);
  });
  it("10: changing from home to second changes cutoff, receiver and supporting lanes", () => {
    const c = cases["home-to-second"],
      movement = new MovementEngine();
    const locations = movement.starting(c),
      ball = movement.field(c, locations);
    const runners = new BaserunningDecisionEngine().create(c);
    const home = engine.assign(
      c,
      ball,
      ball.fielder,
      "home",
      locations,
      "fielded",
      { runners, outs: 0 },
    );
    const second = engine.assign(
      c,
      ball,
      ball.fielder,
      2,
      locations,
      "fielded",
      { runners, outs: 0 },
    );
    for (const p of positions) {
      expect(home.assignments.some((a) => a.player === p)).toBe(true);
      expect(second.assignments.some((a) => a.player === p)).toBe(true);
    }
    expect(home.cutoff).toBe("1B");
    expect(second.cutoff).toBe("2B");
    expect(home.receiver).toBe("C");
    expect(second.receiver).toBe("SS");
    expect(home.assignments.find((a) => a.player === "LF")!.target).not.toEqual(
      second.assignments.find((a) => a.player === "LF")!.target,
    );
    const s = provider.generate(c),
      override = structuredClone(c);
    override.throwTarget = 2;
    const t = provider.generate(override);
    expect(s.phases.find((p) => p.title === "Throw")!.movements).not.toEqual(
      t.phases.find((p) => p.title === "Throw")!.movements,
    );
    auditAllNine(t);
  });
  it("12: infield-in keeps C home and reevaluates the safe throw after contact", () => {
    const s = provider.generate(cases["infield-in"]);
    expect(assignment(s, "C").base).toBe("home");
    for (const p of ["1B", "2B", "3B", "SS"] as const)
      expect(metres(s.startingPositions[p], bases.home)).toBeLessThan(
        metres(defaults[p], bases.home),
      );
    expect(s.dynamic.decisions[0].target).toBe(1); // R3 holds; no invented home out.
    expect(
      s.dynamic.decisions[0].alternatives!.some((c) => c.target === "home"),
    ).toBe(false);
  });
});

describe("reusable tactical rules and diagnostics", () => {
  it("uses the actual throwing origin to back up the same base from different lanes", () => {
    const a = backupPoint({ x: 350, y: 430 }, bases[1]);
    const b = backupPoint({ x: 640, y: 430 }, bases[1]);
    expect(a).not.toEqual(b);
    expect(metres(a, bases[1])).toBeCloseTo(8, 5);
    expect(metres(b, bases[1])).toBeCloseTo(8, 5);
  });
  it("does not promise a late backup is ready, and selects the nearer free candidate", () => {
    const s = provider.generate(cases["ground-short"]);
    expect(
      s.dynamic.diagnostics
        .flatMap((f) => f.issues)
        .some((i) => i.kind === "late-backup"),
    ).toBe(true);
    const c = defaultSettings(),
      movement = new MovementEngine(),
      loc = movement.starting(c),
      ball = movement.field(c, loc);
    // Free candidates are ranked by travel time rather than locking in the
    // opposite outfielder when an adjacent fielder is already in position.
    loc[ball.fielder] = ball.fieldingPoint;
    loc.CF = backupPoint(ball.fieldingPoint, bases[2]);
    loc.LF = { x: 40, y: 800 };
    const plan = engine.assign(c, ball, ball.fielder, 2, loc, "fielded", {
      runners: [],
      outs: 0,
    });
    const backup = plan.assignments.find((a) => a.player === "CF")!;
    expect(["BackupThrow", "SupportBase"]).toContain(backup.type);
    expect(backup.arrivalTime).toBeCloseTo(0, 5);
  });
  it("does not chase a runner certain to score when another out is available", () => {
    const c = cases["aggressive-home"],
      movement = new MovementEngine(),
      loc = movement.starting(c),
      ball = movement.field(c, loc);
    loc[ball.fielder] = ball.fieldingPoint;
    const r = new BaserunningDecisionEngine().create(c);
    Object.assign(
      r.find((r) => r.id === "R2")!,
      { progress: 3.95, goal: 4, decision: "advance" },
    );
    Object.assign(
      r.find((r) => r.id === "BR")!,
      { progress: 1.05, goal: 2, decision: "advance" },
    );
    const d = engine.choose(c, ball, r, 0, loc);
    expect(d.target).toBe(2);
    expect(d.alternatives!.find((a) => a.target === "home")!).toMatchObject({
      viable: false,
      reason: "too-late",
    });
  });
  it("compares reliable inning-ending forces with run prevention and avoids late throws", () => {
    const c = structuredClone(cases["aggressive-home"]),
      movement = new MovementEngine();
    c.ball = {
      type: "Ground ball",
      destination: { x: 360, y: 440 },
      strength: "normal",
    };
    const loc = movement.starting(c),
      ball = movement.field(c, loc),
      r = new BaserunningDecisionEngine().create(c);
    loc[ball.fielder] = ball.fieldingPoint;
    Object.assign(
      r.find((r) => r.id === "R2")!,
      { progress: 3.5, goal: 4, decision: "advance" },
    );
    Object.assign(
      r.find((r) => r.id === "BR")!,
      { progress: 0.1, goal: 1, decision: "advance" },
    );
    expect(engine.choose(c, ball, r, 2, loc).target).toBe(1);
  });
  it("holds at a requested cutoff without inventing an onward throw", () => {
    const c = structuredClone(cases["first-single-left"]);
    c.throwTarget = "cutoff";
    const s = provider.generate(c);
    auditAllNine(s);
    expect(
      s.dynamic.events
        .filter((e) => e.type === "ThrowReceived")
        .map((e) => e.player),
    ).toEqual(["SS"]);
    expect(
      s.dynamic.diagnostics.some((f) => f.trigger === "Cutoff holds the ball"),
    ).toBe(true);
  });
  it("redirects a relay from home to second after a controlled runner retreat", () => {
    const c = structuredClone(cases["center-home-close"]);
    // Supply an explicit change of runner intent at reception. The existing
    // aggression heuristic normally continues this attempt; the defensive
    // compiler must also handle the legitimate decision to abandon it.
    const reaction = vi
      .spyOn(BaserunningDecisionEngine.prototype, "reconsider")
      .mockImplementation((_settings, runners) => {
        const lead = runners.find((r) => r.id === "R2")!;
        lead.goal = 3;
        lead.decision = "retreat";
        return [lead];
      });
    try {
      const s = provider.generate(c);
      expect(s.dynamic.decisions.map((d) => d.target)).toEqual(["home", 2]);
      expect(
        s.dynamic.events
          .filter((e) => e.type === "ThrowReceived")
          .map((e) => e.player),
      ).toEqual(["2B", "SS"]);
      const before = s.dynamic.diagnostics.find(
        (f) => f.route.kind === "relay",
      )!;
      const after = s.dynamic.diagnostics.find(
        (f) => f.trigger === "Relay received / target reconsidered",
      )!;
      expect(after.target).toBe(2);
      expect(
        after.assignments.find((a) => a.player === "CF")!.target,
      ).not.toEqual(before.assignments.find((a) => a.player === "CF")!.target);
      auditAllNine(s);
    } finally {
      reaction.mockRestore();
    }
  });
  it("weights score and inning while prioritizing a real run-saving opportunity", () => {
    const c = defaultSettings();
    c.state.runners = { R1: 1, R3: 3 };
    c.ball = { ...cases["aggressive-home"].ball };
    const movement = new MovementEngine(),
      loc = movement.starting(c),
      ball = movement.field(c, loc);
    loc[ball.fielder] = ball.fieldingPoint;
    const r = new BaserunningDecisionEngine().create(c);
    Object.assign(
      r.find((r) => r.id === "R3")!,
      { progress: 3, goal: 4, decision: "advance" },
    );
    Object.assign(
      r.find((r) => r.id === "R1")!,
      { progress: 1.05, goal: 2, decision: "advance" },
    );
    Object.assign(
      r.find((r) => r.id === "BR")!,
      { progress: 0.1, goal: 1, decision: "advance" },
    );
    const ready = engine.assign(c, ball, ball.fielder, "home", loc, "fielded", {
      runners: r,
      outs: 0,
    });
    loc[ready.cutoff!] = ready.assignments.find(
      (a) => a.player === ready.cutoff,
    )!.target;
    loc.C = bases.home;
    const early = engine.choose(c, ball, r, 0, loc);
    expect(early.target).toBe("home");
    expect(early.alternatives!.find((a) => a.target === 2)!.preventsRun).toBe(
      false,
    );
    c.state.inning = 7;
    const late = engine.choose(c, ball, r, 0, loc);
    expect(late.target).toBe("home");
    expect(
      late.alternatives!.find((a) => a.target === "home")!.score,
    ).toBeGreaterThan(
      early.alternatives!.find((a) => a.target === "home")!.score,
    );
    c.state.homeScore = 10;
    const ahead = engine.choose(c, ball, r, 0, loc);
    expect(ahead.target).toBe("home");
    expect(ahead.alternatives!.find((a) => a.target === "home")!.score).toBe(
      early.alternatives!.find((a) => a.target === "home")!.score,
    );
  });
  it("starts runners held at first, uses double-play depth, and respects outs and context", () => {
    const c = defaultSettings(),
      movement = new MovementEngine();
    const dp = movement.starting(c);
    expect(metres(dp["1B"], bases[1])).toBeLessThan(2);
    for (const p of ["SS", "2B"] as const)
      expect(metres(dp[p], bases[2])).toBeLessThan(
        metres(defaults[p], bases[2]),
      );
    c.state.outs = 2;
    expect(movement.starting(c).SS).toEqual(defaults.SS);
    c.state.runners = { R3: 3 };
    c.state.outs = 0;
    c.state.inning = 5;
    const halfway = movement.starting(c);
    expect(metres(halfway.SS, bases.home)).toBeLessThan(
      metres(defaults.SS, bases.home),
    );
    c.state.homeScore = 10;
    expect(movement.starting(c).SS).toEqual(defaults.SS);
    c.state.strategy = "prevent";
    expect(movement.starting(c).SS).not.toEqual(defaults.SS);
    c.state.outs = 2;
    expect(movement.starting(c).SS).toEqual(defaults.SS);
  });
  it("can leave catcher support at home as an alternate team convention", () => {
    const previous = conventions.catcherBackupFirst;
    conventions.catcherBackupFirst = false;
    try {
      const s = provider.generate(cases["ground-second"]);
      expect(assignment(s, "C")).toMatchObject({
        type: "HoldPosition",
        reason: "homeGuard",
      });
      expect(assignment(s, "P")).toMatchObject({
        type: "BackupThrow",
        base: 1,
      });
      auditAllNine(s);
    } finally {
      conventions.catcherBackupFirst = previous;
    }
  });
  it("uses RF at second when both middle infielders have higher-priority jobs", () => {
    const c = defaultSettings(),
      loc = new MovementEngine().starting(c);
    const ball = {
      ...new MovementEngine().field(c, loc),
      fielder: "2B" as const,
    };
    ball.fieldingPoint = { x: 500, y: 150 };
    loc["2B"] = ball.fieldingPoint;
    loc.RF = { x: 520, y: 400 }; // Already adjusting toward second; CF is farther away.
    const runners = new BaserunningDecisionEngine().create(c);
    for (const r of runners) r.goal = r.originBase + 1;
    const plan = engine.assign(c, ball, "2B", 3, loc, "fielded", {
      runners,
      outs: 0,
    });
    expect(plan.cutoff).toBe("SS");
    expect(plan.assignments.find((a) => a.player === "RF")).toMatchObject({
      type: "CoverBase",
      base: 2,
    });
    expect(plan.assignments).toHaveLength(9);
  });
  it("keeps near-fence support inside the field and leaves the fielder room", () => {
    const c = defaultSettings();
    c.state.runners = {};
    const loc = new MovementEngine().starting(c),
      ball = new MovementEngine().field(c, loc);
    Object.assign(ball, {
      fielder: "CF",
      fieldingPoint: { x: 500, y: 61 },
      touchPoint: { x: 500, y: 61 },
      pursuitTarget: { x: 500, y: 61 },
      fieldingTime: 10,
    });
    const plan = engine.assign(c, ball, "CF", 2, loc, "contact", {
      runners: [],
      outs: 0,
    });
    const a = plan.assignments.find((a) => a.type === "BackupFielder")!;
    expect(a.reason).toBe("wallSupport");
    expect(isPlayable(a.target)).toBe(true);
    expect(metres(a.target, ball.fieldingPoint)).toBeGreaterThan(2);
    expect(plan.issues.some((i) => i.kind === "space-limited")).toBe(true);
    expect(plan.assignments).toHaveLength(9);
  });
  it("reports backup time against the same reception deadline throughout a flight", () => {
    const s = provider.generate(cases["ground-short"]);
    const frames = s.dynamic.diagnostics.filter(
      (f) =>
        f.route.target === 1 &&
        f.assignments.some((a) => a.type === "ThrowBall"),
    );
    const arrivals = frames
      .map((f) => {
        const p = f.assignments.find((a) => a.player === "P")!;
        return p.neededBy === undefined ? undefined : f.time + p.neededBy;
      })
      .filter((n) => n !== undefined);
    expect(arrivals.length).toBeGreaterThan(0);
    for (const t of arrivals) expect(t).toBeCloseTo(arrivals[0]!, 5);
  });
  it("exposes all nine, timing alternatives, priorities, possession and coverage issues as JSON", () => {
    const s = provider.generate(cases["aggressive-home"]),
      info = inspectDefense(s, fieldedTime(s));
    expect(info.state.outs).toBe(0);
    expect(info.ball.selectedPrimaryFielder).toBe("RF");
    expect(info.preferredThrow.target).toBe("home");
    expect(info.alternativeTargets.some((c) => c.target === 2)).toBe(true);
    expect(info.assignments).toHaveLength(9);
    expect(
      info.assignments.filter((a) => a.hasBall).map((a) => a.player),
    ).toEqual(["RF"]);
    expect(JSON.parse(JSON.stringify(info))).toEqual(info);
  });
  it.each(Array.from({ length: 8 }, (_, mask) => mask))(
    "keeps all-nine invariants in the 576-case matrix, occupancy mask %s",
    (mask) => {
      const points = [
        { x: 360, y: 440 },
        { x: 640, y: 430 },
        { x: 235, y: 295 },
        { x: 330, y: 125 },
      ];
      for (let outs = 0; outs < 3; outs++)
        for (const point of points)
          for (const target of ["auto", 1, 2, 3, "home", "hold"] as const) {
            const c = defaultSettings();
            c.state.runners = Object.fromEntries(
              [1, 2, 3]
                .filter((n) => mask & (1 << (n - 1)))
                .map((n) => [`R${n}`, n]),
            );
            c.state.outs = outs;
            c.throwTarget = target;
            c.ball = {
              type: isOutfield(point) ? "Line drive" : "Ground ball",
              destination: point,
              strength: "normal",
            };
            auditAllNine(provider.generate(c));
          }
    },
    30000,
  );
});

describe("center-field run-prevention regression", () => {
  const makeCenter = () => structuredClone(cases["center-home-close"]);
  it("anticipates a home play with speed-limited supporting movement rather than a stationary 1B", () => {
    const c = makeCenter(),
      movement = new MovementEngine(),
      running = new BaserunningDecisionEngine();
    const starting = movement.starting(c),
      ball = movement.field(c, starting),
      runners = running.create(c);
    running.plan(c, ball, runners, 0, true);
    const forecast = structuredClone(runners);
    for (const r of forecast) {
      const at = runningAdvance(r, r.goal, ball.fieldingTime);
      r.progress = at.progress;
      r.runVelocity = at.velocity;
      r.startDelay = at.delay;
    }
    running.plan(c, ball, forecast, ball.fieldingTime, true);
    const original = structuredClone(starting);
    const cold = engine.choose(c, ball, forecast, 0, starting);
    expect(cold.alternatives?.some((a) => a.target === "home")).toBe(true);
    expect(
      engine.choose(c, ball, forecast, 0, starting, ball.fielder, "fielded", {
        seconds: ball.fieldingTime,
        runners,
      }).target,
    ).toBe("home");
    expect(starting).toEqual(original);
    const s = provider.generate(c);
    expect(assignment(s, "1B")).toMatchObject({ type: "Cutoff", base: "home", reason: "innerCutoff" });
    expect(assignment(s, "2B")).toMatchObject({ type: "Relay", base: "home" });
    const atFielding = sample(s, fieldedTime(s)).players.find(
      (p) => p.id === "1B",
    )!;
    const motion = planMotion(
      { position: toWorld(starting["1B"]), velocity: { x: 0, y: 0 } },
      toWorld(assignment(s, "1B").target),
      assumptions.defenderSpeed,
      assumptions.defenderAcceleration,
      assumptions.reaction,
    );
    expect(
      metres(
        atFielding.position,
        fromWorld(sampleMotion(motion, ball.fieldingTime).position),
      ),
    ).toBeLessThan(0.002);
  });
  it.each(
    [557, 558, 559].flatMap((x) => [282, 284, 286].map((y) => ({ x, y }))),
  )(
    "challenges the plate near $x,$y in standard and prevent strategies",
    (point) => {
      for (const strategy of ["standard", "prevent"] as const)
        for (const outs of [0, 1, 2]) {
          const c = makeCenter();
          c.ball.destination = point;
          c.state.strategy = strategy;
          c.state.outs = outs;
          const s = provider.generate(c);
          expect(s.dynamic.ball.fielder).toBe("CF");
          expect(s.dynamic.decisions[0].target).toBe("home");
          expect(
            s.dynamic.events.some(
              (e) =>
                e.type === "ThrowReceived" &&
                e.player === "C" &&
                e.base === "home",
            ),
          ).toBe(true);
          expect(
            s.dynamic.events.some(
                (e) => e.type === "ThrowReceived" && e.player === "2B",
            ),
          ).toBe(true);
          expect(assignment(s, "P")).toMatchObject({
            type: "BackupThrow",
            base: "home",
          });
          expect(assignment(s, "C")).toMatchObject({
            type: "CoverBase",
            base: "home",
          });
          expect(assignment(s, "1B")).toMatchObject({ type: "Cutoff", base: "home" });
          expect(assignment(s, "SS")).toMatchObject({
            type: "CoverBase",
            base: 2,
          });
          expect(assignment(s, "3B")).toMatchObject({
            type: "CoverBase",
            base: 3,
          });
          auditAllNine(s);
        }
    },
  );
  it("labels a competitive plate opportunity independently of a particular calibrated coordinate", () => {
    const c = defaultSettings();
    c.state.runners = { R3: 3 };
    c.state.strategy = "prevent";
    const loc = new MovementEngine().starting(c),
      ball = new MovementEngine().field(c, loc),
      rs = new BaserunningDecisionEngine().create(c),
      e = new DefensiveDecisionEngine();
    ball.fielder = "RF";
    ball.fieldingPoint = loc.RF;
    ball.caught = false;
    rs.find((r) => r.id === "BR")!.status = "out";
    const r = rs.find((r) => r.id === "R3")!;
    r.goal = 4;
    r.decision = "advance";
    r.runVelocity = 0;
    r.startDelay = 0.1;
    r.speed = 2; // Synthetic timing fixture: bracket the full aerodynamic relay time.
    const layout = e.assign(c, ball, "RF", "home", loc, "received", {
        runners: rs,
        outs: 0,
      }),
      arrival = e.arrival(layout, loc, "RF");
    let lo = 3,
      hi = 4;
    for (let i = 0; i < 40; i++) {
      r.progress = (lo + hi) / 2;
      if (importedRunningTime(r, 4) > arrival + 0.1) lo = r.progress;
      else hi = r.progress;
    }
    r.progress = (lo + hi) / 2;
    const d = e.choose(c, ball, rs, 0, loc, "RF", "received"),
      home = d.alternatives!.find((a) => a.target === "home")!;
    expect(home).toMatchObject({
      viable: false,
      competitive: true,
      reason: "competitive-home",
    });
    expect(home.ballArrival).toBeLessThan(home.runnerArrival);
    expect(home.margin).toBeLessThan(0);
    expect(formatDynamic(d.reason, "en")).toMatch(/tag timing is close/);
    expect(formatDynamic(d.reason, "ja")).toMatch(/際どい/);
  });
  it("a normal second-base receiver immediately evaluates a subsequent home throw", () => {
    const c = structuredClone(cases["second-single-right"]);
    c.runnerSpeed = "slow";
    // Control the initial return to exercise the continuation contract. The new
    // heuristic normally chooses home immediately in this opportunity.
    const original = DefensiveDecisionEngine.prototype.choose;
    const firstReturn = vi
      .spyOn(DefensiveDecisionEngine.prototype, "choose")
      .mockImplementation(function (this: DefensiveDecisionEngine, ...args) {
        const d = original.apply(this, args);
        if (args[6] === "received") {
          const r = args[2].find((r) => r.id === "R2");
          if (r && r.status === "active") {
            r.goal = 4;
            r.decision = "advance";
          }
          return original.apply(this, args);
        }
        return {
          ...d,
          target: 2,
          runner: undefined,
          force: false,
          margin: undefined,
          reason: message("targetReturn"),
        };
      });
    try {
      const s = provider.generate(c),
        receipts = s.dynamic.events.filter((e) => e.type === "ThrowReceived");
      expect(s.dynamic.decisions.map((d) => d.target)).toEqual([2, "home"]);
      expect(receipts.map((e) => e.player)).toEqual(["SS", "C"]);
      expect(s.dynamic.decisions[1].time).toBe(receipts[0].time);
      expect(s.dynamic.decisions[1].owner).toBe("SS");
      const home = s.dynamic.events.find(
        (e) => e.type === "ThrowStarted" && e.player === "SS",
      )!;
      expect(home.time - receipts[0].time).toBeCloseTo(
        throwingProfile(bases[2], bases.home, "SS", c.armStrength).prepare,
        5,
      );
      expect(
        sample(s, s.dynamic.decisions[1].time!).phase.assignments!.find(
          (a) => a.player === "P",
        ),
      ).toMatchObject({ type: "BackupThrow", base: "home" });
      auditAllNine(s);
    } finally {
      firstReturn.mockRestore();
    }
  });
  it("does not chase a run that has already scored when BR can be challenged elsewhere", () => {
    const c = makeCenter();
    c.ball.destination = { x: 80, y: 340 };
    c.ball.strength = "hard";
    c.runnerSpeed = "fast";
    c.state.runners = { R3: 3 };
    const s = provider.generate(c);
    expect(
      s.dynamic.events.find((e) => e.type === "RunScored")!.time,
    ).toBeLessThan(fieldedTime(s));
    expect(s.dynamic.decisions[0].target).not.toBe("home");
    expect(
      s.dynamic.events.some(
        (e) => e.type === "ThrowStarted" && e.base === "home",
      ),
    ).toBe(false);
    auditAllNine(s);
  });
  it("does not manufacture a scoring attempt for an R2 who holds third", () => {
    const c = makeCenter();
    c.runnerSpeed = "slow";
    c.aggression = "conservative";
    const s = provider.generate(c);
    expect(s.dynamic.decisions[0].target).toBe(2);
    expect(
      s.dynamic.decisions[0].alternatives!.some((c) => c.target === "home"),
    ).toBe(false);
    expect(sample(s, duration(s)).state.runners.R2).toBe(3);
    auditAllNine(s);
  });
  it("keeps cutoff-and-hold and conservative overrides intact", () => {
    const c = makeCenter();
    c.throwTarget = "cutoff";
    const s = provider.generate(c);
    expect(
      s.dynamic.events.filter((e) => e.type === "ThrowStarted"),
    ).toHaveLength(1);
    expect(
      s.dynamic.events.some(
        (e) => e.type === "ThrowReceived" && e.player === "C",
      ),
    ).toBe(false);
    c.throwTarget = "auto";
    c.state.strategy = "conservative";
    expect(provider.generate(c).dynamic.decisions[0].target).toBe(2);
  });
});

it("does not confuse a late tag third out with a run-cancelling force third out", () => {
  const s = provider.generate(cases["center-home-close"]);
  const frame = s.dynamic.diagnostics.find(
    (f) => f.trigger === "Relay received / target reconsidered",
  )!;
  const locations = Object.fromEntries(
    sample(s, frame.time).players.map((p) => [p.id, p.position]),
  );
  const d = engine.choose(
    s.dynamic.settings,
    { ...s.dynamic.ball, fieldingPoint: locations[frame.owner] },
    frame.runners,
    2,
    locations,
    frame.owner,
    "received",
  );
  const home = d.alternatives!.find((c) => c.target === "home")!;
  const second = d.alternatives!.find(
    (c) => c.target === 2 && c.runner === "BR",
  )!;
  expect(home.preventsRun).toBe(true);
  expect(second).toMatchObject({
    force: false,
    viable: true,
    preventsRun: false,
  });
  expect(d.target).toBe("home");
});

it("credits a force third out with cancelling a run already across the plate", () => {
  const c = structuredClone(cases["ground-short"]);
  c.state.outs = 2;
  c.state.runners = { R2: 2 };
  const movement = new MovementEngine(),
    locations = movement.starting(c),
    ball = movement.field(c, locations);
  locations[ball.fielder] = ball.fieldingPoint;
  const runners = new BaserunningDecisionEngine().create(c);
  Object.assign(
    runners.find((r) => r.id === "R2")!,
    { progress: 4, goal: 4, status: "scored" },
  );
  const decision = engine.choose(c, ball, runners, 2, locations);
  expect(decision.target).toBe(1);
  expect(decision.alternatives!.find((a) => a.target === 1)).toMatchObject({
    force: true,
    viable: true,
    preventsRun: true,
  });
});
