import type { UptieTier } from '@limbus/engine'
import { useState } from 'react'
import type { GameData } from '../lib/data.ts'
import { portraitUrl } from '../lib/images.ts'
import { TEAM_SIZE, useTeamStore } from '../stores/teamStore.ts'
import { NumberField } from './NumberField.tsx'
import { UnitPicker } from './UnitPicker.tsx'

const IDENTITY_ONLY = ['identity'] as const

/** Twelve identity slots as a portrait rail; the selected slot opens its picker and settings underneath. Persisted across visits. */
export function TeamBuilder({ data }: { data: GameData }) {
  const slots = useTeamStore(s => s.slots)
  const { setSlot, patchSlot, clear } = useTeamStore.getState()
  const [active, setActive] = useState<number | null>(null)
  const filled = slots.filter(Boolean).length
  const current = active !== null ? slots[active] : null
  const currentUnit = current ? data.unitsById.get(current.unitId) : undefined

  return (
    <section className="panel min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-[28px] text-bone">Your team <span className="num text-lg text-bone-dim">{filled}/{TEAM_SIZE}</span></h2>
        {filled > 0 && <button type="button" onClick={() => { clear(); setActive(null) }} className="btn btn-quiet h-8 text-[13px]">Clear team</button>}
      </div>
      <ul className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12 sm:gap-2">
        {slots.map((slot, i) => {
          const unit = slot ? data.unitsById.get(slot.unitId) : undefined
          const url = unit && portraitUrl(data.images, unit)
          const isActive = active === i
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setActive(isActive ? null : i)}
                aria-pressed={isActive}
                aria-label={unit ? `${unit.name}, slot ${i + 1}` : `Empty slot ${i + 1}`}
                title={unit?.name}
                className={`relative block aspect-square w-full overflow-hidden rounded-xl border ${isActive ? 'border-gold ring-2 ring-gold/30' : unit ? 'border-paper-edge' : 'border-dashed border-paper-edge'} bg-ink hover:border-gold-dim`}
              >
                {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-[center_20%]" /> : <span className="grid h-full w-full place-items-center text-2xl text-bone-faint">+</span>}
                {slot && <span className="num absolute bottom-1 left-1 rounded bg-ink/85 px-1 text-[11px] text-bone">U{slot.uptie}</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {active !== null && (
        <div className="well mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-bone-dim">Slot {active + 1}{currentUnit && <>: <span className="text-bone">{currentUnit.name}</span></>}</div>
            {current && <button type="button" onClick={() => { setSlot(active, null) }} className="btn btn-quiet h-8 text-[13px]">Remove</button>}
          </div>
          <UnitPicker data={data} value={current?.unitId ?? null} kinds={IDENTITY_ONLY} label={`Slot ${active + 1} identity`} onPick={u => setSlot(active, { unitId: u.id, uptie: current?.uptie ?? 4, level: u.level })} />
          {current && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="label">Uptie
                <div className="mt-1"><div className="seg" role="group" aria-label="Uptie">
                  {([1, 2, 3, 4] as UptieTier[]).map(t => <button key={t} type="button" aria-pressed={current.uptie === t} onClick={() => patchSlot(active, { uptie: t })}>{t}</button>)}
                </div></div>
              </div>
              <label className="label w-24">Level<NumberField min={1} max={data.meta.levelCap} value={current.level} onCommit={n => patchSlot(active, { level: n })} className="field num mt-1 text-right" /></label>
            </div>
          )}
        </div>
      )}
      {filled === 0 && active === null && <p className="mt-3 text-sm text-bone-dim">Tap a slot to add an identity. The grid computes every attack skill on your team against every part in the wave.</p>}
    </section>
  )
}
