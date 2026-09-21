import { ALL_SINS, type Combatant, type MatchupGrid } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { mult, num, pct } from '../lib/format.ts'
import { cellColor } from '../lib/gridColor.ts'
import { portraitUrl } from '../lib/images.ts'
import { slotLabel } from '../lib/unitSearch.ts'

interface Props { data: GameData; grid: MatchupGrid; team: Combatant[]; onCell: (rowIndex: number, colIndex: number) => void }

const DT = ['slash', 'pierce', 'blunt'] as const

/** Rows: my attack skills grouped by identity. Columns: enemy parts. Cells: win % and median damage, tinted by win %. */
export function MatchupGridView({ data, grid, team, onCell }: Props) {
  const unitOf = (id: string) => data.unitsById.get(id)
  const skillOf = (id: string) => data.skillsById.get(id)
  return (
    <div className="overflow-x-auto rounded border border-paper-light bg-paper">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-paper p-2 text-left text-[10px] uppercase tracking-widest text-bone-dim">My skill</th>
            {/* Parts are resolved from the column, never by position: a column list from a different
                wave than the one being rendered must not silently read the wrong part. */}
            {grid.columns.map(col => {
              const part = data.unitsById.get(col.unitId)
              if (!part) return null
              const url = portraitUrl(data.images, part)
              return (
                <th key={col.unitId} className="p-2 text-left align-top">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-ink">{url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}</span>
                    <span className="min-w-0"><span className="block truncate">{part.name}</span><span className="block truncate text-bone-dim">{part.group}</span></span>
                  </div>
                  <div className="ledger-number mt-1 text-bone-dim">HP {num(part.hp)} · {col.skillId ? skillOf(col.skillId)?.name : <span className="text-bone-dim">no attack</span>}</div>
                </th>
              )
            })}
          </tr>
          {/* Coverage strip: the part's resistance multipliers, so a row's sin and type can be read against them. */}
          <tr className="border-y border-paper-light bg-ink/40">
            <th className="sticky left-0 z-10 bg-paper p-2 text-left text-[10px] uppercase tracking-widest text-bone-dim">Resistances</th>
            {grid.columns.map(col => {
              const part = data.unitsById.get(col.unitId)
              if (!part) return null
              return (
                <td key={col.unitId} className="ledger-number p-2 text-[10px] text-bone-dim">
                  <div className="flex flex-wrap gap-x-2">{DT.map(d => <span key={d} className={part.resistances.damageType[d] !== 1 ? 'text-bone' : ''}>{d.slice(0, 2)} {mult(part.resistances.damageType[d])}</span>)}</div>
                  <div className="flex flex-wrap gap-x-2">{ALL_SINS.map(s => <span key={s} className={part.resistances.sin[s] !== 1 ? 'text-bone' : ''}>{s.slice(0, 3)} {mult(part.resistances.sin[s])}</span>)}</div>
                </td>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, i) => {
            const skill = skillOf(row.skillId)
            const unit = unitOf(row.unitId)
            const firstOfUnit = i === 0 || grid.rows[i - 1].unitId !== row.unitId
            return (
              <tr key={row.skillId} className={firstOfUnit ? 'border-t border-paper-light' : ''}>
                <th className="sticky left-0 z-10 bg-paper p-2 text-left font-normal">
                  {firstOfUnit && <div className="truncate text-[10px] uppercase tracking-widest text-gold">{unit?.name}</div>}
                  <div className="flex items-center gap-2"><span className="ledger-number text-bone-dim">{skill ? slotLabel(skill) : ''}</span><span className="truncate">{skill?.name}</span></div>
                </th>
                {grid.cells[i].map((cell, j) => {
                  const part = data.unitsById.get(cell.targetUnitId)
                  if (!part) return null
                  return (
                    <td key={cell.targetUnitId} className="p-0">
                      <button
                        type="button"
                        onClick={() => onCell(i, j)}
                        style={{ backgroundColor: cellColor(cell.win) }}
                        className="ledger-number flex h-full w-full flex-col items-start px-2 py-1.5 text-left hover:outline hover:outline-1 hover:outline-gold"
                        title={`${team.find(t => t.unit.id === row.unitId)?.unit.name} ${skill?.name} vs ${part.name}: open in the Clash Calculator`}
                      >
                        <span className="text-sm">{cell.win === null ? '—' : pct(cell.win, 0)}</span>
                        <span className="text-bone-dim">{num(cell.medianDamage)} dmg</span>
                        {(cell.sinMultiplier !== 1 || cell.damageTypeMultiplier !== 1) && (
                          <span className="text-[10px] text-bone-dim">{cell.sinMultiplier !== 1 ? `sin ${mult(cell.sinMultiplier)} ` : ''}{cell.damageTypeMultiplier !== 1 ? `type ${mult(cell.damageTypeMultiplier)}` : ''}</span>
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
          <tr className="border-t border-paper-light">
            <th className="sticky left-0 z-10 bg-paper p-2 text-left text-[10px] uppercase tracking-widest text-bone-dim">Turns to kill (best skill)</th>
            {grid.columns.map(col => <td key={col.unitId} className="ledger-number p-2">{num(col.turnsToKill)}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
