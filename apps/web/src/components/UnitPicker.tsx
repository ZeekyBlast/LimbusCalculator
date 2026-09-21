import type { Unit } from '@limbus/engine'
import { useMemo, useState } from 'react'
import type { GameData, ImageManifest } from '../lib/data.ts'
import { portraitUrl } from '../lib/images.ts'
import { searchUnits } from '../lib/unitSearch.ts'

interface Props {
  data: GameData
  value: string | null
  onPick: (unit: Unit) => void
  kinds?: ReadonlyArray<Unit['kind']>
  label: string
}

// Hoisted so the default does not change identity on every render (it is a memo dependency).
const ALL_KINDS: ReadonlyArray<Unit['kind']> = ['identity', 'enemy']

function UnitRow({ unit, images }: { unit: Unit; images: ImageManifest }) {
  const url = portraitUrl(images, unit)
  return (
    <>
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-ink">
        {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{unit.name}</span>
        <span className="block truncate text-xs text-bone-dim">{unit.group}</span>
      </span>
    </>
  )
}

/** Searchable combobox over identities and enemy parts, grouped by sinner or enemy. */
export function UnitPicker({ data, value, onPick, kinds = ALL_KINDS, label }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = value ? data.unitsById.get(value) : undefined
  const units = useMemo(() => [...data.identities, ...data.enemies], [data])
  const groups = useMemo(() => searchUnits(units, query, kinds), [units, query, kinds])
  const pick = (u: Unit) => { onPick(u); setOpen(false); setQuery('') }
  return (
    <div className="relative">
      <span className="block text-xs uppercase tracking-widest text-bone-dim">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1 flex w-full items-center gap-3 rounded border border-paper-light bg-paper px-3 py-2 text-left hover:border-gold"
      >
        {selected ? <UnitRow unit={selected} images={data.images} /> : <span className="text-bone-dim">Choose a unit…</span>}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded border border-paper-light bg-paper shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter') { const first = groups[0]?.units[0]; if (first) pick(first) }
            }}
            placeholder="Search by name or group"
            aria-label={`Search ${label}`}
            className="w-full border-b border-paper-light bg-ink px-3 py-2 text-sm outline-none"
          />
          <ul role="listbox" className="max-h-72 overflow-y-auto">
            {groups.map(g => (
              <li key={`${g.kind}:${g.label}`}>
                <div className="sticky top-0 bg-paper-light px-3 py-1 text-[10px] uppercase tracking-widest text-bone-dim">
                  {g.kind === 'identity' ? 'Identity' : 'Enemy'} · {g.label}
                </div>
                {g.units.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={u.id === value}
                    onClick={() => pick(u)}
                    className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-paper-light ${u.id === value ? 'text-gold-bright' : ''}`}
                  >
                    <UnitRow unit={u} images={data.images} />
                  </button>
                ))}
              </li>
            ))}
            {groups.length === 0 && <li className="px-3 py-2 text-sm text-bone-dim">No match.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
