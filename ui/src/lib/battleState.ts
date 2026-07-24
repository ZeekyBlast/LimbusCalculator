import type { Identity } from '../types'

export interface SideBattleState {
  currentHp: number
  maxHp: number
  defeated: boolean
}

export function maxHp(identity: Identity, level: number): number {
  return Math.round((identity.hp ?? 0) + (identity.hpGrowth ?? 0) * level)
}

export function initSideBattleState(identity: Identity, level: number): SideBattleState {
  const hp = maxHp(identity, level)
  return { currentHp: hp, maxHp: hp, defeated: false }
}

/** Reaching 0 HP is the actual defeat condition (limbuscompany.wiki.gg/wiki/Battles) - Stagger is unrelated and not modeled here. */
export function applyHpDamage(state: SideBattleState, damage: number): SideBattleState {
  if (state.defeated || damage <= 0) return state
  const currentHp = Math.max(0, state.currentHp - damage)
  return { ...state, currentHp, defeated: currentHp <= 0 }
}
