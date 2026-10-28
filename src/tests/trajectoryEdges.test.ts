import { it, expect } from "vitest";
import {
  DynamicPlayProvider,
  defaultSettings,
  validateSettings,
} from "../dynamic/provider";
import { validateScenario } from "../simulation/scenarioValidation";
import { fromWorld, fieldRadius } from "../dynamic/geometry";
import type { DynamicSettings } from "../dynamic/types";
const provider = new DynamicPlayProvider();
// Seeded integration exploration exposed numeric-zero stopping semantics and
// a squared-velocity epsilon at nearly stopped bases. Preserve the real inputs.
const edges: [
  number,
  number,
  DynamicSettings["ball"]["type"],
  DynamicSettings["runnerSpeed"],
  DynamicSettings["aggression"],
  DynamicSettings["throwTarget"],
  DynamicSettings["state"]["strategy"],
  number,
  number,
][] = [
  [
    611.1332546993373,
    323.0175980736426,
    "Line drive",
    "slow",
    "conservative",
    "hold",
    "prevent",
    1,
    6,
  ],
  [
    387.42473192334774,
    140.84790546779197,
    "Fly ball",
    "slow",
    "normal",
    3,
    "prevent",
    2,
    1,
  ],
  [
    296.1542952527117,
    169.49909518942331,
    "Fly ball",
    "fast",
    "aggressive",
    "home",
    "conservative",
    2,
    7,
  ],
  [
    125.74023392906378,
    394.4039071784737,
    "Fly ball",
    "average",
    "normal",
    "hold",
    "conservative",
    2,
    2,
  ],
  [
    390.5641900315219,
    305.74198946944944,
    "Line drive",
    "average",
    "aggressive",
    1,
    "conservative",
    1,
    7,
  ],
  [
    819.609265589623,
    449.51622811108615,
    "Fly ball",
    "average",
    "aggressive",
    "cutoff",
    "conservative",
    2,
    7,
  ],
  [
    746.510438382161,
    165.6319976826286,
    "Fly ball",
    "slow",
    "conservative",
    "auto",
    "standard",
    2,
    3,
  ],
  [
    881.2518183054539,
    197.8997467801496,
    "Fly ball",
    "average",
    "conservative",
    "hold",
    "standard",
    2,
    2,
  ],
  [
    883.0212202791542,
    345.54207223128316,
    "Fly ball",
    "slow",
    "normal",
    "hold",
    "standard",
    2,
    7,
  ],
];
it.each(edges)(
  "resolves the continuous edge at %s,%s",
  (x, y, type, speed, aggression, target, strategy, outs, mask) => {
    const c = defaultSettings();
    c.ball = {
      type,
      destination: { x, y },
      strength: type === "Fly ball" ? "hard" : "normal",
    };
    c.state.runners = Object.fromEntries(
      [1, 2, 3].filter((n) => mask & (1 << (n - 1))).map((n) => [`R${n}`, n]),
    );
    c.runnerSpeed = speed;
    c.aggression = aggression;
    c.throwTarget = target;
    c.state.strategy = strategy;
    c.state.outs = outs;
    const s = provider.generate(c);
    expect(validateScenario(s)).toEqual([]);
  },
);
it("resolves 128 independent seeded ball, runner, base/out and strategy combinations", () => {
  let seed = 9012026;
  const rand = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    pick = <T>(values: readonly T[]) =>
      values[Math.floor(rand() * values.length)];
  let checked = 0;
  for (let attempt = 0; checked < 128 && attempt < 512; attempt++) {
    const c = defaultSettings(),
      type = pick(["Ground ball", "Fly ball", "Line drive"] as const),
      angle = ((rand() - 0.5) * Math.PI) / 2,
      depth =
        2 +
        rand() * (fieldRadius(angle) + (type === "Ground ball" ? -2 : 8) - 2);
    c.ball = {
      type,
      strength: pick(["soft", "normal", "hard"] as const),
      destination: fromWorld({
        x: Math.sin(angle) * depth,
        y: -Math.cos(angle) * depth,
      }),
    };
    c.state.outs = pick([0, 1, 2]);
    c.state.strategy = pick(["standard", "prevent", "conservative"] as const);
    const mask = Math.floor(rand() * 8);
    c.state.runners = Object.fromEntries(
      [1, 2, 3].filter((n) => mask & (1 << (n - 1))).map((n) => [`R${n}`, n]),
    );
    c.runnerSpeed = pick(["slow", "average", "fast"] as const);
    c.aggression = pick(["conservative", "normal", "aggressive"] as const);
    c.throwTarget = pick(["auto", 1, 2, 3, "home", "cutoff", "hold"] as const);
    if (validateSettings(c)) continue;
    expect(validateScenario(provider.generate(c)), JSON.stringify(c)).toEqual(
      [],
    );
    checked++;
  }
  expect(checked).toBe(128);
}, 60000);
