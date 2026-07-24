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
  { id: 'attack-power-down', label: 'Atk Power Down' },
  { id: 'defense-power-up', label: 'Def Power Up' },
  { id: 'defense-power-down', label: 'Def Power Down' },
  { id: 'coin-boost', label: 'Coin Boost' },
  { id: 'coin-drop', label: 'Coin Drop' },
  { id: 'sinking', label: 'Sinking' },
  { id: 'haste', label: 'Haste' },
  { id: 'bind', label: 'Bind' },
  { id: 'paralyze', label: 'Paralyze' },
  { id: 'charge', label: 'Charge' },
  { id: 'offense-level-up-grant', label: 'Off. Lv Up (skill)' },
  { id: 'offense-level-down', label: 'Off. Lv Down' },
  { id: 'defense-level-up-grant', label: 'Def. Lv Up (skill)' },
  { id: 'defense-level-down', label: 'Def. Lv Down' },
  { id: 'fragile-slash', label: 'Slash Fragility' },
  { id: 'fragile-pierce', label: 'Pierce Fragility' },
  { id: 'fragile-blunt', label: 'Blunt Fragility' },
  { id: 'fragile-envy', label: 'Envy Fragility' },
  { id: 'fragile-gloom', label: 'Gloom Fragility' },
  { id: 'fragile-pride', label: 'Pride Fragility' },
  { id: 'fragile-lust', label: 'Lust Fragility' },
  { id: 'damage-up-slash', label: 'Slash DMG Up' },
  { id: 'damage-up-blunt', label: 'Blunt DMG Up' },
  { id: 'damage-up-gluttony', label: 'Gluttony DMG Up' },
  { id: 'damage-up-envy', label: 'Envy DMG Up' },
  { id: 'damage-up-pierce', label: 'Pierce DMG Up' },
  { id: 'power-up-slash', label: 'Slash Power Up' },
  { id: 'power-up-blunt', label: 'Blunt Power Up' },
  { id: 'power-up-envy', label: 'Envy Power Up' },
  { id: 'power-up-pride', label: 'Pride Power Up' },
  { id: 'power-up-pierce', label: 'Pierce Power Up' },
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
