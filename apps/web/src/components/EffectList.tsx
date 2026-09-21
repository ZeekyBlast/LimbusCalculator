import type { Effect, Passive, ResolvedCombatant, Skill } from '@limbus/engine'
import { effectStatus, type EffectMark, type EffectStatus } from '../lib/effectStatus.ts'

interface Props { skill: Skill; passives: Passive[]; resolved: ResolvedCombatant }

const MARK: Record<EffectStatus, { dot: string; body: string }> = {
  applied: { dot: 'bg-gold-bright', body: 'text-bone' },
  'per-coin': { dot: 'bg-gold-bright', body: 'text-bone' },
  pending: { dot: 'bg-gold-dim', body: 'text-bone-dim' },
  inactive: { dot: 'bg-bone-faint', body: 'text-bone-dim' },
  unparsed: { dot: 'bg-paper-edge', body: 'text-bone-faint' },
}

function markText(mark: EffectMark): string {
  switch (mark.status) {
    case 'applied': return 'applied'
    case 'per-coin': return mark.coin === undefined ? 'applied per coin' : `applied on coin ${mark.coin + 1}`
    case 'pending': return 'applied later'
    case 'inactive': return 'not active'
    case 'unparsed': return 'not modeled'
  }
}

function Line({ effect, resolved }: { effect: Effect; resolved: ResolvedCombatant }) {
  const mark = effectStatus(effect, resolved)
  const look = MARK[mark.status]
  const scope = effect.scope === 'skill' ? '' : `Coin ${effect.scope.coin + 1}: `
  return (
    <li className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-x-3 text-sm">
      <span className={`mt-1.5 h-2 w-2 rounded-full ${look.dot}`} aria-hidden />
      <span className={look.body}>{scope}{effect.source}</span>
      <span className="text-xs text-bone-faint">{markText(mark)}</span>
    </li>
  )
}

/** Every effect line the engine saw. Applied lines are bright; lines the engine cannot model yet are quiet but never hidden. */
export function EffectList({ skill, passives, resolved }: Props) {
  const lines = [...skill.effects, ...passives.flatMap(p => p.effects)]
  return (
    <div className="pb-3">
      {lines.length === 0 ? <p className="text-sm text-bone-dim">No effect text on this skill.</p> : (
        <ul className="grid gap-1.5">
          {skill.effects.map((e, i) => <Line key={`s${i}`} effect={e} resolved={resolved} />)}
          {passives.map(p => p.effects.map((e, i) => <Line key={`${p.name}${i}`} effect={e} resolved={resolved} />))}
        </ul>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-bone-dim">Raw wiki text</summary>
        <div className="well mt-2 grid gap-2 p-3 text-xs text-bone-dim">
          <pre className="whitespace-pre-wrap font-[family-name:var(--font-body)]">{skill.rawText.skill || '—'}</pre>
          {skill.rawText.coins.map((c, i) => <pre key={i} className="whitespace-pre-wrap font-[family-name:var(--font-body)]">Coin {i + 1}: {c || '—'}</pre>)}
          {passives.map(p => <pre key={p.name} className="whitespace-pre-wrap font-[family-name:var(--font-body)]">{p.name}: {p.text}</pre>)}
        </div>
      </details>
    </div>
  )
}
