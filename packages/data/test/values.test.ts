import { describe, expect, it } from 'vitest'
import {
  maxHpAtLevel, normalizeDamageType, normalizeSin, parseSpeed, parseStaggerThresholds,
  resistanceMultiplier, statusId, toNumber,
} from '../src/normalize/values.ts'

describe('toNumber', () => {
  it('parses plain and plus-prefixed numbers, undefined otherwise', () => {
    expect(toNumber('4')).toBe(4)
    expect(toNumber('+ 4')).toBe(4)
    expect(toNumber('+2')).toBe(2)
    expect(toNumber('-3')).toBe(-3)
    expect(toNumber('2.4')).toBe(2.4)
    expect(toNumber('')).toBeUndefined()
    expect(toNumber(undefined)).toBeUndefined()
    expect(toNumber('abc')).toBeUndefined()
  })
})

describe('resistanceMultiplier', () => {
  it('maps words and numbers', () => {
    expect(resistanceMultiplier('Ineff')).toBe(0.5)
    expect(resistanceMultiplier('Ineff.')).toBe(0.5)
    expect(resistanceMultiplier('Ineffective')).toBe(0.5)
    expect(resistanceMultiplier('Endure')).toBe(0.75)
    expect(resistanceMultiplier('Endured')).toBe(0.75)
    expect(resistanceMultiplier('Normal')).toBe(1)
    expect(resistanceMultiplier('Weak')).toBe(1.5)
    expect(resistanceMultiplier('Fatal')).toBe(2)
    expect(resistanceMultiplier('1.25')).toBe(1.25)
    expect(resistanceMultiplier('')).toBeUndefined()
    expect(resistanceMultiplier('???')).toBeUndefined()
  })
})

describe('normalizeSin / normalizeDamageType', () => {
  it('lowercases sins and rejects unknowns', () => {
    expect(normalizeSin('Pride')).toBe('pride')
    expect(normalizeSin('gloom')).toBe('gloom')
    expect(normalizeSin('Hope')).toBeUndefined()
  })
  it('maps damage and defense types', () => {
    expect(normalizeDamageType('Slash')).toBe('slash')
    expect(normalizeDamageType('blunt')).toBe('blunt')
    expect(normalizeDamageType('Guard')).toBe('guard')
    expect(normalizeDamageType('Defense')).toBe('guard')
    expect(normalizeDamageType('Evade')).toBe('evade')
    expect(normalizeDamageType(undefined)).toBe('none')
  })
})

describe('parseSpeed / parseStaggerThresholds / maxHpAtLevel', () => {
  it('parses a~b speed', () => {
    expect(parseSpeed('4~8')).toEqual({ min: 4, max: 8 })
    expect(parseSpeed('1~1')).toEqual({ min: 1, max: 1 })
    expect(parseSpeed('')).toBeUndefined()
  })
  it('reads stagger1..N percentages into descending fractions, skipping blanks', () => {
    expect(parseStaggerThresholds({ stagger1: '70', stagger2: '40', stagger3: '20' }, 3)).toEqual([0.7, 0.4, 0.2])
    expect(parseStaggerThresholds({ stagger1: '65', stagger2: '35', stagger3: '' }, 3)).toEqual([0.65, 0.35])
    expect(parseStaggerThresholds({}, 5)).toEqual([])
  })
  it('computes hp + growth * level rounded, as the wiki displays it', () => {
    expect(maxHpAtLevel(73, 2.4, 60)).toBe(217)
    expect(maxHpAtLevel(1338, 61.7, 60)).toBe(5040)
  })
})

describe('statusId', () => {
  it('kebab-cases names and applies the engine aliases', () => {
    expect(statusId('Poise')).toBe('poise')
    expect(statusId('Bleed')).toBe('bleed')
    expect(statusId('Slash Fragility')).toBe('fragile-slash')
    expect(statusId('Pierce DMG Up')).toBe('damage-up-pierce')
    expect(statusId('Blunt Power Up')).toBe('power-up-blunt')
    expect(statusId('Damage Up')).toBe('damage-up')
    expect(statusId('Flower-burying Pin -埋花針- (Yinglong)')).toBe('flower-burying-pin-yinglong')
  })
})
