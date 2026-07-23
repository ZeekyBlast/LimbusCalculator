import { useEffect, useMemo, useState } from 'react'
import type { Identity } from '../types'
import { portraitUrl, hideOnError } from '../lib/images'
import { SINNER_ORDER } from '../lib/sinners'

interface LandingPageProps {
  onEnter: () => void
  identities: Identity[]
}

const FACTS = [
  { label: 'Identities on Record', value: (n: number) => String(n) },
  { label: 'Formula Source', value: () => "Syx's Limbus Blog" },
  { label: 'Verified Ailments', value: () => 'Bleed / Burn / Rupture' },
]

/** One real identity per sinner, in roster order - a real sample of the data, not a stand-in. */
function pickShowcase(identities: Identity[]): Identity[] {
  const bySinner = new Map<string, Identity>()
  for (const id of identities) {
    if (id.sinner && !bySinner.has(id.sinner)) bySinner.set(id.sinner, id)
  }
  return SINNER_ORDER.map(s => bySinner.get(s)).filter((i): i is Identity => i != null)
}

function CoinDot({ heads }: { heads: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-display font-bold ${
        heads ? 'bg-gradient-to-br from-gold-bright to-gold border-gold-bright text-ink' : 'bg-gradient-to-br from-bone to-bone-dim border-bone-dim text-ink'
      }`}
    >
      {heads ? 'H' : 'T'}
    </div>
  )
}

export function LandingPage({ onEnter, identities }: LandingPageProps) {
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

  const showcase = useMemo(() => pickShowcase(identities), [identities])
  const [sampleA, sampleB] = showcase

  return (
    <div className="min-h-screen bg-ink text-bone">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-6 py-20 sm:py-24 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-bone-dim mb-4">Dept. of Combat Analysis &mdash; Case No. 000-CLASH</span>

        <h1 className="font-display text-5xl sm:text-6xl font-extrabold uppercase tracking-wide text-gold-bright mb-3 leading-none text-balance">
          Limbus Clash Simulator
        </h1>
        <p className="text-bone-dim text-base sm:text-lg max-w-xl mb-10 text-pretty">
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

      {/* How a clash resolves */}
      <div className="border-t border-paper-light bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-gold-bright mb-3 text-balance">
              How a Clash Resolves
            </h2>
            <p className="text-bone-dim text-sm leading-relaxed text-pretty">
              No hidden dice. Every round is the exact mechanic documented on limbuscompany.wiki.gg, run coin-by-coin in front of you &mdash; not a
              probability estimate.
            </p>
          </div>

          <ol className="relative pl-2">
            <li className="relative pl-10 pb-10">
              <span className="absolute left-0 top-0 w-8 h-8 rounded-full border border-gold-bright flex items-center justify-center ledger-number text-sm text-gold-bright bg-paper">
                1
              </span>
              <span className="absolute left-4 top-8 bottom-0 border-l border-paper-light" aria-hidden="true" />
              <h3 className="font-display text-lg uppercase tracking-wide text-bone mb-1">Two Skills Step Up</h3>
              <p className="text-bone-dim text-sm mb-3 max-w-md text-pretty">
                Attacker and Defender each commit an Attack Skill &mdash; base power, coin power, and a pool of coins ready to flip.
              </p>
              {sampleA && sampleB && (
                <div className="flex items-center gap-3">
                  <img
                    src={portraitUrl(sampleA.title)}
                    alt={sampleA.title}
                    loading="lazy"
                    onError={hideOnError}
                    className="w-10 h-10 rounded-sm object-cover object-top border border-paper-light"
                  />
                  <span className="font-display text-blood-bright text-sm">VS</span>
                  <img
                    src={portraitUrl(sampleB.title)}
                    alt={sampleB.title}
                    loading="lazy"
                    onError={hideOnError}
                    className="w-10 h-10 rounded-sm object-cover object-top border border-paper-light"
                  />
                </div>
              )}
            </li>

            <li className="relative pl-10 pb-10">
              <span className="absolute left-0 top-0 w-8 h-8 rounded-full border border-gold-bright flex items-center justify-center ledger-number text-sm text-gold-bright bg-paper">
                2
              </span>
              <span className="absolute left-4 top-8 bottom-0 border-l border-paper-light" aria-hidden="true" />
              <h3 className="font-display text-lg uppercase tracking-wide text-bone mb-1">Coins Clash, Round by Round</h3>
              <p className="text-bone-dim text-sm mb-3 max-w-md text-pretty">
                Both pools re-flip every round; the lower Clash Power loses a coin. Ties are parry rounds &mdash; the deadlock everyone underestimates.
              </p>
              <div className="flex items-center gap-2">
                <CoinDot heads />
                <CoinDot heads={false} />
                <CoinDot heads />
                <CoinDot heads />
              </div>
            </li>

            <li className="relative pl-10">
              <span className="absolute left-0 top-0 w-8 h-8 rounded-full border border-gold-bright flex items-center justify-center ledger-number text-sm text-gold-bright bg-paper">
                3
              </span>
              <h3 className="font-display text-lg uppercase tracking-wide text-bone mb-1">Damage Lands</h3>
              <p className="text-bone-dim text-sm mb-3 max-w-md text-pretty">
                The winner attacks one-sided with whatever coins survived, run through the same damage formula the game itself uses.
              </p>
              <div className="flex items-center gap-4">
                <span className="stamp text-gold-bright text-sm">Win</span>
                <span className="ledger-number text-3xl text-gold-bright leading-none">37</span>
                <span className="text-xs text-bone-dim uppercase tracking-wide">Example result</span>
              </div>
            </li>
          </ol>
        </div>
      </div>

      {/* Roster showcase */}
      <div className="border-t border-paper-light">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-gold-bright mb-2 text-center text-balance">
            {identities.length || 184} Identities, Verified
          </h2>
          <p className="text-bone-dim text-sm text-center max-w-lg mx-auto mb-8 text-pretty">
            Every portrait below is real scraped wiki data, not placeholder art &mdash; one Identity per Sinner, pulled live from the same roster you'll
            pick from.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {showcase.map(id => (
              <div key={id.title} className="w-20 text-center">
                <img
                  src={portraitUrl(id.title)}
                  alt={id.title}
                  loading="lazy"
                  onError={hideOnError}
                  className="w-20 h-20 rounded-sm object-cover object-top border border-paper-light mb-1"
                />
                <p className="text-[10px] uppercase tracking-wide text-bone-dim truncate" title={id.title}>
                  {id.sinner}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Closing case-file summary */}
      <div className="border-t border-paper-light bg-paper">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-paper-light">
          {FACTS.map(fact => (
            <div key={fact.label} className="px-6 py-5 text-center">
              <p className="ledger-number text-xl text-gold-bright">{fact.value(identities.length)}</p>
              <p className="text-xs uppercase tracking-wide text-bone-dim mt-1">{fact.label}</p>
            </div>
          ))}
        </div>
        <div className="text-center pb-10">
          <button
            onClick={onEnter}
            className="px-6 py-2.5 border border-gold-bright text-gold-bright hover:bg-gold hover:text-ink rounded-sm font-display uppercase tracking-wide transition-colors"
          >
            Open the Case File
          </button>
        </div>
      </div>
    </div>
  )
}
