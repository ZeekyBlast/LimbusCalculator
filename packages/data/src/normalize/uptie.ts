import type { UptieTier } from '@limbus/engine'

export type WikiTierOverrides<T> = Partial<Record<1 | 2 | 3, T>>

/** Wiki rule: `base` is Uptie 4; override N covers tier N and every lower tier down to the next lower override. */
export function resolveWikiTiers<T>(base: T, overrides: WikiTierOverrides<T>): [T, T, T, T] {
  const at = (tier: number): T => {
    for (const n of [1, 2, 3] as const) {
      if (n >= tier && overrides[n] !== undefined) return overrides[n] as T
    }
    return base
  }
  return [at(1), at(2), at(3), at(4)]
}

/** Engine rule: an override at tier t applies upward until a higher override. Emit one wherever the value changes. */
export function changePoints<T>(tiers: [T, T, T, T], equal: (a: T, b: T) => boolean = (a, b) => a === b): Partial<Record<UptieTier, T>> {
  const out: Partial<Record<UptieTier, T>> = {}
  if (!equal(tiers[0], tiers[3])) out[1] = tiers[0]
  for (const t of [2, 3, 4] as const) {
    if (!equal(tiers[t - 1], tiers[t - 2])) out[t] = tiers[t - 1]
  }
  return out
}
