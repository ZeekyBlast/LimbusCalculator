import { describe, expect, it } from 'vitest'
import { binomialPmf } from '../src/binomial'

describe('binomialPmf', () => {
  it('returns [1] for zero coins', () => {
    expect(binomialPmf(0, 0.5)).toEqual([1])
  })
  it('matches hand values for 2 fair coins', () => {
    const pmf = binomialPmf(2, 0.5)
    expect(pmf).toHaveLength(3)
    expect(pmf[0]).toBeCloseTo(0.25)
    expect(pmf[1]).toBeCloseTo(0.5)
    expect(pmf[2]).toBeCloseTo(0.25)
  })
  it('matches C(3,1) p (1-p)^2 for p = 0.77', () => {
    expect(binomialPmf(3, 0.77)[1]).toBeCloseTo(3 * 0.77 * 0.23 * 0.23, 10)
  })
  it('sums to 1 for 6 coins at p = 0.17', () => {
    const total = binomialPmf(6, 0.17).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 12)
  })
  it('is degenerate at p = 1', () => {
    expect(binomialPmf(3, 1)).toEqual([0, 0, 0, 1])
  })
})
