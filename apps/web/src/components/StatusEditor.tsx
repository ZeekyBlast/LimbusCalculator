import { statusEffects, type StatusValue } from '@limbus/engine'
import { NumberField } from './NumberField.tsx'

interface Props { status: Record<string, StatusValue>; onChange: (id: string, value: StatusValue | null) => void }

const OPTIONS: { id: string; name: string }[] = statusEffects.map(e => ({ id: e.id, name: e.name }))
const nameOf = (id: string) => OPTIONS.find(o => o.id === id)?.name ?? id

/** Potency / count per status stack. Every option comes from the engine registry; Poise drives crit chance, Rupture ticks on hit. */
export function StatusEditor({ status, onChange }: Props) {
  const present = Object.keys(status)
  return (
    <div className="grid gap-2 pb-3">
      {present.map(id => (
        <div key={id} className="grid grid-cols-[minmax(0,1fr)_84px_84px_32px] items-end gap-2">
          <span className="truncate pb-2 text-[15px]">{nameOf(id)}</span>
          <label className="label">Potency<NumberField min={0} value={status[id].potency} onCommit={n => onChange(id, { ...status[id], potency: n })} className="field num mt-1 h-9 text-right" /></label>
          <label className="label">Count<NumberField min={0} value={status[id].count} onCommit={n => onChange(id, { ...status[id], count: n })} className="field num mt-1 h-9 text-right" /></label>
          <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => onChange(id, null)} className="btn btn-quiet h-9 w-8 px-0 text-lg">×</button>
        </div>
      ))}
      <select
        value=""
        aria-label="Add status"
        onChange={e => { if (e.target.value) onChange(e.target.value, { potency: 1, count: 1 }) }}
        className="field h-9 text-sm text-bone-dim"
      >
        <option value="">Add a status effect…</option>
        {OPTIONS.filter(o => !present.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}
