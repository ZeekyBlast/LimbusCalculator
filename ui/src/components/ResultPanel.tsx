import type { FullClashResult } from '../lib/useClash'

interface ResultPanelProps {
  result: FullClashResult
}

export function ResultPanel({ result }: ResultPanelProps) {
  const { clash, winner, loser, coins, totalDamage } = result

  if (clash.winner === 'draw') {
    return (
      <div className="border-t border-paper-light pt-4 mt-2 flex items-center gap-4">
        <span className="stamp text-bone-dim">Draw</span>
        <p className="text-xs text-bone-dim">Hit the 99 parry round cap with no resolution.</p>
      </div>
    )
  }

  return (
    <div className="border-t border-paper-light pt-4 mt-2">
      <div className="flex items-center gap-4 mb-2">
        <span className="stamp text-blood-bright">Win</span>
        <p className="text-sm text-bone-dim">
          <span className="text-gold-bright font-display uppercase tracking-wide">{winner.label}</span> ({winner.name}) defeats{' '}
          <span className="text-bone-dim">{loser.label}</span> ({loser.name})
        </p>
      </div>
      <p className="ledger-number text-4xl font-bold text-gold-bright leading-none">{totalDamage}</p>
      <p className="text-xs text-bone-dim mb-2 uppercase tracking-wide">Total Damage &mdash; {coins.length} coin(s)</p>
      <p className="ledger-number text-xs text-bone-dim">
        {coins.map(c => c.damage).join(' + ')} = {totalDamage}
      </p>
      {clash.crackedCoins > 0 && (
        <p className="text-xs text-bone-dim italic mt-2">
          {loser.label} has {clash.crackedCoins} Unbreakable coin{clash.crackedCoins > 1 ? 's' : ''} left, cracked rather than broken &mdash; counter-attack not yet modeled.
        </p>
      )}
    </div>
  )
}
