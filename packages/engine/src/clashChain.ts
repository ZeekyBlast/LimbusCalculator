import { binomialPmf } from './binomial'

export interface ClashSide {
  basePower: number
  coinPower: number
  breakableCoins: number
  unbreakableCoins: number
  headsChance: number
  offenseLevel: number
  clashPowerBonus: number
}

export interface RoundOutcome { win: number; lose: number; tie: number }

export interface ChainResult {
  win: number
  lose: number
  draw: number
  coinsLeftIfWin: number[]
  coinsLeftIfLose: number[]
  parryRoundsExpected: number
}

/** The higher Offense Level gains 1 Clash Power per 3 levels of difference, rounded down. The lower side gains nothing. */
export function clashPowerLevelBonus(myLevel: number, otherLevel: number): number {
  return Math.max(0, Math.floor((myLevel - otherLevel) / 3))
}

/** One clash round: both sides flip every live coin; compare base + bonus + coinPower * heads. */
export function roundOutcome(a: ClashSide, aLive: number, b: ClashSide, bLive: number, aBonus: number, bBonus: number): RoundOutcome {
  const pa = binomialPmf(aLive, a.headsChance)
  const pb = binomialPmf(bLive, b.headsChance)
  let win = 0, lose = 0, tie = 0
  for (let ha = 0; ha <= aLive; ha++) {
    const powerA = a.basePower + aBonus + a.coinPower * ha
    for (let hb = 0; hb <= bLive; hb++) {
      const powerB = b.basePower + bBonus + b.coinPower * hb
      const pr = pa[ha] * pb[hb]
      if (powerA > powerB) win += pr
      else if (powerA < powerB) lose += pr
      else tie += pr
    }
  }
  return { win, lose, tie }
}

const TIE_EPSILON = 1e-12
/**
 * The game caps a clash at 99 parry rounds; past that it draws (limbuscompany.wiki.gg's Battles
 * page, and Syx's blog in the parry-bonus context). A state that can only ever tie therefore sits
 * at that cap rather than at zero parry rounds.
 */
const MAX_PARRY_ROUNDS = 99

/** Exact clash resolution as a Markov chain over (A breakable coins, B breakable coins). */
export function clashChain(a: ClashSide, b: ClashSide): ChainResult {
  const aSide = normalizeCoins(a)
  const bSide = normalizeCoins(b)
  const aBonus = clashPowerLevelBonus(aSide.offenseLevel, bSide.offenseLevel) + aSide.clashPowerBonus
  const bBonus = clashPowerLevelBonus(bSide.offenseLevel, aSide.offenseLevel) + bSide.clashPowerBonus
  const maxA = aSide.breakableCoins + aSide.unbreakableCoins
  const maxB = bSide.breakableCoins + bSide.unbreakableCoins
  const memo = new Map<string, ChainResult>()

  const blank = (): ChainResult => ({
    win: 0, lose: 0, draw: 0,
    coinsLeftIfWin: new Array<number>(maxA + 1).fill(0),
    coinsLeftIfLose: new Array<number>(maxB + 1).fill(0),
    parryRoundsExpected: 0,
  })

  function solve(x: number, y: number): ChainResult {
    const key = `${x},${y}`
    const cached = memo.get(key)
    if (cached) return cached
    const r = blank()
    if (x === 0 && y === 0) {
      r.draw = 1
    } else if (y === 0) {
      r.win = 1
      r.coinsLeftIfWin[x + aSide.unbreakableCoins] = 1
    } else if (x === 0) {
      r.lose = 1
      r.coinsLeftIfLose[y + bSide.unbreakableCoins] = 1
    } else {
      const o = roundOutcome(aSide, x + aSide.unbreakableCoins, bSide, y + bSide.unbreakableCoins, aBonus, bBonus)
      if (o.tie >= 1 - TIE_EPSILON) {
        r.draw = 1
        r.parryRoundsExpected = MAX_PARRY_ROUNDS
      } else {
        const denom = 1 - o.tie
        const onWin = solve(x, y - 1)
        const onLose = solve(x - 1, y)
        const mix = (pick: (c: ChainResult) => number) => (o.win * pick(onWin) + o.lose * pick(onLose)) / denom
        r.win = mix(c => c.win)
        r.lose = mix(c => c.lose)
        r.draw = mix(c => c.draw)
        for (let k = 0; k <= maxA; k++) r.coinsLeftIfWin[k] = mix(c => c.coinsLeftIfWin[k])
        for (let k = 0; k <= maxB; k++) r.coinsLeftIfLose[k] = mix(c => c.coinsLeftIfLose[k])
        r.parryRoundsExpected = o.tie / denom + mix(c => c.parryRoundsExpected)
      }
    }
    memo.set(key, r)
    return r
  }

  return solve(aSide.breakableCoins, bSide.breakableCoins)
}

/** A skill whose coins are all Unbreakable still has to lose a clash somehow: treat them as breakable for the win condition. */
function normalizeCoins(s: ClashSide): ClashSide {
  if (s.breakableCoins > 0 || s.unbreakableCoins === 0) return s
  return { ...s, breakableCoins: s.unbreakableCoins, unbreakableCoins: 0 }
}
