// Core game types shared across all systems

export interface CreationAttributes {
  constitution: number; // 0-5
  schoolRanking: number; // 0-5
  geoLocation: number; // 0-5
}

export interface CoreAttributes {
  performance: number; // 0-100
  skills: number; // 0-100
  academicImpact: number; // 0-100
  health: number; // 0-100
  mental: number; // 0-100
  netWorth: number; // uncapped
}

export type CoreAttributeKey = keyof CoreAttributes;

export type ThresholdState =
  | 'healthy'
  | 'subhealthy'
  | 'critical'
  | 'hospitalized'
  | 'stable'
  | 'stressed'
  | 'atRisk'
  | 'burnout';

export type WorkMode = 'coast' | 'normal' | 'grind';

export type GamePhase = 'academic' | 'career';
export type AcademicStudyMode = 'light' | 'normal' | 'intense';

export type EconomicPhase = 'boom' | 'normal' | 'recession' | 'recovery';

export type VisaType =
  | 'f1'
  | 'opt'
  | 'optStem'
  | 'h1b'
  | 'h1bRenewal'
  | 'h1b7thYear'
  | 'o1'
  | 'l1'
  | 'cptDay1'
  | 'comboCard'
  | 'greenCard';

export type PermStatus =
  | 'none'
  | 'employerDelay'
  | 'filing'
  | 'pending'
  | 'audited'
  | 'approved';

export type I140Status = 'none' | 'pending' | 'approved';
export type I485Status = 'none' | 'pending' | 'rfe' | 'approved';
export type GcTrack = 'perm' | 'niw' | 'eb1a' | 'marriage' | 'none';

export type CompanyCulture = 'grind' | 'balanced' | 'relaxed';
export type GcWillingness = 'eager' | 'standard' | 'reluctant';
export type BossType = 'supportive' | 'neutral' | 'demanding' | 'toxic';
export type CompanyTier = 'faang' | 'bigTech' | 'midTech' | 'startup';
export type CityTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

export type EmploymentStatus = 'student' | 'employed' | 'unemployed' | 'startup';

export type EndingType =
  | 'gcBeforeDeadline'
  | 'age59WithGc'
  | 'age59WithoutGc'
  | 'deported'
  | 'voluntaryDeparture';

export interface Company {
  id: string;
  name: string;
  tier: CompanyTier;
  city: CityTier;
  culture: CompanyCulture;
  gcWillingness: GcWillingness;
  salaryModifier: number;
  pipRateModifier: number;
  promotionModifier: number;
  layoffModifier: number;
}

export interface CareerState {
  path: string; // 'sde' for MVP
  level: number; // 3-7
  company: Company | null;
  bossType: BossType;
  tenure: number; // quarters at current company
  onPip: boolean;
  pipQuartersRemaining: number;
  coastConsecutive: number;
  grindConsecutive: number;
  employed: EmploymentStatus;
  salary: number; // annual TC
  rsu: number; // annual RSU
}

export interface ImmigrationState {
  visaType: VisaType;
  visaExpiryTurn: number;
  permStatus: PermStatus;
  permStartTurn: number;
  i140Status: I140Status;
  i485Status: I485Status;
  priorityDate: number | null; // turn number when PERM was filed
  priorityDateCurrent: number; // visa bulletin cutoff
  gcTrack: GcTrack;
  hasComboCard: boolean;
  hasGreenCard: boolean;
  h1bAttempts: number;
  h1bFiled: boolean;
  h1bPending: boolean; // selected in lottery but not yet activated (Q2→Q4)
  unemploymentQuarters: number; // for NOID tracking
  graceQuartersRemaining: number; // 60-day H1B grace
}

export interface EconomyState {
  cash: number;
  portfolioShares: number;
  portfolioCostBasis: number;
  sharePrice: number;
  autoInvestAmount: number; // per quarter, 0 = off
  ownsHome: boolean;
  homePurchasePrice: number;
  homeMortgageRemaining: number;
  homeValue: number;
  studentLoanRemaining: number;
  city: CityTier;
}

export interface AcademicState {
  gpa: number; // 2.0-4.0
  hadIntern: boolean;
  internQuality: 'none' | 'mid' | 'top';
  hasReturnOffer: boolean;
  isPhd: boolean;
  thesisPoints: number;
}

export interface Portfolio {
  shares: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export type ActionId =
  | 'upskill'
  | 'prepJobChange'
  | 'prepJobChangeIntensive'
  | 'entrepreneurship'
  | 'prepH1b'
  | 'researchNiw'
  | 'publishPaper'
  | 'consultLawyer'
  | 'rest'
  | 'hospital'
  | 'travel'
  | 'exercise'
  | 'therapist'
  | 'studyGpa'
  | 'searchIntern'
  | 'thesisResearch'
  | 'taRaWork'
  | 'networking'
  | 'sideProject'
  | 'urgentJobSearch'
  | 'internWork'
  | 'workHard'
  | 'workSuperHard'
  | 'studySlack'
  | 'studyNormal'
  | 'studyHard';

export interface ActionDef {
  id: ActionId;
  nameZh: string;
  apCost: number;
  phase: 'academic' | 'career' | 'any';
  effects: Partial<CoreAttributes>;
  description: string;
  tipsZh?: string; // Chinese pros/cons guidance
  precondition?: (state: GameState) => boolean;
  exclusive?: ActionId[]; // mutually exclusive with
}

export interface EventChoice {
  id: string;
  textKey: string;
  nameZh: string;
  descZh: string;
  tag: 'stable' | 'risky' | 'desperate' | 'costly' | 'neutral';
  effects: Partial<CoreAttributes>;
  flags?: Record<string, unknown>;
  probabilityRoll?: string; // event type for probability check on risky choices
}

export interface GameEvent {
  id: string;
  type: 'crisis' | 'opportunity' | 'life' | 'immigration' | 'career' | 'economic';
  nameZh: string;
  descZh: string;
  phase: 'academic' | 'career' | 'any';
  precondition?: (state: GameState) => boolean;
  weight: number;
  weightModifiers?: { condition: (state: GameState) => boolean; multiplier: number }[];
  cooldownQuarters: number;
  oneTime: boolean;
  immediateEffects: Partial<CoreAttributes>;
  choices: EventChoice[];
}

export interface QuarterRecord {
  turn: number;
  year: number;
  quarter: number;
  age: number;
  attributesBefore: CoreAttributes;
  attributesAfter: CoreAttributes;
  events: { id: string; choiceId: string }[];
  milestone?: string;
  workMode: WorkMode | AcademicStudyMode;
  actions: ActionId[];
}

export interface GameState {
  turn: number;
  phase: GamePhase;
  creation: CreationAttributes;
  attributes: CoreAttributes;
  career: CareerState;
  immigration: ImmigrationState;
  economy: EconomyState;
  academic: AcademicState;
  economicPhase: EconomicPhase;
  economicPhaseQuarters: number;
  timeline: QuarterRecord[];
  eventCooldowns: Record<string, number>;
  eventFired: Set<string>;
  flags: Record<string, unknown>;
  schoolModifier: number;
  geoBonus: number;
  constitutionSicknessModifier: number;
  grindLockQuarters: number;
  jobSearchQuarters: number;
  endingType: EndingType | null;
  hasUsMasters: boolean;
}
