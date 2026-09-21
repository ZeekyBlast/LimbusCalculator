import type { DamageSummary } from '@limbus/engine'
import { num } from '../lib/format.ts'
import { bandGeometry } from '../lib/verdict.ts'

/** p10–p90 range on a 0..max axis with the median marked. */
export function DamageBand({ summary, label, tone = 'gold' }: { summary: DamageSummary; label: string; tone?: 'gold' | 'blood' }) {
  const g = bandGeometry(summary)
  const bar = tone === 'gold' ? 'bg-gold/35' : 'bg-blood-bright/35'
  const mark = tone === 'gold' ? 'bg-gold-bright' : 'bg-blood-bright'
  const big = tone === 'gold' ? 'text-gold-bright' : 'text-blood-bright'
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-sm text-bone-dim">{label}</span>
        <span className="num text-right leading-none"><span className={`display text-[28px] ${big}`}>{num(summary.p50)}</span><span className="ml-1 text-xs text-bone-dim">median</span></span>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-ink" role="img" aria-label={`${label}: 10th percentile ${num(summary.p10)}, median ${num(summary.p50)}, 90th percentile ${num(summary.p90)}, maximum ${num(summary.max)}`}>
        <div className={`absolute top-0 h-full rounded-full ${bar}`} style={{ left: `${g.left * 100}%`, width: `${g.width * 100}%` }} />
        <div className={`absolute -top-0.5 h-3.5 w-0.5 ${mark}`} style={{ left: `${g.median * 100}%` }} />
      </div>
      <div className="num mt-1 flex justify-between text-xs text-bone-dim">
        <span>{num(summary.p10)}–{num(summary.p90)} in 8 of 10 clashes</span>
        <span>mean {num(summary.mean)} · max {num(summary.max)}</span>
      </div>
    </div>
  )
}
