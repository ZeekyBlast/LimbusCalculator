import type { ReactNode } from 'react'
import { statIconUrl, uptieBadgeUrl, hideOnError } from '../lib/images'

const RESISTANCE_PRESETS: { label: string; value: number }[] = [
  { label: 'Nullify (0%)', value: 0 },
  { label: 'Fatal (200%)', value: 2 },
  { label: 'Weak (150%)', value: 1.5 },
  { label: 'Normal (100%)', value: 1 },
  { label: 'Endure (50%)', value: 0.5 },
  { label: 'Ineffective (25%)', value: 0.25 },
]

export interface CombatantSetup {
  sinResistancePct: number
  typeResistancePct: number
  offenseLevel: number
  defenseLevel: number
  sanityPoints: number
}

interface ClashSetupProps {
  label: string
  setup: CombatantSetup
  onChange: (setup: CombatantSetup) => void
}

function FieldLabel({ stat, children }: { stat: 'coin' | 'defense' | 'hp' | 'speed' | 'stagger'; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-bone-dim mb-1">
      <img src={statIconUrl(stat)} alt="" className="w-3.5 h-3.5 opacity-80" onError={hideOnError} />
      {children}
    </label>
  )
}

function CombatantSetupFields({ label, setup, onChange }: ClashSetupProps) {
  return (
    <div className="border border-paper-light bg-paper rounded-sm p-4">
      <h3 className="font-display text-lg uppercase tracking-wide text-gold mb-3 border-b border-paper-light pb-1.5">{label}</h3>

      <FieldLabel stat="defense">Sin Resistance (if hit)</FieldLabel>
      <select
        className="w-full bg-ink border border-paper-light rounded-sm px-3 py-1.5 mb-3 text-bone focus:border-gold transition-colors"
        value={setup.sinResistancePct}
        onChange={e => onChange({ ...setup, sinResistancePct: Number(e.target.value) })}
      >
        {RESISTANCE_PRESETS.map(p => (
          <option key={p.label} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <FieldLabel stat="defense">Damage Type Resistance (if hit)</FieldLabel>
      <select
        className="w-full bg-ink border border-paper-light rounded-sm px-3 py-1.5 mb-3 text-bone focus:border-gold transition-colors"
        value={setup.typeResistancePct}
        onChange={e => onChange({ ...setup, typeResistancePct: Number(e.target.value) })}
      >
        {RESISTANCE_PRESETS.map(p => (
          <option key={p.label} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <FieldLabel stat="speed">
        Offense Level: <span className="ledger-number text-gold-bright">{setup.offenseLevel}</span>
      </FieldLabel>
      <input
        type="range"
        min={0}
        max={60}
        value={setup.offenseLevel}
        onChange={e => onChange({ ...setup, offenseLevel: Number(e.target.value) })}
        className="w-full mb-3 accent-gold"
      />

      <FieldLabel stat="defense">
        Defense Level: <span className="ledger-number text-gold-bright">{setup.defenseLevel}</span>
      </FieldLabel>
      <input
        type="range"
        min={0}
        max={60}
        value={setup.defenseLevel}
        onChange={e => onChange({ ...setup, defenseLevel: Number(e.target.value) })}
        className="w-full mb-3 accent-gold"
      />

      <FieldLabel stat="coin">
        Sanity: <span className="ledger-number text-gold-bright">{setup.sanityPoints} SP</span> ({50 + setup.sanityPoints}% heads)
      </FieldLabel>
      <input
        type="range"
        min={-45}
        max={45}
        value={setup.sanityPoints}
        onChange={e => onChange({ ...setup, sanityPoints: Number(e.target.value) })}
        className="w-full accent-gold"
      />
    </div>
  )
}

interface ClashSetupSectionProps {
  attackerSetup: CombatantSetup
  onAttackerChange: (setup: CombatantSetup) => void
  defenderSetup: CombatantSetup
  onDefenderChange: (setup: CombatantSetup) => void
  uptieTier: 1 | 2 | 3 | 4
  onUptieTierChange: (tier: 1 | 2 | 3 | 4) => void
}

export function ClashSetup({ attackerSetup, onAttackerChange, defenderSetup, onDefenderChange, uptieTier, onUptieTierChange }: ClashSetupSectionProps) {
  return (
    <section className="lg:col-span-3">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-xs uppercase tracking-wide text-bone-dim">Uptie Tier / Requisition Level</span>
        <div className="flex gap-1.5">
          {([1, 2, 3, 4] as const).map(tier => (
            <button
              key={tier}
              onClick={() => onUptieTierChange(tier)}
              className={`w-9 h-9 rounded-sm border flex items-center justify-center transition-colors ${
                tier === uptieTier ? 'border-gold-bright bg-gold/20' : 'border-paper-light bg-paper hover:border-gold/50'
              }`}
              aria-pressed={tier === uptieTier}
              title={`Uptie ${tier}`}
            >
              <img src={uptieBadgeUrl(tier)} alt={`Uptie ${tier}`} className="w-6 h-6" onError={hideOnError} />
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CombatantSetupFields label="Attacker Requisition" setup={attackerSetup} onChange={onAttackerChange} />
        <CombatantSetupFields label="Defender Requisition" setup={defenderSetup} onChange={onDefenderChange} />
      </div>
    </section>
  )
}

export const DEFAULT_COMBATANT_SETUP: CombatantSetup = {
  sinResistancePct: 1,
  typeResistancePct: 1,
  offenseLevel: 10,
  defenseLevel: 10,
  sanityPoints: 0,
}
