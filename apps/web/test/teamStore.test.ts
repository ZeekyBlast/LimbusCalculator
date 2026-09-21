import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../src/lib/storage.ts'
import { createTeamStore, TEAM_SIZE } from '../src/stores/teamStore.ts'

describe('team store', () => {
  it('starts with twelve empty slots', () => {
    const store = createTeamStore(memoryStorage())
    expect(store.getState().slots).toHaveLength(TEAM_SIZE)
    expect(store.getState().slots.every(s => s === null)).toBe(true)
  })
  it('sets, patches, and clears slots', () => {
    const store = createTeamStore(memoryStorage())
    store.getState().setSlot(3, { unitId: 'x', uptie: 4, level: 60 })
    store.getState().patchSlot(3, { uptie: 2 })
    expect(store.getState().slots[3]).toEqual({ unitId: 'x', uptie: 2, level: 60 })
    store.getState().setSlot(3, null)
    expect(store.getState().slots[3]).toBeNull()
  })
  it('persists and rehydrates', async () => {
    const storage = memoryStorage()
    createTeamStore(storage).getState().setSlot(0, { unitId: 'x', uptie: 4, level: 60 })
    const again = createTeamStore(storage)
    await again.persist.rehydrate()
    expect(again.getState().slots[0]?.unitId).toBe('x')
  })
})
