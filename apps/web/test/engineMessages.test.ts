import { EMPTY_MANUAL, type Combatant } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { handleRequest } from '../src/lib/engineMessages.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

function combatant(id: string, over: Partial<Combatant> = {}): Combatant {
  const unit = makeUnit({ id, skills: [makeSkill({ id: `${id}::skill1` })] })
  return { unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL }, ...over }
}

describe('handleRequest', () => {
  it('answers a clash request with the report under the same id', () => {
    const res = handleRequest({ id: 7, kind: 'clash', a: combatant('a'), b: combatant('b'), options: {} })
    expect(res.id).toBe(7)
    expect(res.ok && res.kind === 'clash' && res.result.win + res.result.lose + res.result.draw).toBeCloseTo(1)
  })
  it('answers unopposed and grid requests', () => {
    const a = combatant('a')
    const part = makeUnit({ id: '1:0', kind: 'enemy', skills: [] })
    const hit = handleRequest({ id: 1, kind: 'unopposed', attacker: a, target: { ...combatant('1:0'), unit: part, skill: undefined }, options: {} })
    expect(hit.ok && hit.kind === 'unopposed' && hit.result.damage.mean).toBeGreaterThan(0)
    const grid = handleRequest({ id: 2, kind: 'grid', team: [a], wave: [part], options: {} })
    expect(grid.ok && grid.kind === 'grid' && grid.result.cells[0][0].win).toBeNull()
  })
  it('turns an engine error into an error response instead of throwing', () => {
    const res = handleRequest({ id: 3, kind: 'clash', a: combatant('a'), b: { ...combatant('b'), skill: undefined }, options: {} })
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toMatch(/both combatants need a skill/)
  })
})
