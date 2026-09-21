import { computeFinalDamage } from './damage'
import { staggerDamageTypeResistanceModifier } from './resistance'
import type { AttackShape } from './statusEffects'
import { averagePairs, clonePair, conditionHolds, consume, critChanceOf, grant, mixStatusAfter, stackModifiers, type StackModifiers } from './statusState'
import type { DamageSummary, Effect, SidePair, StatusAfter } from './types'

export interface AttackParams {
  /** How many coins attack: the survivors of the clash (all of them when unopposed). */
  coins: number
  /** Coins the skill has; `coins <= coinCount`. */
  coinCount: number
  /** 0-based indices of Unbreakable coins. */
  unbreakableCoins: number[]
  /** Skill + uptie + manual + unconditional effects. Stacks and standing conditions are added per coin from `status`. */
  basePower: number
  coinPower: number
  headsChance: number
  critModifier: number
  sinResistance: number
  damageTypeResistance: number
  offenseDefenseAdvantage: number
  parryBonus: number
  /** Flat damage % from manual overrides and unconditional effects. Damage Up / Fragile stacks are read from `status` per coin. */
  dynamicModifier: number
  /** Statuses at the start of the attack: `self` is the attacker, `target` the defender. Never mutated. */
  status: SidePair
  /** The attacking skill's shape, for type- and sin-scoped stacks. */
  attackerSkill?: AttackShape
  /** Parsed effects by original coin index. */
  coinEffects: Effect[][]
  /** Skill-level flat ops re-evaluated before every coin (standing conditions, crit-only damage, clash-win bonuses). */
  conditionalBonuses: Effect[]
  /** Skill-level grants applied once after the last coin, if any coin attacked. */
  attackEndGrants: Effect[]
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
  /** Position in the surviving-coin list. */
  pos: number
  /** Coin Power banked by every heads so far, each at the Coin Power in force when it flipped. */
  powerFromHeads: number
  total: number
  thresholdsCrossed: number
  reductionLeft: number
  prob: number
  status: SidePair
}

export interface SampledCoin {
  /** Original coin index (a coin that broke in the clash is absent). */
  index: number
  heads: boolean
  crit: boolean
  roll: number
  damage: number
  /** Fixed damage added by the Rupture tick on this hit. */
  rupture: number
  staggered: boolean
  /** Sources of the grants this coin applied. */
  grants: string[]
}
export interface SampledAttack { coins: SampledCoin[]; total: number; thresholdsCrossed: number; statusAfter: SidePair }

/**
 * Coins that attack after a clash, ascending by original index: every Unbreakable coin plus the
 * highest-indexed breakable coins, because breakable coins break lowest first ("coins break from
 * lowest to highest": community guide https://steamcommunity.com/sharedfiles/filedetails/?id=3003880251,
 * not the wiki). A skill whose coins are all Unbreakable clashes as if they were breakable (see
 * clashChain's normalizeCoins), so it loses them the same way.
 */
export function survivingCoins(coinCount: number, coins: number, unbreakable: number[]): number[] {
  const all = Array.from({ length: coinCount }, (_, i) => i)
  if (coins >= coinCount) return all
  const u = new Set(unbreakable.filter(i => Number.isInteger(i) && i >= 0 && i < coinCount))
  if (u.size === coinCount) u.clear()
  const breakable = all.filter(i => !u.has(i))
  const keep = Math.max(0, coins - u.size)
  const kept = new Set([...u, ...breakable.slice(breakable.length - keep)])
  const out = all.filter(i => kept.has(i))
  return out.length > coins ? out.slice(out.length - coins) : out
}

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

/** Damage of one coin given its (possibly reduced) roll, the dynamic modifier in force, and the walk state before it. */
function coinDamage(p: AttackParams, coinRoll: number, crit: boolean, thresholdsCrossed: number, absorbed: boolean, dynamic: number): number {
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
    dynamicModifiers: { skillEffects: 0, buffs: dynamic },
  })
}

/** Which per-coin triggers fire on this branch. Anything not tied to the flip or the crit fires on every landing coin. */
function fires(trigger: Effect['trigger'], heads: boolean, crit: boolean): boolean {
  switch (trigger) {
    case 'heads-hit': return heads
    case 'tails-hit': return !heads
    case 'on-crit': return crit
    default: return true
  }
}

interface Bonus { basePower: number; coinPower: number; damagePercent: number }

/** Standing conditions and this coin's own flat ops, judged against the status as the coin is about to flip. */
function coinBonuses(p: AttackParams, coin: number, status: SidePair, heads: boolean, crit: boolean): Bonus {
  const b: Bonus = { basePower: 0, coinPower: 0, damagePercent: 0 }
  for (const e of [...p.conditionalBonuses, ...(p.coinEffects[coin] ?? [])]) {
    if (e.op.kind !== 'coinPower' && e.op.kind !== 'basePower' && e.op.kind !== 'damagePercent') continue
    if (!fires(e.trigger, heads, crit)) continue
    if (e.condition && !conditionHolds(e.condition, status, 'self')) continue
    b[e.op.kind] += e.op.delta
  }
  return b
}

/**
 * The coin lands. Rupture: "When hit by an attack, take fixed damage by the effect's Potency. Then,
 * reduce its Count by 1." (https://limbuscompany.wiki.gg/wiki/Rupture). A crit consumes one Poise
 * count (https://limbuscompany.wiki.gg/wiki/Poise). Returns the tick's fixed damage.
 */
function land(status: SidePair, crit: boolean): number {
  const r = status.target.rupture
  let rupture = 0
  if (r && r.count >= 1) {
    rupture = r.potency
    consume(status.target, 'rupture')
  }
  if (crit) consume(status.self, 'poise')
  return rupture
}

/** This coin's grants, judged together against the status after the coin landed, then applied. */
function coinGrants(p: AttackParams, coin: number, status: SidePair, heads: boolean, crit: boolean): string[] {
  const before = clonePair(status)
  const applied: string[] = []
  for (const e of p.coinEffects[coin] ?? []) {
    if (e.op.kind !== 'applyStatus') continue
    if (!fires(e.trigger, heads, crit)) continue
    if (e.condition && !conditionHolds(e.condition, before, 'self')) continue
    grant(status, e.op, 'self')
    applied.push(e.source)
  }
  return applied
}

function attackEnd(p: AttackParams, status: SidePair): SidePair {
  if (p.attackEndGrants.length === 0) return status
  const out = clonePair(status)
  for (const e of p.attackEndGrants) {
    if (e.op.kind !== 'applyStatus') continue
    if (e.condition && !conditionHolds(e.condition, status, 'self')) continue
    grant(out, e.op, 'self')
  }
  return out
}

interface Step { roll: number; damage: number; rupture: number; grants: string[]; staggered: boolean; crossedNow: number[]; next: Walk }

/** One coin on one branch: bonuses, roll, damage, landing, grants, stagger lines. */
function step(p: AttackParams, lines: number[], coin: number, heads: boolean, crit: boolean, w: Walk, prob: number, m: StackModifiers): Step {
  const status = clonePair(w.status)
  const b = coinBonuses(p, coin, status, heads, crit)
  // A heads banks the Coin Power in force when it flipped; a bonus that switches on later does not rewrite it.
  const coinPowerNow = p.coinPower + m.coinPowerBonus + b.coinPower
  const powerFromHeads = w.powerFromHeads + (heads ? coinPowerNow : 0)
  const { roll, left, absorbed } = absorb(p.basePower + b.basePower + m.coinRollBonus + powerFromHeads, w.reductionLeft)
  const staggered = p.staggerMidAttack && w.thresholdsCrossed > 0
  // Stacks summed first so an unchanged status reproduces the pre-change engine's floating-point result exactly.
  const dynamic = (m.attackerDynamic + m.targetDynamic) + (p.dynamicModifier + b.damagePercent) + (crit ? m.critOnly : 0)
  const damage = coinDamage(p, roll, crit, w.thresholdsCrossed, absorbed, dynamic)
  // An absorbed coin still lands: its hit effects fire and Rupture ticks.
  const rupture = land(status, crit)
  const grants = coinGrants(p, coin, status, heads, crit)
  const total = w.total + damage + rupture
  let crossed = w.thresholdsCrossed
  const crossedNow: number[] = []
  while (crossed < lines.length && total >= lines[crossed]) {
    crossedNow.push(crossed)
    crossed++
  }
  return {
    roll, damage, rupture, grants, staggered, crossedNow,
    next: { pos: w.pos + 1, powerFromHeads, total, thresholdsCrossed: crossed, reductionLeft: left, prob, status },
  }
}

function start(p: AttackParams, alreadyCrossed: number): Walk {
  return { pos: 0, powerFromHeads: 0, total: 0, thresholdsCrossed: alreadyCrossed, reductionLeft: p.powerReduction ?? 0, prob: 1, status: clonePair(p.status) }
}

/** Exact distribution of total damage for a one-sided attack, enumerating every heads/crit sequence of the surviving coins. */
export function attackDamageDistribution(p: AttackParams): DamageSummary {
  const survivors = survivingCoins(p.coinCount, p.coins, p.unbreakableCoins)
  const histogram = new Map<number, number>()
  const perCoinMean = new Array<number>(p.coinCount).fill(0)
  const staggerChance = new Array<number>(p.staggerThresholds.length).fill(0)
  const { lines, alreadyCrossed } = staggerLinesFor(p)
  const terminal: { pair: SidePair; prob: number }[] = []

  const stack: Walk[] = [start(p, alreadyCrossed)]
  while (stack.length > 0) {
    const w = stack.pop()!
    if (w.pos === survivors.length) {
      histogram.set(w.total, (histogram.get(w.total) ?? 0) + w.prob)
      terminal.push({ pair: survivors.length > 0 ? attackEnd(p, w.status) : w.status, prob: w.prob })
      continue
    }
    const coin = survivors[w.pos]
    const m = stackModifiers(w.status, p.attackerSkill)
    const critChance = critChanceOf(w.status.self)
    for (const heads of [true, false]) {
      const pHeads = heads ? p.headsChance : 1 - p.headsChance
      if (pHeads === 0) continue
      for (const crit of [true, false]) {
        const pCrit = crit ? critChance : 1 - critChance
        if (pCrit === 0) continue
        const prob = w.prob * pHeads * pCrit
        const s = step(p, lines, coin, heads, crit, w, prob, m)
        perCoinMean[coin] += (s.damage + s.rupture) * prob
        for (const k of s.crossedNow) staggerChance[k] += prob
        stack.push(s.next)
      }
    }
  }
  return summarize(histogram, perCoinMean, staggerChance, averagePairs(terminal))
}

/** One random path through the same walk `attackDamageDistribution` enumerates (for "Roll once"). */
export function sampleAttack(p: AttackParams, rng: () => number = Math.random): SampledAttack {
  const survivors = survivingCoins(p.coinCount, p.coins, p.unbreakableCoins)
  const { lines, alreadyCrossed } = staggerLinesFor(p)
  let w = start(p, alreadyCrossed)
  const coins: SampledCoin[] = []
  for (const coin of survivors) {
    const m = stackModifiers(w.status, p.attackerSkill)
    const critChance = critChanceOf(w.status.self)
    const heads = rng() < p.headsChance
    // Draw for the crit only while a Poise count is left, as the pre-change sampler did.
    const crit = (w.status.self.poise?.count ?? 0) > 0 && rng() < critChance
    const s = step(p, lines, coin, heads, crit, w, 1, m)
    coins.push({ index: coin, heads, crit, roll: s.roll, damage: s.damage, rupture: s.rupture, staggered: s.staggered, grants: s.grants })
    w = s.next
  }
  return { coins, total: w.total, thresholdsCrossed: w.thresholdsCrossed - alreadyCrossed, statusAfter: survivors.length > 0 ? attackEnd(p, w.status) : w.status }
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
  const statusAfter = mixStatusAfter(parts.map(x => ({ weight: x.weight, after: x.summary.statusAfter })))
  return summarize(histogram, perCoinMean, staggerChance, statusAfter)
}

function summarize(histogram: Map<number, number>, perCoinMean: number[], staggerChance: number[], statusAfter: StatusAfter): DamageSummary {
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
    statusAfter,
  }
}
