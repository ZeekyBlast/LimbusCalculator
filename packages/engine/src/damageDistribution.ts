import { computeFinalDamage } from './damage'
import { staggerDamageTypeResistanceModifier } from './resistance'
import type { DamageSummary } from './types'

export interface AttackParams {
  coins: number
  basePower: number
  coinPower: number
  coinRollBonus: number
  headsChance: number
  critChance: number
  poiseCount: number
  critModifier: number
  sinResistance: number
  damageTypeResistance: number
  offenseDefenseAdvantage: number
  parryBonus: number
  dynamicModifier: number
  /** Added to the dynamic modifier only on coins that crit (Crit Damage Up). */
  critOnlyModifier: number
  defenderMaxHp: number
  defenderCurrentHp: number
  /**
   * Fractions of max HP in descending order, same convention as `Unit.staggerThresholds`
   * (e.g. `[0.7, 0.4]`). The sequential crossing walk below assumes this ordering: descending
   * thresholds produce ascending absolute damage lines, which is what lets it advance a single
   * forward pointer through `staggerLines` instead of re-scanning on every coin.
   */
  staggerThresholds: number[]
  staggerMidAttack: boolean
}

interface Walk {
  coinIndex: number
  headsSoFar: number
  total: number
  thresholdsCrossed: number
  poiseCount: number
  prob: number
}

/** Exact distribution of total damage for a one-sided attack with `coins` coins, enumerating every heads/crit sequence. */
export function attackDamageDistribution(p: AttackParams): DamageSummary {
  const histogram = new Map<number, number>()
  const perCoinMean = new Array<number>(p.coins).fill(0)
  const staggerChance = new Array<number>(p.staggerThresholds.length).fill(0)
  const staggerLines = p.staggerThresholds.map(t => p.defenderCurrentHp - t * p.defenderMaxHp)

  // A line at or below 0 sits behind the defender's current HP: that stagger threshold was broken
  // before this attack began. Seed the walk past those lines so every coin already benefits from
  // the stagger multiplier, and leave their staggerChance at 0 - this attack did not cause them.
  // staggerThresholds is descending, so the already-crossed lines are the leading ones.
  let alreadyCrossed = 0
  while (alreadyCrossed < staggerLines.length && staggerLines[alreadyCrossed] <= 0) alreadyCrossed++

  const stack: Walk[] = [{ coinIndex: 0, headsSoFar: 0, total: 0, thresholdsCrossed: alreadyCrossed, poiseCount: p.poiseCount, prob: 1 }]
  while (stack.length > 0) {
    const w = stack.pop()!
    if (w.coinIndex === p.coins) {
      histogram.set(w.total, (histogram.get(w.total) ?? 0) + w.prob)
      continue
    }
    const critChance = w.poiseCount > 0 ? Math.min(1, p.critChance) : 0
    for (const heads of [true, false]) {
      const pHeads = heads ? p.headsChance : 1 - p.headsChance
      if (pHeads === 0) continue
      for (const crit of [true, false]) {
        const pCrit = crit ? critChance : 1 - critChance
        if (pCrit === 0) continue
        const prob = w.prob * pHeads * pCrit
        const headsSoFar = w.headsSoFar + (heads ? 1 : 0)
        const coinRoll = p.basePower + p.coinRollBonus + p.coinPower * headsSoFar
        const staggered = p.staggerMidAttack && w.thresholdsCrossed > 0
        const damage = computeFinalDamage({
          coinRoll,
          staticModifiers: {
            sinResistance: p.sinResistance,
            damageTypeResistance: staggered ? staggerDamageTypeResistanceModifier(w.thresholdsCrossed) : p.damageTypeResistance,
            offenseDefenseAdvantage: p.offenseDefenseAdvantage,
            parryBonus: p.parryBonus,
            critical: crit ? p.critModifier : 0,
          },
          dynamicModifiers: { skillEffects: 0, buffs: p.dynamicModifier + (crit ? p.critOnlyModifier : 0) },
        })
        perCoinMean[w.coinIndex] += damage * prob
        const total = w.total + damage
        let crossed = w.thresholdsCrossed
        while (crossed < staggerLines.length && total >= staggerLines[crossed]) {
          staggerChance[crossed] += prob
          crossed++
        }
        stack.push({
          coinIndex: w.coinIndex + 1,
          headsSoFar,
          total,
          thresholdsCrossed: crossed,
          poiseCount: crit ? w.poiseCount - 1 : w.poiseCount,
          prob,
        })
      }
    }
  }
  return summarize(histogram, perCoinMean, staggerChance)
}

/** Combine several conditional distributions into one by weight. Weights should sum to 1. */
export function mixDistributions(parts: { weight: number; summary: DamageSummary }[]): DamageSummary {
  const histogram = new Map<number, number>()
  const coins = Math.max(0, ...parts.map(x => x.summary.perCoinMean.length))
  const perCoinMean = new Array<number>(coins).fill(0)
  const thresholds = Math.max(0, ...parts.map(x => x.summary.staggerChance.length))
  const staggerChance = new Array<number>(thresholds).fill(0)
  for (const { weight, summary } of parts) {
    if (weight === 0) continue
    for (const [value, prob] of summary.histogram) histogram.set(value, (histogram.get(value) ?? 0) + prob * weight)
    summary.perCoinMean.forEach((m, i) => { perCoinMean[i] += m * weight })
    summary.staggerChance.forEach((c, i) => { staggerChance[i] += c * weight })
  }
  return summarize(histogram, perCoinMean, staggerChance)
}

function summarize(histogram: Map<number, number>, perCoinMean: number[], staggerChance: number[]): DamageSummary {
  const entries = [...histogram.entries()].sort((x, y) => x[0] - y[0])
  if (entries.length === 0) entries.push([0, 1])
  const mass = entries.reduce((s, [, pr]) => s + pr, 0)
  const mean = entries.reduce((s, [v, pr]) => s + v * pr, 0) / mass
  const percentile = (q: number): number => {
    let acc = 0
    for (const [v, pr] of entries) {
      acc += pr / mass
      if (acc >= q - 1e-12) return v
    }
    return entries[entries.length - 1][0]
  }
  return {
    mean,
    p10: percentile(0.1),
    p50: percentile(0.5),
    p90: percentile(0.9),
    max: entries[entries.length - 1][0],
    perCoinMean: perCoinMean.map(m => m / mass),
    histogram: entries.map(([v, pr]) => [v, pr / mass] as [number, number]),
    staggerChance: staggerChance.map(c => c / mass),
  }
}
