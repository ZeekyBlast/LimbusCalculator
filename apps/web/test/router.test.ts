import { describe, expect, it } from 'vitest'
import { href, parseRoute, type Route } from '../src/lib/router.ts'

describe('parseRoute', () => {
  it('maps the root and /railway under a base path', () => {
    expect(parseRoute('/LimbusCalculator/', '', '/LimbusCalculator/').name).toBe('clash')
    expect(parseRoute('/LimbusCalculator/railway', '?station=2', '/LimbusCalculator/')).toMatchObject({ name: 'railway' })
    expect((parseRoute('/LimbusCalculator/railway', '?station=2', '/LimbusCalculator/') as Extract<Route, { name: 'railway' }>).search.get('station')).toBe('2')
  })
  it('works with the default base and trailing slashes', () => {
    expect(parseRoute('/', '', '/').name).toBe('clash')
    expect(parseRoute('/railway/', '', '/').name).toBe('railway')
  })
  it('reports unknown paths', () => {
    expect(parseRoute('/nope', '', '/')).toEqual({ name: 'not-found', path: '/nope' })
  })
})

describe('href', () => {
  it('joins base, path and query', () => {
    expect(href('/railway', new URLSearchParams({ station: '3' }), '/LimbusCalculator/')).toBe('/LimbusCalculator/railway?station=3')
    expect(href('/', undefined, '/')).toBe('/')
    expect(href('/', new URLSearchParams(), '/')).toBe('/')
  })
})
