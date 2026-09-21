import type { Sin, SkillDamageType } from '@limbus/engine'
import type { ReactNode } from 'react'

const SIN_CLASS: Record<Sin, string> = {
  wrath: 'bg-sin-wrath', lust: 'bg-sin-lust', sloth: 'bg-sin-sloth text-ink', gluttony: 'bg-sin-gluttony',
  gloom: 'bg-sin-gloom', pride: 'bg-sin-pride', envy: 'bg-sin-envy',
}

export function SinBadge({ sin }: { sin: Sin }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bone ${SIN_CLASS[sin]}`}>{sin}</span>
}

export function DamageTypeBadge({ type }: { type: SkillDamageType }) {
  return <span className="rounded border border-bone-dim px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bone-dim">{type}</span>
}

/** Rubber-stamp verdict. `tone` picks the ink. */
export function Stamp({ tone, children }: { tone: 'gold' | 'blood' | 'bone'; children: ReactNode }) {
  const color = tone === 'gold' ? 'text-gold-bright' : tone === 'blood' ? 'text-blood-bright' : 'text-bone-dim'
  return <span className={`stamp text-2xl ${color}`}>{children}</span>
}
