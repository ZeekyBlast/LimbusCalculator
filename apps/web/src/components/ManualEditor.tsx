import type { ManualOverrides } from '@limbus/engine'
import { NumberField } from './NumberField.tsx'

interface Props { manual: ManualOverrides; onChange: (key: keyof ManualOverrides, value: number) => void }

const FIELDS: { key: keyof ManualOverrides; label: string }[] = [
  { key: 'basePower', label: 'Base power' }, { key: 'coinPower', label: 'Coin power' },
  { key: 'clashPower', label: 'Clash power' }, { key: 'damagePercent', label: 'Damage %' },
]

/** Flat adjustments for anything the parser or the data does not carry (spec 10: Railway-specific buffs). */
export function ManualEditor({ manual, onChange }: Props) {
  return (
    <div className="mt-3">
      <span className="block text-xs uppercase tracking-widest text-bone-dim">Manual overrides</span>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELDS.map(f => (
          <label key={f.key} className="text-xs text-bone-dim">
            {f.label}
            <NumberField value={manual[f.key]} onCommit={n => onChange(f.key, n)} className="ledger-number mt-0.5 w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right text-sm text-bone" />
          </label>
        ))}
      </div>
    </div>
  )
}
