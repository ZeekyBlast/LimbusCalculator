import { useEffect, useMemo, useState } from 'react'
import { resistanceModifier, resolveUptie } from '@formula/index'
import { useIdentities } from './lib/identities'
import { CombatantPicker } from './components/CombatantPicker'
import { ClashSetup, DEFAULT_COMBATANT_SETUP, type CombatantSetup } from './components/ClashSetup'
import { ClashArena, type ResolvedCombatant } from './components/ClashArena'
import { LandingPage } from './components/LandingPage'

function App() {
  const { identities, loading, error } = useIdentities()
  const [view, setView] = useState<'landing' | 'simulator'>('landing')

  const [attackerTitle, setAttackerTitle] = useState('')
  const [attackerSkillIndex, setAttackerSkillIndex] = useState(0)
  const [defenderTitle, setDefenderTitle] = useState('')
  const [defenderSkillIndex, setDefenderSkillIndex] = useState(0)

  const [attackerSetup, setAttackerSetup] = useState<CombatantSetup>(DEFAULT_COMBATANT_SETUP)
  const [defenderSetup, setDefenderSetup] = useState<CombatantSetup>(DEFAULT_COMBATANT_SETUP)
  const [uptieTier, setUptieTier] = useState<1 | 2 | 3 | 4>(4)

  useEffect(() => {
    if (identities.length > 0 && !attackerTitle) setAttackerTitle(identities[0].title)
    if (identities.length > 1 && !defenderTitle) setDefenderTitle(identities[1].title)
  }, [identities, attackerTitle, defenderTitle])

  const attackerIdentity = useMemo(() => identities.find(i => i.title === attackerTitle), [identities, attackerTitle])
  const defenderIdentity = useMemo(() => identities.find(i => i.title === defenderTitle), [identities, defenderTitle])
  const attackerSkill = attackerIdentity?.skills[attackerSkillIndex]
  const defenderSkill = defenderIdentity?.skills[defenderSkillIndex]

  const attacker: ResolvedCombatant | undefined = useMemo(() => {
    if (!attackerIdentity || !attackerSkill) return undefined
    return {
      label: 'Attacker',
      name: `${attackerIdentity.title} - ${attackerSkill.name}`,
      title: attackerIdentity.title,
      basePower: resolveUptie(attackerSkill.basePower ?? 0, attackerSkill.basePowerUptie, uptieTier),
      coinPower: resolveUptie(attackerSkill.coinPower ?? 0, attackerSkill.coinPowerUptie, uptieTier),
      coinCount: attackerSkill.coinCount ?? 1,
      offenseLevel: attackerSetup.offenseLevel,
      defenseLevel: attackerSetup.defenseLevel,
      sanityPoints: attackerSetup.sanityPoints,
      sinResistanceModifier: resistanceModifier(attackerSetup.sinResistancePct),
      damageTypeResistanceModifier: resistanceModifier(attackerSetup.typeResistancePct),
    }
  }, [attackerIdentity, attackerSkill, attackerSetup, uptieTier])

  const defender: ResolvedCombatant | undefined = useMemo(() => {
    if (!defenderIdentity || !defenderSkill) return undefined
    return {
      label: 'Defender',
      name: `${defenderIdentity.title} - ${defenderSkill.name}`,
      title: defenderIdentity.title,
      basePower: resolveUptie(defenderSkill.basePower ?? 0, defenderSkill.basePowerUptie, uptieTier),
      coinPower: resolveUptie(defenderSkill.coinPower ?? 0, defenderSkill.coinPowerUptie, uptieTier),
      coinCount: defenderSkill.coinCount ?? 1,
      offenseLevel: defenderSetup.offenseLevel,
      defenseLevel: defenderSetup.defenseLevel,
      sanityPoints: defenderSetup.sanityPoints,
      sinResistanceModifier: resistanceModifier(defenderSetup.sinResistancePct),
      damageTypeResistanceModifier: resistanceModifier(defenderSetup.typeResistancePct),
    }
  }, [defenderIdentity, defenderSkill, defenderSetup, uptieTier])

  if (view === 'landing') {
    return <LandingPage onEnter={() => setView('simulator')} identityCount={identities.length} />
  }

  return (
    <div className="min-h-screen bg-ink text-bone p-6 max-w-6xl mx-auto">
      <header className="mb-8 border-b-2 border-gold/40 pb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide text-gold-bright">Limbus Clash Simulator</h1>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-bone-dim uppercase tracking-widest">Case File &mdash; Dept. of Combat Analysis</span>
            <button
              onClick={() => setView('landing')}
              className="font-mono text-xs uppercase tracking-widest text-bone-dim hover:text-gold-bright border border-paper-light rounded-sm px-2 py-1 transition-colors"
            >
              &larr; Overview
            </button>
          </div>
        </div>
        <p className="text-bone-dim text-sm mt-1">
          {loading && 'Loading identities...'}
          {error && `Failed to load identities: ${error}`}
          {!loading && !error && `${identities.length} identities on record. Both sides use Attack Skills - the clash resolves coin-by-coin.`}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <CombatantPicker
          role="Attacker"
          identities={identities}
          selectedTitle={attackerTitle}
          onTitleChange={setAttackerTitle}
          selectedSkillIndex={attackerSkillIndex}
          onSkillIndexChange={setAttackerSkillIndex}
          uptieTier={uptieTier}
        />
        <CombatantPicker
          role="Defender"
          identities={identities}
          selectedTitle={defenderTitle}
          onTitleChange={setDefenderTitle}
          selectedSkillIndex={defenderSkillIndex}
          onSkillIndexChange={setDefenderSkillIndex}
          uptieTier={uptieTier}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ClashSetup
          attackerSetup={attackerSetup}
          onAttackerChange={setAttackerSetup}
          defenderSetup={defenderSetup}
          onDefenderChange={setDefenderSetup}
          uptieTier={uptieTier}
          onUptieTierChange={setUptieTier}
        />

        {attacker && defender && <ClashArena attacker={attacker} defender={defender} />}
      </div>
    </div>
  )
}

export default App
