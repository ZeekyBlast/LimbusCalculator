import type { Combatant, Unit } from '@limbus/engine'
import type { GameData, RailwayLine, RailwaySection, RailwayWave } from './data.ts'
import { emptySide, sideForUnit, toCombatant, type ClashSetup } from './setup.ts'
import type { TeamSlot } from '../stores/teamStore.ts'

/** Every part of every enemy in the wave (main list first, then reinforcements), plus ids the scrape has no unit for. */
export function waveUnits(data: GameData, wave: RailwayWave): { units: Unit[]; missingIds: string[] } {
  const units: Unit[] = []
  const missingIds: string[] = []
  for (const id of [...wave.enemyIds, ...wave.reinforcementIds]) {
    const parts = data.unitsByEnemyId.get(id)
    if (parts) units.push(...parts)
    else missingIds.push(id)
  }
  return { units, missingIds }
}

/** A team member as the grid wants it: unit scaled to the slot level, no particular skill (the grid enumerates them). */
export function slotCombatant(slot: TeamSlot, data: GameData): Combatant | undefined {
  return toCombatant({ ...emptySide(), unitId: slot.unitId, uptie: slot.uptie, level: slot.level }, data)
}

/** Clash Calculator setup for one grid cell: my skill on side A, the part and its clashing skill on side B. */
export function pairingSetup(slot: TeamSlot, rowSkillId: string, part: Unit, colSkillId: string | null, staggerMidAttack: boolean): ClashSetup {
  const a = { ...emptySide(), unitId: slot.unitId, skillId: rowSkillId, uptie: slot.uptie, level: slot.level }
  const b = { ...sideForUnit(part), skillId: colSkillId }
  return { a, b, staggerMidAttack }
}

export function selectedEncounter(railway: RailwayLine, search: URLSearchParams): { section: RailwaySection; wave: RailwayWave } {
  const section = railway.sections.find(s => s.number === Number(search.get('section'))) ?? railway.sections[0]
  const wave = section.waves.find(w => w.number === Number(search.get('wave'))) ?? section.waves[0]
  return { section, wave }
}
