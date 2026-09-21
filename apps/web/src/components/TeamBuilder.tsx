import type { UptieTier } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { TEAM_SIZE, useTeamStore } from '../stores/teamStore.ts'
import { NumberField } from './NumberField.tsx'
import { UnitPicker } from './UnitPicker.tsx'

const field = 'ledger-number mt-0.5 w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right text-sm text-bone'
const IDENTITY_ONLY = ['identity'] as const

/** Twelve identity slots with uptie and level, persisted across visits. */
export function TeamBuilder({ data }: { data: GameData }) {
  const slots = useTeamStore(s => s.slots)
  const { setSlot, patchSlot, clear } = useTeamStore.getState()
  const filled = slots.filter(Boolean).length
  return (
    <details className="rounded border border-paper-light bg-paper p-4" open={filled === 0}>
      <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl uppercase tracking-widest text-gold">
        Team · <span className="ledger-number">{filled}/{TEAM_SIZE}</span>
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot, i) => (
          <div key={i} className="rounded border border-paper-light p-2">
            <UnitPicker data={data} value={slot?.unitId ?? null} kinds={IDENTITY_ONLY} label={`Slot ${i + 1}`} onPick={u => setSlot(i, { unitId: u.id, uptie: 4, level: u.level })} />
            {slot && (
              <div className="mt-2 flex items-end gap-2">
                <label className="flex-1 text-xs text-bone-dim">Uptie
                  <select value={slot.uptie} onChange={e => patchSlot(i, { uptie: Number(e.target.value) as UptieTier })} className={field}>{[1, 2, 3, 4].map(t => <option key={t} value={t}>{t}</option>)}</select>
                </label>
                <label className="flex-1 text-xs text-bone-dim">Level
                  <NumberField min={1} max={data.meta.levelCap} value={slot.level} onCommit={n => patchSlot(i, { level: n })} className={field} />
                </label>
                <button type="button" onClick={() => setSlot(i, null)} aria-label={`Clear slot ${i + 1}`} className="px-2 py-1 text-bone-dim hover:text-blood-bright">×</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {filled > 0 && <button type="button" onClick={clear} className="mt-3 text-xs uppercase tracking-widest text-bone-dim hover:text-blood-bright">Clear team</button>}
    </details>
  )
}
