import { describe, expect, it } from 'vitest'
import { clashChain, clashPowerLevelBonus, roundOutcome, type ClashSide } from '../src/clashChain'
import { simulateClash } from '../src/legacy/clash'

function side(over: Partial<ClashSide> = {}): ClashSide {
  return { basePower: 4, coinPower: 3, breakableCoins: 2, unbreakableCoins: 0, headsChance: 0.5, offenseLevel: 45, clashPowerBonus: 0, ...over }
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Runs the legacy random simulator over a ClashSide pair and returns the same shape clashChain does. */
function monteCarlo(a: ClashSide, b: ClashSide, n: number, seed: number) {
  const rng = mulberry32(seed)
  const legacy = (s: ClashSide) => ({
    basePower: s.basePower,
    coinPower: s.coinPower,
    coinCount: s.breakableCoins + s.unbreakableCoins,
    unbreakableCoinCount: s.unbreakableCoins,
    level: s.offenseLevel,
    sanityPoints: Math.round(s.headsChance * 100 - 50),
  })
  const coinsLeftIfWin = new Array<number>(a.breakableCoins + a.unbreakableCoins + 1).fill(0)
  let wins = 0
  let parry = 0
  for (let i = 0; i < n; i++) {
    const s = simulateClash(legacy(a), legacy(b), rng)
    if (s.winner === 'a') {
      wins++
      coinsLeftIfWin[s.winnerCoinsRemaining]++
    }
    parry += s.parryRounds
  }
  return { win: wins / n, parryRoundsExpected: parry / n, coinsLeftIfWin: coinsLeftIfWin.map(c => c / n) }
}

describe('clashPowerLevelBonus', () => {
  it('gives floor(diff/3) to the higher side only', () => {
    expect(clashPowerLevelBonus(50, 44)).toBe(2)
    expect(clashPowerLevelBonus(44, 50)).toBe(0)
    expect(clashPowerLevelBonus(47, 45)).toBe(0)
  })
})

describe('roundOutcome', () => {
  it('is a certain win when A always exceeds B', () => {
    const o = roundOutcome(side({ basePower: 10, coinPower: 0 }), 1, side({ basePower: 3, coinPower: 0 }), 1, 0, 0)
    expect(o).toEqual({ win: 1, lose: 0, tie: 0 })
  })
  it('one fair coin each with base 0 coin power 1: tie half the time', () => {
    const o = roundOutcome(side({ basePower: 0, coinPower: 1 }), 1, side({ basePower: 0, coinPower: 1 }), 1, 0, 0)
    expect(o.win).toBeCloseTo(0.25)
    expect(o.lose).toBeCloseTo(0.25)
    expect(o.tie).toBeCloseTo(0.5)
  })
  it('negative coin power: heads lowers power', () => {
    const o = roundOutcome(side({ basePower: 10, coinPower: -4, headsChance: 1 }), 1, side({ basePower: 8, coinPower: 0 }), 1, 0, 0)
    expect(o.lose).toBe(1)
  })
})

describe('clashChain', () => {
  it('1 coin vs 1 coin fair symmetric: 50/50, one expected parry round', () => {
    const r = clashChain(side({ basePower: 0, coinPower: 1, breakableCoins: 1 }), side({ basePower: 0, coinPower: 1, breakableCoins: 1 }))
    expect(r.win).toBeCloseTo(0.5)
    expect(r.lose).toBeCloseTo(0.5)
    expect(r.draw).toBeCloseTo(0)
    expect(r.parryRoundsExpected).toBeCloseTo(1)
    expect(r.coinsLeftIfWin[1]).toBeCloseTo(0.5)
  })
  it('certain win keeps all coins and no parry', () => {
    const r = clashChain(side({ basePower: 9, coinPower: 0, breakableCoins: 1 }), side({ basePower: 3, coinPower: 0, breakableCoins: 2 }))
    expect(r.win).toBe(1)
    expect(r.coinsLeftIfWin).toEqual([0, 1])
    expect(r.parryRoundsExpected).toBe(0)
  })
  it('guaranteed tie every round is a draw at the 99-round parry cap', () => {
    const r = clashChain(side({ basePower: 5, coinPower: 0, breakableCoins: 1 }), side({ basePower: 5, coinPower: 0, breakableCoins: 1 }))
    expect(r.draw).toBe(1)
    expect(r.parryRoundsExpected).toBe(99)
  })
  it('win + lose + draw = 1 and coin distributions sum to win/lose', () => {
    const r = clashChain(side({ breakableCoins: 3, unbreakableCoins: 1 }), side({ basePower: 6, coinPower: 2, breakableCoins: 2, headsChance: 0.77 }))
    expect(r.win + r.lose + r.draw).toBeCloseTo(1, 12)
    expect(r.coinsLeftIfWin.reduce((x, y) => x + y, 0)).toBeCloseTo(r.win, 12)
    expect(r.coinsLeftIfLose.reduce((x, y) => x + y, 0)).toBeCloseTo(r.lose, 12)
  })
  it('unbreakable coins keep flipping and are never lost', () => {
    const r = clashChain(side({ breakableCoins: 1, unbreakableCoins: 2 }), side({ breakableCoins: 1 }))
    // A can only ever end with 1 breakable + 2 unbreakable = 3 live coins when it wins.
    expect(r.coinsLeftIfWin[3]).toBeCloseTo(r.win, 12)
  })
  it('all-unbreakable skill uses its coins as breakable for the win condition', () => {
    const r = clashChain(side({ breakableCoins: 0, unbreakableCoins: 2 }), side({ breakableCoins: 1 }))
    expect(r.win).toBeGreaterThan(0)
  })
  it('agrees with the legacy random simulator on wins, parry rounds, and coins left', () => {
    const a = side({ basePower: 3, coinPower: 4, breakableCoins: 2, headsChance: 0.6, offenseLevel: 50 })
    const b = side({ basePower: 5, coinPower: 2, breakableCoins: 3, headsChance: 0.5, offenseLevel: 44 })
    const exact = clashChain(a, b)
    const sim = monteCarlo(a, b, 200_000, 12345)
    expect(Math.abs(sim.win - exact.win)).toBeLessThan(0.005)
    expect(Math.abs(sim.parryRoundsExpected - exact.parryRoundsExpected)).toBeLessThan(0.02)
    expect(sim.coinsLeftIfWin).toHaveLength(exact.coinsLeftIfWin.length)
    exact.coinsLeftIfWin.forEach((p, k) => {
      expect(Math.abs(sim.coinsLeftIfWin[k] - p)).toBeLessThan(0.01)
    })
  })
  it('agrees with the legacy random simulator when side A holds an unbreakable coin', () => {
    const a = side({ basePower: 3, coinPower: 4, breakableCoins: 2, unbreakableCoins: 1, headsChance: 0.6, offenseLevel: 50 })
    const b = side({ basePower: 5, coinPower: 2, breakableCoins: 3, headsChance: 0.5, offenseLevel: 44 })
    const exact = clashChain(a, b)
    const sim = monteCarlo(a, b, 200_000, 54321)
    expect(Math.abs(sim.win - exact.win)).toBeLessThan(0.005)
    expect(Math.abs(sim.parryRoundsExpected - exact.parryRoundsExpected)).toBeLessThan(0.02)
    expect(sim.coinsLeftIfWin).toHaveLength(exact.coinsLeftIfWin.length)
    exact.coinsLeftIfWin.forEach((p, k) => {
      expect(Math.abs(sim.coinsLeftIfWin[k] - p)).toBeLessThan(0.01)
    })
  })
  it('keeps probabilities and coin distributions consistent over random inputs', () => {
    const rng = mulberry32(777)
    const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))
    const heads = () => [0.05, 0.5, 0.95][int(0, 2)]
    const random = () => side({
      basePower: int(0, 10),
      coinPower: int(-4, 8),
      breakableCoins: int(1, 5),
      unbreakableCoins: int(0, 2),
      headsChance: heads(),
      offenseLevel: int(30, 60),
    })
    for (let i = 0; i < 200; i++) {
      const a = random()
      const b = random()
      const r = clashChain(a, b)
      expect(Math.abs(r.win + r.lose + r.draw - 1)).toBeLessThan(1e-9)
      expect(Math.abs(r.coinsLeftIfWin.reduce((x, y) => x + y, 0) - r.win)).toBeLessThan(1e-9)
      expect(Math.abs(r.coinsLeftIfLose.reduce((x, y) => x + y, 0) - r.lose)).toBeLessThan(1e-9)
    }
  })
})
