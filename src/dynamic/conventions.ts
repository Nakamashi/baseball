import type { Base, Position } from "../simulation/types";
import type { Strategy } from "./types";
import {
  calibratedMaximum,
  homeToFirst,
  runnerAcceleration,
  batterStart,
} from "./calibration";
export const assumptions = {
  baseMetres: 27.43,
  field: { cornerMetres: 90, centreMetres: 120, infieldMetres: 39 },
  // Same provisional average athlete as the running model; fielding still
  // requires a controlled <=3 m/s approach. This is not a measured age norm.
  defenderSpeed: calibratedMaximum(
    27.43,
    homeToFirst.average,
    runnerAcceleration,
    batterStart,
  ),
  defenderAcceleration: 5,
  fieldingReach: 0.6,
  secondaryLeadMetres: 27.43 * 0.08,
  runnerAcceleration,
  batterStart,
  homeToFirst,
  firstBase: {
    overrunMetres: 8,
    roundMetres: 4,
    turnSpeed: 4,
    returnSpeed: 3,
    readTime: 0.35,
  },
  fieldDelay: 0.25,
  transfer: 0.3,
  catchTime: 0.12,
  tagTime: 0.25,
  reaction: 0.25,
  runnerSpeed: {
    slow: calibratedMaximum(
      27.43,
      homeToFirst.slow,
      runnerAcceleration,
      batterStart,
    ),
    average: calibratedMaximum(
      27.43,
      homeToFirst.average,
      runnerAcceleration,
      batterStart,
    ),
    fast: calibratedMaximum(
      27.43,
      homeToFirst.fast,
      runnerAcceleration,
      batterStart,
    ),
  },
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
