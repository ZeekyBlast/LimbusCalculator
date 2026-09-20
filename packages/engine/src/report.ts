import { clashChain, type ClashSide } from './clashChain'
import { criticalDamageModifier } from './criticalModifier'
import { attackDamageDistribution, mixDistributions, type AttackParams } from './damageDistribution'
import { offenseDefenseAdvantage } from './offenseDefenseAdvantage'
import { parryRoundBonus } from './parryBonus'
import { resistanceModifier } from './resistance'
import { resolveCombatant } from './resolveCombatant'
import type { BreakdownLine, ClashReport, Combatant, DamageSummary, ResolvedCombatant, UnopposedReport } from './types'

export interface ReportOptions { staggerMidAttack?: boolean }

export function damageMultipliers(attacker: ResolvedCombatant, target: Combatant): { sin: number; damageType: number } {
  const dt = attacker.damageType
  return {
    sin: target.unit.resistances.sin[attacker.sin],
    damageType: dt === 'slash' || dt === 'pierce' || dt === 'blunt' ? target.unit.resistances.damageType[dt] : 1,
  }
}

export function clashReport(a: Combatant, b: Combatant, options: ReportOptions = {}): ClashReport {
  const ra = resolveCombatant(a, b)
  const rb = resolveCombatant(b, a)
  const chain = clashChain(toSide(ra), toSide(rb))
  const parryBonus = parryRoundBonus(chain.parryRoundsExpected)
  const dealt = conditionalDamage(ra, rb, b, chain.coinsLeftIfWin, chain.win, parryBonus, options)
  const taken = conditionalDamage(rb, ra, a, chain.coinsLeftIfLose, chain.lose, parryBonus, options)
  return {
    win: chain.win,
    lose: chain.lose,
    draw: chain.draw,
    coinsLeftIfWin: chain.coinsLeftIfWin,
    coinsLeftIfLose: chain.coinsLeftIfLose,
    parryRoundsExpected: chain.parryRoundsExpected,
    damageDealt: dealt.summary,
    damageTaken: taken.summary,
    breakdown: dealt.breakdown,
  }
}

export function unopposedReport(attacker: Combatant, target: Combatant, options: ReportOptions = {}): UnopposedReport {
  const ra = resolveCombatant(attacker, target)
  const rt = resolveCombatant(target, attacker)
  const weights = new Array<number>(ra.coinCount + 1).fill(0)
  weights[ra.coinCount] = 1
  const { summary, breakdown } = conditionalDamage(ra, rt, target, weights, 1, 0, options)
  return { damage: summary, breakdown }
}

function toSide(r: ResolvedCombatant): ClashSide {
  return {
    basePower: r.basePower,
    coinPower: r.coinPower,
    breakableCoins: r.coinCount - r.unbreakableCoins,
    unbreakableCoins: r.unbreakableCoins,
    headsChance: r.headsChance,
    offenseLevel: r.offenseLevel,
    clashPowerBonus: r.clashPowerBonus,
  }
}

function conditionalDamage(
  attacker: ResolvedCombatant,
  target: ResolvedCombatant,
  targetCombatant: Combatant,
  coinWeights: number[],
  totalWeight: number,
  parryBonus: number,
  options: ReportOptions,
): { summary: DamageSummary; breakdown: BreakdownLine[] } {
  const mult = damageMultipliers(attacker, targetCombatant)
  const base: Omit<AttackParams, 'coins'> = {
    basePower: attacker.basePower,
    coinPower: attacker.coinPower,
    coinRollBonus: attacker.coinRollBonus,
    headsChance: attacker.headsChance,
    critChance: attacker.critChance,
    poiseCount: attacker.poiseCount,
    critModifier: criticalDamageModifier(),
    sinResistance: resistanceModifier(mult.sin),
    damageTypeResistance: resistanceModifier(mult.damageType),
    offenseDefenseAdvantage: offenseDefenseAdvantage(attacker.offenseLevel, target.defenseLevel),
    parryBonus,
    dynamicModifier: attacker.dynamicAsAttacker + target.dynamicAsTarget + attacker.damagePercent,
    critOnlyModifier: attacker.critOnlyModifier,
    defenderMaxHp: target.maxHp,
    defenderCurrentHp: target.currentHp,
    staggerThresholds: targetCombatant.unit.staggerThresholds,
    staggerMidAttack: options.staggerMidAttack ?? true,
  }
  const breakdown: BreakdownLine[] = [
    { label: 'Base power', value: attacker.basePower, source: 'skill + uptie + effects + manual' },
    { label: 'Coin power', value: attacker.coinPower, source: 'skill + uptie + effects + manual' },
    { label: 'Heads chance', value: attacker.headsChance, source: '50 + SP, clamped to [-45, 45]' },
    { label: 'Sin resistance', value: base.sinResistance, source: `x${mult.sin} ${attacker.sin} on target` },
    { label: 'Damage type resistance', value: base.damageTypeResistance, source: `x${mult.damageType} ${attacker.damageType} on target` },
    { label: 'Offense-defense advantage', value: base.offenseDefenseAdvantage, source: `offense ${attacker.offenseLevel} vs defense ${target.defenseLevel}` },
    { label: 'Parry bonus', value: parryBonus, source: 'expected parry rounds x 0.03' },
    { label: 'Dynamic modifier', value: base.dynamicModifier, source: 'Damage Up/Down, Fragile/Protection, damage % effects' },
    { label: 'Crit chance', value: attacker.critChance, source: 'Poise potency x 5%' },
  ]
  const parts = coinWeights
    .map((w, coins) => ({ weight: totalWeight > 0 ? w / totalWeight : 0, coins }))
    .filter(p => p.weight > 0)
    .map(p => ({ weight: p.weight, summary: attackDamageDistribution({ ...base, coins: p.coins }) }))
  const summary = parts.length > 0 ? mixDistributions(parts) : attackDamageDistribution({ ...base, coins: 0 })
  return { summary, breakdown }
}
