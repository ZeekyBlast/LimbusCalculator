import type { Skill, Unit } from '@limbus/engine'
import type { RawData } from '../src/lib/data.ts'

const flatSin = { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 }

export function makeSkill(over: Partial<Skill> = {}): Skill {
  return {
    id: 'u::skill1', name: 'Test Skill', slot: 'skill1', sin: 'wrath', damageType: 'slash', icon: 'Test Skill Icon',
    offenseLevelMod: 0, basePower: 4, coinPower: 3, coinCount: 2, unbreakableCoins: [],
    attackWeight: 1, uptie: {}, effects: [], rawText: { skill: '', coins: ['', ''] }, ...over,
  }
}

export function makeUnit(over: Partial<Unit> = {}): Unit {
  return {
    id: 'u', kind: 'identity', name: 'Test Unit', group: 'Yi Sang', portrait: 'Test Unit Full.png', level: 60, hp: 200, hpGrowth: 2,
    speed: { min: 3, max: 6 }, defenseMod: 0,
    resistances: { damageType: { slash: 1, pierce: 1, blunt: 1 }, sin: { ...flatSin } },
    staggerThresholds: [0.7, 0.4], skills: [makeSkill()], passives: [], ...over,
  }
}

export function makeRaw(over: Partial<RawData> = {}): RawData {
  const identity = makeUnit()
  const partA = makeUnit({ id: '9568:0', kind: 'enemy', name: 'Inverted Scale', group: 'Refracted Yinglong', portrait: 'Yinglong-9568_portrait.png', skills: [makeSkill({ id: '9568:0::skill1', slot: 'enemy' })] })
  const partB = makeUnit({ id: '9568:1', kind: 'enemy', name: 'Head', group: 'Refracted Yinglong', portrait: 'Yinglong-9568_portrait.png', skills: [] })
  return {
    identities: [identity],
    enemies: [partA, partB],
    railway: {
      title: 'Line 6', start: 'May 28th, 2026',
      stations: [{ number: 1, name: 'Weighing of Robes' }, { number: 2, name: 'Tarnishing' }],
      sections: [{ number: 1, name: 'Weighing of Robes', stationNumbers: [1], waves: [{ number: 1, enemyIds: ['9568'], reinforcementIds: [] }] }],
      enemyIds: ['9568'],
    },
    meta: { scrapedAt: '2026-09-20T00:00:00Z', levelCap: 60, railwayLine: 'Line 6', identityCount: 1, enemyUnitCount: 2, effectParseCoverage: { total: 10, parsed: 4, ratio: 0.4 } },
    images: { 'Test Unit Full.png': 'Test Unit Full.png', 'Test Skill Icon.png': 'Test Skill Icon.png', 'Yinglong-9568_portrait.png': 'Yinglong-9568_portrait.png', 'Missing.png': null },
    ...over,
  }
}
