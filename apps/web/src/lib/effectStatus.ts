import type { Effect, ResolvedCombatant } from '@limbus/engine'

export type EffectStatus = 'applied' | 'per-coin' | 'pending' | 'inactive' | 'unparsed'

/** How the engine treats one effect line, and for a coin-scoped line which coin (0-based). */
export interface EffectMark { status: EffectStatus; coin?: number }

export function effectStatus(effect: Effect, resolved: ResolvedCombatant): EffectMark {
  if (resolved.effectsUnparsed.includes(effect.source)) return { status: 'unparsed' }
  if (resolved.effectsPerCoin.includes(effect.source)) {
    return effect.scope === 'skill' ? { status: 'per-coin' } : { status: 'per-coin', coin: effect.scope.coin }
  }
  if (resolved.effectsPending.includes(effect.source)) return { status: 'pending' }
  if (resolved.effectsApplied.includes(effect.source)) return { status: 'applied' }
  return { status: 'inactive' }
}
