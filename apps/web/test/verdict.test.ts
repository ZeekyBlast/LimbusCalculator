import type { ClashReport, DamageSummary } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { bandGeometry, verdictFor } from '../src/lib/verdict.ts'

const summary = (over: Partial<DamageSummary>): DamageSummary => ({ mean: 0, p10: 0, p50: 0, p90: 0, max: 0, perCoinMean: [], histogram: [[0, 1]], staggerChance: [], statusAfter: { self: {}, target: {}, varies: [] }, ...over })
const report = (win: number, lose: number, draw: number): ClashReport => ({
  win, lose, draw, coinsLeftIfWin: [], coinsLeftIfLose: [], parryRoundsExpected: 0,
  damageDealt: summary({}), damageTaken: summary({}), breakdown: [],
})

describe('verdictFor', () => {
  it('stamps favored above 55%, unfavored below 45%, even between, stalemate on a sure draw', () => {
    expect(verdictFor(report(0.7, 0.3, 0))).toEqual({ text: 'FAVORED', tone: 'gold' })
    expect(verdictFor(report(0.3, 0.7, 0))).toEqual({ text: 'UNFAVORED', tone: 'blood' })
    expect(verdictFor(report(0.5, 0.5, 0))).toEqual({ text: 'EVEN', tone: 'bone' })
    expect(verdictFor(report(0, 0, 1))).toEqual({ text: 'STALEMATE', tone: 'bone' })
  })
})

describe('bandGeometry', () => {
  it('places p10, p90, and the median as fractions of the maximum', () => {
    expect(bandGeometry(summary({ p10: 10, p50: 25, p90: 40, max: 50 }))).toEqual({ left: 0.2, width: 0.6, median: 0.5 })
  })
  it('collapses to zero width when there is no damage', () => {
    expect(bandGeometry(summary({}))).toEqual({ left: 0, width: 0, median: 0 })
  })
})
