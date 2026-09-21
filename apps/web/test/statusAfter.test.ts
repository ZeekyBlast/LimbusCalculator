import { describe, expect, it } from 'vitest'
import { statusRows } from '../src/lib/statusAfter.ts'

describe('statusRows', () => {
  it('names ids from the registry, formats whole numbers plainly and fractions to one decimal, and flags varies', () => {
    const rows = statusRows({ rupture: { potency: 3, count: 1 }, poise: { potency: 1.5, count: 0.5 }, 'strider-mao': { potency: 2, count: 1 } }, ['self:poise'], 'self')
    expect(rows).toEqual([
      { id: 'poise', name: 'Poise', potency: '1.5', count: '0.5', varies: true },
      { id: 'rupture', name: 'Rupture', potency: '3', count: '1', varies: false },
      { id: 'strider-mao', name: 'strider-mao', potency: '2', count: '1', varies: false },
    ])
  })
  it('only flags varies for its own side', () => {
    expect(statusRows({ bleed: { potency: 1, count: 1 } }, ['self:bleed'], 'target')[0].varies).toBe(false)
  })
  it('is empty for an empty state', () => {
    expect(statusRows({}, [], 'self')).toEqual([])
  })
})
