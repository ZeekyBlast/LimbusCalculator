import type { Unit } from '@limbus/engine'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameData, ImageManifest } from '../lib/data.ts'
import { portraitUrl } from '../lib/images.ts'
import { searchUnits } from '../lib/unitSearch.ts'

interface Props {
  data: GameData
  value: string | null
  onPick: (unit: Unit) => void
  kinds?: ReadonlyArray<Unit['kind']>
  label: string
  /** `full` shows the chosen unit in the trigger; `compact` is a small "Change" button for when the unit is shown elsewhere. */
  trigger?: 'full' | 'compact'
}

// Hoisted so the default does not change identity on every render (it is a memo dependency).
const ALL_KINDS: ReadonlyArray<Unit['kind']> = ['identity', 'enemy']

function UnitRow({ unit, images }: { unit: Unit; images: ImageManifest }) {
  const url = portraitUrl(images, unit)
  return (
    <>
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-ink">
        {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px]">{unit.name}</span>
        <span className="block truncate text-xs text-bone-dim">{unit.group}</span>
      </span>
    </>
  )
}

/** Searchable picker over identities and enemy parts, grouped by sinner or enemy. */
export function UnitPicker({ data, value, onPick, kinds = ALL_KINDS, label, trigger = 'full' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const selected = value ? data.unitsById.get(value) : undefined
  const units = useMemo(() => [...data.identities, ...data.enemies], [data])
  const groups = useMemo(() => searchUnits(units, query, kinds), [units, query, kinds])
  const pick = (u: Unit) => { onPick(u); setOpen(false); setQuery('') }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    addEventListener('mousedown', onDown)
    return () => removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={root} className="relative">
      {trigger === 'compact' ? (
        <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Change ${label}`} className="btn btn-quiet h-8 px-3 text-[13px]">
          Change
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-paper-edge bg-ink-2 px-4 py-4 text-left hover:border-gold-dim"
        >
          {selected ? <UnitRow unit={selected} images={data.images} /> : (
            <>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-paper-light text-xl text-bone-dim">+</span>
              <span><span className="block text-[15px]">Choose a unit</span><span className="block text-xs text-bone-dim">Identities and Railway enemies, searchable</span></span>
            </>
          )}
        </button>
      )}
      {open && (
        <div className={`absolute z-30 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-paper-edge bg-paper shadow-[0_24px_60px_rgba(0,0,0,.6)] ${trigger === 'compact' ? 'right-0' : 'left-0'}`}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter') { const first = groups[0]?.units[0]; if (first) pick(first) }
            }}
            placeholder="Search by name or sinner"
            aria-label={`Search ${label}`}
            className="field rounded-none border-0 border-b border-paper-edge"
          />
          <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
            {groups.map(g => (
              <li key={`${g.kind}:${g.label}`}>
                <div className="sticky top-0 bg-paper px-4 pb-1 pt-2 text-xs text-bone-dim">{g.kind === 'identity' ? g.label : `Enemy: ${g.label}`}</div>
                {g.units.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={u.id === value}
                    onClick={() => pick(u)}
                    className={`flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-paper-light ${u.id === value ? 'text-gold-bright' : ''}`}
                  >
                    <UnitRow unit={u} images={data.images} />
                  </button>
                ))}
              </li>
            ))}
            {groups.length === 0 && <li className="px-4 py-3 text-sm text-bone-dim">Nothing matches "{query}".</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
