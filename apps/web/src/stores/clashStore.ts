import type { ManualOverrides, StatusValue, Unit } from '@limbus/engine'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { emptySetup, sideForUnit, type ClashSetup, type SideKey, type SideSetup } from '../lib/setup.ts'
import { defaultStorage } from '../lib/storage.ts'

export interface ClashState {
  setup: ClashSetup
  pickUnit(side: SideKey, unit: Unit): void
  pickSkill(side: SideKey, skillId: string | null): void
  patchSide(side: SideKey, patch: Partial<Pick<SideSetup, 'uptie' | 'level' | 'sanity' | 'currentHp'>>): void
  setStatus(side: SideKey, id: string, value: StatusValue | null): void
  setManual(side: SideKey, key: keyof ManualOverrides, value: number): void
  setStaggerMidAttack(value: boolean): void
  swap(): void
  replace(setup: ClashSetup): void
  reset(): void
}

export function createClashStore(storage: StateStorage = defaultStorage()) {
  return create<ClashState>()(
    persist(
      (set, get) => {
        const update = (side: SideKey, fn: (s: SideSetup) => SideSetup) => set({ setup: { ...get().setup, [side]: fn(get().setup[side]) } })
        return {
          setup: emptySetup(),
          pickUnit: (side, unit) => update(side, () => sideForUnit(unit)),
          pickSkill: (side, skillId) => update(side, s => ({ ...s, skillId })),
          patchSide: (side, patch) => update(side, s => ({ ...s, ...patch })),
          setStatus: (side, id, value) => update(side, s => {
            const status = { ...s.status }
            if (value === null) delete status[id]
            else status[id] = value
            return { ...s, status }
          }),
          setManual: (side, key, value) => update(side, s => ({ ...s, manual: { ...s.manual, [key]: value } })),
          setStaggerMidAttack: value => set({ setup: { ...get().setup, staggerMidAttack: value } }),
          swap: () => set({ setup: { ...get().setup, a: get().setup.b, b: get().setup.a } }),
          replace: setup => set({ setup }),
          reset: () => set({ setup: emptySetup() }),
        }
      },
      { name: 'limbus.clash.v1', storage: createJSONStorage(() => storage), partialize: state => ({ setup: state.setup }) },
    ),
  )
}

export const useClashStore = createClashStore()
