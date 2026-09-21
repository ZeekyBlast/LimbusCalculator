import type { GameData } from '../lib/data.ts'
import { num, pct } from '../lib/format.ts'

/** Footer: where the numbers come from and how much of the effect text the engine models. */
export function DataStatus({ data }: { data: GameData }) {
  const { meta } = data
  return (
    <footer className="mt-14 border-t border-paper-edge pt-4 text-xs text-bone-faint">
      Data from limbuscompany.wiki.gg, scraped <time dateTime={meta.scrapedAt}>{meta.scrapedAt.slice(0, 10)}</time>:{' '}
      <span className="num">{num(meta.identityCount)}</span> identities and <span className="num">{num(meta.enemyUnitCount)}</span> enemy parts from {meta.railwayLine}.
      The engine models <span className="num">{pct(meta.effectParseCoverage.ratio, 0)}</span> of skill effect lines; the rest are shown but not applied.
    </footer>
  )
}
