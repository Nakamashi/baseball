import { occupancy } from "./scriptedPlayProvider";
import type { PlayScenario } from "./types";
export const situationKey = (s: PlayScenario) =>
  `${s.initial.outs}:${occupancy(s.initial)}`;
// Each stage derives its options from the preceding selection. Unsupported base/out
// combinations are never offered; changing a stage selects a real authored play.
export function catalogueChoices(
  library: PlayScenario[],
  category: string,
  situation: string,
) {
  const byCategory =
    category === "all"
      ? library
      : library.filter((s) => s.category === category);
  const situations = [
    ...new Map(byCategory.map((s) => [situationKey(s), s])).values(),
  ];
  const key = situations.some((s) => situationKey(s) === situation)
    ? situation
    : situations[0]
      ? situationKey(situations[0])
      : "";
  return {
    situations,
    key,
    plays: byCategory.filter((s) => situationKey(s) === key),
  };
}
