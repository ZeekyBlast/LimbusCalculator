import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Unit } from '@limbus/engine'
import type { RailwayLine } from '../src/railway/parse.ts'
import type { Meta } from '../src/pipeline/write.ts'
import { DAMAGE_TYPES, SINS, type Failure } from '../src/types.ts'

/** Minimum effect parse coverage; raise it as the parser improves, never lower it silently. */
const COVERAGE_FLOOR = 0.38

const out = (name: string) => new URL(`../out/${name}`, import.meta.url)
const load = <T>(name: string): T => JSON.parse(readFileSync(out(name), 'utf8')) as T

describe('committed outputs', () => {
  it('exist', () => {
    for (const f of ['identities.json', 'enemies.json', 'railway.json', 'failures.json', 'meta.json']) expect(existsSync(out(f)), f).toBe(true)
  })

  const identities = load<Unit[]>('identities.json')
  const enemies = load<Unit[]>('enemies.json')
  const railway = load<RailwayLine>('railway.json')
  const meta = load<Meta>('meta.json')
  const failures = load<{ identities: Failure[]; enemies: Failure[]; warnings: string[] }>('failures.json')

  function checkUnit(u: Unit) {
    expect(u.id.length).toBeGreaterThan(0)
    expect(['identity', 'enemy']).toContain(u.kind)
    expect(u.level).toBeGreaterThan(0)
    expect(u.hp).toBeGreaterThan(0)
    for (const dt of DAMAGE_TYPES) expect(u.resistances.damageType[dt]).toBeGreaterThan(0)
    for (const s of SINS) expect(u.resistances.sin[s]).toBeGreaterThan(0)
    for (let i = 1; i < u.staggerThresholds.length; i++) expect(u.staggerThresholds[i]).toBeLessThanOrEqual(u.staggerThresholds[i - 1])
    for (const t of u.staggerThresholds) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(1) }
    for (const s of u.skills) {
      expect(s.coinCount).toBeGreaterThanOrEqual(1)
      expect(SINS).toContain(s.sin)
      for (const i of s.unbreakableCoins) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(s.coinCount) }
      expect(new Set(s.unbreakableCoins).size).toBe(s.unbreakableCoins.length)
      for (const e of s.effects) expect(e.source.length).toBeGreaterThan(0)
    }
  }

  it('has well-formed identities at the level cap', () => {
    expect(identities.length).toBeGreaterThan(150)
    for (const u of identities) { checkUnit(u); expect(u.kind).toBe('identity'); expect(u.level).toBe(meta.levelCap) }
    expect(new Set(identities.map(u => u.id)).size).toBe(identities.length)
  })
  it('has well-formed enemies covering every railway enemy id', () => {
    expect(enemies.length).toBeGreaterThan(20)
    for (const u of enemies) { checkUnit(u); expect(u.kind).toBe('enemy') }
    const enemyIds = new Set(enemies.map(u => u.id.split(':')[0]))
    const documentedFailures = new Set(failures.enemies.filter(f => f.reason.trim().length > 0).map(f => f.subject))
    // Every railway enemy id must be accounted for: either it produced a unit, or its absence is
    // recorded in failures.json (e.g. a wiki content gap). Silently dropping one is not allowed.
    const unaccounted = railway.enemyIds.filter(id => !enemyIds.has(id) && !documentedFailures.has(id))
    expect(unaccounted, `railway enemy ids with no unit and no documented failure: ${unaccounted.join(', ')}`).toEqual([])
  })
  it('has a railway line with sections and stations', () => {
    expect(railway.title.length).toBeGreaterThan(0)
    expect(railway.sections.length).toBeGreaterThan(0)
    expect(railway.stations.length).toBeGreaterThan(0)
  })
  it('meets the effect parse coverage floor and counts match', () => {
    expect(meta.identityCount).toBe(identities.length)
    expect(meta.enemyUnitCount).toBe(enemies.length)
    expect(meta.effectParseCoverage.total).toBeGreaterThan(1000)
    expect(meta.effectParseCoverage.ratio).toBeGreaterThanOrEqual(COVERAGE_FLOOR)
    expect(new Date(meta.scrapedAt).toString()).not.toBe('Invalid Date')
  })
})
