import { sampleClash, type ClashReport, type ClashSample, type Combatant, type ReportOptions } from '@limbus/engine'
import { useState } from 'react'
import { num } from '../lib/format.ts'

interface Props { a: Combatant; b: Combatant; report: ClashReport; options: ReportOptions }

/** One sampled outcome from the exact distribution, revealed coin by coin. Secondary to the verdict, never the default view. */
export function RollOnce({ a, b, report, options }: Props) {
  const [sample, setSample] = useState<ClashSample | null>(null)
  const [rollId, setRollId] = useState(0)
  const roll = () => { setSample(sampleClash(a, b, options, Math.random, report)); setRollId(n => n + 1) }
  const winner = sample?.outcome === 'win' ? a : sample?.outcome === 'lose' ? b : undefined
  const loser = sample?.outcome === 'win' ? b : sample?.outcome === 'lose' ? a : undefined
  const tone = sample?.outcome === 'win' ? 'text-gold-bright' : sample?.outcome === 'lose' ? 'text-blood-bright' : 'text-bone-dim'
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Roll it once</div>
          <div className="text-xs text-bone-dim">One sample from the odds above. The odds do not change.</div>
        </div>
        <button type="button" onClick={roll} className="btn">{sample ? 'Roll again' : 'Roll'}</button>
      </div>
      {sample && (
        <div key={rollId} className="well mt-3 p-3">
          <div className={`display text-xl ${tone}`}>{sample.outcome === 'draw' ? 'Draw' : `${winner!.unit.name} wins`}</div>
          {sample.outcome !== 'draw' && (
            <p className="mt-0.5 text-xs text-bone-dim">
              Attacks {loser!.unit.name} with {sample.coinsLeft} coin{sample.coinsLeft === 1 ? '' : 's'} left
              {sample.guardReduction > 0 && <> after a guard worth <span className="num text-bone">{sample.guardReduction}</span> power</>}.
            </p>
          )}
          {sample.attack && (
            <ol className="mt-3 flex flex-wrap gap-2">
              {sample.attack.coins.map((c, i) => (
                <li key={i} className={`coin-flip w-[72px] rounded-lg border p-2 text-center ${c.heads ? 'border-gold/60 bg-gold/10' : 'border-paper-edge bg-ink'}`} style={{ animationDelay: `${i * 120}ms` }}>
                  <div className={`text-[11px] ${c.heads ? 'text-gold-bright' : 'text-bone-dim'}`}>{c.heads ? 'Heads' : 'Tails'}{c.crit ? ' · crit' : ''}</div>
                  <div className="num text-xl leading-tight">{num(c.damage)}</div>
                  <div className="num text-[11px] text-bone-faint">roll {c.roll}</div>
                </li>
              ))}
              <li className="grid w-[72px] place-items-center rounded-lg border border-gold/50 p-2 text-center">
                <div>
                  <div className="text-[11px] text-bone-dim">Total</div>
                  <div className="num text-xl leading-tight text-gold-bright">{num(sample.attack.total)}</div>
                </div>
              </li>
            </ol>
          )}
          {sample.outcome !== 'draw' && !sample.attack && <p className="mt-2 text-xs text-bone-dim">The winner's skill deals no damage.</p>}
        </div>
      )}
    </div>
  )
}
