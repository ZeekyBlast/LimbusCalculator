import type { ManualOverrides } from '@limbus/engine'
import { NumberField } from './NumberField.tsx'

interface Props { manual: ManualOverrides; onChange: (key: keyof ManualOverrides, value: number) => void }

const FIELDS: { key: keyof ManualOverrides; label: string }[] = [
  { key: 'basePower', label: 'Base power' }, { key: 'coinPower', label: 'Coin power' },
  { key: 'clashPower', label: 'Clash power' }, { key: 'damagePercent', label: 'Damage %' },
]

/** Flat adjustments for anything the parser or the data does not carry (Railway-only buffs, for instance). */
export function ManualEditor({ manual, onChange }: Props) {
  return (
    <div className="pb-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELDS.map(f => (
          <label key={f.key} className="label">
            {f.label}
            <NumberField value={manual[f.key]} onCommit={n => onChange(f.key, n)} className="field num mt-1 h-9 text-right" />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-bone-faint">Added on top of the skill's numbers. Use these for buffs the wiki text does not carry.</p>
    </div>
  )
}
