import type { GameData } from '../lib/data.ts'
import { num, pct } from '../lib/format.ts'

/** Footer strip: where the numbers come from and how much of the effect text the parser understood. */
export function DataStatus({ data }: { data: GameData }) {
  const { meta } = data
  const scraped = new Date(meta.scrapedAt)
  return (
    <footer className="mt-12 border-t border-paper-light pt-4 text-xs text-bone-dim">
      <p>
        Data scraped from limbuscompany.wiki.gg on <time dateTime={meta.scrapedAt}>{scraped.toISOString().slice(0, 10)}</time>:{' '}
        <span className="ledger-number">{num(meta.identityCount)}</span> identities,{' '}
        <span className="ledger-number">{num(meta.enemyUnitCount)}</span> enemy parts from {meta.railwayLine}.
      </p>
      <p>
        Effect text parsed into engine rules: <span className="ledger-number">{pct(meta.effectParseCoverage.ratio, 1)}</span>{' '}
        ({num(meta.effectParseCoverage.parsed)} of {num(meta.effectParseCoverage.total)} lines). Unparsed lines are shown but not applied.
      </p>
    </footer>
  )
}
