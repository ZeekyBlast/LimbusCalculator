import { describe, expect, it } from 'vitest'
import { parseNumberInput } from '../src/lib/inputs.ts'

describe('parseNumberInput', () => {
  it('returns undefined while the field is empty or half-typed', () => {
    expect(parseNumberInput('')).toBeUndefined()
    expect(parseNumberInput('   ')).toBeUndefined()
    expect(parseNumberInput('-')).toBeUndefined()
    expect(parseNumberInput('+')).toBeUndefined()
    expect(parseNumberInput('.')).toBeUndefined()
    expect(parseNumberInput('-.')).toBeUndefined()
  })
  it('returns undefined for anything that is not a finite number', () => {
    expect(parseNumberInput('abc')).toBeUndefined()
    expect(parseNumberInput('12abc')).toBeUndefined()
    expect(parseNumberInput('Infinity')).toBeUndefined()
    expect(parseNumberInput('-Infinity')).toBeUndefined()
    expect(parseNumberInput('NaN')).toBeUndefined()
  })
  it('parses the numbers a user can type, including negatives and zero', () => {
    expect(parseNumberInput('0')).toBe(0)
    expect(parseNumberInput('-12')).toBe(-12)
    expect(parseNumberInput('2.5')).toBe(2.5)
    expect(parseNumberInput('-0.5')).toBe(-0.5)
    expect(parseNumberInput('+7')).toBe(7)
    expect(parseNumberInput(' 45 ')).toBe(45)
    // A trailing separator is a complete number the user is still typing past.
    expect(parseNumberInput('1.')).toBe(1)
  })
})
