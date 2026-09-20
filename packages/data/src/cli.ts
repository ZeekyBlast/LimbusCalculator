import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Unit } from '@limbus/engine'
import { IDENTITY_LEVEL_CAP } from './normalize/values.ts'
import { scrapeIdentities } from './pipeline/identities.ts'
import { scrapeImages } from './pipeline/images.ts'
import { scrapeRailway } from './pipeline/railway.ts'
import { writeOutputs, type Outputs } from './pipeline/write.ts'
import type { RailwayLine } from './railway/parse.ts'
import { WikiClient } from './wiki/client.ts'

/** The live Refraction Railway line. Update when a new Line opens. */
export const RAILWAY_LINE_PAGE = 'Line 6: Maru no Uchi no Sanzu no Kawa'

const OUT_DIR = fileURLToPath(new URL('../out/', import.meta.url))
const IMAGES_DIR = fileURLToPath(new URL('../images/', import.meta.url))

const log = (line: string) => console.log(line)

function readJson<T>(name: string, fallback: T): T {
  const path = join(OUT_DIR, name)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback
}

async function main() {
  const command = process.argv[2] ?? 'all'
  const limitArg = process.argv.find(a => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined
  const client = new WikiClient({ log })

  const existing: Outputs = {
    identities: readJson<Unit[]>('identities.json', []),
    enemies: readJson<Unit[]>('enemies.json', []),
    railway: readJson<RailwayLine>('railway.json', { title: '', start: '', stations: [], sections: [], enemyIds: [] }),
    failures: readJson('failures.json', { identities: [], enemies: [], warnings: [] }),
    levelCap: IDENTITY_LEVEL_CAP,
  }

  if (command === 'images') {
    await scrapeImages(client, [...existing.identities, ...existing.enemies], IMAGES_DIR, OUT_DIR, log)
    return
  }

  const next: Outputs = { ...existing, failures: { ...existing.failures } }
  const warnings: string[] = []
  if (command === 'identities' || command === 'all') {
    const r = await scrapeIdentities(client, log, limit)
    next.identities = r.units
    next.failures.identities = r.failures
    warnings.push(...r.warnings)
    log(`identities: ${r.units.length} parsed, ${r.failures.length} failed`)
  }
  if (command === 'railway' || command === 'all') {
    const r = await scrapeRailway(client, RAILWAY_LINE_PAGE, log)
    next.railway = r.line
    next.enemies = r.units
    next.failures.enemies = r.failures
    warnings.push(...r.warnings)
    log(`enemies: ${r.units.length} units, ${r.failures.length} failed`)
  }
  next.failures.warnings = warnings
  const meta = writeOutputs(OUT_DIR, next)
  log(`wrote ${OUT_DIR} (coverage ${meta.effectParseCoverage.parsed}/${meta.effectParseCoverage.total} = ${meta.effectParseCoverage.ratio})`)
}

main().catch(e => { console.error(e); process.exit(1) })
