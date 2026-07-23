import type { ReactNode } from 'react'
import { statIconUrl, uptieBadgeUrl, hideOnError } from '../lib/images'
import { Combobox } from './Combobox'

const RESISTANCE_PRESETS: { label: string; value: number }[] = [
  { label: 'Nullify (0%)', value: 0 },
  { label: 'Fatal (200%)', value: 2 },
  { label: 'Weak (150%)', value: 1.5 },
  { label: 'Normal (100%)', value: 1 },
  { label: 'Endure (50%)', value: 0.5 },
  { label: 'Ineffective (25%)', value: 0.25 },
]

const RESISTANCE_GROUPS = [{ options: RESISTANCE_PRESETS }]

function resistanceLabel(pct: number): string {
  return RESISTANCE_PRESETS.find(p => p.value === pct)?.label ?? `${pct * 100}%`
}

export interface CombatantSetup {
  sinResistancePct: number
  typeResistancePct: number
  /** Identity's own Level (1-60, matches the game's cap). Drives HP, Defense, and both the clash-round and post-clash damage formulas. */
  level: number
  sanityPoints: number
}

interface ClashSetupProps {
  label: string
  idPrefix: string
  setup: CombatantSetup
  onChange: (setup: CombatantSetup) => void
}

function FieldLabel({ stat, htmlFor, children }: { stat: 'coin' | 'defense' | 'hp' | 'speed' | 'stagger'; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-bone-dim mb-1">
      <img src={statIconUrl(stat)} alt="" loading="lazy" className="w-3.5 h-3.5 opacity-80" onError={hideOnError} />
      {children}
    </label>
  )
}

function CombatantSetupFields({ label, idPrefix, setup, onChange }: ClashSetupProps) {
  return (
    <div className="border border-paper-light bg-paper rounded-sm p-4">
      <h3 className="font-display text-lg uppercase tracking-wide text-gold mb-3 border-b border-paper-light pb-1.5">{label}</h3>

      <FieldLabel stat="defense" htmlFor={`${idPrefix}-sin-resistance`}>Sin Resistance (if hit)</FieldLabel>
      <Combobox
        id={`${idPrefix}-sin-resistance`}
        ariaLabel={`${label}: Sin Resistance if hit`}
        groups={RESISTANCE_GROUPS}
        value={setup.sinResistancePct}
        onChange={v => onChange({ ...setup, sinResistancePct: v })}
        triggerLabel={resistanceLabel(setup.sinResistancePct)}
        className="mb-3"
      />

      <FieldLabel stat="defense" htmlFor={`${idPrefix}-type-resistance`}>Damage Type Resistance (if hit)</FieldLabel>
      <Combobox
        id={`${idPrefix}-type-resistance`}
        ariaLabel={`${label}: Damage Type Resistance if hit`}
        groups={RESISTANCE_GROUPS}
        value={setup.typeResistancePct}
        onChange={v => onChange({ ...setup, typeResistancePct: v })}
        triggerLabel={resistanceLabel(setup.typeResistancePct)}
        className="mb-3"
      />

      <FieldLabel stat="speed" htmlFor={`${idPrefix}-level`}>
        Level: <span className="ledger-number text-gold-bright">{setup.level}</span>
      </FieldLabel>
      <input
        id={`${idPrefix}-level`}
        type="range"
        min={1}
        max={60}
        value={setup.level}
        onChange={e => onChange({ ...setup, level: Number(e.target.value) })}
        className="w-full mb-3 accent-gold"
      />

      <FieldLabel stat="coin" htmlFor={`${idPrefix}-sanity`}>
        Sanity: <span className="ledger-number text-gold-bright">{setup.sanityPoints} SP</span> ({50 + setup.sanityPoints}% heads)
      </FieldLabel>
      <input
        id={`${idPrefix}-sanity`}
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
              className={`w-11 h-11 rounded-sm border flex items-center justify-center transition-colors ${
                tier === uptieTier ? 'border-gold-bright bg-gold/20' : 'border-paper-light bg-paper hover:border-gold/50'
              }`}
              aria-pressed={tier === uptieTier}
              title={`Uptie ${tier}`}
            >
              <img src={uptieBadgeUrl(tier)} alt={`Uptie ${tier}`} loading="lazy" className="w-6 h-6" onError={hideOnError} />
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CombatantSetupFields label="Attacker Requisition" idPrefix="attacker" setup={attackerSetup} onChange={onAttackerChange} />
        <CombatantSetupFields label="Defender Requisition" idPrefix="defender" setup={defenderSetup} onChange={onDefenderChange} />
      </div>
    </section>
  )
}

export const DEFAULT_COMBATANT_SETUP: CombatantSetup = {
  sinResistancePct: 1,
  typeResistancePct: 1,
  level: 60,
  sanityPoints: 0,
}
