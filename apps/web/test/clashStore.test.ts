import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../src/lib/storage.ts'
import { createClashStore } from '../src/stores/clashStore.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

describe('clash store', () => {
  it('picking a unit resets skill, level, and state for that side only', () => {
    const store = createClashStore(memoryStorage())
    store.getState().patchSide('a', { level: 30, sanity: 20 })
    store.getState().pickUnit('a', makeUnit({ id: 'x', level: 50, skills: [makeSkill({ id: 'x::skill1' })] }))
    expect(store.getState().setup.a).toMatchObject({ unitId: 'x', skillId: 'x::skill1', level: 50, sanity: 0 })
    expect(store.getState().setup.b.unitId).toBeNull()
  })
  it('edits status, manual, and options', () => {
    const store = createClashStore(memoryStorage())
    store.getState().setStatus('b', 'poise', { potency: 3, count: 1 })
    store.getState().setStatus('b', 'fragile', { potency: 2, count: 0 })
    store.getState().setStatus('b', 'fragile', null)
    store.getState().setManual('b', 'clashPower', 2)
    store.getState().setStaggerMidAttack(false)
    expect(store.getState().setup.b.status).toEqual({ poise: { potency: 3, count: 1 } })
    expect(store.getState().setup.b.manual.clashPower).toBe(2)
    expect(store.getState().setup.staggerMidAttack).toBe(false)
  })
  it('swaps sides', () => {
    const store = createClashStore(memoryStorage())
    store.getState().pickUnit('a', makeUnit({ id: 'x' }))
    store.getState().swap()
    expect(store.getState().setup.a.unitId).toBeNull()
    expect(store.getState().setup.b.unitId).toBe('x')
  })
  it('persists the setup and rehydrates a new store from the same storage', async () => {
    const storage = memoryStorage()
    const store = createClashStore(storage)
    store.getState().pickUnit('a', makeUnit({ id: 'x' }))
    const again = createClashStore(storage)
    await again.persist.rehydrate()
    expect(again.getState().setup.a.unitId).toBe('x')
  })
})
