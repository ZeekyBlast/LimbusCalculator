import type { Effect, Passive, Skill, SkillUptieOverride, Unit, UptieTier } from '@limbus/engine'
import { parseEffectText } from '../effects/parse.ts'
import { changePoints, resolveWikiTiers, type WikiTierOverrides } from '../normalize/uptie.ts'
import {
  IDENTITY_LEVEL_CAP, maxHpAtLevel, normalizeDamageType, normalizeSin, parseSpeed, parseStaggerThresholds,
  resistanceMultiplier, toNumber,
} from '../normalize/values.ts'
import { DAMAGE_TYPES, SINS, type ParseResult } from '../types.ts'
import { cleanText, findTemplateBlocks, parseTemplate } from '../wiki/wikitext.ts'

/** Skill param keys in display order; `-N` suffixes are condition-gated variants the wiki lists as sub-tabs. */
export const IDENTITY_SKILL_KEYS: readonly string[] = [
  'skill1', 'skill1-2', 'skill1-3',
  'skill2', 'skill2-2', 'skill2-3',
  'skill3', 'skill3-2', 'skill3-3', 'skill3-4',
  'skill4',
]

const COIN_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const TIERS = [1, 2, 3] as const

function tierParam(params: Record<string, string>, key: string): WikiTierOverrides<string> {
  const out: WikiTierOverrides<string> = {}
  for (const t of TIERS) {
    const v = params[`${t}${key}`]
    if (v !== undefined && v.trim() !== '') out[t] = v
  }
  return out
}

function tierNumber(params: Record<string, string>, key: string, base: number): [number, number, number, number] {
  const raw = tierParam(params, key)
  const overrides: WikiTierOverrides<number> = {}
  for (const t of TIERS) {
    const n = toNumber(raw[t])
    if (n !== undefined) overrides[t] = n
  }
  return resolveWikiTiers(base, overrides)
}

function mapClean(over: WikiTierOverrides<string>): WikiTierOverrides<string> {
  const out: WikiTierOverrides<string> = {}
  for (const t of TIERS) if (over[t] !== undefined) out[t] = cleanText(over[t])
  return out
}

function hasCoinKey(params: Record<string, string>, k: number): boolean {
  return params[`ce${k}`] !== undefined || TIERS.some(tier => params[`${tier}ce${k}`] !== undefined)
}

function effectsForTier(skillText: string, coinTexts: string[]): Effect[] {
  const effects = parseEffectText(skillText, 'skill', 'on-use')
  coinTexts.forEach((text, i) => effects.push(...parseEffectText(text, { coin: i }, 'on-hit')))
  return effects
}

const sameEffects = (a: Effect[], b: Effect[]) => JSON.stringify(a) === JSON.stringify(b)

/** Shared by identities and enemies: one `{{Skill}}`/`{{UptieSkills}}` template to an engine Skill. */
export function parseSkillTemplate(raw: string, id: string, slot: Skill['slot'], variant: string | undefined, warnings: string[]): Skill | null {
  const t = parseTemplate(raw)
  if (!t) { warnings.push(`${id}: skill param is not a template`); return null }
  const p = t.params

  const sin = normalizeSin(p.sin)
  if (!sin) warnings.push(`${id}: unknown sin "${p.sin ?? ''}", defaulting to wrath`)
  const coinCount = toNumber(p.coin) ?? 1
  const basePowerTiers = tierNumber(p, 'spower', toNumber(p.spower) ?? 0)
  const coinPowerTiers = tierNumber(p, 'cpower', toNumber(p.cpower) ?? 0)

  const skillTextTiers = resolveWikiTiers(cleanText(p.se), mapClean(tierParam(p, 'se')))
  // Index coin texts by coin number, not by which `ceN` keys happen to exist: a skill with `ce2`
  // and `ce3` but no `ce1` must still put coin 2's text at index 1. Compacting the array would
  // shift every coin-scoped effect, `rawText.coins` entry and unbreakable-coin index by one.
  const highestCoin = COIN_KEYS.filter(k => hasCoinKey(p, k)).at(-1) ?? 0
  const coinTextTiers = COIN_KEYS.slice(0, highestCoin)
    .map(k => resolveWikiTiers(cleanText(p[`ce${k}`]), mapClean(tierParam(p, `ce${k}`))))
  const effectTiers = [0, 1, 2, 3].map(i => effectsForTier(skillTextTiers[i], coinTextTiers.map(c => c[i]))) as [Effect[], Effect[], Effect[], Effect[]]

  const uptie: Partial<Record<UptieTier, SkillUptieOverride>> = {}
  const merge = <K extends keyof SkillUptieOverride>(field: K, points: Partial<Record<UptieTier, SkillUptieOverride[K]>>) => {
    for (const [tier, value] of Object.entries(points) as [string, SkillUptieOverride[K]][]) {
      const tierNum = Number(tier) as UptieTier
      uptie[tierNum] = { ...(uptie[tierNum] ?? {}), [field]: value }
    }
  }
  merge('basePower', changePoints(basePowerTiers))
  merge('coinPower', changePoints(coinPowerTiers))
  merge('effects', changePoints(effectTiers, sameEffects))

  const baseCoinTexts = coinTextTiers.map(c => c[3])
  return {
    id,
    name: cleanText(p.name),
    slot,
    ...(variant ? { variant } : {}),
    sin: sin ?? 'wrath',
    damageType: normalizeDamageType(p.type),
    offenseLevelMod: toNumber(p.atkmod) ?? 0,
    basePower: basePowerTiers[3],
    coinPower: coinPowerTiers[3],
    coinCount,
    unbreakableCoins: baseCoinTexts.map((text, i) => (/unbreakable coin/i.test(text) ? i : -1)).filter(i => i >= 0 && i < coinCount),
    attackWeight: toNumber(p.atkweight) ?? 1,
    ...(p.icon ? { icon: p.icon.trim() } : {}),
    uptie,
    effects: effectTiers[3],
    rawText: { skill: skillTextTiers[3], coins: baseCoinTexts },
  }
}

export function parsePassiveTemplate(raw: string, warnings: string[], owner: string): Passive | null {
  const t = parseTemplate(raw)
  if (!t) { warnings.push(`${owner}: passive param is not a template`); return null }
  const text = cleanText(t.params['2'])
  return { name: cleanText(t.params['1']), text, effects: parseEffectText(text, 'skill', 'passive') }
}

/** Wiki portrait filenames replace ":" and "【】" with spaces (e.g. "E.G.O::Spicebush" -> "E.G.O Spicebush"). */
export function portraitFilename(title: string): string {
  return `${title.replace(/[:【】]+/g, ' ').replace(/\s+/g, ' ').trim()} Full.png`
}

export function parseIdentityPage(title: string, wikitext: string, levelCap: number = IDENTITY_LEVEL_CAP): ParseResult<Unit> | null {
  const block = findTemplateBlocks(wikitext, ['IDPage'])[0]
  if (!block) return null
  const p = block.params
  const warnings: string[] = []

  const damageType = { slash: 1, pierce: 1, blunt: 1 }
  for (const dt of DAMAGE_TYPES) {
    const m = resistanceMultiplier(p[dt])
    if (m === undefined) warnings.push(`${title}: missing ${dt} resistance, defaulting to 1`)
    else damageType[dt] = m
  }
  const sin = Object.fromEntries(SINS.map(s => [s, 1])) as Unit['resistances']['sin']

  const skills: Skill[] = []
  for (const key of IDENTITY_SKILL_KEYS) {
    if (!p[key]) continue
    const slot = key.slice(0, 6) as Skill['slot']
    const variant = key.includes('-') ? key.split('-')[1] : undefined
    const s = parseSkillTemplate(p[key], `${title}::${key}`, slot, variant, warnings)
    if (s) skills.push(s)
  }
  if (p.defense) {
    const d = parseSkillTemplate(p.defense, `${title}::defense`, 'defense', undefined, warnings)
    if (d) skills.push(d)
  }
  if (skills.length === 0) warnings.push(`${title}: no skills parsed`)

  const passives: Passive[] = []
  for (const n of [1, 2, 3]) {
    if (!p[`passive${n}`]) continue
    const pv = parsePassiveTemplate(p[`passive${n}`], warnings, title)
    if (pv) passives.push(pv)
  }

  const speed = parseSpeed(p.speed)
  if (!speed) warnings.push(`${title}: unparseable speed "${p.speed ?? ''}"`)
  const baseHp = toNumber(p.hp) ?? 0
  const hpGrowth = toNumber(p.hpgrowth) ?? 0

  return {
    value: {
      id: title,
      kind: 'identity',
      name: title,
      ...(p.sinner ? { group: p.sinner.trim() } : {}),
      portrait: portraitFilename(title),
      level: levelCap,
      hp: maxHpAtLevel(baseHp, hpGrowth, levelCap),
      hpGrowth,
      speed: speed ?? { min: 0, max: 0 },
      defenseMod: toNumber(p.defmod) ?? 0,
      resistances: { damageType, sin },
      staggerThresholds: parseStaggerThresholds(p, 3),
      skills,
      passives,
    },
    warnings,
  }
}
