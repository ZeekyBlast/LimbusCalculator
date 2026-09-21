import type { Sin, SkillDamageType } from '@limbus/engine'
import type { CSSProperties, ReactNode } from 'react'

/** Sin as a small colour swatch beside its name; the colour never carries text. */
export function SinBadge({ sin }: { sin: Sin }) {
  return <span className="sin" style={{ '--sin': `var(--color-sin-${sin})` } as CSSProperties}>{sin}</span>
}

export function DamageTypeBadge({ type }: { type: SkillDamageType }) {
  return <span className="type">{type}</span>
}

/** Rubber-stamp verdict. `tone` picks the ink. */
export function Stamp({ tone, children }: { tone: 'gold' | 'blood' | 'bone'; children: ReactNode }) {
  const color = tone === 'gold' ? 'text-gold-bright' : tone === 'blood' ? 'text-blood-bright' : 'text-bone-dim'
  return <span className={`stamp ${color}`}>{children}</span>
}
