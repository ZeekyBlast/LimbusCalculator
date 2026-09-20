import type { Combatant, Skill, Unit, Effect } from '../src/types'
import { EMPTY_MANUAL } from '../src/types'

const flatSin = { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 }

export function makeSkill(over: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-a', name: 'Test Skill', slot: 'skill1', sin: 'wrath', damageType: 'slash',
    offenseLevelMod: 0, basePower: 4, coinPower: 3, coinCount: 2, unbreakableCoins: [],
    attackWeight: 1, uptie: {}, effects: [], rawText: { skill: '', coins: [] }, ...over,
  }
}

export function makeUnit(over: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-a', kind: 'identity', name: 'Test Unit', level: 45, hp: 100, hpGrowth: 0,
    speed: { min: 3, max: 6 }, defenseMod: 0,
    resistances: { damageType: { slash: 1, pierce: 1, blunt: 1 }, sin: { ...flatSin } },
    staggerThresholds: [], skills: [makeSkill()], passives: [], ...over,
  }
}

export function makeCombatant(over: Partial<Combatant> = {}): Combatant {
  const unit = over.unit ?? makeUnit()
  return { unit, skill: over.skill ?? unit.skills[0], uptie: 4, level: unit.level, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL }, ...over }
}

export function effect(op: Effect['op'], extra: Partial<Effect> = {}): Effect {
  return { trigger: 'on-use', scope: 'skill', op, source: 'fixture', ...extra }
}
