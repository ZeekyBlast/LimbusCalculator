import { clonePair, conditionHolds, grant, stackModifiers, type GrantOp, type Owner } from './statusState'
import type { Combatant, Condition, Effect, EffectTrigger, ResolvedCombatant, SidePair, Skill, UptieTier } from './types'

/** Triggers that fire before the clash. Their grants land on the working status at prepare. */
const PRE_CLASH = new Set<EffectTrigger>(['on-use', 'combat-start', 'passive'])
/** Per-coin triggers. A skill-level grant with one of these acts on every coin. */
const HIT = new Set<EffectTrigger>(['on-hit', 'heads-hit', 'tails-hit', 'on-crit'])

type FlatOp = Extract<Effect['op'], { kind: 'coinPower' | 'basePower' | 'clashPower' | 'damagePercent' }>
type GrantLine = Effect & { op: GrantOp }
type FlatLine = Effect & { op: FlatOp }
const isGrant = (e: Effect): e is GrantLine => e.op.kind === 'applyStatus'
const isFlat = (e: Effect): e is FlatLine =>
  e.op.kind === 'coinPower' || e.op.kind === 'basePower' || e.op.kind === 'clashPower' || e.op.kind === 'damagePercent'

function ownLines(c: Combatant, skill: Skill | undefined): Effect[] {
  return [...(skill?.effects ?? []), ...c.unit.passives.flatMap(p => p.effects)]
}

/**
 * Prepare one side for a clash: apply every pre-clash grant of both sides to a working status
 * pair, then read this side's flat numbers off it. Untagged conditional lines are standing
 * conditions: they are evaluated against the status after those grants, not in text order
 * ("Skill Effect Order Clarification" in the community guide
 * https://steamcommunity.com/sharedfiles/filedetails/?id=3003880251, not the wiki), and the
 * attack walk re-evaluates them before every coin.
 */
export function resolveCombatant(self: Combatant, opponent?: Combatant): ResolvedCombatant {
  const skill = self.skill ? applyUptie(self.skill, self.uptie) : undefined
  const oppSkill = opponent?.skill ? applyUptie(opponent.skill, opponent.uptie) : undefined
  const mine = ownLines(self, skill)
  const theirs = opponent ? ownLines(opponent, oppSkill) : []
  const pair: SidePair = clonePair({ self: self.status, target: opponent?.status ?? {} })
  const coinCount = skill?.coinCount ?? 0

  const effectsApplied: string[] = []
  const effectsUnparsed: string[] = []
  const effectsPerCoin: string[] = []
  const effectsPending: string[] = []
  const conditionalBonuses: Effect[] = []
  const coinEffects: Effect[][] = Array.from({ length: coinCount }, () => [])
  const grants: ResolvedCombatant['grants'] = { clashWin: [], clashLose: [], attackEnd: [] }
  const flat = {
    basePower: (skill?.basePower ?? 0) + self.manual.basePower,
    coinPower: (skill?.coinPower ?? 0) + self.manual.coinPower,
    damagePercent: self.manual.damagePercent,
  }
  let clashPowerBonus = self.manual.clashPower

  // Target-side conditions are false with no opponent, even ones an absent status would satisfy.
  const holds = (c: Condition, owner: Owner): boolean => (c.side === 'target' && !opponent ? false : conditionHolds(c, pair, owner))

  const addFlat = (op: FlatOp, into: { basePower: number; coinPower: number; damagePercent: number }): void => {
    switch (op.kind) {
      case 'coinPower': into.coinPower += op.delta; break
      case 'basePower': into.basePower += op.delta; break
      case 'clashPower': clashPowerBonus += op.delta; break
      case 'damagePercent': into.damagePercent += op.delta; break
    }
  }

  const preGrants: GrantLine[] = []
  const standing: FlatLine[] = []
  for (const e of mine) {
    if (e.op.kind === 'unparsed') { effectsUnparsed.push(e.source); continue }
    if (e.scope !== 'skill') {
      if (e.scope.coin >= 0 && e.scope.coin < coinCount) {
        coinEffects[e.scope.coin].push(e)
        effectsPerCoin.push(e.source)
      } else {
        effectsUnparsed.push(e.source)
      }
      continue
    }
    if (HIT.has(e.trigger) && isGrant(e)) {
      for (const coin of coinEffects) coin.push(e)
      effectsPerCoin.push(e.source)
      continue
    }
    if (e.trigger === 'clash-win') { grants.clashWin.push(e); effectsPending.push(e.source); continue }
    if (e.trigger === 'clash-lose') { grants.clashLose.push(e); effectsPending.push(e.source); continue }
    if (e.trigger === 'attack-end' && isGrant(e)) { grants.attackEnd.push(e); effectsPending.push(e.source); continue }
    if (e.trigger === 'on-crit' && e.op.kind === 'damagePercent') {
      // The parser's crit-only damage: it acts on the crit branch of each coin.
      conditionalBonuses.push(e)
      effectsPerCoin.push(e.source)
      continue
    }
    if (!PRE_CLASH.has(e.trigger)) continue
    if (isGrant(e)) { preGrants.push(e); continue }
    if (!isFlat(e)) continue
    if (e.condition) { standing.push(e); continue }
    addFlat(e.op, flat)
    effectsApplied.push(e.source)
  }

  // Grants accumulate in any order, so unconditional ones of both sides land first. Conditional
  // grants are then judged together against that state: none of them sees another's effect.
  const theirPreGrants = theirs.filter((e): e is GrantLine => e.scope === 'skill' && PRE_CLASH.has(e.trigger) && isGrant(e))
  const conditionalGrants: [GrantLine, Owner][] = []
  const sides: [GrantLine[], Owner][] = [[preGrants, 'self'], [theirPreGrants, 'target']]
  for (const [list, owner] of sides) {
    for (const e of list) {
      if (e.condition) { conditionalGrants.push([e, owner]); continue }
      grant(pair, e.op, owner)
      if (owner === 'self') effectsApplied.push(e.source)
    }
  }
  const decided = conditionalGrants.map(([e, owner]) => [e, owner, holds(e.condition!, owner)] as const)
  for (const [e, owner, ok] of decided) {
    if (!ok) continue
    grant(pair, e.op, owner)
    if (owner === 'self') effectsApplied.push(e.source)
  }

  // Standing conditions at prepare: the clash uses these totals; the walk re-evaluates them per coin.
  const totals = { ...flat }
  for (const e of standing) {
    if (e.op.kind !== 'clashPower') conditionalBonuses.push(e)
    if (!holds(e.condition!, 'self')) continue
    addFlat(e.op, totals)
    effectsApplied.push(e.source)
  }

  const myAttack = skill ? { damageType: skill.damageType, sin: skill.sin } : undefined
  const theirAttack = oppSkill ? { damageType: oppSkill.damageType, sin: oppSkill.sin } : undefined
  const m = stackModifiers(pair, myAttack)
  const asTarget = stackModifiers({ self: pair.target, target: pair.self }, theirAttack).targetDynamic
  const poise = pair.self.poise ?? { potency: 0, count: 0 }
  const sanity = Math.min(45, Math.max(-45, self.sanity))
  const unbreakableCoinIndices = skill ? unbreakableIndices(skill) : []

  return {
    basePower: totals.basePower,
    // Coin Boost / Coin Drop modify Coin Power itself, so they land after effects and manual overrides.
    coinPower: totals.coinPower + m.coinPowerBonus,
    coinCount,
    unbreakableCoins: unbreakableCoinIndices.length,
    headsChance: (50 + sanity) / 100,
    offenseLevel: self.level + (skill?.offenseLevelMod ?? 0),
    defenseLevel: self.level + self.unit.defenseMod,
    clashPowerBonus,
    damagePercent: totals.damagePercent,
    coinRollBonus: m.coinRollBonus,
    critChance: Math.min(1, poise.potency * 0.05),
    poiseCount: poise.count,
    dynamicAsAttacker: m.attackerDynamic,
    critOnlyModifier: m.critOnly,
    dynamicAsTarget: asTarget,
    maxHp: self.unit.hp,
    currentHp: self.currentHp ?? self.unit.hp,
    sin: skill?.sin ?? 'wrath',
    damageType: skill?.damageType ?? 'none',
    effectsApplied,
    effectsUnparsed,
    effectsPerCoin,
    effectsPending,
    flat,
    conditionalBonuses,
    coinEffects,
    grants,
    statusAfterPrepare: pair,
    unbreakableCoinIndices,
  }
}

/**
 * Unbreakable coins are 0-based indices into the skill's coins. Scraped data can repeat an index
 * or point past the last coin, so only distinct in-range integers count - otherwise the clash
 * chain would size its coin pool from indices that name no real coin.
 */
function unbreakableIndices(skill: Skill): number[] {
  const seen = new Set<number>()
  for (const i of skill.unbreakableCoins) {
    if (Number.isInteger(i) && i >= 0 && i < skill.coinCount) seen.add(i)
  }
  return [...seen].sort((x, y) => x - y)
}

function applyUptie(skill: Skill, tier: UptieTier): Skill {
  let out = { ...skill }
  for (const t of [1, 2, 3, 4] as UptieTier[]) {
    if (t > tier) break
    const o = skill.uptie[t]
    if (!o) continue
    if (o.basePower !== undefined) out = { ...out, basePower: o.basePower }
    if (o.coinPower !== undefined) out = { ...out, coinPower: o.coinPower }
    if (o.effects !== undefined) out = { ...out, effects: o.effects }
  }
  return out
}
