import type { ClashReport, Combatant, ReportOptions } from '@limbus/engine'
import { num, pct } from '../lib/format.ts'
import { statusRows, type StatusRow } from '../lib/statusAfter.ts'
import { verdictFor } from '../lib/verdict.ts'
import { Stamp } from './Badges.tsx'
import { DamageBand } from './DamageBand.tsx'
import { RollOnce } from './RollOnce.tsx'

interface Props { report: ClashReport; a: Combatant; b: Combatant; options: ReportOptions }

const fmtValue = (label: string, value: number) =>
  label === 'Heads chance' || label === 'Crit chance' ? pct(value) : Number.isInteger(value) ? String(value) : value.toFixed(3)

function AfterSkill({ name, rows }: { name: string; rows: StatusRow[] }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-bone-dim">{name}</div>
      {rows.length === 0 ? <div className="text-sm text-bone-faint">No statuses</div> : (
        <ul className="mt-1 grid gap-0.5 text-sm">
          {rows.map(r => (
            <li key={r.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{r.name}{r.varies && <span className="ml-1 text-xs text-bone-faint">varies</span>}</span>
              <span className="num shrink-0 text-bone">{r.potency} <span className="text-bone-faint">×</span> {r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The answer: win chance first, then what the damage looks like either way, then how it was computed. */
export function VerdictPanel({ report, a, b, options }: Props) {
  const verdict = verdictFor(report)
  const thresholds = b.unit.staggerThresholds
  // coinsLeftIfWin is a joint distribution (sums to `win`); show it conditional on winning.
  const coinsLeft = report.coinsLeftIfWin.map((p, coins) => ({ coins, p: report.win > 0 ? p / report.win : 0 })).filter(x => x.p > 0.0005)
  const after = report.damageDealt.statusAfter
  const afterA = statusRows(after.self, after.varies, 'self')
  const afterB = statusRows(after.target, after.varies, 'target')
  return (
    <aside className="slab p-5 sm:p-6" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-bone-dim">{a.unit.name} wins the clash</div>
          <div className="display text-[84px] text-gold-bright">{pct(report.win)}</div>
        </div>
        <div className="pt-4"><Stamp tone={verdict.tone}>{verdict.text}</Stamp></div>
      </div>
      <dl className="num mt-2 grid grid-cols-3 gap-3 text-sm">
        <div><dt className="label">Draw</dt><dd className="text-bone">{pct(report.draw)}</dd></div>
        <div><dt className="label">Loses</dt><dd className="text-bone">{pct(report.lose)}</dd></div>
        <div><dt className="label">Parry rounds</dt><dd className="text-bone">{report.parryRoundsExpected.toFixed(2)}</dd></div>
      </dl>

      <div className="mt-6 grid gap-5 border-t border-paper-edge pt-5">
        <DamageBand summary={report.damageDealt} label={`Damage to ${b.unit.name} if ${a.unit.name} wins`} />
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-bone-dim">
          {report.damageDealt.perCoinMean.map((m, i) => <span key={i} className="num">Coin {i + 1}: <span className="text-bone">{m.toFixed(1)}</span></span>)}
          {coinsLeft.length > 0 && <span className="num">Coins left: {coinsLeft.map(x => `${x.coins} (${pct(x.p, 0)})`).join(', ')}</span>}
        </div>
        {thresholds.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {thresholds.map((t, i) => (
              <li key={i} className="flex justify-between"><span className="text-bone-dim">Staggers at {pct(t, 0)} HP</span><span className="num">{pct(report.damageDealt.staggerChance[i] ?? 0)}</span></li>
            ))}
          </ul>
        )}
        <DamageBand summary={report.damageTaken} label={`Damage to ${a.unit.name} if ${b.unit.name} wins`} tone="blood" />
        <div className="border-t border-paper-edge pt-4">
          <div className="text-sm text-bone-dim">After this skill, if {a.unit.name} wins</div>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <AfterSkill name={a.unit.name} rows={afterA} />
            <AfterSkill name={b.unit.name} rows={afterB} />
          </div>
          <p className="mt-2 text-xs text-bone-faint">Potency × count, averaged over every way the coins can land. "Varies" means it differs between outcomes.</p>
        </div>
        <p className="text-xs text-bone-faint">Max HP {num(b.unit.hp)} for {b.unit.name}, {num(a.unit.hp)} for {a.unit.name}. Damage figures assume that side won the clash.</p>
      </div>

      <div className="mt-5 border-t border-paper-edge pt-5">
        <RollOnce a={a} b={b} report={report} options={options} />
      </div>

      <details className="mt-5 border-t border-paper-edge pt-4">
        <summary className="cursor-pointer text-sm text-bone-dim">How this was computed</summary>
        <div className="mt-2 text-xs text-bone-dim">{a.unit.name}, {a.skill?.name ?? ''}</div>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {report.breakdown.map(line => (
              <tr key={line.label} className="border-t border-paper-edge/70">
                <td className="py-1.5 pr-2">{line.label}<span className="block text-xs text-bone-faint">{line.source}</span></td>
                <td className="num py-1.5 text-right align-top">{fmtValue(line.label, line.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </aside>
  )
}
