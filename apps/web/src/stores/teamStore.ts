import type { UptieTier } from '@limbus/engine'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { defaultStorage } from '../lib/storage.ts'

export const TEAM_SIZE = 12

export interface TeamSlot { unitId: string; uptie: UptieTier; level: number }

export interface TeamState {
  slots: (TeamSlot | null)[]
  setSlot(index: number, slot: TeamSlot | null): void
  patchSlot(index: number, patch: Partial<Omit<TeamSlot, 'unitId'>>): void
  clear(): void
}

const emptySlots = (): (TeamSlot | null)[] => Array.from({ length: TEAM_SIZE }, () => null)

export function createTeamStore(storage: StateStorage = defaultStorage()) {
  return create<TeamState>()(
    persist(
      (set, get) => ({
        slots: emptySlots(),
        setSlot: (index, slot) => set({ slots: get().slots.map((s, i) => (i === index ? slot : s)) }),
        patchSlot: (index, patch) => set({ slots: get().slots.map((s, i) => (i === index && s ? { ...s, ...patch } : s)) }),
        clear: () => set({ slots: emptySlots() }),
      }),
      { name: 'limbus.team.v1', storage: createJSONStorage(() => storage), partialize: state => ({ slots: state.slots }) },
    ),
  )
}

export const useTeamStore = createTeamStore()
