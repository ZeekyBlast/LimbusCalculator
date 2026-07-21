import { useEffect, useMemo, useState } from 'react'
import { computeFinalDamage, resistanceModifier, offenseDefenseAdvantage, parryRoundBonus } from '@formula/index'
import type { Identity, Skill } from './types'

const RESISTANCE_PRESETS: { label: string; value: number }[] = [
  { label: 'Nullify (0%)', value: 0 },
  { label: 'Fatal (200%)', value: 2 },
  { label: 'Weak (150%)', value: 1.5 },
  { label: 'Normal (100%)', value: 1 },
  { label: 'Endure (50%)', value: 0.5 },
  { label: 'Ineffective (25%)', value: 0.25 },
]

// Wiki filenames replace ":", "【", "】" with a single space - matches data/scraper/image-paths.mjs.
function titleToFilenameBase(title: string) {
  return title.replace(/[:【】]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function portraitUrl(title: string) {
  return `/gamedata/images/portraits/${encodeURIComponent(titleToFilenameBase(title))}.png`
}

function App() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [selectedTitle, setSelectedTitle] = useState<string>('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)

  const [sinResistancePct, setSinResistancePct] = useState(1)
  const [typeResistancePct, setTypeResistancePct] = useState(1)
  const [offenseLevel, setOffenseLevel] = useState(10)
  const [defenseLevel, setDefenseLevel] = useState(10)
  const [parryRounds, setParryRounds] = useState(0)
  const [coinRollOverride, setCoinRollOverride] = useState<number | null>(null)

  useEffect(() => {
    fetch('/gamedata/identities.json')
      .then(res => res.json())
      .then((data: Identity[]) => {
        setIdentities(data)
        if (data.length > 0) setSelectedTitle(data[0].title)
      })
      .catch(err => console.error('Failed to load identities.json', err))
  }, [])

  const identity = useMemo(() => identities.find(i => i.title === selectedTitle), [identities, selectedTitle])
  const skill: Skill | undefined = identity?.skills[selectedSkillIndex]

  const defaultCoinRoll = (skill?.basePower ?? 0) + (skill?.coinPower ?? 0)
  const coinRoll = coinRollOverride ?? defaultCoinRoll

  const A = resistanceModifier(sinResistancePct)
  const B = resistanceModifier(typeResistancePct)
  const C = offenseDefenseAdvantage(offenseLevel, defenseLevel)
  const D = parryRoundBonus(parryRounds)

  const finalDamage = computeFinalDamage({
    coinRoll,
    staticModifiers: { sinResistance: A, damageTypeResistance: B, offenseDefenseAdvantage: C, parryBonus: D, critical: 0 },
    dynamicModifiers: { skillEffects: 0, buffs: 0 },
  })

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <h1 className="text-2xl font-semibold mb-1">Limbus Calculator</h1>
      <p className="text-neutral-400 text-sm mb-6">
        Data + formula wiring check &mdash; {identities.length} identities loaded from the wiki scrape.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1">
          <label className="block text-sm text-neutral-400 mb-1">Identity</label>
          <select
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2"
            value={selectedTitle}
            onChange={e => {
              setSelectedTitle(e.target.value)
              setSelectedSkillIndex(0)
            }}
          >
            {identities.map(i => (
              <option key={i.title} value={i.title}>
                {i.title}
              </option>
            ))}
          </select>

          {identity && (
            <div className="mt-4">
              <img
                src={portraitUrl(identity.title)}
                alt={identity.title}
                className="w-full rounded border border-neutral-800"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
              <p className="text-sm text-neutral-400 mt-2 italic">{identity.quote}</p>
              <dl className="text-sm mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-neutral-500">HP</dt>
                <dd>{identity.hp}</dd>
                <dt className="text-neutral-500">Slash / Pierce / Blunt</dt>
                <dd>
                  {identity.resistances?.slash} / {identity.resistances?.pierce} / {identity.resistances?.blunt}
                </dd>
              </dl>
            </div>
          )}
        </section>

        <section className="lg:col-span-1">
          <label className="block text-sm text-neutral-400 mb-1">Skill</label>
          <select
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2"
            value={selectedSkillIndex}
            onChange={e => {
              setSelectedSkillIndex(Number(e.target.value))
              setCoinRollOverride(null)
            }}
          >
            {identity?.skills.map((s, idx) => (
              <option key={idx} value={idx}>
                S{s.skillLevel} &mdash; {s.name} ({s.sin}, {s.damageType})
              </option>
            ))}
          </select>

          {skill && (
            <div className="mt-4 text-sm space-y-1">
              <p>
                Base Power {skill.basePower} + Coin Power {skill.coinPower} &times; {skill.coinCount} coin(s)
              </p>
              <p className="text-neutral-400">{skill.skillEffect}</p>
              {skill.coinEffects?.map((e, i) => (
                <p key={i} className="text-neutral-400">
                  {e}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded p-4">
          <h2 className="font-semibold mb-3">Damage Preview</h2>

          <label className="block text-sm text-neutral-400 mb-1">Coin Roll</label>
          <input
            type="number"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 mb-3"
            value={coinRoll}
            onChange={e => setCoinRollOverride(Number(e.target.value))}
          />
          <p className="text-xs text-neutral-500 -mt-2 mb-3">
            Defaults to Base Power + Coin Power (not the actual heads/tails RNG &mdash; override to test specific rolls).
          </p>

          <label className="block text-sm text-neutral-400 mb-1">{identity?.sinner}'s {skill?.sin} Resistance</label>
          <select
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 mb-3"
            value={sinResistancePct}
            onChange={e => setSinResistancePct(Number(e.target.value))}
          >
            {RESISTANCE_PRESETS.map(p => (
              <option key={p.label} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="block text-sm text-neutral-400 mb-1">{skill?.damageType} Type Resistance</label>
          <select
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 mb-3"
            value={typeResistancePct}
            onChange={e => setTypeResistancePct(Number(e.target.value))}
          >
            {RESISTANCE_PRESETS.map(p => (
              <option key={p.label} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="block text-sm text-neutral-400 mb-1">
            Offense Level {offenseLevel} vs Defense Level {defenseLevel}
          </label>
          <input
            type="range"
            min={0}
            max={40}
            value={offenseLevel}
            onChange={e => setOffenseLevel(Number(e.target.value))}
            className="w-full"
          />
          <input
            type="range"
            min={0}
            max={40}
            value={defenseLevel}
            onChange={e => setDefenseLevel(Number(e.target.value))}
            className="w-full mb-3"
          />

          <label className="block text-sm text-neutral-400 mb-1">Parry Rounds: {parryRounds}</label>
          <input
            type="range"
            min={0}
            max={20}
            value={parryRounds}
            onChange={e => setParryRounds(Number(e.target.value))}
            className="w-full mb-4"
          />

          <div className="border-t border-neutral-800 pt-3">
            <p className="text-xs text-neutral-500">A={A.toFixed(3)} B={B.toFixed(3)} C={C.toFixed(3)} D={D.toFixed(3)}</p>
            <p className="text-3xl font-bold mt-1">{finalDamage}</p>
            <p className="text-xs text-neutral-500">Final Damage</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
