import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Effect, Unit } from '@limbus/engine'
import { effectCoverage } from '../effects/parse.ts'
import type { RailwayLine } from '../railway/parse.ts'
import type { Failure } from '../types.ts'

export interface Outputs {
  identities: Unit[]
  enemies: Unit[]
  railway: RailwayLine
  failures: { identities: Failure[]; enemies: Failure[]; warnings: string[] }
  levelCap: number
}

export interface Meta {
  scrapedAt: string
  levelCap: number
  railwayLine: string
  identityCount: number
  enemyUnitCount: number
  effectParseCoverage: { total: number; parsed: number; ratio: number }
}

function allEffects(units: Unit[]): Effect[] {
  return units.flatMap(u => [...u.skills.flatMap(s => s.effects), ...u.passives.flatMap(p => p.effects)])
}

export function buildMeta(data: Outputs, now: Date = new Date()): Meta {
  const cov = effectCoverage(allEffects([...data.identities, ...data.enemies]))
  return {
    scrapedAt: now.toISOString(),
    levelCap: data.levelCap,
    railwayLine: data.railway.title,
    identityCount: data.identities.length,
    enemyUnitCount: data.enemies.length,
    effectParseCoverage: { ...cov, ratio: cov.total === 0 ? 0 : Number((cov.parsed / cov.total).toFixed(4)) },
  }
}

export interface WriteOptions {
  /** Skip the drop guard below. Only for a deliberate, reviewed shrink of the data set. */
  force?: boolean
}

/** Spec §10: a scrape that loses more than 5% of either count is a regression, not new data. */
const DROP_FLOOR = 0.95

/**
 * Refuses to overwrite committed outputs with a scrape that lost more than 5% of the identities or
 * enemy units, so one bad run (a wiki outage, a category rename) cannot silently clobber good data.
 */
function checkDrop(dir: string, meta: Meta): void {
  const path = join(dir, 'meta.json')
  if (!existsSync(path)) return
  let previous: Partial<Meta>
  try {
    previous = JSON.parse(readFileSync(path, 'utf8')) as Partial<Meta>
  } catch {
    return
  }
  const drops: string[] = []
  for (const field of ['identityCount', 'enemyUnitCount'] as const) {
    const before = previous[field]
    if (typeof before !== 'number' || before <= 0) continue
    if (meta[field] < before * DROP_FLOOR) drops.push(`${field} ${before} -> ${meta[field]}`)
  }
  if (drops.length > 0) {
    throw new Error(`refusing to write: output dropped more than 5% (${drops.join('; ')}). Re-run the scrape, or pass --force if the drop is real.`)
  }
}

export function writeOutputs(dir: string, data: Outputs, options: WriteOptions = {}): Meta {
  mkdirSync(dir, { recursive: true })
  const write = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + '\n')
  const meta = buildMeta(data)
  if (!options.force) checkDrop(dir, meta)
  write('identities.json', data.identities)
  write('enemies.json', data.enemies)
  write('railway.json', data.railway)
  write('failures.json', data.failures)
  write('meta.json', meta)
  return meta
}
