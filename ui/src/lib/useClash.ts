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
  type ClashResult,
} from '@formula/index'
import { toEffectStacks, type CombatantEffectsSetup } from './effectSetup'

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

function runFullClash(
  attacker: ResolvedCombatant,
  defender: ResolvedCombatant,
  attackerEffects: CombatantEffectsSetup,
  defenderEffects: CombatantEffectsSetup,
): RunResult {
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
  const winnerChance = (50 + Math.min(Math.max(winner.sanityPoints, -45), 45)) / 100
  const parryBonus = parryRoundBonus(clash.parryRounds)

  // Fragile/Protection live on whoever's getting hit (the loser); Damage Up/Down, Power Up, and
  // Coin Boost/Drop live on whoever's dealing the hit (the winner) - Syx's blog Md term (G+H)
  // combines both sides' contributions for a single damage instance, regardless of source.
  const combinedStacks = [...toEffectStacks(winnerEffects), ...toEffectStacks(loserEffects)]
  const dynamicModifier = calculateDynamicModifier(combinedStacks, false)
  const winnerStacks = toEffectStacks(winnerEffects)
  const coinRollBonus = sumCoinRollBonus(winnerStacks)
  const coinPowerBonus = sumCoinPowerBonus(winnerStacks)

  const coins: OneSidedCoinResult[] = []
  let totalDamage = 0

  if (clash.winner !== 'draw') {
    for (let i = 0; i < clash.winnerCoinsRemaining; i++) {
      const heads = flipCoins(1, winnerChance) === 1
      const coinRoll = winner.basePower + (heads ? winner.coinPower + coinPowerBonus : 0) + coinRollBonus
      const damage = computeFinalDamage({
        coinRoll,
        staticModifiers: {
          sinResistance: loser.sinResistanceModifier,
          damageTypeResistance: loser.damageTypeResistanceModifier,
          offenseDefenseAdvantage: offenseDefenseAdvantage(winner.offenseLevel, loser.defenseLevel),
          parryBonus,
          critical: 0,
        },
        dynamicModifiers: { skillEffects: 0, buffs: dynamicModifier },
      })
      coins.push({ heads, coinRoll, damage })
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
  }
  const nextDefenderEffects: CombatantEffectsSetup = {
    ...defenderEffects,
    bleed: bBleed.nextState,
    rupture: clash.winner === 'a' ? rupture.nextState : defenderEffects.rupture,
  }

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
    },
    nextAttackerEffects,
    nextDefenderEffects,
  }
}

/** Owns the clash run/reveal state machine so it can be shared by sibling components (both dossiers need `poseFor`, the center column needs the rest) instead of living inside one presentational component. */
export function useClash(
  attacker: ResolvedCombatant,
  defender: ResolvedCombatant,
  attackerEffects: CombatantEffectsSetup,
  defenderEffects: CombatantEffectsSetup,
  onEffectsConsumed: (attacker: CombatantEffectsSetup, defender: CombatantEffectsSetup) => void,
) {
  const [phase, setPhase] = useState<ClashPhase>('idle')
  const [result, setResult] = useState<FullClashResult | null>(null)
  const [revealedCoins, setRevealedCoins] = useState(0)

  function startClash() {
    const run = runFullClash(attacker, defender, attackerEffects, defenderEffects)
    setResult(run.result)
    onEffectsConsumed(run.nextAttackerEffects, run.nextDefenderEffects)
    setRevealedCoins(0)
    setPhase('clashing')
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

  return { phase, result, revealedCoins, startClash, onRoundSequenceComplete, revealNextCoin, poseFor }
}
