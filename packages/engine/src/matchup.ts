import { clashReport, damageMultipliers, unopposedReport, type ReportOptions } from './report'
import { resolveCombatant } from './resolveCombatant'
import { EMPTY_MANUAL, type Combatant, type MatchupCell, type MatchupGrid, type Skill, type Unit } from './types'

function isAttack(skill: Skill): boolean {
  return skill.slot !== 'defense' && (skill.damageType === 'slash' || skill.damageType === 'pierce' || skill.damageType === 'blunt')
}

export function primaryAttackSkill(unit: Unit): Skill | undefined {
  let best: Skill | undefined
  for (const s of unit.skills) {
    if (!isAttack(s)) continue
    if (!best || s.attackWeight > best.attackWeight) best = s
  }
  return best
}

export function enemyCombatant(unit: Unit, skill: Skill | undefined): Combatant {
  return { unit, skill, uptie: 4, level: unit.level, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } }
}

export function matchupGrid(team: Combatant[], wave: Unit[], options: ReportOptions = {}): MatchupGrid {
  const rowCombatants = team.flatMap(member =>
    member.unit.skills.filter(isAttack).map(skill => ({ ...member, skill })),
  )
  // A part with no attack skill still takes damage, so it keeps a column; its clash cells are null.
  const columnCombatants = wave.map(unit => enemyCombatant(unit, primaryAttackSkill(unit)))

  const cells: MatchupCell[][] = rowCombatants.map(row =>
    columnCombatants.map(col => {
      const clash = col.skill ? clashReport(row, col, options) : undefined
      const hit = unopposedReport(row, col, options)
      const mult = damageMultipliers(resolveCombatant(row, col), col)
      return {
        attackerSkillId: row.skill.id,
        targetUnitId: col.unit.id,
        targetSkillId: col.skill?.id ?? null,
        win: clash ? clash.win : null,
        medianDamage: hit.damage.p50,
        meanDamage: hit.damage.mean,
        sinMultiplier: mult.sin,
        damageTypeMultiplier: mult.damageType,
      }
    }),
  )

  const columns = columnCombatants.map((col, j) => {
    const bestMean = Math.max(0, ...cells.map(r => r[j].meanDamage))
    return { unitId: col.unit.id, skillId: col.skill?.id ?? null, turnsToKill: bestMean > 0 ? Math.ceil(col.unit.hp / bestMean) : Infinity }
  })

  return {
    rows: rowCombatants.map(r => ({ unitId: r.unit.id, skillId: r.skill.id })),
    columns,
    cells,
  }
}
