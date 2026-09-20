import { describe, expect, it } from 'vitest'
import { changePoints, resolveWikiTiers } from '../src/normalize/uptie.ts'

describe('resolveWikiTiers', () => {
  it('applies an override to its tier and every lower tier', () => {
    expect(resolveWikiTiers(3, { 2: 2 })).toEqual([2, 2, 3, 3])
    expect(resolveWikiTiers(3, { 3: 2 })).toEqual([2, 2, 2, 3])
    expect(resolveWikiTiers(3, { 1: 1, 3: 2 })).toEqual([1, 2, 2, 3])
    expect(resolveWikiTiers(3, {})).toEqual([3, 3, 3, 3])
  })
})

describe('changePoints', () => {
  it('emits engine overrides where the value changes, relative to the tier-4 base', () => {
    expect(changePoints([2, 2, 3, 3])).toEqual({ 1: 2, 3: 3 })
    expect(changePoints([2, 2, 2, 3])).toEqual({ 1: 2, 4: 3 })
    expect(changePoints([1, 2, 2, 3])).toEqual({ 1: 1, 2: 2, 4: 3 })
    expect(changePoints([3, 2, 3, 3])).toEqual({ 2: 2, 3: 3 })
    expect(changePoints([3, 3, 3, 3])).toEqual({})
  })
  it('accepts a custom equality for arrays', () => {
    const eq = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)
    expect(changePoints([['a'], ['a'], ['b'], ['b']], eq)).toEqual({ 1: ['a'], 3: ['b'] })
  })
})
