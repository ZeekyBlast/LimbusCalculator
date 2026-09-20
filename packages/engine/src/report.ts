import { binomialPmf } from './binomial'
import { clashChain, type ClashSide } from './clashChain'
import { criticalDamageModifier } from './criticalModifier'
import { attackDamageDistribution, mixDistributions, sampleAttack, type AttackParams, type SampledAttack } from './damageDistribution'
import { offenseDefenseAdvantage } from './offenseDefenseAdvantage'
import { parryRoundBonus } from './parryBonus'
import { resistanceModifier } from './resistance'
import { resolveCombatant } from './resolveCombatant'
import type { BreakdownLine, ClashReport, Combatant, DamageSummary, ResolvedCombatant, Skill, UnopposedReport } from './types'

export interface ReportOptions { staggerMidAttack?: boolean }

export interface AttackContext {
  params: Omit<AttackParams, 'coins' | 'powerReduction'>
  breakdown: BreakdownLine[]
}

export interface ClashSample {
  outcome: 'win' | 'lose' | 'draw'
  /** Coins the winner attacks with (0 on a draw). */
  coinsLeft: number
  /** Guard final power taken off the attack when the loser guarded; 0 otherwise. */
  guardReduction: number
  /** Absent on a draw or when the winner's skill cannot attack (guard, evade, none). */
  attack?: SampledAttack
}

export function damageMultipliers(attacker: ResolvedCombatant, target: Combatant): { sin: number; damageType: number } {
  const dt = attacker.damageType
  return {
    sin: target.unit.resistances.sin[attacker.sin],
    damageType: dt === 'slash' || dt === 'pierce' || dt === 'blunt' ? target.unit.resistances.damageType[dt] : 1,
  }
}

function isAttackSkill(skill: Skill | undefined): boolean {
  const dt = skill?.damageType
  return dt === 'slash' || dt === 'pierce' || dt === 'blunt'
}

function isGuard(skill: Skill | undefined): boolean {
  return skill?.damageType === 'guard'
}

export function clashReport(a: Combatant, b: Combatant, options: ReportOptions = {}): ClashReport {
  if (!a.skill || !b.skill) throw new Error('clashReport: both combatants need a skill')
  if (isGuard(b.skill) && isAttackSkill(a.skill)) {
    const g = guardClash(a, b, options)
    return {
      win: g.attackerWins, lose: g.guardWins, draw: g.draw,
      coinsLeftIfWin: oneHot(g.attackerCoins).map(p => p * g.attackerWins),
      coinsLeftIfLose: oneHot(g.guardCoins).map(p => p * g.guardWins),
      parryRoundsExpected: g.parryRoundsExpected,
      damageDealt: g.attackDamage, damageTaken: g.noDamage, breakdown: g.breakdown,
    }
  }
  if (isGuard(a.skill) && isAttackSkill(b.skill)) {
    const g = guardClash(b, a, options)
    return {
      win: g.guardWins, lose: g.attackerWins, draw: g.draw,
      coinsLeftIfWin: oneHot(g.guardCoins).map(p => p * g.guardWins),
      coinsLeftIfLose: oneHot(g.attackerCoins).map(p => p * g.attackerWins),
      parryRoundsExpected: g.parryRoundsExpected,
      damageDealt: g.noDamage, damageTaken: g.attackDamage, breakdown: g.breakdown,
    }
  }
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
  if (!attacker.skill) throw new Error('unopposedReport: the attacker needs a skill')
  const ra = resolveCombatant(attacker, target)
  const rt = resolveCombatant(target, attacker)
  const weights = new Array<number>(ra.coinCount + 1).fill(0)
  weights[ra.coinCount] = 1
  const { summary, breakdown } = conditionalDamage(ra, rt, target, weights, 1, 0, options)
  return { damage: summary, breakdown }
}

/**
 * One random outcome of the clash: who won, how many coins they attack with, and one exact path
 * through the damage stage. Pass the report you already computed to skip recomputing it.
 */
export function sampleClash(a: Combatant, b: Combatant, options: ReportOptions = {}, rng: () => number = Math.random, report: ClashReport = clashReport(a, b, options)): ClashSample {
  const u = rng()
  const outcome: ClashSample['outcome'] = u < report.win ? 'win' : u < report.win + report.lose ? 'lose' : 'draw'
  if (outcome === 'draw') return { outcome, coinsLeft: 0, guardReduction: 0 }
  const [winner, loser] = outcome === 'win' ? [a, b] : [b, a]
  const coinsLeft = sampleIndex(outcome === 'win' ? report.coinsLeftIfWin : report.coinsLeftIfLose, rng())
  if (!isAttackSkill(winner.skill)) return { outcome, coinsLeft, guardReduction: 0 }
  const rw = resolveCombatant(winner, loser)
  const rl = resolveCombatant(loser, winner)
  const guardReduction = isGuard(loser.skill) ? sampleWeighted(guardRound(rw, rl).reductionIfAttackerWins, rng()) : 0
  const ctx = attackContext(rw, rl, loser, parryRoundBonus(report.parryRoundsExpected), options)
  return { outcome, coinsLeft, guardReduction, attack: sampleAttack({ ...ctx.params, coins: coinsLeft, powerReduction: guardReduction }, rng) }
}

/** Everything the damage stage needs except the coin count, plus the modifier breakdown. */
export function attackContext(attacker: ResolvedCombatant, target: ResolvedCombatant, targetCombatant: Combatant, parryBonus: number, options: ReportOptions): AttackContext {
  const mult = damageMultipliers(attacker, targetCombatant)
  const params: AttackContext['params'] = {
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
    { label: 'Sin resistance', value: params.sinResistance, source: `x${mult.sin} ${attacker.sin} on target` },
    { label: 'Damage type resistance', value: params.damageTypeResistance, source: `x${mult.damageType} ${attacker.damageType} on target` },
    { label: 'Offense-defense advantage', value: params.offenseDefenseAdvantage, source: `offense ${attacker.offenseLevel} vs defense ${target.defenseLevel}` },
    { label: 'Parry bonus', value: parryBonus, source: 'expected parry rounds x 0.03' },
    { label: 'Dynamic modifier', value: params.dynamicModifier, source: 'Damage Up/Down, Fragile/Protection, damage % effects' },
    { label: 'Crit chance', value: attacker.critChance, source: 'Poise potency x 5%' },
  ]
  return { params, breakdown }
}

function toSide(r: ResolvedCombatant): ClashSide {
  return {
    basePower: r.basePower,
    coinPower: r.coinPower,
    breakableCoins: Math.max(0, r.coinCount - r.unbreakableCoins),
    unbreakableCoins: r.unbreakableCoins,
    headsChance: r.headsChance,
    offenseLevel: r.offenseLevel,
    clashPowerBonus: r.clashPowerBonus,
  }
}

function oneHot(coins: number): number[] {
  const out = new Array<number>(coins + 1).fill(0)
  out[coins] = 1
  return out
}

function sampleIndex(weights: number[], u: number): number {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return weights.length - 1
  let acc = 0
  const target = u * total
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (target < acc) return i
  }
  return weights.length - 1
}

function sampleWeighted(pairs: [number, number][], u: number): number {
  let acc = 0
  for (const [value, weight] of pairs) {
    acc += weight
    if (u < acc) return value
  }
  return pairs.length > 0 ? pairs[pairs.length - 1][0] : 0
}

interface GuardRound {
  attackerWins: number
  guardWins: number
  tie: number
  /** Guard final power and its probability, conditional on the attacker winning the round. */
  reductionIfAttackerWins: [number, number][]
}

/**
 * Spec 6.2: one round, every coin of both skills flipped. The guard's level bonus comes from its
 * Defense Level against the attacker's Offense Level; the attacker's from the reverse difference.
 */
function guardRound(attacker: ResolvedCombatant, guard: ResolvedCombatant): GuardRound {
  const aHeads = binomialPmf(attacker.coinCount, attacker.headsChance)
  const gHeads = binomialPmf(guard.coinCount, guard.headsChance)
  const aBonus = attacker.clashPowerBonus + Math.floor(Math.max(attacker.offenseLevel - guard.defenseLevel, 0) / 3)
  const gBonus = guard.clashPowerBonus + Math.floor(Math.max(guard.defenseLevel - attacker.offenseLevel, 0) / 3)
  let attackerWins = 0
  let guardWins = 0
  let tie = 0
  const reduction = new Map<number, number>()
  aHeads.forEach((pa, h) => {
    gHeads.forEach((pg, g) => {
      const p = pa * pg
      if (p === 0) return
      const attackPower = attacker.basePower + attacker.coinPower * h + aBonus
      const guardPower = guard.basePower + guard.coinPower * g + gBonus
      if (attackPower > guardPower) {
        attackerWins += p
        reduction.set(guardPower, (reduction.get(guardPower) ?? 0) + p)
      } else if (guardPower > attackPower) {
        guardWins += p
      } else {
        tie += p
      }
    })
  })
  const reductionIfAttackerWins = [...reduction.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([power, p]) => [power, p / attackerWins] as [number, number])
  return { attackerWins, guardWins, tie, reductionIfAttackerWins }
}

interface GuardClash {
  attackerWins: number
  guardWins: number
  draw: number
  parryRoundsExpected: number
  attackerCoins: number
  guardCoins: number
  /** Attack damage conditional on the attacker winning, reduced by the guard's final power. */
  attackDamage: DamageSummary
  /** The guard's (empty) attack, shaped like a real summary so consumers need no special case. */
  noDamage: DamageSummary
  breakdown: BreakdownLine[]
}

function guardClash(attacker: Combatant, guard: Combatant, options: ReportOptions): GuardClash {
  const ra = resolveCombatant(attacker, guard)
  const rg = resolveCombatant(guard, attacker)
  const round = guardRound(ra, rg)
  const decided = 1 - round.tie
  const parryRoundsExpected = decided > 0 ? round.tie / decided : 0
  const ctx = attackContext(ra, rg, guard, parryRoundBonus(parryRoundsExpected), options)
  const parts = round.reductionIfAttackerWins.map(([power, weight]) => ({
    weight,
    summary: attackDamageDistribution({ ...ctx.params, coins: ra.coinCount, powerReduction: power }),
  }))
  const attackDamage = parts.length > 0 ? mixDistributions(parts) : attackDamageDistribution({ ...ctx.params, coins: 0 })
  const expectedReduction = round.reductionIfAttackerWins.reduce((s, [power, weight]) => s + power * weight, 0)
  const breakdown = [...ctx.breakdown, { label: 'Guard reduction', value: expectedReduction, source: 'guard final power given the guard lost; absorbed by the earliest coins' }]
  const noDamage = attackDamageDistribution({ ...attackContext(rg, ra, attacker, 0, options).params, coins: 0 })
  return {
    attackerWins: decided > 0 ? round.attackerWins / decided : 0,
    guardWins: decided > 0 ? round.guardWins / decided : 0,
    draw: decided > 0 ? 0 : 1,
    parryRoundsExpected,
    attackerCoins: ra.coinCount,
    guardCoins: rg.coinCount,
    attackDamage,
    noDamage,
    breakdown,
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
  const { params, breakdown } = attackContext(attacker, target, targetCombatant, parryBonus, options)
  // Guard, Evade and other non-damaging skills still clash, but they land no attack: report a
  // zero summary rather than running the attack math on a damage type the target cannot resist.
  const dt = attacker.damageType
  if (dt !== 'slash' && dt !== 'pierce' && dt !== 'blunt') {
    return { summary: attackDamageDistribution({ ...params, coins: 0 }), breakdown }
  }
  const parts = coinWeights
    .map((w, coins) => ({ weight: totalWeight > 0 ? w / totalWeight : 0, coins }))
    .filter(p => p.weight > 0)
    .map(p => ({ weight: p.weight, summary: attackDamageDistribution({ ...params, coins: p.coins }) }))
  const summary = parts.length > 0 ? mixDistributions(parts) : attackDamageDistribution({ ...params, coins: 0 })
  return { summary, breakdown }
}
