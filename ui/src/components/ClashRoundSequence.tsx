import { useEffect, useRef, useState } from 'react'
import type { ClashResult } from '@formula/index'
import type { ResolvedCombatant } from '../lib/useClash'

interface PoolCoin {
  id: number
  unbreakable: boolean
  status: 'active' | 'broken' | 'cracked'
}

function buildPool(coinCount: number, unbreakableCount: number): PoolCoin[] {
  const breakableCount = coinCount - unbreakableCount
  return Array.from({ length: coinCount }, (_, i) => ({ id: i, unbreakable: i >= breakableCount, status: 'active' as const }))
}

/** Breaks the lowest-id still-active breakable coin - coins are otherwise interchangeable, so which one doesn't matter mechanically. */
function breakNextCoin(pool: PoolCoin[]): PoolCoin[] {
  const idx = pool.findIndex(c => c.status === 'active' && !c.unbreakable)
  if (idx === -1) return pool
  return pool.map((c, i) => (i === idx ? { ...c, status: 'broken' as const } : c))
}

function crackRemaining(pool: PoolCoin[]): PoolCoin[] {
  return pool.map(c => (c.status === 'active' ? { ...c, status: 'cracked' as const } : c))
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function CoinPool({ label, pool, power, heads }: { label: string; pool: PoolCoin[]; power?: number; heads?: number }) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-[132px]">
      <div className="flex gap-1.5 flex-wrap justify-center max-w-[160px]">
        {pool.map(coin => (
          <span
            key={coin.id}
            className={`pool-coin ${coin.unbreakable ? 'pool-coin-unbreakable' : ''} ${coin.status === 'broken' ? 'pool-coin-broken' : ''} ${coin.status === 'cracked' ? 'pool-coin-cracked' : ''}`}
          />
        ))}
      </div>
      <p key={`${power}-${heads}`} className="round-readout ledger-number text-xs text-bone-dim h-4">
        {power !== undefined ? `${heads}H · Power ${power}` : ' '}
      </p>
      <span className="font-mono text-[10px] uppercase tracking-wide text-bone-dim">{label}</span>
    </div>
  )
}

interface ClashRoundSequenceProps {
  attacker: ResolvedCombatant
  defender: ResolvedCombatant
  clash: ClashResult
  onComplete: () => void
}

/**
 * Visualizes simulateClash's round-by-round loop - previously computed in full but only ever
 * summarized as one line of text. Every round in `clash.rounds` already carries which side lost
 * (the lower-power side, same comparison simulateClash itself uses) and whether it was a parry
 * tie; this only renders what's already there, nothing invented. The one exception is *which*
 * specific breakable coin breaks - coins are interchangeable in the model, so the lowest-id
 * still-active one is picked for a stable visual, not because it's mechanically distinguished.
 */
export function ClashRoundSequence({ attacker, defender, clash, onComplete }: ClashRoundSequenceProps) {
  const totalRoundSteps = clash.rounds.length
  const hasCrackBeat = clash.winner !== 'draw' && clash.crackedCoins > 0
  const totalSteps = totalRoundSteps + (hasCrackBeat ? 1 : 0)

  const [step, setStep] = useState(0)
  const [aPool, setAPool] = useState(() => buildPool(attacker.coinCount, attacker.unbreakableCoinCount))
  const [bPool, setBPool] = useState(() => buildPool(defender.coinCount, defender.unbreakableCoinCount))
  const [parry, setParry] = useState(false)
  const completedRef = useRef(false)

  function applyStep(i: number) {
    if (i < totalRoundSteps) {
      const round = clash.rounds[i]
      setParry(round.tie)
      if (!round.tie) {
        if (round.aPower < round.bPower) setAPool(p => breakNextCoin(p))
        else setBPool(p => breakNextCoin(p))
      }
    } else {
      setParry(false)
      if (clash.winner === 'a') setBPool(p => crackRemaining(p))
      else if (clash.winner === 'b') setAPool(p => crackRemaining(p))
    }
  }

  function skipToEnd() {
    for (let i = step; i < totalSteps; i++) applyStep(i)
    setStep(totalSteps)
  }

  useEffect(() => {
    if (step >= totalSteps) {
      if (completedRef.current) return
      completedRef.current = true
      const t = setTimeout(onComplete, prefersReducedMotion() ? 0 : 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      applyStep(step)
      setStep(s => s + 1)
    }, prefersReducedMotion() ? 0 : 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, totalSteps])

  const roundIndex = Math.min(step, totalRoundSteps - 1)
  const currentRound = totalRoundSteps > 0 && step <= totalRoundSteps ? clash.rounds[roundIndex] : undefined
  const showingCrackBeat = step >= totalRoundSteps && hasCrackBeat

  let statusText: string
  if (step < totalRoundSteps) statusText = `Round ${step + 1} / ${totalRoundSteps}`
  else if (showingCrackBeat && step === totalRoundSteps) statusText = 'Unbreakable coins hold...'
  else statusText = 'Clash resolved'

  return (
    <div className="mb-4 pb-4 border-b border-paper-light/60">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-xs text-bone-dim uppercase tracking-wide">{statusText}</p>
        {step < totalSteps && (
          <button
            onClick={skipToEnd}
            className="font-mono text-xs uppercase tracking-wide text-bone-dim hover:text-gold-bright underline underline-offset-2"
          >
            Skip to Result
          </button>
        )}
      </div>

      <div className="flex items-start justify-center gap-10 relative">
        <CoinPool label={attacker.label} pool={aPool} power={currentRound?.aPower} heads={currentRound?.aHeads} />
        {parry && (
          <span key={step} className="parry-flash absolute -top-1 left-1/2 -translate-x-1/2 stamp text-xs text-gold-bright">
            Parry
          </span>
        )}
        <CoinPool label={defender.label} pool={bPool} power={currentRound?.bPower} heads={currentRound?.bHeads} />
      </div>
    </div>
  )
}
