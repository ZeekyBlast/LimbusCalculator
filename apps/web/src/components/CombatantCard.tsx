import type { Combatant, ResolvedCombatant, UptieTier } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { num } from '../lib/format.ts'
import { portraitUrl } from '../lib/images.ts'
import { skillAtUptie, type SideKey } from '../lib/setup.ts'
import { useClashStore } from '../stores/clashStore.ts'
import { EffectList } from './EffectList.tsx'
import { ManualEditor } from './ManualEditor.tsx'
import { NumberField } from './NumberField.tsx'
import { SkillPicker } from './SkillPicker.tsx'
import { StatusEditor } from './StatusEditor.tsx'
import { UnitPicker } from './UnitPicker.tsx'

interface Props { side: SideKey; data: GameData; combatant?: Combatant; resolved?: ResolvedCombatant }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-lg leading-tight text-bone">{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}

export function CombatantCard({ side, data, combatant, resolved }: Props) {
  const setup = useClashStore(s => s.setup[side])
  const { pickUnit, pickSkill, patchSide, setStatus, setManual } = useClashStore.getState()
  const unit = combatant?.unit
  const isEnemy = unit?.kind === 'enemy'
  const art = unit && portraitUrl(data.images, unit)
  const applied = resolved?.effectsApplied.length ?? 0
  const notModeled = resolved?.effectsUnparsed.length ?? 0
  const statusCount = Object.keys(setup.status).length

  return (
    <section className="panel min-w-0 overflow-hidden" aria-label={`Side ${side.toUpperCase()}`}>
      {!unit ? (
        <div className="p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="display text-2xl text-gold">Side {side.toUpperCase()}</h2>
          </div>
          <UnitPicker data={data} value={setup.unitId} onPick={u => pickUnit(side, u)} label={`Side ${side.toUpperCase()} unit`} />
        </div>
      ) : (
        <>
          {isEnemy ? (
            <div className="flex items-center gap-4 p-5 pb-4">
              <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink shadow-[0_8px_20px_rgba(0,0,0,.5)]">
                {art && <img src={art} alt="" className="h-full w-full object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="label">Side {side.toUpperCase()} · {unit.group}</div>
                <h2 className="display truncate text-[26px] text-bone">{unit.name}</h2>
              </div>
              <UnitPicker data={data} value={setup.unitId} onPick={u => pickUnit(side, u)} label={`Side ${side.toUpperCase()} unit`} trigger="compact" />
            </div>
          ) : (
            <div className="hero">
              {art && <img src={art} alt="" />}
              <div className="absolute right-3 top-3 z-[1]"><UnitPicker data={data} value={setup.unitId} onPick={u => pickUnit(side, u)} label={`Side ${side.toUpperCase()} unit`} trigger="compact" /></div>
              <div className="hero-title">
                <div className="label text-bone-dim">Side {side.toUpperCase()} · {unit.group}</div>
                <h2 className="display text-[30px] text-bone drop-shadow-[0_2px_8px_rgba(0,0,0,.8)]">{unit.name}</h2>
              </div>
            </div>
          )}

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 px-5 pb-5">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <Stat label="Max HP" value={num(unit.hp)} />
              <Stat label="Speed" value={`${unit.speed.min}–${unit.speed.max}`} />
              <Stat label="Defense" value={`${unit.defenseMod >= 0 ? '+' : ''}${unit.defenseMod}`} />
              {unit.staggerThresholds.length > 0 && <Stat label="Stagger at" value={unit.staggerThresholds.map(t => `${Math.round(t * 100)}%`).join(' / ')} />}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="label w-[84px]">Level<NumberField min={1} max={isEnemy ? 200 : data.meta.levelCap} value={setup.level} onCommit={n => patchSide(side, { level: n })} className="field num mt-1 text-right" /></label>
              {!isEnemy && (
                <div className="label">Uptie
                  <div className="mt-1"><div className="seg" role="group" aria-label="Uptie">
                    {([1, 2, 3, 4] as UptieTier[]).map(t => <button key={t} type="button" aria-pressed={setup.uptie === t} onClick={() => patchSide(side, { uptie: t })}>{t}</button>)}
                  </div></div>
                </div>
              )}
              {!isEnemy && <label className="label w-[84px]">SP<NumberField min={-45} max={45} value={setup.sanity} onCommit={n => patchSide(side, { sanity: n })} className="field num mt-1 text-right" /></label>}
              <label className="label w-[110px]">Current HP
                <input type="number" min={1} max={unit.hp} placeholder={num(unit.hp)} value={setup.currentHp ?? ''} onChange={e => patchSide(side, { currentHp: e.target.value === '' ? null : Number(e.target.value) })} className="field num mt-1 text-right" />
              </label>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium">Skill</div>
              <SkillPicker unit={unit} value={setup.skillId} uptie={setup.uptie} images={data.images} onPick={id => pickSkill(side, id)} />
            </div>

            <div className="border-t border-paper-edge">
              <details className="section" open={statusCount > 0}>
                <summary>Status effects <span className="num text-bone-dim">{statusCount || ''}</span></summary>
                <StatusEditor status={setup.status} onChange={(id, v) => setStatus(side, id, v)} />
              </details>
              <details className="section">
                <summary>Manual overrides</summary>
                <ManualEditor manual={setup.manual} onChange={(k, v) => setManual(side, k, v)} />
              </details>
              {combatant?.skill && resolved && (
                <details className="section">
                  <summary>
                    Effect text
                    <span className="text-xs text-bone-dim"><span className="text-gold-bright">{applied} applied</span>{notModeled > 0 && <> · {notModeled} not modeled</>}</span>
                  </summary>
                  <EffectList skill={skillAtUptie(combatant.skill, setup.uptie)} passives={unit.passives} resolved={resolved} />
                </details>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
