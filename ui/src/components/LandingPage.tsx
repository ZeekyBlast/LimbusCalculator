import { useEffect, useState } from 'react'

interface LandingPageProps {
  onEnter: () => void
  identityCount: number
}

const FACTS = [
  { label: 'Identities on Record', value: (n: number) => String(n) },
  { label: 'Formula Source', value: () => "Syx's Limbus Blog" },
  { label: 'Verified Ailments', value: () => 'Bleed / Burn / Rupture' },
]

export function LandingPage({ onEnter, identityCount }: LandingPageProps) {
  const [heads, setHeads] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return
    const id = setInterval(() => {
      setHeads(h => !h)
      setTick(t => t + 1)
    }, 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-ink text-bone flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-bone-dim mb-4">Dept. of Combat Analysis &mdash; Case No. 000-CLASH</span>

        <h1 className="font-display text-5xl sm:text-6xl font-extrabold uppercase tracking-wide text-gold-bright mb-3 leading-none">
          Limbus Clash Simulator
        </h1>
        <p className="text-bone-dim text-base sm:text-lg max-w-xl mb-10">
          Every coin, every clash, calculated to the letter &mdash; reverse-engineered from the game's own code, not the wiki's guesswork.
        </p>

        <div className="flex items-center gap-8 mb-10" style={{ perspective: '600px' }}>
          <div
            key={tick}
            className="coin-flip w-28 h-28 rounded-full flex items-center justify-center border-2 shadow-lg bg-gradient-to-br from-gold-bright to-gold border-gold-bright"
          >
            <span className="font-display text-4xl font-bold text-ink">{heads ? 'H' : 'T'}</span>
          </div>
          <span key={`stamp-${tick}`} className={`stamp ${heads ? 'text-gold-bright' : 'text-blood-bright'}`}>
            {heads ? 'Win' : 'Loss'}
          </span>
        </div>

        <button
          onClick={onEnter}
          className="px-8 py-3 bg-gold hover:bg-gold-bright text-ink rounded-sm font-display text-lg font-bold uppercase tracking-wide transition-colors"
        >
          Open the Case File
        </button>
      </div>

      <div className="border-t border-paper-light bg-paper">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-paper-light">
          {FACTS.map(fact => (
            <div key={fact.label} className="px-6 py-5 text-center">
              <p className="ledger-number text-xl text-gold-bright">{fact.value(identityCount)}</p>
              <p className="text-xs uppercase tracking-wide text-bone-dim mt-1">{fact.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
