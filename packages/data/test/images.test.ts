import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Unit } from '@limbus/engine'
import { imageRefs, localImagePath, scrapeImages } from '../src/pipeline/images.ts'
import { WikiClient } from '../src/wiki/client.ts'

const unit = (over: Partial<Unit>): Unit => ({
  id: 'u', kind: 'identity', name: 'U', level: 60, hp: 1, hpGrowth: 0, speed: { min: 1, max: 1 }, defenseMod: 0,
  resistances: { damageType: { slash: 1, pierce: 1, blunt: 1 }, sin: { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 } },
  staggerThresholds: [], skills: [], passives: [], ...over,
})

describe('imageRefs / localImagePath', () => {
  it('collects distinct portraits and skill icons', () => {
    const units = [
      unit({ portrait: 'A Full.png', skills: [{ icon: 'Icon One' } as never, { icon: 'Icon One' } as never] }),
      unit({ id: 'v', portrait: 'A Full.png' }),
    ]
    expect(imageRefs(units)).toEqual(['A Full.png', 'Icon One.png'])
  })
  it('sanitizes filenames into a flat safe path', () => {
    expect(localImagePath('Yinglong-9568_portrait.png')).toBe('Yinglong-9568_portrait.png')
    expect(localImagePath('E.G.O::Spicebush Full.png')).toBe('E.G.O__Spicebush Full.png')
    expect(localImagePath('a/b c.png')).toBe('a_b c.png')
  })
  it('replaces every character that is unsafe in a URL path segment or on Windows', () => {
    expect(localImagePath('Is it You?! Sinclair Icon.png')).toBe('Is it You_! Sinclair Icon.png')
    expect(localImagePath('"Enwrap 330 times" Yi Sang Icon.png')).toBe('_Enwrap 330 times_ Yi Sang Icon.png')
    expect(localImagePath('a<b>c|d*e#f\\g.png')).toBe('a_b_c_d_e_f_g.png')
  })
  it('keeps distinct filenames distinct after sanitizing', () => {
    const names = [
      'Is it You?! Sinclair Icon.png',
      'Is it You!! Sinclair Icon.png',
      'Take the Hit to the Last Blow, Please? Hong Lu Icon.png',
      'You Win... Will You Play?.png',
      '"Revel with Soundless Applause" Yi Sang Icon.png',
    ]
    expect(new Set(names.map(localImagePath)).size).toBe(names.length)
  })
})

describe('scrapeImages', () => {
  it('downloads missing files, skips existing, records not-found, writes the manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'limbus-images-'))
    const outDir = mkdtempSync(join(tmpdir(), 'limbus-out-'))
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('titles=File%3AMissing.png')) return new Response(JSON.stringify({ query: { pages: { '-1': { missing: '' } } } }))
      if (url.includes('action=query')) return new Response(JSON.stringify({ query: { pages: { '1': { imageinfo: [{ url: 'https://img/x.png' }] } } } }))
      return new Response(new Uint8Array([1, 2, 3]))
    }) as unknown as typeof fetch
    const client = new WikiClient({ fetchImpl, sleep: async () => {}, delayMs: 0 })
    const units = [unit({ portrait: 'Have.png', skills: [{ icon: 'Missing' } as never] })]
    const manifest = await scrapeImages(client, units, dir, outDir, () => {})
    expect(manifest).toEqual({ 'Have.png': 'Have.png', 'Missing.png': null })
    expect(existsSync(join(dir, 'Have.png'))).toBe(true)
    expect(JSON.parse(readFileSync(join(outDir, 'images.json'), 'utf8'))).toEqual(manifest)
    const again = await scrapeImages(client, units, dir, outDir, () => {})
    expect(again['Have.png']).toBe('Have.png')
  })
})
