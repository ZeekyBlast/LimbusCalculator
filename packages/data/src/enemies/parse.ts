import type { Passive, Skill, Unit } from '@limbus/engine'
import { parsePassiveTemplate, parseSkillTemplate } from '../identities/parse.ts'
import { maxHpAtLevel, parseSpeed, parseStaggerThresholds, resistanceMultiplier, toNumber } from '../normalize/values.ts'
import { DAMAGE_TYPES, SINS, type ParseResult } from '../types.ts'
import { cleanText, findTemplateBlocks, parseTemplate, type TemplateBlock } from '../wiki/wikitext.ts'
import type { EnBoxEntry } from './enbox.ts'

export interface EnemyRef { id: string; name: string; page: string; anchor?: string; image?: string; faction?: string }

const ENEMY_TEMPLATES = ['ABPage', 'ENPage']

export function enemyRefFromEnBox(id: string, entry: EnBoxEntry): EnemyRef {
  const hash = entry.page.indexOf('#')
  return {
    id,
    name: entry.name,
    page: hash === -1 ? entry.page : entry.page.slice(0, hash),
    ...(hash === -1 ? {} : { anchor: entry.page.slice(hash + 1) }),
    ...(entry.image ? { image: entry.image } : {}),
    ...(entry.faction ? { faction: entry.faction } : {}),
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Matches the `id="..."` span or `==...==` heading that carries `anchor`, wiki-markup permitting. */
function anchorHeading(anchor: string): RegExp {
  const esc = escapeRegExp(anchor)
  return new RegExp(`(id="${esc}"|==\\s*(?:'''|<span[^>]*>)?\\s*${esc}\\s*(?:'''|</span>)?\\s*==)`)
}

/** The enemy block for `ref`: by `id` param when present, else the first block after the heading that carries the anchor. */
export function findEnemyBlock(wikitext: string, ref: EnemyRef): TemplateBlock | undefined {
  const blocks = findTemplateBlocks(wikitext, ENEMY_TEMPLATES)
  const byId = blocks.find(b => b.params.id?.trim() === ref.id)
  if (byId) return byId
  if (!ref.anchor) return blocks[0]
  const m = anchorHeading(ref.anchor).exec(wikitext)
  if (!m) return undefined
  return blocks.find(b => b.start > m.index)
}

/**
 * Some anchor headings carry a `{{For|...|Target{{!}}Label}}` hatnote instead of the enemy block
 * itself, when the wiki moved that enemy's stats to a subpage. Returns the subpage title, or
 * undefined if the heading isn't found or isn't followed by such a hatnote.
 */
export function findRedirectPage(wikitext: string, anchor: string): string | undefined {
  const m = anchorHeading(anchor).exec(wikitext)
  if (!m) return undefined
  const after = wikitext.slice(m.index + m[0].length, m.index + m[0].length + 500)
  const forBlock = findTemplateBlocks(after, ['For'])[0]
  if (!forBlock) return undefined
  const target = (forBlock.params['2'] ?? '').split('{{!}}')[0].trim()
  return target || undefined
}

type Params = Record<string, string>

function resistances(p: Params, warnings: string[], owner: string): Unit['resistances'] {
  const damageType = { slash: 1, pierce: 1, blunt: 1 }
  for (const dt of DAMAGE_TYPES) {
    const m = resistanceMultiplier(p[dt])
    if (m === undefined) warnings.push(`${owner}: missing ${dt} resistance, defaulting to 1`)
    else damageType[dt] = m
  }
  const sin = { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 }
  for (const s of SINS) {
    const m = resistanceMultiplier(p[s])
    if (m === undefined) warnings.push(`${owner}: missing ${s} resistance, defaulting to 1`)
    else sin[s] = m
  }
  return { damageType, sin }
}

function passivesOf(p: Params, warnings: string[], owner: string, keys: string[]): Passive[] {
  const out: Passive[] = []
  for (const k of keys) {
    if (!p[k]) continue
    const pv = parsePassiveTemplate(p[k], warnings, owner)
    if (pv) out.push(pv)
  }
  return out
}

function skillsOf(p: Params, unitId: string, keys: string[], slot: Skill['slot'], warnings: string[]): Skill[] {
  const out: Skill[] = []
  for (const k of keys) {
    if (!p[k]) continue
    const s = parseSkillTemplate(p[k], `${unitId}::${k}`, slot, undefined, warnings)
    if (s) out.push(s)
  }
  return out
}

const range = (prefix: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`)

export function parseEnemyBlock(block: TemplateBlock, ref: EnemyRef): ParseResult<Unit[]> {
  const warnings: string[] = []
  return block.name === 'ABPage'
    ? { value: parseAbnormality(block.params, ref, warnings), warnings }
    : { value: [parseSingleBody(block.params, ref, warnings)], warnings }
}

function parseAbnormality(p: Params, ref: EnemyRef, warnings: string[]): Unit[] {
  const parts = range('abnoparts', 1, 8)
    .map(k => p[k])
    .filter((raw): raw is string => Boolean(raw))
    .map(raw => parseTemplate(raw)?.params)
    .filter((q): q is Params => Boolean(q))
  if (parts.length === 0) return [parseSingleBody(p, ref, warnings)]

  const passives = passivesOf(p, warnings, ref.name, range('passive', 1, 5))
  const blockLevel = toNumber(p.level)
  const skillKeys = range('skill', 1, 13).filter(k => p[k])

  return parts.map((q, index) => {
    const unitId = `${ref.id}:${index}`
    const partName = cleanText(q.partsname) || `Part ${index + 1}`
    const level = toNumber(q.level) ?? blockLevel ?? 1
    const baseHp = toNumber(q.hp) ?? toNumber(p.hp) ?? 0
    const hpGrowth = toNumber(q.hpgrowth) ?? toNumber(p.hpgrowth) ?? 0
    const ownKeys = skillKeys.filter(k => {
      if (parts.length === 1) return true
      const label = cleanText(p[`skillparts${k.slice('skill'.length)}`])
      return label.includes(partName)
    })
    const speed = parseSpeed(q.speed)
    if (!speed) warnings.push(`${unitId}: unparseable speed "${q.speed ?? ''}"`)
    return {
      id: unitId,
      kind: 'enemy',
      name: partName,
      group: ref.name,
      ...(ref.image ? { portrait: ref.image } : {}),
      level,
      hp: maxHpAtLevel(baseHp, hpGrowth, level),
      hpGrowth,
      speed: speed ?? { min: 0, max: 0 },
      defenseMod: toNumber(q.defmod) ?? 0,
      resistances: resistances(q, warnings, unitId),
      staggerThresholds: parseStaggerThresholds(q, 5),
      skills: skillsOf(p, unitId, ownKeys, 'enemy', warnings),
      passives,
    }
  })
}

function parseSingleBody(p: Params, ref: EnemyRef, warnings: string[]): Unit {
  const unitId = `${ref.id}:0`
  const level = toNumber(p.level) ?? 1
  const baseHp = toNumber(p.hp) ?? 0
  const hpGrowth = toNumber(p.hpgrowth) ?? 0
  const speed = parseSpeed(p.speed)
  if (!speed) warnings.push(`${unitId}: unparseable speed "${p.speed ?? ''}"`)
  return {
    id: unitId,
    kind: 'enemy',
    name: ref.name,
    group: ref.name,
    ...(ref.image ? { portrait: ref.image } : {}),
    level,
    hp: maxHpAtLevel(baseHp, hpGrowth, level),
    hpGrowth,
    speed: speed ?? { min: 0, max: 0 },
    defenseMod: toNumber(p.defmod) ?? 0,
    resistances: resistances(p, warnings, unitId),
    staggerThresholds: parseStaggerThresholds(p, 4),
    skills: [
      ...skillsOf(p, unitId, range('skill', 1, 9), 'enemy', warnings),
      ...skillsOf(p, unitId, ['defense', 'defense2', 'defense3', 'defense4'], 'defense', warnings),
    ],
    passives: passivesOf(p, warnings, ref.name, ['passive0', ...range('passive', 1, 9)]),
  }
}
