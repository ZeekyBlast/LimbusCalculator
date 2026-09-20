import { calculateDynamicModifier, getEffectById, isEffectApplicable, sumCoinPowerBonus, sumCoinRollBonus, type EffectStack } from './statusEffects'
import type { Combatant, Condition, Effect, ResolvedCombatant, Skill, UptieTier } from './types'

const ACTIVE_TRIGGERS = new Set<Effect['trigger']>(['on-use', 'passive', 'combat-start'])
/** Registry slot whose stacks belong to the side being hit (Fragile/Protection and their typed variants). */
const TARGET_SIDE_SLOT = 'dynamic-additive-fragile-protection'

export function resolveCombatant(self: Combatant, opponent?: Combatant): ResolvedCombatant {
  const skill = applyUptie(self.skill, self.uptie)
  let basePower = skill.basePower + self.manual.basePower
  let coinPower = skill.coinPower + self.manual.coinPower
  let clashPowerBonus = self.manual.clashPower
  let damagePercent = self.manual.damagePercent
  const effectsApplied: string[] = []
  const effectsUnparsed: string[] = []

  const candidates = [...skill.effects, ...self.unit.passives.flatMap(p => p.effects)]
  for (const e of candidates) {
    if (e.op.kind === 'unparsed') { effectsUnparsed.push(e.source); continue }
    // Per-coin effects need the coin index the enumeration is on, which this flat resolve has no
    // room for. Surface them as unhandled rather than silently dropping them, whatever the trigger.
    if (e.scope !== 'skill') { effectsUnparsed.push(e.source); continue }
    if (!ACTIVE_TRIGGERS.has(e.trigger)) continue
    if (e.condition && !holds(e.condition, self, opponent)) continue
    switch (e.op.kind) {
      case 'coinPower': coinPower += e.op.delta; break
      case 'basePower': basePower += e.op.delta; break
      case 'clashPower': clashPowerBonus += e.op.delta; break
      case 'damagePercent': damagePercent += e.op.delta; break
      case 'applyStatus': continue
    }
    effectsApplied.push(e.source)
  }

  const stacks: EffectStack[] = Object.entries(self.status).map(([effectId, v]) => ({ effectId, stacks: v.potency }))
  // Bucket by registry slot, not by id: every Fragile/Protection variant belongs to the side being
  // hit. Ids missing from the registry fall to the attacker side and contribute 0 there anyway.
  // Scoped variants (Fragile (Slash), Damage Up (Pride), ...) only count for a matching attack:
  // the attacker's own stacks against its own skill, the Fragile family against the opponent's.
  const myAttack = { damageType: skill.damageType, sin: skill.sin }
  const theirAttack = opponent ? { damageType: opponent.skill.damageType, sin: opponent.skill.sin } : undefined
  const targetStacks = stacks.filter(s => getEffectById(s.effectId)?.slot === TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, theirAttack))
  const attackerStacks = stacks.filter(s => getEffectById(s.effectId)?.slot !== TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, myAttack))
  // Coin Boost / Coin Drop modify Coin Power itself, so they land after effects and manual overrides.
  coinPower += sumCoinPowerBonus(attackerStacks)
  const poise = self.status['poise'] ?? { potency: 0, count: 0 }
  const sanity = Math.min(45, Math.max(-45, self.sanity))

  // The [-1, 1] clamps inside calculateDynamicModifier apply per side: the attacker's Damage
  // Up/Down is clamped separately from the target's Fragile/Protection, never as one pooled sum.
  // That only diverges from clamping the pool once a single side exceeds the clamp on its own.
  const dynamicAsAttacker = calculateDynamicModifier(attackerStacks, false)
  const dynamicAsTarget = calculateDynamicModifier(targetStacks, false)
  const critOnlyModifier = calculateDynamicModifier(attackerStacks, true) - dynamicAsAttacker

  return {
    basePower,
    coinPower,
    coinCount: skill.coinCount,
    unbreakableCoins: countUnbreakableCoins(skill),
    headsChance: (50 + sanity) / 100,
    offenseLevel: self.level + skill.offenseLevelMod,
    defenseLevel: self.level + self.unit.defenseMod,
    clashPowerBonus,
    damagePercent,
    coinRollBonus: sumCoinRollBonus(attackerStacks),
    critChance: Math.min(1, poise.potency * 0.05),
    poiseCount: poise.count,
    dynamicAsAttacker,
    critOnlyModifier,
    dynamicAsTarget,
    maxHp: self.unit.hp,
    currentHp: self.currentHp ?? self.unit.hp,
    sin: skill.sin,
    damageType: skill.damageType,
    effectsApplied,
    effectsUnparsed,
  }
}

/**
 * Unbreakable coins are 0-based indices into the skill's coins. Scraped data can repeat an index
 * or point past the last coin, so only distinct in-range integers count - otherwise the clash
 * chain would size its coin pool from indices that name no real coin.
 */
function countUnbreakableCoins(skill: Skill): number {
  const seen = new Set<number>()
  for (const i of skill.unbreakableCoins) {
    if (Number.isInteger(i) && i >= 0 && i < skill.coinCount) seen.add(i)
  }
  return seen.size
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

function holds(c: Condition, self: Combatant, opponent?: Combatant): boolean {
  const owner = c.side === 'self' ? self : opponent
  if (!owner) return false
  const actual = owner.status[c.stat]?.[c.field] ?? 0
  switch (c.op) {
    case '>=': return actual >= c.value
    case '>': return actual > c.value
    case '<=': return actual <= c.value
    case '<': return actual < c.value
    case '==': return actual === c.value
  }
}
