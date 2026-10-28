import type { Base, Position } from "../simulation/types";
import type { Strategy } from "./types";
export const assumptions = {
  baseMetres: 27.43,
  field: { cornerMetres: 90, centreMetres: 120, infieldMetres: 39 },
  defenderSpeed: 6,
  firstBase: {
    overrunMetres: 3,
    roundMetres: 4,
    turnSpeed: 4,
    returnSpeed: 3,
    readTime: 0.35,
  },
  throwSpeed: 20,
  fieldDelay: 0.35,
  transfer: 0.3,
  catchTime: 0.12,
  tagTime: 0.25,
  reaction: 0.35,
  runnerSpeed: { slow: 5.1, average: 6.2, fast: 7.2 },
  ballSpeed: { soft: 12, normal: 24, hard: 34 },
  outfieldBallSpeed: { soft: 8, normal: 15, hard: 23 },
  cutoffDistance: 23,
  relayDistance: 55,
  closeMargin: 0.45,
};
export const conventions = {
  // Optional team convention: home protection always overrides this support job.
  catcherBackupFirst: true,
  backupDepth: 8,
  secondaryBackupDepth: 13,
  trailSeparation: 4,
  cutoff: { 1: "2B", 2: "2B", 3: "SS", home: "1B" } as Record<Base, Position>,
  coverage: {
    1: ["1B", "2B", "P", "SS", "3B", "C"],
    2: ["2B", "SS", "RF", "CF", "P", "3B", "1B", "C"],
    3: ["3B", "SS", "P", "2B", "1B", "C"],
    home: ["C", "P", "1B", "3B", "2B", "SS"],
  } as Record<Base, Position[]>,
};
export function recommendStrategy(state: {
  inning: number;
  half: "top" | "bottom";
  homeScore: number;
  awayScore: number;
  runners: object;
  outs?: number;
}): Strategy {
  const difference =
    state.half === "top"
      ? state.homeScore - state.awayScore
      : state.awayScore - state.homeScore;
  return state.outs !== 2 &&
    state.inning >= 6 &&
    difference >= 0 &&
    difference <= 1 &&
    Object.values(state.runners).includes(3)
    ? "prevent"
    : "standard";
}
