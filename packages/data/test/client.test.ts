import { describe, expect, it, vi } from 'vitest'
import { WikiClient } from '../src/wiki/client.ts'

function fakeFetch(responses: unknown[]): typeof fetch {
  let i = 0
  return vi.fn(async () => {
    const body = responses[Math.min(i++, responses.length - 1)]
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

describe('WikiClient', () => {
  it('returns wikitext and caches by title', async () => {
    const fetchImpl = fakeFetch([{ parse: { title: 'X', wikitext: { '*': '{{IDPage|hp=1}}' } } }])
    const client = new WikiClient({ fetchImpl, sleep: async () => {}, delayMs: 0 })
    expect(await client.fetchWikitext('X')).toBe('{{IDPage|hp=1}}')
    expect(await client.fetchWikitext('X')).toBe('{{IDPage|hp=1}}')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('returns null for a missing page', async () => {
    const client = new WikiClient({ fetchImpl: fakeFetch([{ error: { code: 'missingtitle' } }]), sleep: async () => {}, delayMs: 0 })
    expect(await client.fetchWikitext('Nope')).toBeNull()
  })
  it('rejects with the error code for a non-missingtitle API error, instead of treating it as missing', async () => {
    const client = new WikiClient({
      fetchImpl: fakeFetch([{ error: { code: 'internal_api_error_DBQueryError' } }]),
      sleep: async () => {},
      delayMs: 0,
    })
    await expect(client.fetchWikitext('X')).rejects.toThrow(/internal_api_error_DBQueryError/)
  })
  it('retries after a ratelimited error, sleeping in between', async () => {
    const sleep = vi.fn(async () => {})
    const fetchImpl = fakeFetch([{ error: { code: 'ratelimited' } }, { parse: { title: 'X', wikitext: { '*': 'ok' } } }])
    const client = new WikiClient({ fetchImpl, sleep, delayMs: 0 })
    expect(await client.fetchWikitext('X')).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalled()
  })
  it('pages through category members', async () => {
    const fetchImpl = fakeFetch([
      { query: { categorymembers: [{ title: 'A' }, { title: 'B' }] }, continue: { cmcontinue: 'x' } },
      { query: { categorymembers: [{ title: 'C' }] } },
    ])
    const client = new WikiClient({ fetchImpl, sleep: async () => {}, delayMs: 0 })
    expect(await client.fetchCategoryMembers('Identities')).toEqual(['A', 'B', 'C'])
  })
  it('resolves an image url', async () => {
    const fetchImpl = fakeFetch([{ query: { pages: { '1': { imageinfo: [{ url: 'https://img/x.png' }] } } } }])
    const client = new WikiClient({ fetchImpl, sleep: async () => {}, delayMs: 0 })
    expect(await client.fetchImageUrl('x.png')).toBe('https://img/x.png')
  })
})
