import type { Effect, ResolvedCombatant } from '@limbus/engine'

export type EffectStatus = 'applied' | 'unparsed' | 'inactive'

/** How the engine treated one effect line: applied to the numbers, not understood, or understood but not active (trigger or condition). */
export function effectStatus(effect: Effect, resolved: ResolvedCombatant): EffectStatus {
  if (resolved.effectsUnparsed.includes(effect.source)) return 'unparsed'
  if (resolved.effectsApplied.includes(effect.source)) return 'applied'
  return 'inactive'
}
