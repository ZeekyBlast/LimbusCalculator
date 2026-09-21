import type { DamageSummary } from '@limbus/engine'
import { num } from '../lib/format.ts'
import { bandGeometry } from '../lib/verdict.ts'

/** p10–p90 range on a 0..max axis with the median marked; numbers alongside. */
export function DamageBand({ summary, label }: { summary: DamageSummary; label: string }) {
  const g = bandGeometry(summary)
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs uppercase tracking-widest text-bone-dim">
        <span>{label}</span>
        <span className="ledger-number">median <span className="text-bone">{num(summary.p50)}</span> · mean {num(summary.mean)} · max {num(summary.max)}</span>
      </div>
      <div className="relative mt-1 h-3 rounded bg-ink" role="img" aria-label={`${label}: 10th percentile ${num(summary.p10)}, median ${num(summary.p50)}, 90th percentile ${num(summary.p90)}, maximum ${num(summary.max)}`}>
        <div className="absolute top-0 h-full rounded bg-gold/40" style={{ left: `${g.left * 100}%`, width: `${g.width * 100}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-gold-bright" style={{ left: `${g.median * 100}%` }} />
      </div>
      <div className="ledger-number mt-0.5 flex justify-between text-[10px] text-bone-dim"><span>0</span><span>p10 {num(summary.p10)} – p90 {num(summary.p90)}</span><span>{num(summary.max)}</span></div>
    </div>
  )
}
