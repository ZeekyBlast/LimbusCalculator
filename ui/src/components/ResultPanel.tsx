import type { FullClashResult } from '../lib/useClash'

interface ResultPanelProps {
  result: FullClashResult
}

function BleedLines({ result }: { result: FullClashResult }) {
  const { winner, loser, attackerBleedDamage, defenderBleedDamage } = result
  const attacker = winner.label === 'Attacker' ? winner : loser
  const defender = winner.label === 'Defender' ? winner : loser
  if (attackerBleedDamage === 0 && defenderBleedDamage === 0) return null
  return (
    <div className="text-xs text-bone-dim italic mt-2 space-y-0.5">
      {attackerBleedDamage > 0 && <p>{attacker.label} bleeds for {attackerBleedDamage} over the clash.</p>}
      {defenderBleedDamage > 0 && <p>{defender.label} bleeds for {defenderBleedDamage} over the clash.</p>}
    </div>
  )
}

function BurnLines({ result }: { result: FullClashResult }) {
  const { winner, loser, attackerBurnDamage, defenderBurnDamage } = result
  const attacker = winner.label === 'Attacker' ? winner : loser
  const defender = winner.label === 'Defender' ? winner : loser
  if (attackerBurnDamage === 0 && defenderBurnDamage === 0) return null
  return (
    <div className="text-xs text-bone-dim italic mt-2 space-y-0.5">
      {attackerBurnDamage > 0 && <p>{attacker.label} burns for {attackerBurnDamage} at Turn End.</p>}
      {defenderBurnDamage > 0 && <p>{defender.label} burns for {defenderBurnDamage} at Turn End.</p>}
    </div>
  )
}

export function ResultPanel({ result }: ResultPanelProps) {
  const { clash, winner, loser, coins, totalDamage, ruptureDamage } = result

  if (clash.winner === 'draw') {
    return (
      <div className="border-t border-paper-light pt-4 mt-2">
        <div className="flex items-center gap-4">
          <span className="stamp text-bone-dim">Draw</span>
          <p className="text-xs text-bone-dim">Hit the 99 parry round cap with no resolution.</p>
        </div>
        <BleedLines result={result} />
        <BurnLines result={result} />
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
      {ruptureDamage > 0 && (
        <p className="text-xs text-bone-dim italic mt-2">
          {loser.label}'s Rupture adds {ruptureDamage} more, bypassing resistance and level scaling.
        </p>
      )}
      <BleedLines result={result} />
      <BurnLines result={result} />
      {clash.crackedCoins > 0 && (
        <p className="text-xs text-bone-dim italic mt-2">
          {loser.label} has {clash.crackedCoins} Unbreakable coin{clash.crackedCoins > 1 ? 's' : ''} left, cracked rather than broken &mdash; counter-attack not yet modeled.
        </p>
      )}
    </div>
  )
}
