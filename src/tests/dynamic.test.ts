import { describe, it, expect } from "vitest";
import { DynamicPlayProvider, defaultSettings } from "../dynamic/provider";
import { sample, duration } from "../simulation/timeline";
import { validateScenario } from "../simulation/scenarioValidation";
import { formatDynamic } from "../dynamic/messages";
import type { DynamicSettings } from "../dynamic/types";
const provider = new DynamicPlayProvider();
const make = (change: Partial<DynamicSettings> = {}) =>
  provider.generate({ ...defaultSettings(), ...change });
describe("dynamic vertical slice", () => {
  it("retrieves a right-field single and assigns every defender", () => {
    const s = make();
    expect(s.dynamic.ball.fielder).toBe("RF");
    for (const phase of s.phases) {
      expect(phase.assignments).toHaveLength(9);
      expect(new Set(phase.assignments!.map((a) => a.player)).size).toBe(9);
    }
    expect(validateScenario(s)).toEqual([]);
    expect(s.dynamic.events.some((e) => e.type === "ThrowReceived")).toBe(true);
    expect(sample(s, duration(s)).state.runners.BR).toBeDefined();
  });
  it("generates the same timeline independently of replay history", () => {
    const a = make(),
      b = make();
    expect(a).toEqual(b);
    const first = sample(a, 3);
    sample(a, duration(a));
    expect(sample(a, 3)).toEqual(first);
  });
  it("translates every generated instruction into Japanese", () => {
    const s = make();
    const strings = [
      s.title,
      s.objective,
      s.result,
      ...s.notes,
      ...s.alternatives,
    ];
    for (const p of s.phases) {
      strings.push(p.explanation);
      for (const r of Object.values(p.responsibilities))
        strings.push(r.action, r.why, r.support);
    }
    for (const text of strings)
      expect(formatDynamic(text, "ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  });
});
import { isPlayable, isOutfield, bases, metres } from "../dynamic/geometry";
import { assumptions, recommendStrategy } from "../dynamic/conventions";
import { BaserunningDecisionEngine } from "../dynamic/baserunning";
import { isForced } from "../dynamic/defense";
import { validateSettings } from "../dynamic/provider";
import { dynamicMessages } from "../dynamic/messages";
const ground = (point = { x: 360, y: 440 }) => {
  const s = defaultSettings();
  s.ball = { ...s.ball, type: "Ground ball", destination: point };
  return s;
};
describe("fundamental baseball decisions", () => {
  it("uses SS and 2B for their routine ground-ball lanes", () => {
    for (const [point, expected] of [
      [{ x: 360, y: 440 }, "SS"],
      [{ x: 640, y: 430 }, "2B"],
    ] as const) {
      const s = provider.generate(ground(point));
      expect(s.dynamic.ball.fielder).toBe(expected);
      expect(
        s.phases
          .find((p) => p.title === "Contact")!
          .assignments!.find((a) => a.base === 2 && a.type === "CoverBase")!
          .player,
      ).toBe(expected === "SS" ? "2B" : "SS");
    }
  });
  it("evaluates a double play, but does not guarantee one", () => {
    const slow = ground();
    slow.runnerSpeed = "slow";
    const s = provider.generate(slow);
    expect(s.dynamic.decisions.map((d) => d.target)).toEqual([2, 1]);
    expect(sample(s, duration(s)).state.outs).toBe(2);
    const normal = provider.generate(ground());
    expect(sample(normal, duration(normal)).state.outs).toBe(1);
  });
  it("ends live throwing decisions at the third out", () => {
    const c = ground();
    c.state.outs = 2;
    c.runnerSpeed = "slow";
    const s = provider.generate(c);
    expect(s.dynamic.decisions).toHaveLength(1);
    const out = s.dynamic.events.find((e) => e.type === "RunnerOut")!;
    expect(
      s.dynamic.events.filter(
        (e) => e.time > out.time && e.type === "ThrowStarted",
      ),
    ).toEqual([]);
    expect(sample(s, duration(s)).state.outs).toBe(3);
    expect(sample(s, duration(s)).state.runners).toEqual({});
  });
  it("assigns P to cover first when 1B fields away from the bag", () => {
    const c = ground({ x: 650, y: 550 });
    c.state.runners = {};
    const s = provider.generate(c);
    expect(s.dynamic.ball.fielder).toBe("1B");
    expect(
      s.phases.some((p) =>
        p.assignments!.some(
          (a) => a.player === "P" && a.type === "CoverBase" && a.base === 1,
        ),
      ),
    ).toBe(true);
    expect(
      s.dynamic.events.filter((e) => e.type === "ThrowReceived").at(-1)?.player,
    ).toBe("P");
  });
  it("aligns cutoffs on the actual throwing lane and covers vacated bases", () => {
    const c = defaultSettings();
    c.throwTarget = 3;
    const s = provider.generate(c);
    const phase = s.phases.find((p) => p.title === "Field & decide")!;
    const cutoff = phase.assignments!.find(
      (a) => a.type === "Cutoff" || a.type === "Relay",
    )!;
    expect(cutoff.player).toBe("SS");
    const from = s.dynamic.ball.fieldingPoint,
      to = bases[3],
      v = cutoff.target;
    expect(
      Math.abs(
        (v.x - from.x) * (to.y - from.y) - (v.y - from.y) * (to.x - from.x),
      ),
    ).toBeLessThan(0.001);
    expect(
      phase.assignments!.find((a) => a.base === 2 && a.type === "CoverBase")
        ?.player,
    ).toBe("2B");
    expect(phase.assignments!.find((a) => a.player === "P")?.type).toBe(
      "BackupThrow",
    );
  });
  it("uses a relay for a deep outfield throw, with a separate base receiver", () => {
    const c = defaultSettings();
    c.ball.destination = { x: 330, y: 125 };
    c.throwTarget = "home";
    const s = provider.generate(c);
    expect(
      s.phases.some((p) => p.assignments!.some((a) => a.type === "Relay")),
    ).toBe(true);
    expect(
      s.dynamic.events
        .filter((e) => e.type === "ThrowReceived")
        .map((e) => e.player),
    ).toEqual(["1B", "C"]);
    const phase = s.phases.find((p) => p.title === "Field & decide")!;
    expect(phase.assignments!.find((a) => a.player === "P")?.base).toBe("home");
    expect(
      phase.assignments!.find((a) => a.base === 1 && a.type === "CoverBase")
        ?.player,
    ).toBe("2B");
  });
  it("changes runner behavior for a marginal deep hit under different aggression", () => {
    const conservative = defaultSettings();
    conservative.ball.destination = { x: 340, y: 120 };
    conservative.aggression = "conservative";
    const aggressive = structuredClone(conservative);
    aggressive.aggression = "aggressive";
    const a = provider.generate(conservative),
      b = provider.generate(aggressive);
    expect(a.dynamic.events.filter((e) => e.type === "RunnerOut")).toHaveLength(
      0,
    );
    expect(sample(b, duration(b)).state.runners.R1).toBe(3);
    expect(sample(a, duration(a)).state.runners.R1).toBe(2);
    expect(a).not.toEqual(b);
  });
  it("separates speed from aggression", () => {
    const slow = defaultSettings();
    slow.ball.destination = { x: 320, y: 130 };
    slow.runnerSpeed = "slow";
    const fast = structuredClone(slow);
    fast.runnerSpeed = "fast";
    expect(sample(provider.generate(slow), 100).state.runners.R1).toBe(2);
    expect(sample(provider.generate(fast), 100).state.runners.R1).toBe(3);
  });
  it("supports retreat from a marginal extra base after the cutoff receives", () => {
    const c = defaultSettings(),
      r = new BaserunningDecisionEngine().create(c);
    const lead = r.find((r) => r.id === "R1")!;
    lead.progress = 2.15;
    lead.goal = 3;
    lead.decision = "advance";
    const changed = new BaserunningDecisionEngine().reconsider(c, r, 3, {
      x: 400,
      y: 500,
    });
    expect(changed.map((r) => r.id)).toEqual(["R1"]);
    expect(lead.goal).toBe(2);
    expect(lead.decision).toBe("retreat");
  });
  it("distinguishes a force from a tag and removes the force when a following runner is retired", () => {
    const c = defaultSettings();
    c.state.runners = { R1: 1, R2: 2 };
    const r = new BaserunningDecisionEngine().create(c),
      r2 = r.find((r) => r.id === "R2")!;
    expect(isForced(r2, r, 3)).toBe(true);
    r.find((r) => r.id === "R1")!.status = "out";
    expect(isForced(r2, r, 3)).toBe(false);
    expect(isForced(r.find((r) => r.id === "BR")!, r, 2)).toBe(false);
  });
  it("recalculates coverage, paths and runner consequences for a coach override", () => {
    const a = make(),
      c = defaultSettings();
    c.throwTarget = "home";
    c.aggression = "aggressive";
    const b = provider.generate(c);
    expect(
      b.dynamic.events
        .filter((e) => e.type === "ThrowReceived")
        .map((e) => e.player),
    ).toEqual(["1B", "C"]);
    expect(sample(b, duration(b)).state.runners.BR).toBe(2);
    expect(sample(a, duration(a)).state.runners.BR).toBe(1);
    expect(
      b.phases.find((p) => p.title === "Field & decide")!.assignments,
    ).not.toEqual(
      a.phases.find((p) => p.title === "Field & decide")!.assignments,
    );
  });
  it("can hold at the cutoff or hold without making a throw", () => {
    const c = defaultSettings();
    c.throwTarget = "cutoff";
    const s = provider.generate(c);
    expect(
      s.dynamic.events
        .filter((e) => e.type === "ThrowReceived")
        .map((e) => e.player),
    ).toEqual(["2B"]);
    c.throwTarget = "hold";
    expect(
      provider
        .generate(c)
        .dynamic.events.some((e) => e.type === "ThrowStarted"),
    ).toBe(false);
  });
  it("changes interception with continuous destination and ball strength", () => {
    const c = ground(),
      a = provider.generate(c);
    c.ball.destination = { x: 375, y: 458 };
    const b = provider.generate(c);
    expect(a.dynamic.ball.fieldingPoint).not.toEqual(
      b.dynamic.ball.fieldingPoint,
    );
    c.ball.strength = "soft";
    const soft = provider.generate(c);
    c.ball.strength = "hard";
    const hard = provider.generate(c);
    expect(soft.dynamic.ball.travelTime).toBeGreaterThan(
      hard.dynamic.ball.travelTime,
    );
    expect(soft.phases).not.toEqual(hard.phases);
  });
  it("recommends run prevention late in a close game, while allowing an override", () => {
    const c = defaultSettings();
    c.state.inning = 7;
    c.state.runners = { R3: 3 };
    expect(recommendStrategy(c.state)).toBe("prevent");
    c.state.strategy = "conservative";
    expect(provider.generate(c).dynamic.settings.state.strategy).toBe(
      "conservative",
    );
  });
  it("rejects out-of-field, unsupported and invalid input without substituting a scripted play", () => {
    const c = defaultSettings();
    c.ball.destination = { x: 10, y: 850 };
    expect(validateSettings(c)).toBeDefined();
    expect(isPlayable(c.ball.destination)).toBe(false);
    expect(
      provider.resolve(c.state, {
        type: "Fly ball",
        direction: "Centre field",
        location: { x: 500, y: 200 },
      }).supported,
    ).toBe(false);
    c.ball.destination = { x: 500, y: 600 };
    expect(validateSettings(c)).toBeDefined();
    c.ball.type = "Ground ball";
    c.state.outs = 3;
    expect(validateSettings(c)).toBeDefined();
  });
});
describe("generated-state invariants across base/out situations", () => {
  const points = [
    { x: 350, y: 450 },
    { x: 640, y: 430 },
    { x: 650, y: 550 },
    { x: 510, y: 620 },
    { x: 240, y: 300 },
    { x: 800, y: 240 },
    { x: 400, y: 130 },
  ];
  it.each(points)(
    "validates every occupancy and out count at $x,$y",
    (point) => {
      for (let mask = 0; mask < 8; mask++)
        for (let outs = 0; outs < 3; outs++) {
          const c = defaultSettings();
          c.state.outs = outs;
          c.state.runners = Object.fromEntries(
            [1, 2, 3]
              .filter((n) => mask & (1 << (n - 1)))
              .map((n) => [`R${n}`, n]),
          );
          c.ball = {
            ...c.ball,
            destination: point,
            type: isOutfield(point) ? "Base hit" : "Ground ball",
          };
          const s = provider.generate(c);
          expect(validateScenario(s)).toEqual([]);
          for (const p of s.phases) {
            expect(sample(s, p.start).phase.id).toBe(p.id);
            expect(p.assignments).toHaveLength(9);
            expect(new Set(p.assignments!.map((a) => a.player)).size).toBe(9);
            for (const a of p.assignments!) expect(a.explanation).toBeTruthy();
            expect(p.state.outs).toBeLessThanOrEqual(3);
            const occupancy = Object.values(p.state.runners);
            expect(new Set(occupancy).size).toBe(occupancy.length);
            for (const move of p.movements) {
              if (
                ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].includes(
                  move.player,
                )
              ) {
                const length = move.path
                  .slice(1)
                  .reduce(
                    (sum, point, i) => sum + metres(point, move.path[i]),
                    0,
                  );
                expect(length).toBeLessThanOrEqual(
                  assumptions.defenderSpeed * p.duration + 0.001,
                );
              }
            }
          }
          const final = sample(s, duration(s));
          for (const p of s.phases) {
            const snap = sample(s, p.start + p.duration / 2);
            expect(snap.players.filter((p) => p.hasBall).length).toBe(
              snap.owner ? 1 : 0,
            );
          }
          if (final.state.outs === 3) expect(final.state.runners).toEqual({});
        }
    },
  );
  it("maintains complete bilingual templates for generated messages", () =>
    expect(Object.keys(dynamicMessages.english).sort()).toEqual(
      Object.keys(dynamicMessages.japanese).sort(),
    ));
});
import { TimelineBuilder } from "../dynamic/timelineBuilder";
describe("scoring and secure outs", () => {
  it("records the routine 6-3 with bases empty", () => {
    const c = ground();
    c.state.runners = {};
    const s = provider.generate(c);
    expect(s.dynamic.ball.fielder).toBe("SS");
    expect(s.dynamic.decisions[0].target).toBe(1);
    expect(sample(s, duration(s)).state.outs).toBe(1);
  });
  it("carries the ball to first without inventing a throw when 1B is close", () => {
    const c = ground({ x: 690, y: 565 });
    c.state.runners = {};
    const s = provider.generate(c);
    expect(s.dynamic.ball.fielder).toBe("1B");
    expect(s.dynamic.events.some((e) => e.type === "BaseTouched")).toBe(true);
    expect(s.dynamic.events.some((e) => e.type === "ThrowStarted")).toBe(false);
    expect(sample(s, duration(s)).state.outs).toBe(1);
  });
  it("credits a run to the batting team and preserves the fielding score", () => {
    const c = defaultSettings();
    c.state = {
      ...c.state,
      runners: { R2: 2 },
      half: "bottom",
      fieldingTeam: "away",
      homeScore: 3,
      awayScore: 2,
    };
    c.runnerSpeed = "fast";
    c.aggression = "aggressive";
    c.throwTarget = "hold";
    const s = provider.generate(c),
      final = sample(s, duration(s));
    expect(final.state.runs).toBe(1);
    expect(final.state.homeScore).toBe(4);
    expect(final.state.awayScore).toBe(2);
    expect(final.players.find((p) => p.id === "R2")?.status).toBe("scored");
  });
  it("disallows an earlier run when BR is the third out before first", () => {
    const c = defaultSettings();
    c.state.outs = 2;
    const runners = new BaserunningDecisionEngine().create(c);
    const b = new TimelineBuilder(
      c.state,
      { BR: bases.home, R1: bases[1] },
      runners,
    );
    b.pendingRuns = 1;
    b.time = 2;
    b.event("RunScored", "provisional");
    b.time = 3;
    b.retire("BR", 1, true);
    expect(b.state.outs).toBe(3);
    expect(b.pendingRuns).toBe(0);
    expect(b.state.runners).toEqual({});
    expect(b.events.at(-1)?.type).toBe("RunDisallowed");
  });
  it("counts a run before a non-force third out, but not a simultaneous run", () => {
    const c = defaultSettings();
    c.state.outs = 2;
    for (const earlier of [true, false]) {
      const runners = new BaserunningDecisionEngine().create(c),
        b = new TimelineBuilder(
          c.state,
          { BR: bases.home, R1: bases[1] },
          runners,
        );
      b.pendingRuns = 1;
      b.time = earlier ? 2 : 3;
      b.event("RunScored", "provisional");
      b.time = 3;
      b.retire("R1", 3, false);
      expect(b.pendingRuns).toBe(earlier ? 1 : 0);
    }
  });
  it("does not recommend infield-in strategy just to prevent a run with two outs", () => {
    const c = defaultSettings();
    c.state.inning = 7;
    c.state.runners = { R3: 3 };
    c.state.outs = 2;
    expect(recommendStrategy(c.state)).toBe("standard");
  });
});
describe("continuous field coordinates", () => {
  it("accepts fair foul-line locations at both corner bases", () => {
    expect(isPlayable(bases[1])).toBe(true);
    expect(isPlayable(bases[3])).toBe(true);
    expect(isPlayable({ x: 900, y: 700 })).toBe(false);
  });
  it("can charge a slow ball before the defender nearest its eventual destination", () => {
    const c = ground();
    c.ball.strength = "soft";
    const s = provider.generate(c);
    expect(s.dynamic.ball.fielder).not.toBe("SS");
    expect(s.dynamic.ball.fieldingPoint).not.toEqual(c.ball.destination);
  });
});
describe("varied deterministic inputs", () => {
  it("keeps all invariants and translations across overrides, strengths and strategies", () => {
    const points = [
      { x: 340, y: 445 },
      { x: 640, y: 425 },
      { x: 650, y: 550 },
      { x: 490, y: 640 },
      { x: 230, y: 285 },
      { x: 810, y: 220 },
      { x: 350, y: 125 },
    ];
    const targets = ["auto", 1, 2, 3, "home", "cutoff", "hold"] as const;
    for (let i = 0; i < 84; i++) {
      const c = defaultSettings(),
        point = points[i % points.length];
      c.ball = {
        type: isOutfield(point) ? "Base hit" : "Ground ball",
        destination: point,
        strength: (["soft", "normal", "hard"] as const)[i % 3],
      };
      c.throwTarget = targets[Math.floor(i / points.length) % targets.length];
      c.state.outs = i % 3;
      c.state.strategy = (["standard", "prevent", "conservative"] as const)[
        Math.floor(i / 3) % 3
      ];
      c.runnerSpeed = (["slow", "average", "fast"] as const)[
        Math.floor(i / 7) % 3
      ];
      c.aggression = (["conservative", "normal", "aggressive"] as const)[
        Math.floor(i / 4) % 3
      ];
      const mask = i % 8;
      c.state.runners = Object.fromEntries(
        [1, 2, 3].filter((n) => mask & (1 << (n - 1))).map((n) => [`R${n}`, n]),
      );
      const s = provider.generate(c);
      expect(validateScenario(s)).toEqual([]);
      for (const phase of s.phases) {
        for (const r of Object.values(phase.responsibilities)) {
          for (const text of [r.action, r.why, r.support]) {
            expect(formatDynamic(text, "en")).not.toContain("@v2:");
            expect(formatDynamic(text, "ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);
          }
        }
      }
    }
  });
});
describe("coverage and tag positioning regressions", () => {
  it("uses CF to back up RF without sending LF across the whole outfield", () => {
    const s = make(),
      contact = s.phases.find((p) => p.title === "Contact")!;
    expect(contact.assignments!.find((a) => a.player === "CF")?.type).toBe(
      "BackupFielder",
    );
    expect(contact.assignments!.find((a) => a.player === "LF")?.type).toBe(
      "HoldPosition",
    );
  });
  it("never replaces 1B fielding with base coverage before the ball is secured", () => {
    const c = ground({ x: 650, y: 550 });
    c.state.strategy = "prevent";
    c.ball.strength = "hard";
    c.throwTarget = 3;
    const s = provider.generate(c);
    expect(
      s.phases
        .find((p) => p.title === "Contact")!
        .assignments!.find((a) => a.player === s.dynamic.ball.fielder)?.type,
    ).toBe("FieldBall");
    expect(validateScenario(s)).toEqual([]);
  });
  it("records tag outs only when the runner is within tagging distance", () => {
    const c = defaultSettings();
    c.ball.destination = { x: 810, y: 220 };
    c.ball.strength = "hard";
    c.aggression = "aggressive";
    c.runnerSpeed = "fast";
    c.throwTarget = 3;
    const s = provider.generate(c);
    const tags = s.dynamic.events.filter(
      (e) => e.type === "RunnerOut" && !e.force,
    );
    expect(tags.length).toBeGreaterThan(0);
    for (const e of tags) {
      const snapshot = sample(s, e.time);
      const runner = snapshot.players.find((p) => p.id === e.player)!;
      expect(metres(runner.position, bases[e.base!])).toBeLessThan(1);
      expect(snapshot.owner).toBeDefined();
    }
  });
});
it("keeps English and Japanese dynamic template parameters in sync", () => {
  for (const key of Object.keys(
    dynamicMessages.english,
  ) as (keyof typeof dynamicMessages.english)[]) {
    const parameters = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    expect(parameters(dynamicMessages.japanese[key])).toEqual(
      parameters(dynamicMessages.english[key]),
    );
  }
});
