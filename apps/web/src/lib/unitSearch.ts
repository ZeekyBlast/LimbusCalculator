import type { Skill, Unit } from '@limbus/engine'

export interface UnitGroup { kind: Unit['kind']; label: string; units: Unit[] }

/** Identities grouped by sinner (alphabetical), then enemies grouped by enemy name (part order), filtered by every query token. */
export function searchUnits(units: Unit[], query: string, kinds: ReadonlyArray<Unit['kind']> = ['identity', 'enemy']): UnitGroup[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (u: Unit) => {
    const hay = `${u.name} ${u.group ?? ''}`.toLowerCase()
    return tokens.every(t => hay.includes(t))
  }
  const out: UnitGroup[] = []
  for (const kind of ['identity', 'enemy'] as const) {
    if (!kinds.includes(kind)) continue
    const byGroup = new Map<string, Unit[]>()
    for (const u of units) {
      if (u.kind !== kind || !matches(u)) continue
      const label = u.group ?? u.name
      byGroup.set(label, [...(byGroup.get(label) ?? []), u])
    }
    const labels = [...byGroup.keys()]
    if (kind === 'identity') labels.sort((x, y) => x.localeCompare(y))
    for (const label of labels) out.push({ kind, label, units: byGroup.get(label)! })
  }
  return out
}

const SLOT: Record<Skill['slot'], string> = { skill1: 'S1', skill2: 'S2', skill3: 'S3', skill4: 'S4', defense: 'DEF', enemy: 'ATK' }

export function slotLabel(skill: Skill): string {
  return skill.variant ? `${SLOT[skill.slot]} v${skill.variant}` : SLOT[skill.slot]
}
