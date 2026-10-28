import type {
  Base,
  GameState,
  PlayScenario,
  PlayerId,
  Point,
  Position,
  Runner,
} from "../simulation/types";
export type Strength = "soft" | "normal" | "hard";
export type Aggression = "conservative" | "normal" | "aggressive";
export type RunnerSpeed = "slow" | "average" | "fast";
export type Strategy = "standard" | "prevent" | "conservative";
export type ThrowTarget = Base | "auto" | "hold" | "cutoff";
export type AssignmentType =
  | "FieldBall"
  | "CoverBase"
  | "Cutoff"
  | "Relay"
  | "BackupFielder"
  | "BackupThrow"
  | "HoldPosition"
  | "PrepareForThrow"
  | "Communicate";
export interface DynamicSettings {
  state: GameState & {
    inning: number;
    half: "top" | "bottom";
    homeScore: number;
    awayScore: number;
    fieldingTeam: "home" | "away";
    strategy: Strategy;
  };
  ball: {
    type: "Ground ball" | "Base hit";
    destination: Point;
    strength: Strength;
  };
  aggression: Aggression;
  runnerSpeed: RunnerSpeed;
  throwTarget: ThrowTarget;
}
export interface BattedBall {
  type: DynamicSettings["ball"]["type"];
  origin: Point;
  destination: Point;
  strength: Strength;
  path: Point[];
  travelTime: number;
  fieldingTime: number;
  fielder: Position;
  fieldingPoint: Point;
  status: "rolling" | "fielded";
}
export interface DefensiveAssignment {
  player: Position;
  type: AssignmentType;
  target: Point;
  priority: number;
  base?: Base;
  teammate?: Position;
  replacesOn: string;
  explanation: string;
}
export interface DefensivePlayer {
  id: Position;
  position: Point;
  speed: number;
  throwSpeed: number;
  assignment?: DefensiveAssignment;
  hasBall: boolean;
}
export interface OffensiveRunner {
  id: Runner;
  originBase: number;
  progress: number;
  goal: number;
  speed: number;
  decision: "advance" | "hold" | "retreat";
  status: "active" | "out" | "scored";
}
export interface SimulationEvent {
  id: string;
  time: number;
  type:
    | "BallContact"
    | "BallFielded"
    | "ThrowStarted"
    | "ThrowReceived"
    | "RunnerAdvanced"
    | "RunnerRetreated"
    | "RunnerOut"
    | "RunScored"
    | "RunDisallowed"
    | "BaseTouched"
    | "PlayCompleted";
  player?: PlayerId;
  base?: Base;
  force?: boolean;
  explanation: string;
}
export interface ThrowDecision {
  target: Base | "hold";
  runner?: Runner;
  force: boolean;
  margin?: number;
  reason: string;
  override: boolean;
}
export interface SimulationMetadata {
  settings: DynamicSettings;
  ball: BattedBall;
  events: SimulationEvent[];
  decisions: ThrowDecision[];
  closePlays: number;
  convention: string;
}
export interface DynamicScenario extends PlayScenario {
  dynamic: SimulationMetadata;
}
export interface SimulationTimeline {
  scenario: DynamicScenario;
  events: SimulationEvent[];
}
