import type { Sin, SkillDamageType } from '@limbus/engine'
import { SINS } from '../types.ts'

/** Sinner level cap in Season 7; identities are stored at this level. */
export const IDENTITY_LEVEL_CAP = 60

export function toNumber(raw: string | undefined): number | undefined {
  if (raw == null) return undefined
  const cleaned = raw.trim().replace(/^\+\s*/, '')
  if (cleaned === '') return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

const RESISTANCE_WORDS: Record<string, number> = {
  ineff: 0.5, 'ineff.': 0.5, ineffective: 0.5,
  endure: 0.75, endured: 0.75,
  normal: 1,
  weak: 1.5,
  fatal: 2,
}

/** Word or numeric resistance to a damage multiplier (0.5 Ineffective .. 2 Fatal). */
export function resistanceMultiplier(raw: string | undefined): number | undefined {
  if (raw == null) return undefined
  const key = raw.trim().toLowerCase()
  if (key === '') return undefined
  if (key in RESISTANCE_WORDS) return RESISTANCE_WORDS[key]
  return toNumber(key)
}

export function normalizeSin(raw: string | undefined): Sin | undefined {
  const key = raw?.trim().toLowerCase()
  return SINS.find(s => s === key)
}

export function normalizeDamageType(raw: string | undefined): SkillDamageType {
  const key = raw?.trim().toLowerCase() ?? ''
  if (key === 'slash' || key === 'pierce' || key === 'blunt') return key
  if (key === 'guard' || key === 'defense') return 'guard'
  if (key === 'evade') return 'evade'
  return 'none'
}

export function parseSpeed(raw: string | undefined): { min: number; max: number } | undefined {
  const m = /^\s*(\d+)\s*[~-]\s*(\d+)\s*$/.exec(raw ?? '')
  if (!m) return undefined
  return { min: Number(m[1]), max: Number(m[2]) }
}

/** `stagger1..staggerN` percentages -> fractions of max HP in the order the wiki lists them (descending). */
export function parseStaggerThresholds(params: Record<string, string>, count: number): number[] {
  const out: number[] = []
  for (let i = 1; i <= count; i++) {
    const n = toNumber(params[`stagger${i}`])
    if (n !== undefined) out.push(n / 100)
  }
  return out
}

/** The wiki displays HP as hp + hpgrowth * level, rounded. */
export function maxHpAtLevel(baseHp: number, growth: number, level: number): number {
  return Math.round(baseHp + growth * level)
}

const STATUS_ALIASES: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(slash|pierce|blunt) fragility$/, m => `fragile-${m[1]}`],
  [/^(slash|pierce|blunt) dmg up$/, m => `damage-up-${m[1]}`],
  [/^(slash|pierce|blunt) dmg down$/, m => `damage-down-${m[1]}`],
  [/^(slash|pierce|blunt) power up$/, m => `power-up-${m[1]}`],
  [/^(slash|pierce|blunt) power down$/, m => `power-down-${m[1]}`],
]

/** Status name as written in skill text -> the engine registry's kebab-case id. */
export function statusId(name: string): string {
  const key = name.trim().toLowerCase()
  for (const [re, build] of STATUS_ALIASES) {
    const m = re.exec(key)
    if (m) return build(m)
  }
  return key
    .replace(/\([^)]*\)/g, m => ' ' + m.slice(1, -1) + ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
