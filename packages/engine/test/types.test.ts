import { describe, expect, it } from 'vitest'
import { ALL_SINS, EMPTY_MANUAL } from '../src/types'

describe('shared constants', () => {
  it('are frozen so a caller cannot mutate the shared defaults', () => {
    expect(Object.isFrozen(EMPTY_MANUAL)).toBe(true)
    expect(Object.isFrozen(ALL_SINS)).toBe(true)
  })
  it('lists every sin once', () => {
    expect(ALL_SINS).toHaveLength(7)
    expect(new Set(ALL_SINS).size).toBe(7)
  })
})
