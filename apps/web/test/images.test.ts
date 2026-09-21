import { describe, expect, it } from 'vitest'
import { imageUrl, portraitUrl, skillIconUrl } from '../src/lib/images.ts'
import { makeRaw, makeSkill, makeUnit } from './fixtures.ts'

const images = makeRaw().images

describe('image urls', () => {
  it('resolves a manifest entry under base/images with the path segment encoded', () => {
    expect(imageUrl(images, 'Test Unit Full.png', '/LimbusCalculator/')).toBe('/LimbusCalculator/images/Test%20Unit%20Full.png')
  })
  it('returns undefined for missing filenames and null manifest entries', () => {
    expect(imageUrl(images, undefined, '/')).toBeUndefined()
    expect(imageUrl(images, 'Missing.png', '/')).toBeUndefined()
    expect(imageUrl(images, 'Not in manifest.png', '/')).toBeUndefined()
  })
  it('derives portrait and icon filenames from units and skills', () => {
    expect(portraitUrl(images, makeUnit(), '/')).toBe('/images/Test%20Unit%20Full.png')
    expect(skillIconUrl(images, makeSkill(), '/')).toBe('/images/Test%20Skill%20Icon.png')
    expect(skillIconUrl(images, makeSkill({ icon: undefined }), '/')).toBeUndefined()
  })
})
