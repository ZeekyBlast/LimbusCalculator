import { sampleClash, type ClashReport, type ClashSample, type Combatant, type ReportOptions } from '@limbus/engine'
import { useState } from 'react'
import { num } from '../lib/format.ts'
import { Stamp } from './Badges.tsx'

interface Props { a: Combatant; b: Combatant; report: ClashReport; options: ReportOptions }

/** One sampled outcome from the exact distribution, revealed coin by coin. Secondary to the verdict, never the default view. */
export function RollOnce({ a, b, report, options }: Props) {
  const [sample, setSample] = useState<ClashSample | null>(null)
  const [rollId, setRollId] = useState(0)
  const roll = () => { setSample(sampleClash(a, b, options, Math.random, report)); setRollId(n => n + 1) }
  const winner = sample?.outcome === 'win' ? a : sample?.outcome === 'lose' ? b : undefined
  const loser = sample?.outcome === 'win' ? b : sample?.outcome === 'lose' ? a : undefined
  return (
    <section className="mt-4 rounded border border-paper-light bg-paper p-4">
      <div className="flex items-center gap-4">
        <button type="button" onClick={roll} className="rounded border border-gold px-3 py-1 text-sm uppercase tracking-widest text-gold hover:bg-gold hover:text-ink">Roll once</button>
        <span className="text-xs text-bone-dim">Samples one outcome from the distribution above. The odds do not change.</span>
      </div>
      {sample && (
        <div key={rollId} className="mt-4">
          <Stamp tone={sample.outcome === 'win' ? 'gold' : sample.outcome === 'lose' ? 'blood' : 'bone'}>
            {sample.outcome === 'draw' ? 'DRAW' : `${winner!.unit.name} WINS`}
          </Stamp>
          {sample.outcome !== 'draw' && (
            <p className="mt-2 text-sm text-bone-dim">
              {winner!.unit.name} attacks {loser!.unit.name} with {sample.coinsLeft} coin{sample.coinsLeft === 1 ? '' : 's'}
              {sample.guardReduction > 0 && <> after a guard worth <span className="ledger-number text-bone">{sample.guardReduction}</span> power</>}.
            </p>
          )}
          {sample.attack && (
            <ol className="mt-3 flex flex-wrap gap-2">
              {sample.attack.coins.map((c, i) => (
                <li key={i} className="coin-flip w-24 rounded border border-paper-light bg-ink p-2 text-center" style={{ animationDelay: `${i * 120}ms` }}>
                  <div className={`text-[10px] uppercase tracking-widest ${c.heads ? 'text-gold-bright' : 'text-bone-dim'}`}>{c.heads ? 'Heads' : 'Tails'}{c.crit ? ' · crit' : ''}</div>
                  <div className="ledger-number text-xl">{num(c.damage)}</div>
                  <div className="ledger-number text-[10px] text-bone-dim">roll {c.roll}{c.staggered ? ' · staggered' : ''}</div>
                </li>
              ))}
              <li className="w-24 rounded border border-gold/50 p-2 text-center">
                <div className="text-[10px] uppercase tracking-widest text-bone-dim">Total</div>
                <div className="ledger-number text-xl text-gold-bright">{num(sample.attack.total)}</div>
              </li>
            </ol>
          )}
          {sample.outcome !== 'draw' && !sample.attack && <p className="mt-2 text-sm text-bone-dim">The winner's skill deals no damage.</p>}
        </div>
      )}
    </section>
  )
}
