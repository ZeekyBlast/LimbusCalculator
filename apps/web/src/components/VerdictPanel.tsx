import type { ClashReport, Combatant } from '@limbus/engine'
import { num, pct } from '../lib/format.ts'
import { verdictFor } from '../lib/verdict.ts'
import { Stamp } from './Badges.tsx'
import { DamageBand } from './DamageBand.tsx'

interface Props { report: ClashReport; a: Combatant; b: Combatant }

const fmtValue = (label: string, value: number) =>
  label === 'Heads chance' || label === 'Crit chance' ? pct(value) : Number.isInteger(value) ? String(value) : value.toFixed(3)

/** Everything the report says, in ledger order: verdict, odds, damage dealt, coins, stagger, damage taken, breakdown. */
export function VerdictPanel({ report, a, b }: Props) {
  const verdict = verdictFor(report)
  const thresholds = b.unit.staggerThresholds
  // coinsLeftIfWin is a joint distribution (sums to `win`); show it conditional on winning.
  const coinsLeft = report.coinsLeftIfWin.map((p, coins) => ({ coins, p: report.win > 0 ? p / report.win : 0 })).filter(x => x.p > 0.0005)
  return (
    <section className="mt-6 rounded border border-paper-light bg-paper p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-bone-dim">Side A wins</div>
          <div className="ledger-number text-5xl text-gold-bright">{pct(report.win)}</div>
        </div>
        <div className="ledger-number grid text-sm text-bone-dim">
          <span>Draw {pct(report.draw)}</span>
          <span>Lose {pct(report.lose)}</span>
          <span>Expected parry rounds {report.parryRoundsExpected.toFixed(2)}</span>
        </div>
        <div className="ml-auto"><Stamp tone={verdict.tone}>{verdict.text}</Stamp></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <DamageBand summary={report.damageDealt} label={`Damage to ${b.unit.name} if A wins`} />
          {report.damageDealt.perCoinMean.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-bone-dim"><tr><th className="text-left">Coin</th><th className="text-right">Mean damage</th></tr></thead>
              <tbody className="ledger-number">
                {report.damageDealt.perCoinMean.map((m, i) => <tr key={i}><td>Coin {i + 1}</td><td className="text-right">{m.toFixed(1)}</td></tr>)}
              </tbody>
            </table>
          )}
          {thresholds.length > 0 && (
            <ul className="mt-3 grid gap-0.5 text-sm">
              {thresholds.map((t, i) => (
                <li key={i} className="flex justify-between"><span className="text-bone-dim">Crosses the {pct(t, 0)} HP stagger line</span><span className="ledger-number">{pct(report.damageDealt.staggerChance[i] ?? 0)}</span></li>
              ))}
            </ul>
          )}
          {coinsLeft.length > 0 && (
            <p className="ledger-number mt-3 text-xs text-bone-dim">Coins left if A wins: {coinsLeft.map(x => `${x.coins} (${pct(x.p, 0)})`).join(', ')}</p>
          )}
        </div>
        <div>
          <DamageBand summary={report.damageTaken} label={`Damage to ${a.unit.name} if B wins`} />
          <table className="mt-3 w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-bone-dim"><tr><th className="text-left">Modifier</th><th className="text-right">Value</th><th className="text-left pl-3">Source</th></tr></thead>
            <tbody>
              {report.breakdown.map(line => (
                <tr key={line.label} className="border-t border-paper-light/60">
                  <td className="py-0.5">{line.label}</td>
                  <td className="ledger-number text-right">{fmtValue(line.label, line.value)}</td>
                  <td className="pl-3 text-xs text-bone-dim">{line.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-bone-dim">Damage figures are conditional on that side winning; unopposed hits use every coin. Max HP {num(b.unit.hp)} for {b.unit.name}.</p>
        </div>
      </div>
    </section>
  )
}
