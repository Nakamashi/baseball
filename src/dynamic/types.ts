import type {
  Base,
  GameState,
  PlayScenario,
  PlayerId,
  Point,
  Position,
  Runner,
} from "../simulation/types";
import type { BallTrajectory } from "./trajectory";
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
  | "RecoverPosition"
  | "ThrowBall"
  | "PossessBall"
  | "SupportBase"
  | "TrailRunner"
  | "Communicate"
  | "Decelerate"
  | "TrackBall";
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
    type: "Ground ball" | "Fly ball" | "Line drive";
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
  status: "rolling" | "fielded" | "caught" | "out-of-play";
  trajectory?: BallTrajectory;
  touchTime?: number;
  touchPoint?: Point;
  pursuitTarget?: Point;
  pursuitDelay?: number;
  caught?: boolean;
  infieldFly?: boolean;
  boundary?: "home-run" | "ground-rule-double";
  candidates?: {
    player: Position;
    time: number;
    point: Point;
    bodyPoint?: Point;
    endingSpeed?: number;
    height: number;
    arrival: number;
    caught: boolean;
  }[];
}
export interface DefensiveAssignment {
  player: Position;
  type: AssignmentType;
  target: Point;
  priority: number;
  notBefore?: number;
  base?: Base;
  teammate?: Position;
  replacesOn: string;
  explanation: string;
  reason: AssignmentReason;
  runner?: Runner;
  /** Estimated seconds from this assignment snapshot; not a guarantee of readiness. */
  arrivalTime?: number;
  neededBy?: number;
  throwOrigin?: Point;
  receivingPoint?: Point;
}
export type AssignmentReason =
  | "primary"
  | "release"
  | "possession"
  | "receiver"
  | "liveBase"
  | "homeThreat"
  | "cutoffLane"
  | "relayLane"
  | "fieldBackup"
  | "wallSupport"
  | "throwBackup"
  | "catcherSupport"
  | "homeGuard"
  | "secondSupport"
  | "trailing"
  | "guardThird"
  | "guardSpace"
  | "complete"
  | "braking"
  | "boundaryTrack";
export interface AssignmentContext {
  ballDead?: boolean;
  fixedCutoff?: Position;
  fixedReceiver?: Position;
  ballInFlight?: boolean;
  receptionTimes?: Partial<Record<Position, number>>;
  runners: OffensiveRunner[];
  outs: number;
}
export interface CoverageIssue {
  kind: "unfulfilled" | "late-backup" | "conflict" | "space-limited";
  base?: Base;
  player?: Position;
  detail: string;
}
export interface ThrowRoute {
  kind:
    "direct" | "through-cutoff" | "relay" | "cutoff-hold" | "carry" | "hold";
  target: Base | "hold";
  from: Point;
  receiver?: Position;
  cutoff?: Position;
  cutoffPoint?: Point;
  legs: Position[];
}
export interface DefensiveLayout {
  assignments: DefensiveAssignment[];
  receiver?: Position;
  cutoff?: Position;
  route: ThrowRoute;
  issues: CoverageIssue[];
}
export interface ThrowCandidate {
  appeal?: boolean;
  target: Base;
  runner: Runner;
  force: boolean;
  runnerArrival: number;
  ballArrival: number;
  margin: number;
  viable: boolean;
  competitive: boolean;
  preventsRun: boolean;
  score: number;
  reason:
    | "competitive-home"
    | "timely-home"
    | "third-out"
    | "lead-force"
    | "tag-opportunity"
    | "too-late"
    | "insufficient-margin";
  route: ThrowRoute["kind"];
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
  runVelocity?: number;
  startDelay?: number;
  airborneRead?: "tag" | "read" | "contact";
  forceRemoved?: boolean;
  retouchBase?: number;
  afterRetouchGoal?: number;
  approach?: "straight" | "round";
  retiredRunThrough?: boolean;
  firstTurn?: {
    kind: "overrun" | "round";
    stage: "outbound" | "read" | "return" | "complete";
    travelled: number;
    extent: number;
    readRemaining: number;
  };
  plan?: {
    reason: string;
    candidates: {
      base: Base;
      runnerTime: number;
      defensiveTime: number;
      margin: number;
      accepted: boolean;
    }[];
  };
}
export interface SimulationEvent {
  id: string;
  time: number;
  type:
    | "BallContact"
    | "BallFielded"
    | "ThrowStarted"
    | "ThrowReceived"
    | "ThrowGloveContact"
    | "BallTouched"
    | "BallCaught"
    | "InfieldFly"
    | "RunnerTaggedUp"
    | "BallPassedInfield"
    | "BallBoundary"
    | "BallBounce"
    | "RunnerAdvanced"
    | "RunnerBaseTouch"
    | "RunnerRetreated"
    | "RunnerOut"
    | "RunScored"
    | "RunDisallowed"
    | "BaseTouched"
    | "RunThroughAfterOut"
    | "FirstBaseOverrun"
    | "FirstBaseRounded"
    | "RunnerReturned"
    | "PlayCompleted";
  player?: PlayerId;
  base?: Base;
  force?: boolean;
  explanation: string;
}
export interface ThrowDecision {
  appeal?: boolean;
  target: Base | "hold";
  runner?: Runner;
  force: boolean;
  margin?: number;
  reason: string;
  override: boolean;
  alternatives?: ThrowCandidate[];
  time?: number;
  owner?: Position;
}
export interface SimulationMetadata {
  modelVersion: string;
  contactTime: number;
  settings: DynamicSettings;
  ball: BattedBall;
  events: SimulationEvent[];
  decisions: ThrowDecision[];
  closePlays: number;
  convention: string;
  diagnostics: DefensiveAuditFrame[];
}
export interface DefensiveAuditFrame {
  time: number;
  trigger: string;
  state: GameState;
  runners: OffensiveRunner[];
  owner: Position;
  target: Base | "hold";
  route: ThrowRoute;
  assignments: DefensiveAssignment[];
  issues: CoverageIssue[];
}
export interface DynamicScenario extends PlayScenario {
  dynamic: SimulationMetadata;
}
export interface SimulationTimeline {
  scenario: DynamicScenario;
  events: SimulationEvent[];
}
