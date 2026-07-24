import { useState } from 'react'
import {
  simulateClash,
  flipCoins,
  offenseDefenseAdvantage,
  parryRoundBonus,
  computeFinalDamage,
  headsChance,
  clashPowerLevelBonus,
  calculateDynamicModifier,
  sumCoinRollBonus,
  sumCoinPowerBonus,
  resolveBleedThroughRounds,
  resolveRuptureOverHits,
  resolveBurnTrigger,
  resolvePoiseCrit,
  criticalDamageModifier,
  parseSkillGrants,
  isEffectApplicable,
  clampAilmentValue,
  type ClashResult,
  type SkillGrant,
} from '@formula/index'
import { toEffectStacks, type CombatantEffectsSetup } from './effectSetup'
import { applyHpDamage, type SideBattleState } from './battleState'
import type { Skill } from '../types'

export interface ResolvedCombatant {
  label: string
  name: string
  /** Raw identity title, used to resolve sprite pose images - kept separate from the display `name`. */
  title: string
  basePower: number
  coinPower: number
  coinCount: number
  unbreakableCoinCount: number
  offenseLevel: number
  defenseLevel: number
  sanityPoints: number
  /** This combatant's own resistance, used when THEY are the one hit (i.e. they lost the clash). */
  sinResistanceModifier: number
  damageTypeResistanceModifier: number
}

export interface OneSidedCoinResult {
  heads: boolean
  coinRoll: number
  damage: number
  isCrit: boolean
}

export interface FullClashResult {
  clash: ClashResult
  winner: ResolvedCombatant
  loser: ResolvedCombatant
  coins: OneSidedCoinResult[]
  totalDamage: number
  /** Self-inflicted Bleed damage, ticked once per coin each side tosses across every round of the clash - independent of who wins. */
  attackerBleedDamage: number
  defenderBleedDamage: number
  /** Rupture damage on the loser only, once per post-win coin (each is one "hit"). 0 on a draw. */
  ruptureDamage: number
  /** Turn End Burn tick, applied after the clash's own damage/triggers - 0 for a side with no Burn Count left, or already defeated. */
  attackerBurnDamage: number
  defenderBurnDamage: number
}

export type ClashPhase = 'idle' | 'clashing' | 'revealing' | 'done'
export type Pose = 'idle' | 'moving' | 'hurt'

/** Expected Clash Power for one round: what the forecast panel shows before a Clash is run - same terms simulateClash compares each round, just pre-averaged over the coin flip instead of rolled. */
export function expectedRoundPower(c: ResolvedCombatant, opponentOffenseLevel: number): number {
  const levelBonus = clashPowerLevelBonus(c.offenseLevel, opponentOffenseLevel)
  return c.basePower + levelBonus + c.coinCount * headsChance(c.sanityPoints) * c.coinPower
}

interface RunResult {
  result: FullClashResult
  nextAttackerEffects: CombatantEffectsSetup
  nextDefenderEffects: CombatantEffectsSetup
}

/** Additively folds one parsed skill grant into an effects object - stack grants into `.stacks`, potency/count grants into the matching AilmentState/PoiseState field, both clamped [0,99] like the manual editor already does. */
function applyGrant(effects: CombatantEffectsSetup, grant: SkillGrant, amount: number): CombatantEffectsSetup {
  if (grant.dimension === 'stack') {
    return { ...effects, stacks: { ...effects.stacks, [grant.effectId]: (effects.stacks[grant.effectId] ?? 0) + amount } }
  }
  const field = grant.effectId as 'bleed' | 'burn' | 'rupture' | 'poise'
  const current = effects[field]
  const next =
    grant.dimension === 'potency'
      ? { ...current, potency: clampAilmentValue(current.potency + amount) }
      : { ...current, count: clampAilmentValue(current.count + amount) }
  return { ...effects, [field]: next }
}

/** Applies every grant of one trigger from `grants`, routing each to `self`/`opponent` by its own target - used for On Use (both sides act every clash) and for the winner-only On Hit/On Crit grants (see runFullClash). */
function applyGrantsOfTrigger(
  grants: SkillGrant[],
  trigger: SkillGrant['trigger'],
  self: CombatantEffectsSetup,
  opponent: CombatantEffectsSetup,
  amountMultiplier: number,
): { self: CombatantEffectsSetup; opponent: CombatantEffectsSetup } {
  let nextSelf = self
  let nextOpponent = opponent
  for (const grant of grants) {
    if (grant.trigger !== trigger) continue
    const amount = grant.amount * amountMultiplier
    if (amount === 0) continue
    if (grant.target === 'self') nextSelf = applyGrant(nextSelf, grant, amount)
    else nextOpponent = applyGrant(nextOpponent, grant, amount)
  }
  return { self: nextSelf, opponent: nextOpponent }
}

function runFullClash(
  attacker: ResolvedCombatant,
  defender: ResolvedCombatant,
  attackerEffects: CombatantEffectsSetup,
  defenderEffects: CombatantEffectsSetup,
  attackerSkill: Skill,
  defenderSkill: Skill,
): RunResult {
  // On Use fires for both sides every clash, regardless of who wins - applied before anything
  // below reads attacker/defenderEffects, so it's already reflected in this clash's own math.
  const attackerOnUse = applyGrantsOfTrigger(parseSkillGrants(attackerSkill), 'on-use', attackerEffects, defenderEffects, 1)
  const defenderOnUse = applyGrantsOfTrigger(parseSkillGrants(defenderSkill), 'on-use', attackerOnUse.opponent, attackerOnUse.self, 1)
  attackerEffects = defenderOnUse.opponent
  defenderEffects = defenderOnUse.self

  const clash = simulateClash(
    {
      basePower: attacker.basePower,
      coinPower: attacker.coinPower,
      coinCount: attacker.coinCount,
      unbreakableCoinCount: attacker.unbreakableCoinCount,
      level: attacker.offenseLevel,
      sanityPoints: attacker.sanityPoints,
    },
    {
      basePower: defender.basePower,
      coinPower: defender.coinPower,
      coinCount: defender.coinCount,
      unbreakableCoinCount: defender.unbreakableCoinCount,
      level: defender.offenseLevel,
      sanityPoints: defender.sanityPoints,
    },
  )

  const winner = clash.winner === 'a' ? attacker : defender
  const loser = clash.winner === 'a' ? defender : attacker
  const winnerEffects = clash.winner === 'a' ? attackerEffects : defenderEffects
  const loserEffects = clash.winner === 'a' ? defenderEffects : attackerEffects
  const winnerSkill = clash.winner === 'a' ? attackerSkill : defenderSkill
  const winnerChance = (50 + Math.min(Math.max(winner.sanityPoints, -45), 45)) / 100
  const parryBonus = parryRoundBonus(clash.parryRounds)

  // Fragile/Protection live on whoever's getting hit (the loser); Damage Up/Down, Power Up, and
  // Coin Boost/Drop live on whoever's dealing the hit (the winner) - Syx's blog Md term (G+H)
  // combines both sides' contributions for a single damage instance, regardless of source.
  // Type/sin-scoped variants (Slash Fragility etc.) only apply when they match the resolving
  // skill's own damage type/sin - a Pierce skill never benefits from a Slash Fragility stack.
  const winnerStacks = toEffectStacks(winnerEffects).filter(s => isEffectApplicable(s.effectId, winnerSkill.damageType, winnerSkill.sin))
  const loserStacks = toEffectStacks(loserEffects).filter(s => isEffectApplicable(s.effectId, winnerSkill.damageType, winnerSkill.sin))
  const coinRollBonus = sumCoinRollBonus(winnerStacks)
  const coinPowerBonus = sumCoinPowerBonus(winnerStacks)

  const coins: OneSidedCoinResult[] = []
  let totalDamage = 0
  let poiseState = winnerEffects.poise

  if (clash.winner !== 'draw') {
    for (let i = 0; i < clash.winnerCoinsRemaining; i++) {
      const heads = flipCoins(1, winnerChance) === 1
      const crit = resolvePoiseCrit(poiseState)
      poiseState = crit.nextState
      const coinRoll = winner.basePower + (heads ? winner.coinPower + coinPowerBonus : 0) + coinRollBonus
      const dynamicModifier = calculateDynamicModifier([...winnerStacks, ...loserStacks], crit.isCrit)
      const damage = computeFinalDamage({
        coinRoll,
        staticModifiers: {
          sinResistance: loser.sinResistanceModifier,
          damageTypeResistance: loser.damageTypeResistanceModifier,
          offenseDefenseAdvantage: offenseDefenseAdvantage(winner.offenseLevel, loser.defenseLevel),
          parryBonus,
          critical: crit.isCrit ? criticalDamageModifier() : 0,
        },
        dynamicModifiers: { skillEffects: 0, buffs: dynamicModifier },
      })
      coins.push({ heads, coinRoll, damage, isCrit: crit.isCrit })
      totalDamage += damage
    }
  }

  const aBleed = resolveBleedThroughRounds(clash.rounds, attacker.coinCount, 'a', attackerEffects.bleed)
  const bBleed = resolveBleedThroughRounds(clash.rounds, defender.coinCount, 'b', defenderEffects.bleed)
  const rupture = clash.winner !== 'draw' ? resolveRuptureOverHits(coins.length, loserEffects.rupture) : { totalDamage: 0, nextState: loserEffects.rupture }

  const nextAttackerEffects: CombatantEffectsSetup = {
    ...attackerEffects,
    bleed: aBleed.nextState,
    rupture: clash.winner === 'b' ? rupture.nextState : attackerEffects.rupture,
    poise: clash.winner === 'a' ? poiseState : attackerEffects.poise,
  }
  const nextDefenderEffects: CombatantEffectsSetup = {
    ...defenderEffects,
    bleed: bBleed.nextState,
    rupture: clash.winner === 'a' ? rupture.nextState : defenderEffects.rupture,
    poise: clash.winner === 'b' ? poiseState : defenderEffects.poise,
  }

  // On Hit / On Crit only come from the winner's skill - only the winner's post-win coins are
  // individually resolved into `coins` in this sim, the loser's skill never lands a hit. Each
  // grant is multiplied by how many coins triggered it and folds into *next* clash's effects
  // (not this one) - matches the "next turn" phrasing most real On Hit/On Crit text already uses.
  const winnerGrants = parseSkillGrants(winnerSkill)
  const onHitApplied = applyGrantsOfTrigger(
    winnerGrants,
    'on-hit',
    clash.winner === 'a' ? nextAttackerEffects : nextDefenderEffects,
    clash.winner === 'a' ? nextDefenderEffects : nextAttackerEffects,
    coins.length,
  )
  const onCritApplied = applyGrantsOfTrigger(
    winnerGrants,
    'on-crit',
    onHitApplied.self,
    onHitApplied.opponent,
    coins.filter(c => c.isCrit).length,
  )
  const finalWinnerNextEffects = onCritApplied.self
  const finalLoserNextEffects = onCritApplied.opponent

  return {
    result: {
      clash,
      winner,
      loser,
      coins,
      totalDamage,
      attackerBleedDamage: aBleed.totalDamage,
      defenderBleedDamage: bBleed.totalDamage,
      ruptureDamage: rupture.totalDamage,
      // Burn is Turn End, not part of the clash itself - startClash() fills these in once it
      // knows whether each side is already defeated (runFullClash has no battle-state awareness).
      attackerBurnDamage: 0,
      defenderBurnDamage: 0,
    },
    nextAttackerEffects: clash.winner === 'a' ? finalWinnerNextEffects : finalLoserNextEffects,
    nextDefenderEffects: clash.winner === 'a' ? finalLoserNextEffects : finalWinnerNextEffects,
  }
}

/** Owns the clash run/reveal state machine so it can be shared by sibling components (both dossiers need `poseFor`, the center column needs the rest) instead of living inside one presentational component. */
export function useClash(
  attacker: ResolvedCombatant,
  defender: ResolvedCombatant,
  attackerEffects: CombatantEffectsSetup,
  defenderEffects: CombatantEffectsSetup,
  onEffectsConsumed: (attacker: CombatantEffectsSetup, defender: CombatantEffectsSetup) => void,
  attackerBattle: SideBattleState,
  defenderBattle: SideBattleState,
  onTurnResolved: (attacker: SideBattleState, defender: SideBattleState) => void,
  attackerSkill: Skill,
  defenderSkill: Skill,
) {
  const [phase, setPhase] = useState<ClashPhase>('idle')
  const [result, setResult] = useState<FullClashResult | null>(null)
  const [revealedCoins, setRevealedCoins] = useState(0)

  function startClash() {
    const run = runFullClash(attacker, defender, attackerEffects, defenderEffects, attackerSkill, defenderSkill)

    // Clash-phase HP damage: the loser takes the winner's coin damage plus their own Rupture;
    // Bleed applies to both sides regardless of who won (already reflected in these totals).
    // On a draw, totalDamage/ruptureDamage are both 0, so which side `loser` nominally points
    // to doesn't matter here.
    const attackerClashDamage =
      run.result.attackerBleedDamage + (run.result.loser.label === 'Attacker' ? run.result.totalDamage + run.result.ruptureDamage : 0)
    const defenderClashDamage =
      run.result.defenderBleedDamage + (run.result.loser.label === 'Defender' ? run.result.totalDamage + run.result.ruptureDamage : 0)

    let nextAttackerBattle = applyHpDamage(attackerBattle, attackerClashDamage)
    let nextDefenderBattle = applyHpDamage(defenderBattle, defenderClashDamage)

    // Turn End: Burn ticks after the clash's own triggers (Bleed per toss, Rupture per hit,
    // both already resolved above) - only for a side that's still standing.
    const nextAttackerEffects = { ...run.nextAttackerEffects }
    const nextDefenderEffects = { ...run.nextDefenderEffects }
    let attackerBurnDamage = 0
    let defenderBurnDamage = 0
    if (!nextAttackerBattle.defeated) {
      const burn = resolveBurnTrigger(nextAttackerEffects.burn)
      attackerBurnDamage = burn.damage
      nextAttackerEffects.burn = burn.nextState
      nextAttackerBattle = applyHpDamage(nextAttackerBattle, burn.damage)
    }
    if (!nextDefenderBattle.defeated) {
      const burn = resolveBurnTrigger(nextDefenderEffects.burn)
      defenderBurnDamage = burn.damage
      nextDefenderEffects.burn = burn.nextState
      nextDefenderBattle = applyHpDamage(nextDefenderBattle, burn.damage)
    }

    setResult({ ...run.result, attackerBurnDamage, defenderBurnDamage })
    onEffectsConsumed(nextAttackerEffects, nextDefenderEffects)
    onTurnResolved(nextAttackerBattle, nextDefenderBattle)
    setRevealedCoins(0)
    setPhase('clashing')
  }

  function reset() {
    setPhase('idle')
    setResult(null)
    setRevealedCoins(0)
  }

  function onRoundSequenceComplete() {
    setPhase(prev => (prev === 'clashing' && result ? (result.coins.length > 0 ? 'revealing' : 'done') : prev))
  }

  function revealNextCoin() {
    if (!result) return
    if (revealedCoins < result.coins.length) {
      setRevealedCoins(revealedCoins + 1)
    } else {
      setPhase('done')
    }
  }

  function poseFor(combatant: ResolvedCombatant): Pose {
    if (phase !== 'done' || !result || result.clash.winner === 'draw') return 'idle'
    if (result.winner === combatant) return 'moving'
    if (result.loser === combatant) return 'hurt'
    return 'idle'
  }

  return { phase, result, revealedCoins, startClash, reset, onRoundSequenceComplete, revealNextCoin, poseFor }
}
