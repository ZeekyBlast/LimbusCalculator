// Every wiki-image filename -> URL mapper in one place. All assets are served at
// /gamedata/images/... via the ui/public/gamedata junction into data/generated/images.

import type { SyntheticEvent } from 'react'

const BASE = "/gamedata/images"

// Wiki filenames replace ":", "【", "】" with a single space - matches data/scraper/image-paths.mjs.
export function titleToFilenameBase(title: string): string {
  return title.replace(/[:【】]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function portraitUrl(title: string): string {
  return `${BASE}/portraits/${encodeURIComponent(titleToFilenameBase(title))}.png`
}

export function spriteUrl(title: string, pose: 'idle' | 'moving' | 'guard' | 'evade' | 'hurt'): string {
  return `${BASE}/sprites/${encodeURIComponent(titleToFilenameBase(title))}/${pose}.png`
}

export function idleAnimationUrl(title: string): string {
  return `${BASE}/sprites/${encodeURIComponent(titleToFilenameBase(title))}/idle-animation.gif`
}

export function skillIconUrl(icon: string): string {
  return `${BASE}/skills/${encodeURIComponent(icon)}.png`
}

export function sinIconUrl(sin: string): string {
  return `${BASE}/icons/sin/${sin.toLowerCase()}.png`
}

export function damageTypeIconUrl(damageType: string): string {
  return `${BASE}/icons/damage-type/${damageType.toLowerCase()}.png`
}

export function sinnerIconUrl(sinner: string): string {
  return `${BASE}/icons/sinners/${encodeURIComponent(sinner.replace(/ /g, '_'))}.png`
}

export type StatIcon = 'coin' | 'defense' | 'hp' | 'speed' | 'stagger'

export function statIconUrl(stat: StatIcon): string {
  return `${BASE}/icons/stats/${stat}.png`
}

export function uptieBadgeUrl(tier: 1 | 2 | 3 | 4): string {
  return `${BASE}/icons/uptie-badges/tier-${tier}.png`
}

/** 3-frame animated border, Uptie 4 only - no equivalent art exists for tiers 1-3. */
export function uptie4BorderFrameUrls(): string[] {
  return ['Uptie_4_Frame_0', 'Uptie_4_Frame_00', 'Uptie_4_Frame_000'].map(f => `${BASE}/icons/uptie4-border/${f}.png`)
}

export function statusEffectIconUrl(name: string): string {
  return `${BASE}/icons/status-effects/${encodeURIComponent(name)}.png`
}

/** Shared onError handler: hide broken images instead of showing a browser placeholder. */
export function hideOnError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none'
}
