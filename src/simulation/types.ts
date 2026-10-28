import type { DefensiveAssignment } from "../dynamic/types";
export const positions = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
] as const;
export type Position = (typeof positions)[number];
export type Runner = "BR" | "R1" | "R2" | "R3";
export type PlayerId = Position | Runner;
export type Base = 1 | 2 | 3 | "home";
export interface Point {
  x: number;
  y: number;
}
export interface GameState {
  outs: number;
  balls: number;
  strikes: number;
  runners: Partial<Record<Runner, Base>>;
  phase: string;
  runs: number;
  ballStatus?:
    | "ready"
    | "rolling"
    | "airborne"
    | "gathering"
    | "dead"
    | "held"
    | "throwing"
    | "complete";
  inning?: number;
  half?: "top" | "bottom";
  homeScore?: number;
  awayScore?: number;
  fieldingTeam?: "home" | "away";
  strategy?: "standard" | "prevent" | "conservative";
}
export type BallType =
  "Ground ball" | "Fly ball" | "Line drive" | "Base hit" | "Bunt";
export const directions = [
  "Left field",
  "Left-centre",
  "Centre field",
  "Right-centre",
  "Right field",
  "Third-base side",
  "Shortstop",
  "Middle infield",
  "Second-base side",
  "First-base side",
  "Pitcher",
] as const;
export type Direction = (typeof directions)[number];
export interface BallEvent {
  type: BallType;
  direction: Direction;
  location: Point;
  outcome: "fielded" | "caught" | "hit";
}
export interface PlayerState {
  id: PlayerId;
  position: Point;
  action: string;
  hasBall: boolean;
  status: "active" | "out" | "scored";
}
export interface Responsibility {
  action: string;
  why: string;
  support: string;
}
export interface Movement {
  player: PlayerId;
  path: Point[];
  samples?: TimedPoint[];
}
export interface TimedPoint {
  t: number;
  point: Point;
  height?: number;
}
export type BallAction =
  | {
      kind: "held";
      owner: PlayerId;
      secure?: boolean;
      height?: number;
      endHeight?: number;
      gloveOffset?: Point;
    }
  | {
      kind: "travel";
      journeyId?: string;
      path: Point[];
      style: "hit" | "throw";
      receiver?: Position;
      samples?: TimedPoint[];
      dead?: boolean;
    };
export interface PlayPhase {
  assignments?: DefensiveAssignment[];
  id: string;
  title: string;
  start: number;
  duration: number;
  explanation: string;
  movements: Movement[];
  ball: BallAction;
  responsibilities: Record<string, Responsibility>;
  state: GameState;
  statuses: Partial<Record<Runner, "active" | "out" | "scored">>;
}
export interface PlayScenario {
  id: string;
  title: string;
  category: string;
  description: string;
  objective: string;
  initial: GameState;
  ballEvent: BallEvent;
  startingPositions: Record<string, Point>;
  phases: PlayPhase[];
  result: string;
  notes: string[];
  alternatives: string[];
  notation: string;
}
export interface Snapshot {
  time: number;
  phase: PlayPhase;
  players: PlayerState[];
  ball: Point;
  owner?: PlayerId;
  ballHeight?: number;
  state: GameState;
}
export interface PlayProvider {
  resolve(
    state: GameState,
    event: Pick<BallEvent, "type" | "direction"> & Partial<BallEvent>,
  ):
    | { supported: true; scenarios: PlayScenario[] }
    | { supported: false; reason: string };
}
