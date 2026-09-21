import { describe, expect, it } from 'vitest'
import { shortEnemyName } from '../src/lib/names.ts'

describe('shortEnemyName', () => {
  it('keeps the last path segment and drops a trailing class number', () => {
    expect(shortEnemyName('Refracted Peccatulum Invidiae - Heishou Pack - Mao Branch Adept Faust Class 2')).toBe('Mao Branch Adept Faust')
    expect(shortEnemyName('Refracted Peccatulum Invidiae - The Lord of Hongyuan Hong Lu Class 2')).toBe('The Lord of Hongyuan Hong Lu')
  })
  it('leaves names without a path alone', () => {
    expect(shortEnemyName('Refracted Hongyu, the Crimson Jade [紅玉]')).toBe('Refracted Hongyu, the Crimson Jade [紅玉]')
    expect(shortEnemyName('Inverted Scale')).toBe('Inverted Scale')
  })
})
