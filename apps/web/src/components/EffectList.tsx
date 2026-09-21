import type { Effect, Passive, ResolvedCombatant, Skill } from '@limbus/engine'
import { effectStatus, type EffectStatus } from '../lib/effectStatus.ts'

interface Props { skill: Skill; passives: Passive[]; resolved: ResolvedCombatant }

const MARK: Record<EffectStatus, { text: string; className: string }> = {
  applied: { text: 'applied', className: 'text-gold-bright' },
  unparsed: { text: 'unparsed', className: 'text-blood-bright' },
  inactive: { text: 'not active', className: 'text-bone-dim' },
}

function Line({ effect, resolved }: { effect: Effect; resolved: ResolvedCombatant }) {
  const mark = MARK[effectStatus(effect, resolved)]
  const scope = effect.scope === 'skill' ? '' : `coin ${effect.scope.coin + 1}: `
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className={`w-16 shrink-0 text-[10px] uppercase tracking-widest ${mark.className}`}>{mark.text}</span>
      <span className={effectStatus(effect, resolved) === 'unparsed' ? 'text-bone' : 'text-bone-dim'}>{scope}{effect.source}</span>
    </li>
  )
}

/** Every effect line the engine saw, marked applied / unparsed / not active, with the raw wiki text underneath. */
export function EffectList({ skill, passives, resolved }: Props) {
  return (
    <details className="mt-3 rounded border border-paper-light bg-ink/40 p-2" open>
      <summary className="cursor-pointer text-xs uppercase tracking-widest text-bone-dim">
        Effects · {resolved.effectsApplied.length} applied · <span className={resolved.effectsUnparsed.length ? 'text-blood-bright' : ''}>{resolved.effectsUnparsed.length} unparsed</span>
      </summary>
      <ul className="mt-2 grid gap-1">
        {skill.effects.map((e, i) => <Line key={`s${i}`} effect={e} resolved={resolved} />)}
        {passives.map(p => p.effects.map((e, i) => <Line key={`${p.name}${i}`} effect={e} resolved={resolved} />))}
        {skill.effects.length === 0 && passives.every(p => p.effects.length === 0) && <li className="text-sm text-bone-dim">No effect text.</li>}
      </ul>
      <details className="mt-2">
        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-bone-dim">Raw wiki text</summary>
        <pre className="mt-1 whitespace-pre-wrap text-xs text-bone-dim">{skill.rawText.skill}</pre>
        {skill.rawText.coins.map((c, i) => <pre key={i} className="whitespace-pre-wrap text-xs text-bone-dim">Coin {i + 1}: {c || '—'}</pre>)}
        {passives.map(p => <pre key={p.name} className="mt-1 whitespace-pre-wrap text-xs text-bone-dim">{p.name}: {p.text}</pre>)}
      </details>
    </details>
  )
}
