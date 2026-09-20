import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanText, findTemplateBlocks, parseTemplate } from '../src/wiki/wikitext.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

describe('parseTemplate', () => {
  it('parses named and positional params with nested templates kept intact', () => {
    const t = parseTemplate('{{Passive|Collective Breathing|When this unit gains {{StatusEffect|Poise|b}}: do a thing|sin=Pride|req=2 Res}}')
    expect(t?.name).toBe('Passive')
    expect(t?.params['1']).toBe('Collective Breathing')
    expect(t?.params['2']).toBe('When this unit gains {{StatusEffect|Poise|b}}: do a thing')
    expect(t?.params.sin).toBe('Pride')
  })
  it('ignores trailing text after the closing braces', () => {
    expect(parseTemplate('{{Skill|name=X}} <!-- comment -->')?.params.name).toBe('X')
  })
  it('returns null for non-template input', () => {
    expect(parseTemplate('plain text')).toBeNull()
  })
})

describe('cleanText', () => {
  it('flattens wiki markup to readable text', () => {
    const raw = "At 5+ {{StatusEffect|Poise|b}} on self, Coin Power +1 <br> {{SkillCon|On Use}} Gain +2 {{StatusEffect|Poise|b}} Count"
    expect(cleanText(raw)).toBe('At 5+ Poise on self, Coin Power +1\n[On Use] Gain +2 Poise Count')
  })
  it('handles SkillHint, Keyword, links, bold, and html', () => {
    const raw = "{{SkillCon|On Use}} {{SkillHint|Consume all {{StatusEffect|Flower-burying Pin -埋花針- (Yinglong)|b}}}} on self [[:Category:X|Blade Lineage]] '''bold''' <b>空間斬</b> {{Keyword|H Corp.}} {{Icons|Abno Part Head}}"
    expect(cleanText(raw)).toBe('[On Use] Consume all Flower-burying Pin -埋花針- (Yinglong) on self Blade Lineage bold 空間斬 H Corp.')
  })
  it('returns empty string for undefined', () => {
    expect(cleanText(undefined)).toBe('')
  })
})

describe('findTemplateBlocks', () => {
  it('finds both ABPage blocks on the Yinglong page with their ids', () => {
    const blocks = findTemplateBlocks(fixture('enemy-yinglong.wikitext'), ['ABPage'])
    expect(blocks.map(b => b.params.id)).toEqual(['9568', '9569'])
    expect(blocks[0].start).toBeLessThan(blocks[1].start)
    expect(blocks[0].params.name).toBe('Refracted Yinglong')
  })
  it('matches template name prefixes so ENPage covers ENPage/Invidiae', () => {
    const blocks = findTemplateBlocks(fixture('enemy-station2-invidiae.wikitext'), ['ABPage', 'ENPage'])
    expect(blocks.length).toBeGreaterThanOrEqual(12)
    expect(blocks[0].name).toBe('ENPage/Invidiae')
    expect(blocks[0].params.sinner).toBe('Hong Lu')
  })
  it('skips the interior of matched blocks and returns only the requested names', () => {
    const abpage = findTemplateBlocks(fixture('enemy-yinglong.wikitext'), ['ABPage'])
    expect(abpage.every(b => b.name === 'ABPage')).toBe(true)
    const skills = findTemplateBlocks(fixture('enemy-yinglong.wikitext'), ['Skill'])
    expect(skills.length).toBeGreaterThan(10)
    expect(skills.every(b => b.name === 'Skill')).toBe(true)
  })
})
