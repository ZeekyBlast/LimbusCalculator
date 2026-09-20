import { findTemplateBlocks } from '../wiki/wikitext.ts'

export interface RailwayWave { number: number; enemyIds: string[]; reinforcementIds: string[] }
export interface RailwaySection {
  number: number
  name: string
  /** Station numbers this section covers, read off its name (e.g. "A - B" -> both stations). */
  stationNumbers: number[]
  waves: RailwayWave[]
}
export interface RailwayStation { number: number; name: string }
export interface RailwayLine { title: string; start: string; stations: RailwayStation[]; sections: RailwaySection[]; enemyIds: string[] }

const SECTION_HEADING = /^==\s*Encounter Details\s*==/m
const NEXT_HEADING = /^==[^=]/m
const SECTION_CELL = /Section #(\d+)\s*:\s*([^\n|!<]+)/
const WAVE_CELL = /Wave (\d+)/
const STATION_CELL = /Station #(\d+)\s*:\s*([^\n|!<]+)/g
const ENBOX = /\{\{EnBox\|(\d+)/g

function ids(text: string): string[] {
  return [...text.matchAll(ENBOX)].map(m => m[1])
}

export function parseLinePage(wikitext: string, warnings: string[] = []): RailwayLine {
  const header = findTemplateBlocks(wikitext, ['RRLine'])[0]?.params ?? {}

  const stations = new Map<number, string>()
  for (const m of wikitext.matchAll(STATION_CELL)) {
    const n = Number(m[1])
    if (!stations.has(n)) stations.set(n, m[2].trim())
  }

  const sections: RailwaySection[] = []
  const start = SECTION_HEADING.exec(wikitext)
  if (start) {
    const after = wikitext.slice(start.index + start[0].length)
    const stop = NEXT_HEADING.exec(after)
    const table = stop ? after.slice(0, stop.index) : after
    let current: RailwaySection | undefined
    for (const row of table.split(/^\|-\s*$/m)) {
      const sec = SECTION_CELL.exec(row)
      if (sec) {
        current = { number: Number(sec[1]), name: sec[2].trim(), stationNumbers: [], waves: [] }
        sections.push(current)
      }
      const wave = WAVE_CELL.exec(row)
      if (!wave || !current) continue
      const cell = row.slice(wave.index)
      const [main, reinforcements = ''] = cell.split(/Reinforcements/i)
      current.waves.push({ number: Number(wave[1]), enemyIds: ids(main), reinforcementIds: ids(reinforcements) })
    }
  }

  // Section names list the stations they cover, e.g. "Heart of Innocence - Face of Things".
  const byName = new Map([...stations.entries()].map(([number, name]) => [name, number]))
  for (const section of sections) {
    for (const segment of section.name.split(' - ').map(x => x.trim()).filter(x => x.length > 0)) {
      const number = byName.get(segment)
      if (number === undefined) warnings.push(`Section #${section.number} "${section.name}": no station named "${segment}"`)
      else section.stationNumbers.push(number)
    }
  }

  const enemyIds = [...new Set(sections.flatMap(s => s.waves.flatMap(w => [...w.enemyIds, ...w.reinforcementIds])))]
  return {
    title: header.title?.trim() ?? '',
    start: header.start?.trim() ?? '',
    stations: [...stations.entries()].sort((a, b) => a[0] - b[0]).map(([number, name]) => ({ number, name })),
    sections,
    enemyIds,
  }
}
