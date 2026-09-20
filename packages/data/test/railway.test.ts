import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseLinePage } from '../src/railway/parse.ts'

const warnings: string[] = []
const line = parseLinePage(readFileSync(new URL('./fixtures/railway-line6.wikitext', import.meta.url), 'utf8'), warnings)

describe('parseLinePage', () => {
  it('reads the line header', () => {
    expect(line.title).toBe('Line 6: Maru no Uchi no Sanzu no Kawa')
    expect(line.start).toBe('May 28th, 2026')
  })
  it('reads stations from the stage list', () => {
    expect(line.stations).toHaveLength(8)
    expect(line.stations[5]).toEqual({ number: 6, name: 'Drowning Desire' })
    expect(line.stations[7].name).toBe('Advent')
  })
  it('reads sections and waves with reinforcements', () => {
    expect(line.sections.map(s => s.number)).toEqual([1, 2, 3, 4, 5])
    expect(line.sections[1].name).toBe('Tarnishing')
    expect(line.sections[1].waves).toHaveLength(4)
    const wave2 = line.sections[1].waves[1]
    expect(wave2.number).toBe(2)
    expect(wave2.enemyIds.slice(0, 2)).toEqual(['9570', '9543'])
    expect(wave2.enemyIds).toHaveLength(7)
    expect(wave2.reinforcementIds).toHaveLength(6)
    expect(line.sections[0].waves).toEqual([{ number: 1, enemyIds: ['9563'], reinforcementIds: [] }])
    expect(line.sections[4].waves[0].enemyIds).toEqual(['9567', '9572', '9573', '9574'])
  })
  it('links each section to the stations its name lists', () => {
    expect(line.sections[0].stationNumbers).toEqual([1])
    expect(line.sections[1].name).toBe('Tarnishing')
    expect(line.sections[1].stationNumbers).toEqual([2])
    expect(line.sections[2].name).toBe('Heart of Innocence - Face of Things')
    expect(line.sections[2].stationNumbers).toEqual([3, 4])
    expect(line.sections[3].stationNumbers).toEqual([5, 6, 7])
    expect(line.sections[4].stationNumbers).toEqual([8])
    expect(warnings).toEqual([])
  })
  it('warns about a section-name segment that matches no station', () => {
    const w: string[] = []
    const page = [
      '{{RRLine|title=T|start=S}}',
      '{|',
      '! scope="col" |Station #1: Real Station',
      '|}',
      '== Encounter Details ==',
      '{|',
      '|-',
      '! Section #1 : Real Station - Ghost Station',
      '|Wave 1 {{EnBox|1}}',
      '|}',
    ].join('\n')
    const parsed = parseLinePage(page, w)
    expect(parsed.sections[0].stationNumbers).toEqual([1])
    expect(w).toEqual(['Section #1 "Real Station - Ghost Station": no station named "Ghost Station"'])
  })
  it('collects every distinct enemy id', () => {
    expect(line.enemyIds).toContain('9568')
    expect(line.enemyIds).toContain('9567')
    expect(new Set(line.enemyIds).size).toBe(line.enemyIds.length)
    expect(line.enemyIds.length).toBeGreaterThanOrEqual(30)
  })
})
