import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseIdentityPage } from '../src/identities/parse.ts'

const wikitext = readFileSync(new URL('./fixtures/identity-don-quixote.wikitext', import.meta.url), 'utf8')
const TITLE = 'Blade Lineage Salsu Don Quixote'

describe('parseIdentityPage', () => {
  const result = parseIdentityPage(TITLE, wikitext)
  const unit = result!.value

  it('returns null when no IDPage template exists', () => {
    expect(parseIdentityPage('X', '== nothing ==')).toBeNull()
  })
  it('maps unit-level stats at the level cap', () => {
    expect(unit.id).toBe(TITLE)
    expect(unit.kind).toBe('identity')
    expect(unit.group).toBe('Don Quixote')
    expect(unit.level).toBe(60)
    expect(unit.hp).toBe(217)
    expect(unit.hpGrowth).toBe(2.4)
    expect(unit.speed).toEqual({ min: 4, max: 8 })
    expect(unit.defenseMod).toBe(-2)
    expect(unit.resistances.damageType).toEqual({ slash: 0.5, pierce: 1, blunt: 2 })
    expect(unit.resistances.sin).toEqual({ wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 })
    expect(unit.staggerThresholds).toEqual([0.7, 0.4, 0.2])
    expect(unit.portrait).toBe('Blade Lineage Salsu Don Quixote Full.png')
  })
  it('parses the three attack skills and the defense skill', () => {
    expect(unit.skills.map(s => s.slot)).toEqual(['skill1', 'skill2', 'skill3', 'defense'])
    const s1 = unit.skills[0]
    expect(s1.id).toBe(`${TITLE}::skill1`)
    expect(s1.name).toBe('Draw of the Sword')
    expect(s1.sin).toBe('pride')
    expect(s1.damageType).toBe('pierce')
    expect(s1.basePower).toBe(3)
    expect(s1.coinPower).toBe(4)
    expect(s1.coinCount).toBe(2)
    expect(s1.offenseLevelMod).toBe(1)
    expect(s1.attackWeight).toBe(1)
    expect(s1.icon).toBe('Draw of the Sword Don Quixote Icon')
    expect(s1.unbreakableCoins).toEqual([])
    expect(s1.rawText.skill).toBe('At 5+ Poise on self, Coin Power +1\n[On Use] Gain +2 Poise Count')
    expect(s1.rawText.coins).toEqual(['[On Hit] Gain 1 Poise', '[On Hit] Gain 1 Poise'])
  })
  it('converts wiki tier overrides to engine uptie overrides', () => {
    const s1 = unit.skills[0]
    expect(s1.uptie[1]?.basePower).toBe(2)
    expect(s1.uptie[2]?.basePower).toBeUndefined()
    expect(s1.uptie[3]?.basePower).toBe(3)
    expect(s1.uptie[4]?.basePower).toBeUndefined()
    const evade = unit.skills[3]
    expect(evade.damageType).toBe('evade')
    expect(evade.basePower).toBe(3)
    expect(evade.coinPower).toBe(10)
    expect(evade.uptie[1]?.basePower).toBe(2)
    expect(evade.uptie[4]?.basePower).toBe(3)
  })
  it('builds base effects from the uptie-4 text and tier-1 effects from the 3se/3ce overrides', () => {
    const s1 = unit.skills[0]
    expect(s1.effects).toHaveLength(4)
    expect(s1.effects[0]).toMatchObject({ trigger: 'on-use', scope: 'skill', condition: { stat: 'poise', value: 5 }, op: { kind: 'coinPower', delta: 1 } })
    expect(s1.effects[1].op).toEqual({ kind: 'applyStatus', target: 'self', status: 'poise', count: 2 })
    expect(s1.effects[2]).toMatchObject({ trigger: 'on-hit', scope: { coin: 0 }, op: { kind: 'applyStatus', target: 'self', status: 'poise', potency: 1 } })
    expect(s1.effects[3].scope).toEqual({ coin: 1 })
    const tier1 = s1.uptie[1]?.effects
    expect(tier1).toHaveLength(3)
    expect(tier1?.[0].op).toEqual({ kind: 'applyStatus', target: 'self', status: 'poise', count: 2 })
    expect(tier1?.[1].trigger).toBe('heads-hit')
    expect(s1.uptie[4]?.effects).toHaveLength(4)
  })
  it('parses passives with names, text, and effects', () => {
    expect(unit.passives.map(p => p.name)).toEqual(['Collective Breathing', 'Nightly Stroll'])
    expect(unit.passives[0].text.startsWith('When this unit gains Poise Potency')).toBe(true)
    expect(unit.passives[0].effects[0].trigger).toBe('passive')
  })
  it('reports no warnings for a well-formed page', () => {
    expect(result!.warnings).toEqual([])
  })
  it('warns when a page yields no skills at all', () => {
    const bare = parseIdentityPage('Skill-less ID', '{{IDPage|sinner=Nobody|hp=100|speed=4~6}}')
    expect(bare!.value.skills).toEqual([])
    expect(bare!.warnings).toContain('Skill-less ID: no skills parsed')
  })
})
