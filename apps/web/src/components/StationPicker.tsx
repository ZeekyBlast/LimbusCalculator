import type { GameData, RailwaySection, RailwayWave } from '../lib/data.ts'
import { portraitUrl } from '../lib/images.ts'

interface Props { data: GameData; section: RailwaySection; wave: RailwayWave; onSelect: (section: number, wave: number) => void }

function EnemyChips({ data, ids }: { data: GameData; ids: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {ids.map(id => {
        const parts = data.unitsByEnemyId.get(id)
        const first = parts?.[0]
        const url = first && portraitUrl(data.images, first)
        return (
          <li key={id} className="flex items-center gap-2 rounded border border-paper-light bg-ink px-2 py-1 text-xs" title={first?.group ?? `Enemy ${id}`}>
            <span className="h-6 w-6 overflow-hidden rounded bg-paper">{url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}</span>
            <span>{first ? first.group : <span className="text-blood-bright">#{id} no data</span>}</span>
            {parts && parts.length > 1 && <span className="ledger-number text-bone-dim">×{parts.length}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Sections of the live Line with their stations; the chosen section lists its waves with enemy portraits. */
export function StationPicker({ data, section, wave, onSelect }: Props) {
  const { railway } = data
  const stationName = (n: number) => railway.stations.find(s => s.number === n)?.name ?? `Station ${n}`
  return (
    <section className="rounded border border-paper-light bg-paper p-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl uppercase tracking-widest text-gold">{railway.title}</h2>
      <p className="text-xs text-bone-dim">Started {railway.start}</p>
      <ol className="mt-3 grid gap-1">
        {railway.sections.map(s => (
          <li key={s.number}>
            <button
              type="button"
              aria-pressed={s.number === section.number}
              onClick={() => onSelect(s.number, s.waves[0]?.number ?? 1)}
              className={`flex w-full flex-wrap items-baseline gap-x-3 rounded border px-3 py-1.5 text-left text-sm ${s.number === section.number ? 'border-gold bg-paper-light' : 'border-paper-light hover:border-bone-dim'}`}
            >
              <span className="ledger-number text-bone-dim">§{s.number}</span>
              <span className="flex flex-wrap gap-x-2">{s.stationNumbers.map(n => <span key={n}><span className="ledger-number text-bone-dim">#{n}</span> {stationName(n)}</span>)}</span>
            </button>
            {s.number === section.number && (
              <ol className="mt-1 ml-6 grid gap-2">
                {s.waves.map(w => (
                  <li key={w.number}>
                    <button type="button" aria-pressed={w.number === wave.number} onClick={() => onSelect(s.number, w.number)} className={`mb-1 text-xs uppercase tracking-widest ${w.number === wave.number ? 'text-gold-bright' : 'text-bone-dim hover:text-bone'}`}>
                      Wave {w.number}
                    </button>
                    <EnemyChips data={data} ids={w.enemyIds} />
                    {w.reinforcementIds.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[10px] uppercase tracking-widest text-bone-dim">Reinforcements</span>
                        <EnemyChips data={data} ids={w.reinforcementIds} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
