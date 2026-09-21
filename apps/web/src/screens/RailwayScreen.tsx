import { useMemo } from 'react'
import { MatchupGridView } from '../components/MatchupGridView.tsx'
import { StationPicker } from '../components/StationPicker.tsx'
import { TeamBuilder } from '../components/TeamBuilder.tsx'
import type { GameData } from '../lib/data.ts'
import { pairingSetup, selectedEncounter, slotCombatant, waveUnits } from '../lib/railway.ts'
import { href, navigate } from '../lib/router.ts'
import { encodeSetup } from '../lib/setupCodec.ts'
import { useMatchupGrid } from '../lib/useEngine.ts'
import { useClashStore } from '../stores/clashStore.ts'
import { useTeamStore, type TeamSlot } from '../stores/teamStore.ts'

interface Props { data: GameData; search: URLSearchParams }

export function RailwayScreen({ data, search }: Props) {
  const { section, wave } = selectedEncounter(data.railway, search)
  const slots = useTeamStore(s => s.slots)
  const staggerMidAttack = useClashStore(s => s.setup.staggerMidAttack)

  const filledSlots = useMemo(() => slots.filter((s): s is TeamSlot => s !== null), [slots])
  const team = useMemo(() => filledSlots.flatMap(s => { const c = slotCombatant(s, data); return c ? [c] : [] }), [filledSlots, data])
  const { units, missingIds } = useMemo(() => waveUnits(data, wave), [data, wave])
  const options = useMemo(() => ({ staggerMidAttack }), [staggerMidAttack])
  const grid = useMatchupGrid(team, units, options)

  const select = (sectionNumber: number, waveNumber: number) =>
    navigate(href('/railway', new URLSearchParams({ section: String(sectionNumber), wave: String(waveNumber) })))

  const openCell = (rowIndex: number, colIndex: number) => {
    if (!grid.result) return
    const row = grid.result.rows[rowIndex]
    const col = grid.result.columns[colIndex]
    const slot = filledSlots.find(s => s.unitId === row.unitId)
    const part = data.unitsById.get(col.unitId)
    if (!slot || !part) return
    navigate(href('/', new URLSearchParams({ s: encodeSetup(pairingSetup(slot, row.skillId, part, col.skillId, staggerMidAttack)) })))
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <StationPicker data={data} section={section} wave={wave} onSelect={select} />
        <TeamBuilder data={data} />
      </div>
      {missingIds.length > 0 && <p className="text-xs text-blood-bright">No stat block on the wiki for enemy id{missingIds.length > 1 ? 's' : ''} {missingIds.join(', ')}; not shown in the grid.</p>}
      {team.length === 0 ? <p className="text-bone-dim">Add identities to the team to see the matchup grid for §{section.number} wave {wave.number}.</p>
        : units.length === 0 ? <p className="text-bone-dim">This wave has no enemy data.</p>
        : grid.error ? <p className="text-blood-bright">{grid.error}</p>
        : !grid.result ? <p className="text-bone-dim" aria-live="polite">Computing {team.length} identities against {units.length} parts…</p>
        : <MatchupGridView data={data} grid={grid.result} team={team} wave={units} onCell={openCell} />}
    </div>
  )
}
