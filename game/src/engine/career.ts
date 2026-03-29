// Career System — company generation, promotion, PIP, layoff, job change

import type { GameState, Company, BossType, CompanyTier, CityTier, CompanyCulture, GcWillingness, CareerState } from './types';
import { roll } from './probability';

const COMPANY_NAMES = [
  'TechCorp', 'DataFlow', 'CloudNine', 'ByteWorks', 'NexGen',
  'Quantum Labs', 'SkyNet AI', 'DeepMind Co', 'Apex Systems', 'Vertex Inc',
  'Sigma Tech', 'Lambda Corp', 'Zeta Digital', 'Omega Systems', 'PrimeCode',
  'CoreStack', 'FluxData', 'HyperScale', 'MetaLogic', 'NovaTech',
];

const SALARY_BANDS: Record<number, { min: number; max: number; rsu: number }> = {
  3: { min: 120000, max: 180000, rsu: 30000 },
  4: { min: 160000, max: 250000, rsu: 60000 },
  5: { min: 220000, max: 350000, rsu: 100000 },
  6: { min: 300000, max: 500000, rsu: 180000 },
  7: { min: 450000, max: 700000, rsu: 300000 },
};

const SEVERANCE_MONTHS: Record<number, number> = { 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(options: { value: T; weight: number }[]): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

function randomUniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function rollBossType(): BossType {
  return weightedPick([
    { value: 'supportive' as BossType, weight: 0.25 },
    { value: 'neutral' as BossType, weight: 0.40 },
    { value: 'demanding' as BossType, weight: 0.25 },
    { value: 'toxic' as BossType, weight: 0.10 },
  ]);
}

export function generateCompany(level: number, currentCity?: CityTier): Company {
  const tier = weightedPick<CompanyTier>([
    { value: 'faang', weight: level >= 5 ? 0.3 : 0.15 },
    { value: 'bigTech', weight: 0.35 },
    { value: 'midTech', weight: 0.30 },
    { value: 'startup', weight: 0.20 },
  ]);

  const city = currentCity ?? weightedPick<CityTier>([
    { value: 'tier1', weight: 0.40 },
    { value: 'tier2', weight: 0.25 },
    { value: 'tier3', weight: 0.25 },
    { value: 'tier4', weight: 0.10 },
  ]);

  const culture = weightedPick<CompanyCulture>([
    { value: 'grind', weight: tier === 'startup' ? 0.5 : 0.25 },
    { value: 'balanced', weight: 0.45 },
    { value: 'relaxed', weight: tier === 'faang' ? 0.15 : 0.30 },
  ]);

  const gcWillingness = weightedPick<GcWillingness>([
    { value: 'eager', weight: tier === 'faang' ? 0.6 : 0.2 },
    { value: 'standard', weight: 0.4 },
    { value: 'reluctant', weight: tier === 'startup' ? 0.5 : 0.2 },
  ]);

  const salaryMod = tier === 'faang' ? 1.15 : tier === 'bigTech' ? 1.05 : tier === 'startup' ? 0.90 : 1.0;
  const cityMod = city === 'tier1' ? 1.0 : city === 'tier2' ? 0.92 : city === 'tier3' ? 0.85 : 0.78;

  return {
    id: `company_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: pick(COMPANY_NAMES),
    tier,
    city,
    culture,
    gcWillingness,
    salaryModifier: salaryMod * cityMod,
    pipRateModifier: culture === 'grind' ? 0.05 : culture === 'relaxed' ? -0.03 : 0,
    promotionModifier: culture === 'grind' ? 0.03 : culture === 'relaxed' ? -0.03 : 0,
    layoffModifier: tier === 'startup' ? 0.03 : tier === 'faang' ? -0.02 : 0,
  };
}

export function computeSalary(level: number, company: Company, performance: number): { salary: number; rsu: number } {
  const band = SALARY_BANDS[level] || SALARY_BANDS[3];
  const perfPosition = Math.max(0, (performance - 50) / 50);
  const range = band.max - band.min;
  const baseSalary = band.min + range * perfPosition * 0.5;
  const salary = Math.round(baseSalary * company.salaryModifier);
  const rsu = Math.round(band.rsu * company.salaryModifier);
  return { salary, rsu };
}

export function processAnnualReview(state: GameState): {
  promoted: boolean;
  newLevel: number;
  mentalDelta: number;
  performanceReset?: number;
  salaryChange?: { salary: number; rsu: number };
} {
  const { career, attributes } = state;
  if (career.level >= 7) {
    // L7 — no further promotion, within-level raise only
    return { promoted: false, newLevel: 7, mentalDelta: 0 };
  }

  // Check minimum tenure
  const minTenure: Record<number, number> = { 3: 4, 4: 8, 5: 12, 6: 16, 7: 999 };
  if (career.tenure < (minTenure[career.level] || 4)) {
    return { promoted: false, newLevel: career.level, mentalDelta: 0 };
  }

  if (career.onPip) {
    return { promoted: false, newLevel: career.level, mentalDelta: -5 };
  }

  const result = roll('promotion', state);

  if (result.success) {
    const newLevel = career.level + 1;
    const newSalary = career.company
      ? computeSalary(newLevel, career.company, 60)
      : { salary: SALARY_BANDS[newLevel].min, rsu: SALARY_BANDS[newLevel].rsu };
    return {
      promoted: true,
      newLevel,
      mentalDelta: 15,
      performanceReset: 60,
      salaryChange: newSalary,
    };
  }

  // Denied — check for consecutive denials
  return {
    promoted: false,
    newLevel: career.level,
    mentalDelta: -5, // mild disappointment; -10 if 2+ consecutive tracked elsewhere
  };
}

export function checkPip(state: GameState): { pipTriggered: boolean } {
  if (state.attributes.performance >= 30) return { pipTriggered: false };
  if (state.career.onPip) return { pipTriggered: false }; // already on PIP

  const result = roll('pip', state);
  return { pipTriggered: result.success };
}

export function processPipQuarter(state: GameState): {
  resolved: boolean;
  terminated: boolean;
} {
  if (!state.career.onPip) return { resolved: false, terminated: false };

  if (state.attributes.performance >= 50) {
    return { resolved: true, terminated: false };
  }

  if (state.career.pipQuartersRemaining <= 0) {
    return { resolved: true, terminated: true };
  }

  return { resolved: false, terminated: false };
}

export function checkLayoff(state: GameState): { laidOff: boolean; severance: number } {
  if (state.career.employed !== 'employed') return { laidOff: false, severance: 0 };

  const result = roll('layoff', state);
  if (!result.success) return { laidOff: false, severance: 0 };

  const months = SEVERANCE_MONTHS[state.career.level] || 2;
  const quarterlySalary = (state.career.salary + state.career.rsu) / 4;
  const severance = quarterlySalary * (months / 3);
  return { laidOff: true, severance: Math.round(severance) };
}

export function generateJobOffers(
  state: GameState,
  count: number
): Array<{
  company: Company;
  level: number;
  salary: number;
  rsu: number;
  signingBonus: number;
}> {
  const offers = [];
  for (let i = 0; i < count; i++) {
    const externalPromo = Math.random() < 0.15;
    const offerLevel = externalPromo ? Math.min(state.career.level + 1, 7) : state.career.level;
    const company = generateCompany(offerLevel);

    // Job hop premium: 15-40%
    const currentTC = state.career.salary + state.career.rsu;
    const hopPremium = randomUniform(0.15, 0.40);
    const targetTC = currentTC * (1 + hopPremium);

    const band = SALARY_BANDS[offerLevel];
    const salary = Math.round(Math.min(band.max * company.salaryModifier, targetTC * 0.7));
    const rsu = Math.round(Math.min(band.rsu * company.salaryModifier, targetTC * 0.3));
    const signingBonus = Math.round(salary * randomUniform(0.1, 0.3));

    offers.push({ company, level: offerLevel, salary, rsu, signingBonus });
  }
  return offers;
}

export function applyJobChange(
  state: GameState,
  offer: { company: Company; level: number; salary: number; rsu: number; signingBonus: number }
): Partial<CareerState> & { economyDelta: number; mentalDelta: number; permReset: boolean } {
  const preI140 = state.immigration.i140Status !== 'approved';

  return {
    company: offer.company,
    level: offer.level,
    salary: offer.salary,
    rsu: offer.rsu,
    bossType: rollBossType(),
    tenure: 0,
    onPip: false,
    pipQuartersRemaining: 0,
    coastConsecutive: 0,
    grindConsecutive: 0,
    employed: 'employed',
    economyDelta: offer.signingBonus,
    mentalDelta: 10,
    permReset: preI140 && (state.immigration.permStatus !== 'none'),
  };
}

export function shouldRotateBoss(tenure: number): boolean {
  if (tenure < 6) return false;
  return Math.random() < 0.15; // ~15% chance each quarter after 6
}
