import { useState } from 'react'
import { simulateClash, flipCoins, offenseDefenseAdvantage, parryRoundBonus, computeFinalDamage, type ClashResult } from '@formula/index'
import { spriteUrl, hideOnError } from '../lib/images'
import { CoinFlipRow } from './CoinFlipRow'
import { ResultPanel } from './ResultPanel'

export interface ResolvedCombatant {
  label: string
  name: string
  /** Raw identity title, used to resolve sprite pose images - kept separate from the display `name`. */
  title: string
  basePower: number
  coinPower: number
  coinCount: number
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
}

function runFullClash(attacker: ResolvedCombatant, defender: ResolvedCombatant): FullClashResult {
  const clash = simulateClash(
    { basePower: attacker.basePower, coinPower: attacker.coinPower, coinCount: attacker.coinCount, level: attacker.offenseLevel, sanityPoints: attacker.sanityPoints },
    { basePower: defender.basePower, coinPower: defender.coinPower, coinCount: defender.coinCount, level: defender.offenseLevel, sanityPoints: defender.sanityPoints },
  )

  const winner = clash.winner === 'a' ? attacker : defender
  const loser = clash.winner === 'a' ? defender : attacker
  const winnerChance = (50 + Math.min(Math.max(winner.sanityPoints, -45), 45)) / 100
  const parryBonus = parryRoundBonus(clash.parryRounds)

  const coins: OneSidedCoinResult[] = []
  let totalDamage = 0

  if (clash.winner !== 'draw') {
    for (let i = 0; i < clash.winnerCoinsRemaining; i++) {
      const heads = flipCoins(1, winnerChance) === 1
      const coinRoll = winner.basePower + (heads ? winner.coinPower : 0)
      const damage = computeFinalDamage({
        coinRoll,
        staticModifiers: {
          sinResistance: loser.sinResistanceModifier,
          damageTypeResistance: loser.damageTypeResistanceModifier,
          offenseDefenseAdvantage: offenseDefenseAdvantage(winner.offenseLevel, loser.defenseLevel),
          parryBonus,
          critical: 0,
        },
        dynamicModifiers: { skillEffects: 0, buffs: 0 },
      })
      coins.push({ heads, coinRoll, damage })
      totalDamage += damage
    }
  }

  return { clash, winner, loser, coins, totalDamage }
}

type Phase = 'idle' | 'clashing' | 'revealing' | 'done'

function SpritePane({ combatant, pose }: { combatant: ResolvedCombatant; pose: 'idle' | 'moving' | 'hurt' }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-28 h-36 flex items-end justify-center overflow-hidden">
        <img
          key={pose}
          src={spriteUrl(combatant.title, pose)}
          alt={combatant.title}
          className={`max-w-full max-h-full object-contain ${pose === 'hurt' ? 'grayscale-[40%]' : ''}`}
          onError={hideOnError}
        />
      </div>
      <span className="font-mono text-[11px] uppercase tracking-wide text-bone-dim">{combatant.label}</span>
    </div>
  )
}

interface ClashArenaProps {
  attacker: ResolvedCombatant
  defender: ResolvedCombatant
}

export function ClashArena({ attacker, defender }: ClashArenaProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<FullClashResult | null>(null)
  const [revealedCoins, setRevealedCoins] = useState(0)

  function startClash() {
    const fullResult = runFullClash(attacker, defender)
    setResult(fullResult)
    setRevealedCoins(0)
    setPhase(fullResult.coins.length > 0 ? 'revealing' : 'done')
  }

  function revealNextCoin() {
    if (!result) return
    if (revealedCoins < result.coins.length) {
      setRevealedCoins(revealedCoins + 1)
    } else {
      setPhase('done')
    }
  }

  function poseFor(combatant: ResolvedCombatant): 'idle' | 'moving' | 'hurt' {
    if (phase !== 'done' || !result || result.clash.winner === 'draw') return 'idle'
    if (result.winner === combatant) return 'moving'
    if (result.loser === combatant) return 'hurt'
    return 'idle'
  }

  return (
    <section className="lg:col-span-3 border border-paper-light bg-paper rounded-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-paper-light bg-ink/40 px-4 py-2">
        <span className="font-display text-lg tracking-wide uppercase text-gold">Clash Arena</span>
        <button
          onClick={startClash}
          disabled={phase === 'revealing'}
          className="px-5 py-1.5 bg-gold hover:bg-gold-bright text-ink rounded-sm font-display font-bold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clash
        </button>
      </header>

      <div className="p-4">
        <div className="flex items-center justify-center gap-16 mb-4 pb-4 border-b border-paper-light/60">
          <SpritePane combatant={attacker} pose={poseFor(attacker)} />
          <span className="font-display text-2xl text-blood-bright/80">VS</span>
          <SpritePane combatant={defender} pose={poseFor(defender)} />
        </div>

        {phase === 'idle' && <p className="text-bone-dim text-sm">Set up both sides above, then press Clash.</p>}

        {result && phase !== 'idle' && (
          <div>
            <p className="ledger-number text-xs text-bone-dim mb-3 uppercase tracking-wide">
              Rounds: {result.clash.rounds.length} &mdash; Parry rounds: {result.clash.parryRounds} &mdash;{' '}
              {result.clash.winner === 'draw' ? 'Draw (99 parry cap)' : `${result.winner.label} wins with ${result.clash.winnerCoinsRemaining} coin(s) remaining`}
            </p>

            {result.coins.length > 0 && (
              <CoinFlipRow coins={result.coins} revealedCount={revealedCoins} onRevealNext={phase === 'revealing' ? revealNextCoin : undefined} />
            )}

            {phase === 'done' && <ResultPanel result={result} />}
          </div>
        )}
      </div>
    </section>
  )
}
