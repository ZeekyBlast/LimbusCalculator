import type { EffectStack, AilmentState, PoiseState } from '@formula/index'

/** Verified dynamic-modifier/counter effects a user can stack in the simulator. */
export const STACKABLE_EFFECTS: { id: string; label: string }[] = [
  { id: 'fragile', label: 'Fragile' },
  { id: 'protection', label: 'Protection' },
  { id: 'damage-up', label: 'Damage Up' },
  { id: 'damage-down', label: 'Damage Down' },
  { id: 'crit-damage-up', label: 'Crit Dmg Up' },
  { id: 'power-up', label: 'Power Up' },
  { id: 'attack-power-up', label: 'Atk Power Up' },
  { id: 'coin-boost', label: 'Coin Boost' },
  { id: 'coin-drop', label: 'Coin Drop' },
  { id: 'sinking', label: 'Sinking' },
]

export interface CombatantEffectsSetup {
  stacks: Record<string, number>
  bleed: AilmentState
  burn: AilmentState
  rupture: AilmentState
  /** Drives Critical Hit chance on this combatant's own hits ((Potency * 5)%, wiki's Poise page) - only relevant when this side wins the clash. */
  poise: PoiseState
}

export const DEFAULT_EFFECTS_SETUP: CombatantEffectsSetup = {
  stacks: {},
  bleed: { potency: 0, count: 0 },
  burn: { potency: 0, count: 0 },
  rupture: { potency: 0, count: 0 },
  poise: { potency: 0, count: 0 },
}

export function toEffectStacks(setup: CombatantEffectsSetup): EffectStack[] {
  return Object.entries(setup.stacks)
    .filter(([, stacks]) => stacks > 0)
    .map(([effectId, stacks]) => ({ effectId, stacks }))
}
