import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Unit } from '@limbus/engine'
import { writeOutputs, type Meta, type Outputs } from '../src/pipeline/write.ts'

const unit = (id: string, kind: Unit['kind']): Unit => ({
  id, kind, name: id, level: 60, hp: 1, hpGrowth: 0, speed: { min: 1, max: 1 }, defenseMod: 0,
  resistances: { damageType: { slash: 1, pierce: 1, blunt: 1 }, sin: { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 } },
  staggerThresholds: [], skills: [], passives: [],
})

const outputs = (identities: number, enemies: number): Outputs => ({
  identities: Array.from({ length: identities }, (_, i) => unit(`id-${i}`, 'identity')),
  enemies: Array.from({ length: enemies }, (_, i) => unit(`en-${i}`, 'enemy')),
  railway: { title: 'Line 6', start: '', stations: [], sections: [], enemyIds: [] },
  failures: { identities: [], enemies: [], warnings: [] },
  levelCap: 60,
})

function dirWithMeta(identityCount: number, enemyUnitCount: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'limbus-write-'))
  const meta: Meta = {
    scrapedAt: new Date().toISOString(), levelCap: 60, railwayLine: 'Line 6',
    identityCount, enemyUnitCount, effectParseCoverage: { total: 10, parsed: 5, ratio: 0.5 },
  }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  return dir
}

describe('writeOutputs drop guard', () => {
  it('writes into an empty directory with no previous meta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'limbus-write-'))
    expect(writeOutputs(dir, outputs(100, 40)).identityCount).toBe(100)
  })
  it('throws when the identity count drops below 95% of the committed count', () => {
    const dir = dirWithMeta(100, 40)
    expect(() => writeOutputs(dir, outputs(90, 40))).toThrow(/identityCount 100 -> 90/)
    expect(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).identityCount).toBe(100)
  })
  it('throws when the enemy unit count drops below 95% of the committed count', () => {
    const dir = dirWithMeta(100, 40)
    expect(() => writeOutputs(dir, outputs(100, 30))).toThrow(/enemyUnitCount 40 -> 30/)
  })
  it('allows a drop within 5%', () => {
    const dir = dirWithMeta(100, 40)
    expect(writeOutputs(dir, outputs(96, 40)).identityCount).toBe(96)
  })
  it('allows any drop when force is set', () => {
    const dir = dirWithMeta(100, 40)
    expect(writeOutputs(dir, outputs(90, 10), { force: true }).identityCount).toBe(90)
  })
})
