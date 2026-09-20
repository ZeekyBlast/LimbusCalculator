import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEnBoxData } from '../src/enemies/enbox.ts'
import { enemyRefFromEnBox, findEnemyBlock, parseEnemyBlock } from '../src/enemies/parse.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const enbox = parseEnBoxData(fixture('enbox-data.lua'))
const ref = (id: string) => enemyRefFromEnBox(id, enbox.get(id)!)

describe('parseEnBoxData', () => {
  it('reads id rows into entries and splits page anchors', () => {
    expect(enbox.size).toBeGreaterThanOrEqual(30)
    expect(enbox.get('9568')).toEqual({ name: 'Refracted Yinglong', faction: 'Yinglong', image: 'Yinglong-9568_portrait.png', risk: 'WAW', page: 'Yinglong/Enemy#Refracted Yinglong' })
    expect(ref('9568')).toMatchObject({ id: '9568', page: 'Yinglong/Enemy', anchor: 'Refracted Yinglong' })
    expect(ref('9543').page).toBe('Line 6: Maru no Uchi no Sanzu no Kawa/Station 2: Tarnishing')
  })
})

describe('findEnemyBlock', () => {
  it('prefers the block whose id param matches', () => {
    const wikitext = fixture('enemy-yinglong.wikitext')
    expect(findEnemyBlock(wikitext, ref('9568'))?.params.id).toBe('9568')
    expect(findEnemyBlock(wikitext, ref('9569'))?.params.id).toBe('9569')
  })
  it('falls back to the heading anchor for blocks without an id', () => {
    const wikitext = fixture('enemy-station2-invidiae.wikitext')
    expect(findEnemyBlock(wikitext, ref('9543'))?.params.sinner).toBe('Hong Lu')
    expect(findEnemyBlock(wikitext, ref('9538'))?.params.sinner).toBe('Yi Sang')
  })
  it('returns undefined when nothing matches', () => {
    expect(findEnemyBlock('== nothing ==', ref('9568'))).toBeUndefined()
  })
})

describe('parseEnemyBlock: ABPage with parts', () => {
  const wikitext = fixture('enemy-yinglong.wikitext')
  const { value: units, warnings } = parseEnemyBlock(findEnemyBlock(wikitext, ref('9568'))!, ref('9568'))

  it('emits one unit per part with numeric resistances and hp at the stated level', () => {
    expect(units.map(u => u.id)).toEqual(['9568:0', '9568:1'])
    expect(units.map(u => u.name)).toEqual(['Inverted Scale', 'Head'])
    expect(units[0].group).toBe('Refracted Yinglong')
    expect(units[0].kind).toBe('enemy')
    expect(units[0].level).toBe(60)
    expect(units[0].hp).toBe(5040)
    expect(units[1].hp).toBe(7427)
    expect(units[0].speed).toEqual({ min: 1, max: 1 })
    expect(units[0].defenseMod).toBe(5)
    expect(units[0].resistances.damageType).toEqual({ slash: 1, pierce: 1, blunt: 1 })
    expect(units[0].resistances.sin).toEqual({ wrath: 1, lust: 0.75, sloth: 0.75, gluttony: 1.5, gloom: 1.5, pride: 1, envy: 1.5 })
    expect(units[0].staggerThresholds).toEqual([])
    expect(units[0].portrait).toBe('Yinglong-9568_portrait.png')
    expect(warnings).toEqual([])
  })
  it('assigns skills to parts by the skillparts label', () => {
    expect(units[0].skills).toHaveLength(1)
    const scale = units[0].skills[0]
    expect(scale.id).toBe('9568:0::skill1')
    expect(scale.slot).toBe('enemy')
    expect(scale.name).toBe('Wrath of the Inverted Scale [逆鱗之禍]')
    expect(scale.sin).toBe('wrath')
    expect(scale.damageType).toBe('pierce')
    expect(scale.basePower).toBe(2)
    expect(scale.coinPower).toBe(1)
    expect(scale.coinCount).toBe(2)
    expect(scale.attackWeight).toBe(7)
    expect(scale.unbreakableCoins).toEqual([0, 1])
    expect(scale.uptie).toEqual({})
    expect(units[1].skills).toHaveLength(6)
    expect(units[1].skills.map(s => s.basePower)).toEqual([3, 4, 4, 3, 4, 18])
  })
  it('attaches block passives to every part', () => {
    expect(units[0].passives.length).toBeGreaterThan(0)
    expect(units[0].passives).toEqual(units[1].passives)
  })
  it('parses the phase-3 block into four parts', () => {
    const p3 = parseEnemyBlock(findEnemyBlock(wikitext, ref('9569'))!, ref('9569')).value
    expect(p3).toHaveLength(4)
    expect(p3[0].staggerThresholds).toEqual([0.7, 0.3, 0])
  })
})

describe('parseEnemyBlock: ABPage single part (refracted human)', () => {
  it('parses Shiomi Yoru as one body with stagger and 1.2 slash', () => {
    const wikitext = fixture('enemy-shiomi-yoru.wikitext')
    const units = parseEnemyBlock(findEnemyBlock(wikitext, ref('9550'))!, ref('9550')).value
    expect(units).toHaveLength(1)
    expect(units[0].id).toBe('9550:0')
    expect(units[0].name).toBe('Body')
    expect(units[0].level).toBe(77)
    expect(units[0].hp).toBe(1918)
    expect(units[0].staggerThresholds).toEqual([0.2])
    expect(units[0].resistances.damageType.slash).toBe(1.2)
    expect(units[0].skills.length).toBeGreaterThanOrEqual(5)
    expect(units[0].skills[0]).toMatchObject({ name: 'Twinslash [二連]', basePower: 7, coinPower: 3, coinCount: 2, offenseLevelMod: -3 })
  })
})

describe('parseEnemyBlock: ENPage/Invidiae', () => {
  it('parses a Peccatulum as an identity-like single unit with word resistances', () => {
    const wikitext = fixture('enemy-station2-invidiae.wikitext')
    const { value: units } = parseEnemyBlock(findEnemyBlock(wikitext, ref('9543'))!, ref('9543'))
    expect(units).toHaveLength(1)
    const u = units[0]
    expect(u.id).toBe('9543:0')
    expect(u.name).toBe('Refracted Peccatulum Invidiae - The Lord of Hongyuan Hong Lu Class 2')
    expect(u.level).toBe(60)
    expect(u.hp).toBe(192)
    expect(u.speed).toEqual({ min: 4, max: 8 })
    expect(u.defenseMod).toBe(-2)
    expect(u.resistances.damageType).toEqual({ slash: 0.5, pierce: 1, blunt: 2 })
    expect(u.resistances.sin.wrath).toBe(2)
    expect(u.resistances.sin.gloom).toBe(0.75)
    expect(u.staggerThresholds).toEqual([0.65, 0.35])
    expect(u.skills.map(s => s.slot)).toEqual(['enemy', 'enemy', 'enemy', 'defense', 'defense'])
    expect(u.skills[0].name).toBe('I Wish to Open the Path')
    expect(u.passives.length).toBeGreaterThanOrEqual(3)
  })
  it('locates the Yi Sang block by anchor and reads its first skill', () => {
    const wikitext = fixture('enemy-station2-invidiae.wikitext')
    const units = parseEnemyBlock(findEnemyBlock(wikitext, ref('9538'))!, ref('9538')).value
    expect(units[0].skills[0].name).toBe('Cut Down and Trample')
  })
})
