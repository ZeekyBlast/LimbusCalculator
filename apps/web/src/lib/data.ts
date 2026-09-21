import { useEffect, useState } from 'react'
import type { Skill, Unit } from '@limbus/engine'

// Mirrors packages/data/src/railway/parse.ts. Kept here so the web app has no build-time
// dependency on the scraper package.
export interface RailwayWave { number: number; enemyIds: string[]; reinforcementIds: string[] }
export interface RailwaySection { number: number; name: string; stationNumbers: number[]; waves: RailwayWave[] }
export interface RailwayStation { number: number; name: string }
export interface RailwayLine { title: string; start: string; stations: RailwayStation[]; sections: RailwaySection[]; enemyIds: string[] }
export interface Meta {
  scrapedAt: string
  levelCap: number
  railwayLine: string
  identityCount: number
  enemyUnitCount: number
  effectParseCoverage: { total: number; parsed: number; ratio: number }
}
export type ImageManifest = Record<string, string | null>

export interface RawData {
  identities: Unit[]
  enemies: Unit[]
  railway: RailwayLine
  meta: Meta
  images: ImageManifest
}

export interface GameData extends RawData {
  unitsById: Map<string, Unit>
  skillsById: Map<string, Skill>
  /** Enemy parts grouped by the numeric enemy id (the part before ":"), in part order. */
  unitsByEnemyId: Map<string, Unit[]>
}

const FILES = ['identities', 'enemies', 'railway', 'meta', 'images'] as const

export function indexData(raw: RawData): GameData {
  const unitsById = new Map<string, Unit>()
  const skillsById = new Map<string, Skill>()
  const unitsByEnemyId = new Map<string, Unit[]>()
  for (const unit of [...raw.identities, ...raw.enemies]) {
    unitsById.set(unit.id, unit)
    for (const skill of unit.skills) skillsById.set(skill.id, skill)
    if (unit.kind === 'enemy') {
      const enemyId = unit.id.split(':')[0]
      const parts = unitsByEnemyId.get(enemyId) ?? []
      parts.push(unit)
      unitsByEnemyId.set(enemyId, parts)
    }
  }
  return { ...raw, unitsById, skillsById, unitsByEnemyId }
}

export async function loadGameData(base: string = import.meta.env.BASE_URL, fetchImpl: typeof fetch = fetch): Promise<GameData> {
  const entries = await Promise.all(FILES.map(async name => {
    const url = `${base}data/${name}.json`
    const res = await fetchImpl(url)
    if (!res.ok) throw new Error(`Could not load ${name}.json (HTTP ${res.status})`)
    return [name, await res.json()] as const
  }))
  return indexData(Object.fromEntries(entries) as unknown as RawData)
}

let shared: Promise<GameData> | undefined

/** Loads the data set once per page and shares it across components. */
export function useGameData(): { data?: GameData; error?: string } {
  const [state, setState] = useState<{ data?: GameData; error?: string }>({})
  useEffect(() => {
    shared ??= loadGameData()
    let live = true
    shared.then(data => { if (live) setState({ data }) }, (e: unknown) => { if (live) setState({ error: e instanceof Error ? e.message : String(e) }) })
    return () => { live = false }
  }, [])
  return state
}
