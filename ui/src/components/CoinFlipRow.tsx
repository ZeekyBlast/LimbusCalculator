import type { OneSidedCoinResult } from './ClashArena'

interface CoinFlipRowProps {
  coins: OneSidedCoinResult[]
  revealedCount: number
  onRevealNext?: () => void
}

export function CoinFlipRow({ coins, revealedCount, onRevealNext }: CoinFlipRowProps) {
  return (
    <div className="mb-4">
      <div className="flex gap-3 flex-wrap mb-3" style={{ perspective: '600px' }}>
        {coins.map((coin, i) => {
          const revealed = i < revealedCount
          const justRevealed = i === revealedCount - 1
          return (
            <div
              key={i}
              className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 shadow-lg ${justRevealed ? 'coin-flip' : ''} ${
                !revealed
                  ? 'bg-paper border-paper-light text-bone-dim'
                  : coin.heads
                    ? 'bg-gradient-to-br from-gold-bright to-gold border-gold-bright text-ink'
                    : 'bg-gradient-to-br from-bone to-bone-dim border-bone-dim text-ink'
              }`}
            >
              {revealed ? (
                <>
                  <span className="font-display text-xl font-bold leading-none">{coin.heads ? 'H' : 'T'}</span>
                  <span className="ledger-number text-[11px] leading-none mt-0.5">{coin.damage}</span>
                </>
              ) : (
                <span className="font-display text-2xl">?</span>
              )}
            </div>
          )
        })}
      </div>
      {onRevealNext && (
        <button
          onClick={onRevealNext}
          className="px-4 py-2.5 bg-blood hover:bg-blood-bright border border-blood-bright rounded-sm text-sm font-display uppercase tracking-wide transition-colors"
        >
          Reveal Next Coin ({revealedCount}/{coins.length})
        </button>
      )}
    </div>
  )
}
