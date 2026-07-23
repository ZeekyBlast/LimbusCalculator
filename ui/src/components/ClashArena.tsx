import { uptieBadgeUrl, hideOnError } from '../lib/images'
import { CoinFlipRow } from './CoinFlipRow'
import { ResultPanel } from './ResultPanel'
import { ClashRoundSequence } from './ClashRoundSequence'
import { expectedRoundPower, type ResolvedCombatant, type ClashPhase, type FullClashResult } from '../lib/useClash'

function ForecastSide({ label, combatant, opponent }: { label: string; combatant: ResolvedCombatant; opponent: ResolvedCombatant }) {
  const power = expectedRoundPower(combatant, opponent.offenseLevel)
  const breakable = combatant.coinCount - combatant.unbreakableCoinCount
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <span className="font-mono text-[10px] uppercase tracking-wide text-bone-dim">{label}</span>
      <div className="flex gap-1 flex-wrap justify-center max-w-[120px]">
        {Array.from({ length: breakable }, (_, i) => <span key={`b${i}`} className="pool-coin" style={{ width: 12, height: 12 }} />)}
        {Array.from({ length: combatant.unbreakableCoinCount }, (_, i) => (
          <span key={`u${i}`} className="pool-coin pool-coin-unbreakable" style={{ width: 12, height: 12 }} />
        ))}
      </div>
      <p className="ledger-number text-lg text-gold-bright leading-none">{power.toFixed(1)}</p>
      <p className="font-mono text-[10px] text-bone-dim">avg. round power</p>
    </div>
  )
}

/** Real-data forecast bar: proportional split of each side's expected round power (same terms `simulateClash` compares each round, pre-averaged over the coin flip instead of rolled) - not a decorative meter. */
function ForecastBar({ attacker, defender }: { attacker: ResolvedCombatant; defender: ResolvedCombatant }) {
  const aPower = expectedRoundPower(attacker, defender.offenseLevel)
  const bPower = expectedRoundPower(defender, attacker.offenseLevel)
  const total = aPower + bPower || 1
  const aPct = (aPower / total) * 100
  return (
    <div className="h-1.5 rounded-full overflow-hidden flex bg-paper-light w-full">
      <div className="h-full bg-gold-bright transition-all" style={{ width: `${aPct}%` }} />
      <div className="h-full bg-bone-dim transition-all" style={{ width: `${100 - aPct}%` }} />
    </div>
  )
}

interface ClashArenaProps {
  attacker: ResolvedCombatant
  defender: ResolvedCombatant
  uptieTier: 1 | 2 | 3 | 4
  onUptieTierChange: (tier: 1 | 2 | 3 | 4) => void
  phase: ClashPhase
  result: FullClashResult | null
  revealedCoins: number
  startClash: () => void
  onRoundSequenceComplete: () => void
  revealNextCoin: () => void
}

export function ClashArena({
  attacker,
  defender,
  uptieTier,
  onUptieTierChange,
  phase,
  result,
  revealedCoins,
  startClash,
  onRoundSequenceComplete,
  revealNextCoin,
}: ClashArenaProps) {
  return (
    <section className="border border-paper-light bg-paper rounded-sm overflow-hidden h-fit lg:sticky lg:top-6">
      <header className="border-b border-paper-light bg-ink/40 px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg tracking-wide uppercase text-gold">Clash</h2>
          <div className="flex gap-1">
            {([1, 2, 3, 4] as const).map(tier => (
              <button
                key={tier}
                onClick={() => onUptieTierChange(tier)}
                className={`w-8 h-8 rounded-sm border flex items-center justify-center transition-colors ${
                  tier === uptieTier ? 'border-gold-bright bg-gold/20' : 'border-paper-light bg-paper hover:border-gold/50'
                }`}
                aria-pressed={tier === uptieTier}
                title={`Uptie ${tier}`}
              >
                <img src={uptieBadgeUrl(tier)} alt={`Uptie ${tier}`} loading="lazy" className="w-5 h-5" onError={hideOnError} />
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={startClash}
          disabled={phase === 'clashing' || phase === 'revealing'}
          className="w-full py-2 bg-gold hover:bg-gold-bright text-ink rounded-sm font-display font-bold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {phase === 'done' ? 'Clash Again' : 'Clash'}
        </button>
      </header>

      <div className="p-4">
        {(phase === 'idle' || phase === 'done') && (
          <div className="mb-4 pb-4 border-b border-paper-light/60">
            <div className="flex items-start justify-center gap-6">
              <ForecastSide label={attacker.label} combatant={attacker} opponent={defender} />
              <span className="font-display text-xl text-blood-bright mt-4">VS</span>
              <ForecastSide label={defender.label} combatant={defender} opponent={attacker} />
            </div>
            <div className="mt-3">
              <ForecastBar attacker={attacker} defender={defender} />
            </div>
          </div>
        )}

        {phase === 'idle' && <p className="text-bone-dim text-sm">Forecast above reflects the current build on both sides. Press Clash to run it.</p>}

        {result && phase === 'clashing' && (
          <ClashRoundSequence attacker={attacker} defender={defender} clash={result.clash} onComplete={onRoundSequenceComplete} />
        )}

        {result && (phase === 'revealing' || phase === 'done') && (
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
