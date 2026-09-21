import { ALL_SINS, type Combatant, type MatchupGrid, type Unit } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { mult, num, pct } from '../lib/format.ts'
import { cellColor } from '../lib/gridColor.ts'
import { portraitUrl, skillIconUrl } from '../lib/images.ts'
import { shortEnemyName } from '../lib/names.ts'
import { slotLabel } from '../lib/unitSearch.ts'

interface Props { data: GameData; grid: MatchupGrid; team: Combatant[]; onCell: (rowIndex: number, colIndex: number) => void }

const DT = ['slash', 'pierce', 'blunt'] as const

/** Only the multipliers that differ from 1: weak spots in gold, resistances in blood. */
function Resistances({ part }: { part: Unit }) {
  const entries = [
    ...DT.map(d => ({ key: d, m: part.resistances.damageType[d] })),
    ...ALL_SINS.map(s => ({ key: s, m: part.resistances.sin[s] })),
  ].filter(e => e.m !== 1)
  if (entries.length === 0) return <span className="text-xs text-bone-faint">No weaknesses or resistances</span>
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(e => (
        <span key={e.key} className={`num rounded px-1.5 py-0.5 text-[11px] capitalize ${e.m > 1 ? 'bg-gold/15 text-gold-bright' : 'bg-blood/30 text-bone-dim'}`}>{e.key} {mult(e.m)}</span>
      ))}
    </span>
  )
}

/** Rows: my attack skills grouped by identity. Columns: enemy parts. Cells: win % and median damage, tinted by win %. */
export function MatchupGridView({ data, grid, team, onCell }: Props) {
  const unitOf = (id: string) => data.unitsById.get(id)
  const skillOf = (id: string) => data.skillsById.get(id)
  const teamName = (id: string) => team.find(t => t.unit.id === id)?.unit.name
  return (
    <div className="panel w-full min-w-0 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-paper p-3 text-left align-bottom text-xs font-normal text-bone-dim">Win chance and median damage</th>
            {/* Parts are resolved from the column, never by position. */}
            {grid.columns.map(col => {
              const part = unitOf(col.unitId)
              if (!part) return null
              const url = portraitUrl(data.images, part)
              return (
                <th key={col.unitId} className="min-w-[150px] p-3 text-left align-top font-normal">
                  <span className="block h-14 w-14 overflow-hidden rounded-xl bg-ink shadow-[0_6px_14px_rgba(0,0,0,.5)]">{url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}</span>
                  <div className="mt-2 truncate text-[15px] font-medium text-bone" title={part.name}>{shortEnemyName(part.name)}</div>
                  {part.group && part.group !== part.name && <div className="truncate text-xs text-bone-dim" title={part.group}>{shortEnemyName(part.group)}</div>}
                  <div className="num mt-1 text-xs text-bone-dim">HP {num(part.hp)}</div>
                  <div className="truncate text-xs text-bone-dim">{col.skillId ? skillOf(col.skillId)?.name : 'No attack skill'}</div>
                  <div className="mt-2"><Resistances part={part} /></div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, i) => {
            const skill = skillOf(row.skillId)
            const unit = unitOf(row.unitId)
            const firstOfUnit = i === 0 || grid.rows[i - 1].unitId !== row.unitId
            const icon = skill && skillIconUrl(data.images, skill)
            return (
              <tr key={row.skillId}>
                <th className={`sticky left-0 z-10 min-w-[220px] bg-paper p-3 text-left font-normal ${firstOfUnit ? 'border-t border-paper-edge' : ''}`}>
                  {firstOfUnit && <div className="display mb-1 text-sm text-gold">{unit?.name}</div>}
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-ink">{icon && <img src={icon} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
                    <span className="num text-xs text-bone-faint">{skill ? slotLabel(skill) : ''}</span>
                    <span className="truncate">{skill?.name}</span>
                  </div>
                </th>
                {grid.cells[i].map((cell, j) => {
                  const part = unitOf(cell.targetUnitId)
                  if (!part) return null
                  const tint = cellColor(cell.win)
                  return (
                    <td key={cell.targetUnitId} className={`p-1 ${firstOfUnit ? 'border-t border-paper-edge' : ''}`}>
                      <button
                        type="button"
                        onClick={() => onCell(i, j)}
                        style={{ backgroundColor: cellColor(cell.win, 0.16), borderLeftColor: tint === 'transparent' ? 'var(--color-paper-edge)' : cellColor(cell.win, 0.9) }}
                        className="flex h-full w-full flex-col items-start rounded-md border-l-[3px] px-3 py-2 text-left hover:ring-1 hover:ring-gold"
                        title={`${teamName(row.unitId)}, ${skill?.name} vs ${part.name}. Open in the Clash Calculator.`}
                      >
                        <span className="display text-[22px] text-bone">{cell.win === null ? '—' : pct(cell.win, 0)}</span>
                        <span className="num text-xs text-bone-dim">{num(cell.medianDamage)} dmg</span>
                        {(cell.sinMultiplier !== 1 || cell.damageTypeMultiplier !== 1) && (
                          <span className="num mt-0.5 text-[11px] text-bone-faint">{cell.sinMultiplier !== 1 ? `sin ${mult(cell.sinMultiplier)}` : ''}{cell.sinMultiplier !== 1 && cell.damageTypeMultiplier !== 1 ? ' · ' : ''}{cell.damageTypeMultiplier !== 1 ? `type ${mult(cell.damageTypeMultiplier)}` : ''}</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th className="sticky left-0 z-10 border-t border-paper-edge bg-paper p-3 text-left text-xs font-normal text-bone-dim">Turns to kill with the best skill</th>
            {grid.columns.map(col => unitOf(col.unitId) ? <td key={col.unitId} className="num border-t border-paper-edge p-3 text-lg">{num(col.turnsToKill)}</td> : null)}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
