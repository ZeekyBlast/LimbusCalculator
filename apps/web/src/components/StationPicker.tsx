import type { GameData, RailwaySection, RailwayWave } from '../lib/data.ts'
import { portraitUrl } from '../lib/images.ts'
import { shortEnemyName } from '../lib/names.ts'

interface Props { data: GameData; section: RailwaySection; wave: RailwayWave | undefined; onSelect: (section: number, wave: number) => void }

function EnemyStrip({ data, ids, muted }: { data: GameData; ids: string[]; muted?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {ids.map(id => {
        const parts = data.unitsByEnemyId.get(id)
        const first = parts?.[0]
        const url = first && portraitUrl(data.images, first)
        return (
          <li key={id} className={`w-[92px] ${muted ? 'opacity-75' : ''}`} title={first?.group ?? `Enemy ${id}`}>
            <span className="relative block h-[92px] w-[92px] overflow-hidden rounded-xl bg-ink shadow-[0_8px_18px_rgba(0,0,0,.5)]">
              {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
              {parts && parts.length > 1 && <span className="num absolute bottom-1 right-1 rounded bg-ink/85 px-1.5 text-xs text-bone">×{parts.length}</span>}
            </span>
            <span className={`mt-1.5 line-clamp-2 text-xs leading-tight ${first ? 'text-bone-dim' : 'text-blood-bright'}`}>{first ? shortEnemyName(first.group ?? first.name) : `#${id}: no data on the wiki`}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** The live Line as a track of sections; the chosen section's waves as tabs; the chosen wave as a strip of enemy portraits. */
export function StationPicker({ data, section, wave, onSelect }: Props) {
  const { railway } = data
  const stationName = (n: number) => railway.stations.find(s => s.number === n)?.name ?? `Station ${n}`
  return (
    <section className="panel min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-[28px] text-bone">{railway.title}</h2>
        <span className="text-xs text-bone-dim">Live since {railway.start}</span>
      </div>

      <ol className="mt-4 flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
        {railway.sections.map(s => {
          const active = s.number === section.number
          return (
            <li key={s.number} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(s.number, s.waves[0]?.number ?? 1)}
                className={`flex min-w-[160px] flex-col items-start rounded-xl border px-3 py-2 text-left ${active ? 'border-gold bg-paper-light' : 'border-paper-edge bg-ink-2 hover:border-gold-dim'}`}
              >
                <span className={`num text-xs ${active ? 'text-gold-bright' : 'text-bone-faint'}`}>Section {s.number}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-bone">
                  {s.stationNumbers.map(n => <span key={n}><span className="num text-bone-faint">{n} </span>{stationName(n)}</span>)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {section.waves.length > 0 && (
        <div className="seg mt-4 max-w-full overflow-x-auto" role="group" aria-label="Wave">
          {section.waves.map(w => <button key={w.number} type="button" aria-pressed={w.number === wave?.number} onClick={() => onSelect(section.number, w.number)}>Wave {w.number}</button>)}
        </div>
      )}

      {wave ? (
        <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          <EnemyStrip data={data} ids={wave.enemyIds} />
          {wave.reinforcementIds.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-bone-dim">Reinforcements</div>
              <EnemyStrip data={data} ids={wave.reinforcementIds} muted />
            </div>
          )}
        </div>
      ) : <p className="mt-4 text-sm text-bone-dim">No encounter data for this section.</p>}
    </section>
  )
}
