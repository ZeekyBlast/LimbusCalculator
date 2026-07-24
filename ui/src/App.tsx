import { useEffect, useMemo, useState } from 'react'
import { resistanceModifier, resolveUptie, countUnbreakableCoins } from '@formula/index'
import { useIdentities } from './lib/identities'
import { CombatantDossier, DEFAULT_COMBATANT_SETUP, type CombatantSetup } from './components/CombatantDossier'
import { ClashArena } from './components/ClashArena'
import { LandingPage } from './components/LandingPage'
import { useClash, type ResolvedCombatant } from './lib/useClash'
import { DEFAULT_EFFECTS_SETUP, type CombatantEffectsSetup } from './lib/effectSetup'
import { RosterPanel } from './components/RosterPanel'
import { DEFAULT_ROSTER, type Roster } from './lib/roster'
import { initSideBattleState, type SideBattleState } from './lib/battleState'

const FALLBACK_COMBATANT: ResolvedCombatant = {
  label: '',
  name: '',
  title: '',
  basePower: 0,
  coinPower: 0,
  coinCount: 0,
  unbreakableCoinCount: 0,
  offenseLevel: 1,
  defenseLevel: 1,
  sanityPoints: 0,
  sinResistanceModifier: 1,
  damageTypeResistanceModifier: 1,
}

const FALLBACK_BATTLE: SideBattleState = { currentHp: 0, maxHp: 0, defeated: false }

function App() {
  const { identities, loading, error } = useIdentities()
  const [view, setView] = useState<'landing' | 'simulator'>('landing')

  const [attackerTitle, setAttackerTitle] = useState('')
  const [attackerSkillIndex, setAttackerSkillIndex] = useState(0)
  const [defenderTitle, setDefenderTitle] = useState('')
  const [defenderSkillIndex, setDefenderSkillIndex] = useState(0)

  const [attackerSetup, setAttackerSetup] = useState<CombatantSetup>(DEFAULT_COMBATANT_SETUP)
  const [defenderSetup, setDefenderSetup] = useState<CombatantSetup>(DEFAULT_COMBATANT_SETUP)
  const [attackerEffects, setAttackerEffects] = useState<CombatantEffectsSetup>(DEFAULT_EFFECTS_SETUP)
  const [defenderEffects, setDefenderEffects] = useState<CombatantEffectsSetup>(DEFAULT_EFFECTS_SETUP)
  const [uptieTier, setUptieTier] = useState<1 | 2 | 3 | 4>(4)
  const [attackerRoster, setAttackerRoster] = useState<Roster>(DEFAULT_ROSTER)
  const [defenderRoster, setDefenderRoster] = useState<Roster>(DEFAULT_ROSTER)
  const [attackerBattle, setAttackerBattle] = useState<SideBattleState | null>(null)
  const [defenderBattle, setDefenderBattle] = useState<SideBattleState | null>(null)

  useEffect(() => {
    if (identities.length > 0 && !attackerTitle) setAttackerTitle(identities[0].title)
    if (identities.length > 1 && !defenderTitle) setDefenderTitle(identities[1].title)
  }, [identities, attackerTitle, defenderTitle])

  const attackerIdentity = useMemo(() => identities.find(i => i.title === attackerTitle), [identities, attackerTitle])
  const defenderIdentity = useMemo(() => identities.find(i => i.title === defenderTitle), [identities, defenderTitle])
  const attackerSkill = attackerIdentity?.skills[attackerSkillIndex]
  const defenderSkill = defenderIdentity?.skills[defenderSkillIndex]

  // Seeds HP once per encounter (guarded by `!...Battle`) - resetEncounter() nulls it out to
  // reseed, but adjusting the Level slider mid-encounter does NOT refill HP.
  useEffect(() => {
    if (attackerIdentity && !attackerBattle) setAttackerBattle(initSideBattleState(attackerIdentity, attackerSetup.level))
  }, [attackerIdentity, attackerSetup.level, attackerBattle])
  useEffect(() => {
    if (defenderIdentity && !defenderBattle) setDefenderBattle(initSideBattleState(defenderIdentity, defenderSetup.level))
  }, [defenderIdentity, defenderSetup.level, defenderBattle])

  const attacker: ResolvedCombatant | undefined = useMemo(() => {
    if (!attackerIdentity || !attackerSkill) return undefined
    return {
      label: 'Attacker',
      name: `${attackerIdentity.title} - ${attackerSkill.name}`,
      title: attackerIdentity.title,
      basePower: resolveUptie(attackerSkill.basePower ?? 0, attackerSkill.basePowerUptie, uptieTier),
      coinPower: resolveUptie(attackerSkill.coinPower ?? 0, attackerSkill.coinPowerUptie, uptieTier),
      coinCount: attackerSkill.coinCount ?? 1,
      unbreakableCoinCount: countUnbreakableCoins(attackerSkill.coinEffects),
      offenseLevel: attackerSetup.level,
      defenseLevel: attackerSetup.level + (attackerIdentity.defenseLevelMod ?? 0),
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
      unbreakableCoinCount: countUnbreakableCoins(defenderSkill.coinEffects),
      offenseLevel: defenderSetup.level,
      defenseLevel: defenderSetup.level + (defenderIdentity.defenseLevelMod ?? 0),
      sanityPoints: defenderSetup.sanityPoints,
      sinResistanceModifier: resistanceModifier(defenderSetup.sinResistancePct),
      damageTypeResistanceModifier: resistanceModifier(defenderSetup.typeResistancePct),
    }
  }, [defenderIdentity, defenderSkill, defenderSetup, uptieTier])

  // useClash needs stable combatant/battle objects even before identities finish loading; the
  // fallbacks are never reached in practice since the Clash button only renders once resolved.
  const { phase, result, revealedCoins, startClash, reset, onRoundSequenceComplete, revealNextCoin, poseFor } = useClash(
    attacker ?? FALLBACK_COMBATANT,
    defender ?? FALLBACK_COMBATANT,
    attackerEffects,
    defenderEffects,
    (nextAttacker, nextDefender) => {
      setAttackerEffects(nextAttacker)
      setDefenderEffects(nextDefender)
    },
    attackerBattle ?? FALLBACK_BATTLE,
    defenderBattle ?? FALLBACK_BATTLE,
    (nextAttacker, nextDefender) => {
      setAttackerBattle(nextAttacker)
      setDefenderBattle(nextDefender)
    },
    attackerSkill ?? {},
    defenderSkill ?? {},
  )

  const encounterOver = Boolean(attackerBattle?.defeated || defenderBattle?.defeated)

  function resetEncounter() {
    setAttackerBattle(null)
    setDefenderBattle(null)
    setAttackerEffects(DEFAULT_EFFECTS_SETUP)
    setDefenderEffects(DEFAULT_EFFECTS_SETUP)
    reset()
  }

  if (view === 'landing') {
    return <LandingPage onEnter={() => setView('simulator')} identities={identities} />
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_1fr] gap-6 items-start">
        <CombatantDossier
          role="Attacker"
          identities={identities}
          selectedTitle={attackerTitle}
          onTitleChange={setAttackerTitle}
          selectedSkillIndex={attackerSkillIndex}
          onSkillIndexChange={setAttackerSkillIndex}
          uptieTier={uptieTier}
          setup={attackerSetup}
          onSetupChange={setAttackerSetup}
          effects={attackerEffects}
          onEffectsChange={setAttackerEffects}
          pose={attacker ? poseFor(attacker) : 'idle'}
          battle={attackerBattle}
        />

        {attacker && defender && (
          <ClashArena
            attacker={attacker}
            defender={defender}
            uptieTier={uptieTier}
            onUptieTierChange={setUptieTier}
            phase={phase}
            result={result}
            revealedCoins={revealedCoins}
            startClash={startClash}
            onRoundSequenceComplete={onRoundSequenceComplete}
            revealNextCoin={revealNextCoin}
            resetEncounter={resetEncounter}
            encounterOver={encounterOver}
          />
        )}

        <CombatantDossier
          role="Defender"
          identities={identities}
          selectedTitle={defenderTitle}
          onTitleChange={setDefenderTitle}
          selectedSkillIndex={defenderSkillIndex}
          onSkillIndexChange={setDefenderSkillIndex}
          uptieTier={uptieTier}
          setup={defenderSetup}
          onSetupChange={setDefenderSetup}
          effects={defenderEffects}
          onEffectsChange={setDefenderEffects}
          pose={defender ? poseFor(defender) : 'idle'}
          battle={defenderBattle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RosterPanel
          role="Attacker"
          identities={identities}
          roster={attackerRoster}
          onRosterChange={setAttackerRoster}
          deployedIdentity={attackerIdentity}
          level={attackerSetup.level}
        />
        <RosterPanel
          role="Defender"
          identities={identities}
          roster={defenderRoster}
          onRosterChange={setDefenderRoster}
          deployedIdentity={defenderIdentity}
          level={defenderSetup.level}
        />
      </div>
    </div>
  )
}

export default App
