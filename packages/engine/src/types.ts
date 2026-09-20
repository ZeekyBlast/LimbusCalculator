export type Sin = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy'
export type DamageType = 'slash' | 'pierce' | 'blunt'
export type SkillDamageType = DamageType | 'guard' | 'evade' | 'none'
export type UptieTier = 1 | 2 | 3 | 4

export interface Resistances {
  damageType: Record<DamageType, number>
  sin: Record<Sin, number>
}

export interface Passive {
  name: string
  text: string
  effects: Effect[]
}

export interface Unit {
  id: string
  kind: 'identity' | 'enemy'
  name: string
  group?: string
  level: number
  hp: number
  hpGrowth: number
  speed: { min: number; max: number }
  defenseMod: number
  resistances: Resistances
  /** Fractions of max HP, descending, e.g. [0.7, 0.4]. */
  staggerThresholds: number[]
  skills: Skill[]
  passives: Passive[]
}

export type EffectTrigger =
  | 'on-use' | 'combat-start' | 'clash-win' | 'clash-lose' | 'on-hit'
  | 'heads-hit' | 'tails-hit' | 'on-crit' | 'attack-end' | 'passive'

export interface Condition {
  stat: string
  side: 'self' | 'target'
  field: 'potency' | 'count'
  op: '>=' | '>' | '<=' | '<' | '=='
  value: number
}

export type Operation =
  | { kind: 'coinPower'; delta: number }
  | { kind: 'basePower'; delta: number }
  | { kind: 'clashPower'; delta: number }
  | { kind: 'damagePercent'; delta: number }
  | { kind: 'applyStatus'; target: 'self' | 'target'; status: string; potency?: number; count?: number }
  | { kind: 'unparsed' }

export interface Effect {
  trigger: EffectTrigger
  scope: 'skill' | { coin: number }
  condition?: Condition
  op: Operation
  source: string
}

export interface SkillUptieOverride {
  basePower?: number
  coinPower?: number
  effects?: Effect[]
}

export interface Skill {
  id: string
  name: string
  slot: 'skill1' | 'skill2' | 'skill3' | 'defense' | 'enemy'
  variant?: string
  sin: Sin
  damageType: SkillDamageType
  offenseLevelMod: number
  basePower: number
  coinPower: number
  coinCount: number
  /** 0-based indices of coins that are Unbreakable. */
  unbreakableCoins: number[]
  attackWeight: number
  /** Overrides keyed by the tier they start applying at; an override applies from its tier upward until a higher tier overrides it. */
  uptie: Partial<Record<UptieTier, SkillUptieOverride>>
  effects: Effect[]
  rawText: { skill: string; coins: string[] }
}

export interface StatusValue { potency: number; count: number }

export interface ManualOverrides {
  coinPower: number
  basePower: number
  clashPower: number
  damagePercent: number
}

export interface Combatant {
  unit: Unit
  skill: Skill
  uptie: UptieTier
  level: number
  /** -45..45. Enemies are always 0. */
  sanity: number
  status: Record<string, StatusValue>
  manual: ManualOverrides
  /** Current HP; defaults to max when omitted. */
  currentHp?: number
}

export interface ResolvedCombatant {
  basePower: number
  coinPower: number
  coinCount: number
  unbreakableCoins: number
  headsChance: number
  offenseLevel: number
  defenseLevel: number
  clashPowerBonus: number
  damagePercent: number
  coinRollBonus: number
  critChance: number
  poiseCount: number
  /** Damage Up/Down etc. contributed when this combatant attacks. */
  dynamicAsAttacker: number
  /** Extra dynamic modifier that only applies on a critical hit (Crit Damage Up). */
  critOnlyModifier: number
  /** Fragile/Protection etc. contributed when this combatant is hit. */
  dynamicAsTarget: number
  maxHp: number
  currentHp: number
  sin: Sin
  damageType: SkillDamageType
  effectsApplied: string[]
  effectsUnparsed: string[]
}

export interface DamageSummary {
  mean: number
  p10: number
  p50: number
  p90: number
  max: number
  perCoinMean: number[]
  histogram: [number, number][]
  staggerChance: number[]
}

export interface BreakdownLine { label: string; value: number; source: string }

export interface ClashReport {
  win: number
  lose: number
  draw: number
  coinsLeftIfWin: number[]
  coinsLeftIfLose: number[]
  parryRoundsExpected: number
  /** Damage A deals to B, conditional on A winning. */
  damageDealt: DamageSummary
  /** Damage B deals to A, conditional on B winning. */
  damageTaken: DamageSummary
  breakdown: BreakdownLine[]
}

export interface UnopposedReport {
  damage: DamageSummary
  breakdown: BreakdownLine[]
}

export interface MatchupCell {
  attackerSkillId: string
  targetUnitId: string
  targetSkillId: string
  win: number
  medianDamage: number
  meanDamage: number
  sinMultiplier: number
  damageTypeMultiplier: number
}

export interface MatchupGrid {
  rows: { unitId: string; skillId: string }[]
  columns: { unitId: string; skillId: string; turnsToKill: number }[]
  cells: MatchupCell[][]
}

/** Shared default; frozen because callers spread it (`{ ...EMPTY_MANUAL }`) rather than mutate it. */
export const EMPTY_MANUAL: Readonly<ManualOverrides> = Object.freeze({ coinPower: 0, basePower: 0, clashPower: 0, damagePercent: 0 })

export const ALL_SINS: readonly Sin[] = Object.freeze<Sin[]>(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'])
