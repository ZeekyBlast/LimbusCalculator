import { EMPTY_MANUAL, primaryAttackSkill, type Combatant, type ManualOverrides, type Skill, type StatusValue, type Unit, type UptieTier } from '@limbus/engine'
import type { GameData } from './data.ts'

export type SideKey = 'a' | 'b'

export interface SideSetup {
  unitId: string | null
  skillId: string | null
  uptie: UptieTier
  level: number
  /** -45..45; ignored (forced to 0) for enemies. */
  sanity: number
  status: Record<string, StatusValue>
  manual: ManualOverrides
  /** null means full HP. */
  currentHp: number | null
}

export interface ClashSetup {
  a: SideSetup
  b: SideSetup
  /** Spec 10: whether a stagger threshold crossed mid-attack applies Fatal to the remaining coins. */
  staggerMidAttack: boolean
}

export const EMPTY_SIDE: Readonly<SideSetup> = Object.freeze({
  unitId: null, skillId: null, uptie: 4, level: 1, sanity: 0, status: {}, manual: EMPTY_MANUAL, currentHp: null,
})

export function emptySide(): SideSetup {
  return { ...EMPTY_SIDE, status: {}, manual: { ...EMPTY_MANUAL } }
}

export function emptySetup(): ClashSetup {
  return { a: emptySide(), b: emptySide(), staggerMidAttack: true }
}

/** Side setup for a freshly picked unit: scraped level, uptie 4, its primary attack skill, no state. */
export function sideForUnit(unit: Unit, skillId?: string): SideSetup {
  const requested = skillId ? unit.skills.find(s => s.id === skillId) : undefined
  const skill = requested ?? primaryAttackSkill(unit) ?? unit.skills[0]
  return { ...emptySide(), unitId: unit.id, skillId: skill?.id ?? null, level: unit.level }
}

/** The skill as displayed at a tier: an override applies from its tier upward until a higher tier overrides it. */
export function skillAtUptie(skill: Skill, tier: UptieTier): Skill {
  let out = { ...skill }
  for (const t of [1, 2, 3, 4] as UptieTier[]) {
    if (t > tier) break
    const o = skill.uptie[t]
    if (!o) continue
    if (o.basePower !== undefined) out = { ...out, basePower: o.basePower }
    if (o.coinPower !== undefined) out = { ...out, coinPower: o.coinPower }
    if (o.effects !== undefined) out = { ...out, effects: o.effects }
  }
  return out
}

/** Max HP at another level, per the data package's contract note: hp + hpGrowth * (L - level). */
export function hpAtLevel(unit: Unit, level: number): number {
  return Math.round(unit.hp + unit.hpGrowth * (level - unit.level))
}

export function toCombatant(side: SideSetup, data: GameData): Combatant | undefined {
  const unit = side.unitId ? data.unitsById.get(side.unitId) : undefined
  if (!unit) return undefined
  const skill = side.skillId ? unit.skills.find(s => s.id === side.skillId) : undefined
  const scaled = side.level === unit.level ? unit : { ...unit, hp: hpAtLevel(unit, side.level) }
  return {
    unit: scaled,
    skill,
    uptie: side.uptie,
    level: side.level,
    sanity: unit.kind === 'enemy' ? 0 : side.sanity,
    status: side.status,
    manual: side.manual,
    ...(side.currentHp !== null ? { currentHp: side.currentHp } : {}),
  }
}
