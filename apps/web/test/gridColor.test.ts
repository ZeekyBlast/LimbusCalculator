import { describe, expect, it } from 'vitest'
import { cellColor } from '../src/lib/gridColor.ts'

describe('cellColor', () => {
  it('runs from blood at 0% through gold at 100%, and is neutral without a clash', () => {
    expect(cellColor(0)).toBe('rgba(140, 28, 28, 0.45)')
    expect(cellColor(1)).toBe('rgba(201, 162, 39, 0.45)')
    expect(cellColor(0.5)).toBe('rgba(171, 95, 34, 0.45)')
    expect(cellColor(null)).toBe('transparent')
  })
})
