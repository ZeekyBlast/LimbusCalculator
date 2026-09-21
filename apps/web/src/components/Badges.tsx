import type { Sin, SkillDamageType } from '@limbus/engine'
import type { ReactNode } from 'react'

/** Each fill carries the ink colour that clears 4.5:1 on it: the light fills take `text-ink`, the
 *  three dark ones keep `text-bone`. */
const SIN_CLASS: Record<Sin, string> = {
  wrath: 'bg-sin-wrath text-bone', lust: 'bg-sin-lust text-ink', sloth: 'bg-sin-sloth text-ink', gluttony: 'bg-sin-gluttony text-ink',
  gloom: 'bg-sin-gloom text-ink', pride: 'bg-sin-pride text-bone', envy: 'bg-sin-envy text-bone',
}

export function SinBadge({ sin }: { sin: Sin }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SIN_CLASS[sin]}`}>{sin}</span>
}

export function DamageTypeBadge({ type }: { type: SkillDamageType }) {
  return <span className="rounded border border-bone-dim px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bone-dim">{type}</span>
}

/** Rubber-stamp verdict. `tone` picks the ink. */
export function Stamp({ tone, children }: { tone: 'gold' | 'blood' | 'bone'; children: ReactNode }) {
  const color = tone === 'gold' ? 'text-gold-bright' : tone === 'blood' ? 'text-blood-bright' : 'text-bone-dim'
  return <span className={`stamp text-2xl ${color}`}>{children}</span>
}
