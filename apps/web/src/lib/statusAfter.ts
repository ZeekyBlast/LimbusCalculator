import { getEffectById, type StatusState } from '@limbus/engine'

export interface StatusRow { id: string; name: string; potency: string; count: string; varies: boolean }

const fmt = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(1))

/** Rows for the "After this skill" block, sorted by display name. `varies` entries are `"<side>:<id>"`. */
export function statusRows(state: StatusState, varies: string[], side: 'self' | 'target'): StatusRow[] {
  return Object.entries(state)
    .map(([id, v]) => ({ id, name: getEffectById(id)?.name ?? id, potency: fmt(v.potency), count: fmt(v.count), varies: varies.includes(`${side}:${id}`) }))
    .sort((x, y) => x.name.localeCompare(y.name))
}
