import { statusEffects, type StatusValue } from '@limbus/engine'

interface Props { status: Record<string, StatusValue>; onChange: (id: string, value: StatusValue | null) => void }

const OPTIONS: { id: string; name: string }[] = [{ id: 'poise', name: 'Poise' }, ...statusEffects.map(e => ({ id: e.id, name: e.name }))]
const nameOf = (id: string) => OPTIONS.find(o => o.id === id)?.name ?? id

/** Potency / count per status stack. Poise drives crit chance; the rest come from the engine registry. */
export function StatusEditor({ status, onChange }: Props) {
  const present = Object.keys(status)
  return (
    <div className="mt-3">
      <span className="block text-xs uppercase tracking-widest text-bone-dim">Status</span>
      {present.length > 0 && (
        <table className="mt-1 w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-bone-dim"><tr><th className="text-left">Effect</th><th className="w-20">Potency</th><th className="w-20">Count</th><th className="w-8" /></tr></thead>
          <tbody>
            {present.map(id => (
              <tr key={id}>
                <td className="py-0.5">{nameOf(id)}</td>
                <td><input type="number" min={0} aria-label={`${nameOf(id)} potency`} value={status[id].potency} onChange={e => onChange(id, { ...status[id], potency: Number(e.target.value) })} className="ledger-number w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right" /></td>
                <td><input type="number" min={0} aria-label={`${nameOf(id)} count`} value={status[id].count} onChange={e => onChange(id, { ...status[id], count: Number(e.target.value) })} className="ledger-number w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right" /></td>
                <td><button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => onChange(id, null)} className="px-1 text-bone-dim hover:text-blood-bright">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <select
        value=""
        aria-label="Add status"
        onChange={e => { if (e.target.value) onChange(e.target.value, { potency: 1, count: 1 }) }}
        className="mt-1 w-full rounded border border-paper-light bg-paper px-2 py-1 text-sm text-bone-dim"
      >
        <option value="">Add status…</option>
        {OPTIONS.filter(o => !present.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}
