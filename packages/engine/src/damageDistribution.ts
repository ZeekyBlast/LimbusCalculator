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
  /**
   * Flat power a lost guard clash strips from this attack (spec 6.2). Absorbed by the earliest
   * coins first: a coin whose whole roll is absorbed deals 0, the remainder carries to the next.
   * Default 0.
   */
  powerReduction?: number
}

interface Walk {
  coinIndex: number
  headsSoFar: number
  total: number
  thresholdsCrossed: number
  poiseCount: number
  reductionLeft: number
  prob: number
}

export interface SampledCoin { heads: boolean; crit: boolean; roll: number; damage: number; staggered: boolean }
export interface SampledAttack { coins: SampledCoin[]; total: number; thresholdsCrossed: number }

/** Absolute damage lines for the stagger thresholds, and how many already sit behind current HP. */
function staggerLinesFor(p: AttackParams): { lines: number[]; alreadyCrossed: number } {
  const lines = p.staggerThresholds.map(t => p.defenderCurrentHp - t * p.defenderMaxHp)
  // A line at or below 0 sits behind the defender's current HP: that stagger threshold was broken
  // before this attack began. Seed the walk past those lines so every coin already benefits from
  // the stagger multiplier, and leave their staggerChance at 0 - this attack did not cause them.
  // staggerThresholds is descending, so the already-crossed lines are the leading ones.
  let alreadyCrossed = 0
  while (alreadyCrossed < lines.length && lines[alreadyCrossed] <= 0) alreadyCrossed++
  return { lines, alreadyCrossed }
}

/**
 * Takes as much of `left` as this coin's roll can absorb. `absorbed` means the whole roll went, so
 * the coin deals nothing - including a roll of 0 or below, which must not slip past the reduction
 * and pick up the 1-damage floor. `used` is clamped at 0 so a negative roll cannot credit power
 * back into the pool and leave more reduction for the coins behind it.
 */
function absorb(roll: number, left: number): { roll: number; left: number; absorbed: boolean } {
  const used = Math.max(0, Math.min(roll, left))
  return { roll: roll - used, left: left - used, absorbed: left > 0 && roll - used <= 0 }
}

/** Damage of one coin given its (possibly reduced) roll and the walk state before it. */
function coinDamage(p: AttackParams, coinRoll: number, crit: boolean, thresholdsCrossed: number, absorbed: boolean): number {
  if (absorbed) return 0
  const staggered = p.staggerMidAttack && thresholdsCrossed > 0
  return computeFinalDamage({
    coinRoll,
    staticModifiers: {
      sinResistance: p.sinResistance,
      damageTypeResistance: staggered ? staggerDamageTypeResistanceModifier(thresholdsCrossed) : p.damageTypeResistance,
      offenseDefenseAdvantage: p.offenseDefenseAdvantage,
      parryBonus: p.parryBonus,
      critical: crit ? p.critModifier : 0,
    },
    dynamicModifiers: { skillEffects: 0, buffs: p.dynamicModifier + (crit ? p.critOnlyModifier : 0) },
  })
}

/** Exact distribution of total damage for a one-sided attack with `coins` coins, enumerating every heads/crit sequence. */
export function attackDamageDistribution(p: AttackParams): DamageSummary {
  const histogram = new Map<number, number>()
  const perCoinMean = new Array<number>(p.coins).fill(0)
  const staggerChance = new Array<number>(p.staggerThresholds.length).fill(0)
  const { lines: staggerLines, alreadyCrossed } = staggerLinesFor(p)

  const stack: Walk[] = [{ coinIndex: 0, headsSoFar: 0, total: 0, thresholdsCrossed: alreadyCrossed, poiseCount: p.poiseCount, reductionLeft: p.powerReduction ?? 0, prob: 1 }]
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
        const { roll, left, absorbed } = absorb(p.basePower + p.coinRollBonus + p.coinPower * headsSoFar, w.reductionLeft)
        const damage = coinDamage(p, roll, crit, w.thresholdsCrossed, absorbed)
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
          reductionLeft: left,
          prob,
        })
      }
    }
  }
  return summarize(histogram, perCoinMean, staggerChance)
}

/** One random path through the same walk `attackDamageDistribution` enumerates (for "Roll once"). */
export function sampleAttack(p: AttackParams, rng: () => number = Math.random): SampledAttack {
  const { lines: staggerLines, alreadyCrossed } = staggerLinesFor(p)
  let crossed = alreadyCrossed
  let headsSoFar = 0
  let total = 0
  let poiseCount = p.poiseCount
  let reductionLeft = p.powerReduction ?? 0
  const coins: SampledCoin[] = []
  for (let i = 0; i < p.coins; i++) {
    const heads = rng() < p.headsChance
    const crit = poiseCount > 0 && rng() < Math.min(1, p.critChance)
    if (heads) headsSoFar++
    const { roll, left, absorbed } = absorb(p.basePower + p.coinRollBonus + p.coinPower * headsSoFar, reductionLeft)
    reductionLeft = left
    const staggered = p.staggerMidAttack && crossed > 0
    const damage = coinDamage(p, roll, crit, crossed, absorbed)
    total += damage
    while (crossed < staggerLines.length && total >= staggerLines[crossed]) crossed++
    if (crit) poiseCount--
    coins.push({ heads, crit, roll, damage, staggered })
  }
  return { coins, total, thresholdsCrossed: crossed - alreadyCrossed }
}

/**
 * Combine several conditional distributions into one by weight.
 *
 * `perCoinMean[i]` is the unconditional contribution of coin i - the mean damage coin i adds
 * across every outcome, not conditional on reaching that coin - so parts with fewer coins are
 * zero-padded and `sum(perCoinMean)` equals `mean`. Weights need not sum to 1: `summarize`
 * normalizes everything by the total mass it is handed.
 */
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
