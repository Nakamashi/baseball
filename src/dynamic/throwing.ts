import type { Point, Position } from "../simulation/types";
import type { DynamicSettings } from "./types";
import { metres, bases } from "./geometry";
/** Provisional effective game-flight profiles, NOT radar-release population norms.
 * Academy peak velocities supplied by the user only bound plausibility. */
export const throwProfiles = {
  feed: { speed: 16, prepare: 0.2 },
  infield: { speed: 22, prepare: 0.3 },
  pivot: { speed: 22, prepare: 0.22 },
  relay: { speed: 23.5, prepare: 0.26 },
  outfield: { speed: 25, prepare: 0.38 },
};
export function throwingProfile(
  from: Point,
  to: Point,
  owner: Position = "SS",
  strength: DynamicSettings["armStrength"] = "standard",
) {
  const distance = metres(from, to),
    outfielder = ["LF", "CF", "RF"].includes(owner),
    pivot =
      !outfielder &&
      ["SS", "2B"].includes(owner) &&
      metres(from, bases[2]) < 1.5;
  const kind = outfielder
    ? "outfield"
    : distance <= 12
      ? "feed"
      : pivot
        ? "pivot"
        : metres(from, bases.home) > 45
          ? "relay"
          : "infield";
  const delta = strength === "developing" ? -2 : strength === "strong" ? 2 : 0;
  return {
    kind,
    speed: throwProfiles[kind].speed + delta,
    prepare: throwProfiles[kind].prepare,
  };
}
/** Provisional accurate-return range deciding direct-through versus a relay.
 * It is separate from effective planar flight speed, and needs local measurement. */
export function directThrowRange(
  owner: Position,
  strength: DynamicSettings["armStrength"] = "standard",
) {
  return ["LF", "CF", "RF"].includes(owner)
    ? 75 + (strength === "strong" ? 10 : strength === "developing" ? -10 : 0)
    : 55;
}
