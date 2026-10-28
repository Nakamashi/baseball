import { defaultSettings } from "./provider";
import type { DynamicSettings } from "./types";
/** Review fixtures, not exceptions in the decision engine. */
export function defensiveAuditCases(): Record<string, DynamicSettings> {
  const make = (
    x: number,
    y: number,
    runners: DynamicSettings["state"]["runners"] = {},
    ground = false,
  ) => {
    const s = defaultSettings();
    s.state.runners = runners;
    s.ball = {
      type: "Ground ball",
      destination: { x, y },
      strength: "normal",
    };
    return s;
  };
  const cases = {
    "ground-second": make(640, 430, {}, true),
    "ground-short": make(360, 440, {}, true),
    "double-play": make(425, 425, { R1: 1 }, true),
    "third-ground-second": make(640, 430, { R3: 3 }, true),
    "single-left": make(235, 280),
    "first-single-left": make(235, 280, { R1: 1 }),
    "second-single-right": make(765, 280, { R2: 2 }),
    "extra-base-trail": make(80, 340),
    "deep-left-centre": make(170, 200, { R1: 1, R2: 2 }),
    "home-to-second": make(765, 280, { R2: 2 }),
    "aggressive-home": make(765, 280, { R2: 2 }),
    "infield-in": make(640, 430, { R3: 3 }, true),
    "center-home-close": make(550, 125, { R2: 2 }),
  };
  cases["first-single-left"].throwTarget = 2;

  cases["double-play"].runnerSpeed = "slow";
  cases["double-play"].ball.strength = "hard";
  cases["extra-base-trail"].ball.strength = "hard";
  cases["deep-left-centre"].ball.strength = "hard";
  cases["extra-base-trail"].aggression = "aggressive";
  cases["extra-base-trail"].throwTarget = 3;
  cases["deep-left-centre"].throwTarget = "home";
  cases["home-to-second"].throwTarget = "home";
  cases["aggressive-home"].aggression = "aggressive";
  cases["second-single-right"].aggression = "aggressive";
  cases["infield-in"].state.strategy = "prevent";
  cases["infield-in"].state.inning = 7;
  cases["center-home-close"].aggression = "aggressive";
  cases["center-home-close"].runnerSpeed = "average";
  cases["center-home-close"].ball.strength = "hard";
  cases["center-home-close"].state.strategy = "prevent";
  return cases;
}
