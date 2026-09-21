import type { Combatant, ResolvedCombatant, UptieTier } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { skillAtUptie, type SideKey } from '../lib/setup.ts'
import { useClashStore } from '../stores/clashStore.ts'
import { EffectList } from './EffectList.tsx'
import { ManualEditor } from './ManualEditor.tsx'
import { SkillPicker } from './SkillPicker.tsx'
import { StatusEditor } from './StatusEditor.tsx'
import { UnitPicker } from './UnitPicker.tsx'

interface Props { side: SideKey; data: GameData; combatant?: Combatant; resolved?: ResolvedCombatant }

const field = 'ledger-number mt-0.5 w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right text-sm text-bone'

export function CombatantCard({ side, data, combatant, resolved }: Props) {
  const setup = useClashStore(s => s.setup[side])
  const { pickUnit, pickSkill, patchSide, setStatus, setManual } = useClashStore.getState()
  const unit = combatant?.unit
  const isEnemy = unit?.kind === 'enemy'
  return (
    <section className="rounded border border-paper-light bg-paper p-4" aria-label={`Combatant ${side.toUpperCase()}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl uppercase tracking-widest text-gold">Side {side.toUpperCase()}</h2>
        {unit && <span className="ledger-number text-xs text-bone-dim">HP {unit.hp} · SPD {unit.speed.min}–{unit.speed.max} · DEF {unit.defenseMod >= 0 ? '+' : ''}{unit.defenseMod}</span>}
      </div>
      <UnitPicker data={data} value={setup.unitId} onPick={u => pickUnit(side, u)} label="Unit" />
      {unit && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-xs text-bone-dim">Level
              <input type="number" min={1} max={isEnemy ? 200 : data.meta.levelCap} value={setup.level} onChange={e => patchSide(side, { level: Number(e.target.value) })} className={field} />
            </label>
            {!isEnemy && (
              <label className="text-xs text-bone-dim">Uptie
                <select value={setup.uptie} onChange={e => patchSide(side, { uptie: Number(e.target.value) as UptieTier })} className={field}>
                  {[1, 2, 3, 4].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            )}
            {!isEnemy && (
              <label className="text-xs text-bone-dim">SP
                <input type="number" min={-45} max={45} value={setup.sanity} onChange={e => patchSide(side, { sanity: Number(e.target.value) })} className={field} />
              </label>
            )}
            <label className="text-xs text-bone-dim">Current HP
              <input type="number" min={1} max={unit.hp} placeholder={String(unit.hp)} value={setup.currentHp ?? ''} onChange={e => patchSide(side, { currentHp: e.target.value === '' ? null : Number(e.target.value) })} className={field} />
            </label>
          </div>
          <SkillPicker unit={unit} value={setup.skillId} uptie={setup.uptie} images={data.images} onPick={id => pickSkill(side, id)} />
          <StatusEditor status={setup.status} onChange={(id, v) => setStatus(side, id, v)} />
          <ManualEditor manual={setup.manual} onChange={(k, v) => setManual(side, k, v)} />
          {combatant?.skill && resolved && <EffectList skill={skillAtUptie(combatant.skill, setup.uptie)} passives={unit.passives} resolved={resolved} />}
        </>
      )}
    </section>
  )
}
