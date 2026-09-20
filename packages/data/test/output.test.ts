import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Unit } from '@limbus/engine'
import type { RailwayLine } from '../src/railway/parse.ts'
import type { ImageManifest } from '../src/pipeline/images.ts'
import type { Meta } from '../src/pipeline/write.ts'
import { DAMAGE_TYPES, SINS, type Failure } from '../src/types.ts'

/** Minimum effect parse coverage; raise it as the parser improves, never lower it silently. */
const COVERAGE_FLOOR = 0.38

const out = (name: string) => new URL(`../out/${name}`, import.meta.url)
const load = <T>(name: string): T => JSON.parse(readFileSync(out(name), 'utf8')) as T

describe('committed outputs', () => {
  it('exist', () => {
    for (const f of ['identities.json', 'enemies.json', 'railway.json', 'failures.json', 'meta.json', 'images.json']) expect(existsSync(out(f)), f).toBe(true)
  })

  const identities = load<Unit[]>('identities.json')
  const enemies = load<Unit[]>('enemies.json')
  const railway = load<RailwayLine>('railway.json')
  const meta = load<Meta>('meta.json')
  const failures = load<{ identities: Failure[]; enemies: Failure[]; warnings: string[] }>('failures.json')
  const images = load<ImageManifest>('images.json')
  const allUnits = [...identities, ...enemies]

  /**
   * Units the wiki genuinely gives no skill block for. Maintained deliberately: a new id appearing
   * here means a parser regression or a wiki change, not something to paper over by editing the list.
   */
  const KNOWN_SKILL_LESS = ['9572:0', '9573:0', '9574:0']
  /** Units with no parseable speed range. Same rule as above: this list is meant to stay empty. */
  const KNOWN_SPEEDLESS: string[] = []

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
    // Bounds the gate above: without this, any regression that broke parsing for many railway
    // enemies would still pass as long as each one landed in failures.json. This is the exact,
    // known list of wiki content gaps (see task-9-report.md); update it deliberately, not to make
    // a new failure disappear.
    expect(failures.enemies.map(f => f.subject)).toEqual(['9553'])
  })
  it('has no undeclared skill-less or speed-less units', () => {
    expect(allUnits.filter(u => u.skills.length === 0).map(u => u.id).sort()).toEqual(KNOWN_SKILL_LESS)
    expect(allUnits.filter(u => u.speed.min === 0 && u.speed.max === 0).map(u => u.id).sort()).toEqual(KNOWN_SPEEDLESS)
  })
  it('has an image manifest covering every portrait and skill icon', () => {
    const refs = new Set<string>()
    for (const u of allUnits) {
      if (u.portrait) refs.add(u.portrait)
      for (const s of u.skills) if (s.icon) refs.add(`${s.icon}.png`)
    }
    const missing = [...refs].filter(r => !(r in images)).sort()
    expect(missing, `image refs absent from images.json: ${missing.join(', ')}`).toEqual([])
    // A null means the wiki has no such file; keep the list empty rather than tolerating gaps.
    const nulls = Object.entries(images).filter(([, v]) => v === null).map(([k]) => k).sort()
    expect(nulls, `image refs the wiki has no file for: ${nulls.join(', ')}`).toEqual([])
    // Distinct wiki filenames must not collapse onto the same local file after sanitizing.
    const locals = Object.values(images).filter((v): v is string => v !== null)
    expect(new Set(locals).size).toBe(locals.length)
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
