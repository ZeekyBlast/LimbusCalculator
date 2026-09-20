import { mkdirSync, writeFileSync } from 'node:fs'
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

export function writeOutputs(dir: string, data: Outputs): Meta {
  mkdirSync(dir, { recursive: true })
  const write = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + '\n')
  const meta = buildMeta(data)
  write('identities.json', data.identities)
  write('enemies.json', data.enemies)
  write('railway.json', data.railway)
  write('failures.json', data.failures)
  write('meta.json', meta)
  return meta
}
