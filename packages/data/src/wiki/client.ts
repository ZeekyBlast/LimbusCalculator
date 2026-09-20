const API = 'https://limbuscompany.wiki.gg/api.php'
const USER_AGENT = 'LimbusCalculator-DataScraper/0.2 (personal project; contact via GitHub)'

export type Log = (line: string) => void

export interface WikiClientOptions {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  delayMs?: number
  log?: Log
}

type Json = Record<string, any>

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** Rate-limited MediaWiki API client with retry on `ratelimited` and an in-memory wikitext cache. */
export class WikiClient {
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly delayMs: number
  private readonly log: Log
  private readonly cache = new Map<string, string | null>()

  constructor(options: WikiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sleep = options.sleep ?? defaultSleep
    this.delayMs = options.delayMs ?? 1000
    this.log = options.log ?? (() => {})
  }

  private async apiGet(params: Record<string, string>, retries = 5): Promise<Json> {
    const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await this.fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } })
      const data = (await res.json()) as Json
      if (data.error?.code === 'ratelimited') {
        const wait = 5000 * (attempt + 1)
        this.log(`rate limited, waiting ${wait}ms`)
        await this.sleep(wait)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      await this.sleep(this.delayMs)
      return data
    }
    throw new Error(`still rate limited after ${retries} retries: ${url}`)
  }

  async fetchWikitext(title: string): Promise<string | null> {
    if (this.cache.has(title)) return this.cache.get(title) ?? null
    const data = await this.apiGet({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' })
    if (data.error) {
      // `ratelimited` is already retried inside apiGet, so anything here is a different error.
      // `missingtitle` means the page genuinely doesn't exist; anything else (a transient
      // `internal_api_error_*`, an `invalidtitle`, ...) must not be silently recorded as missing.
      if (data.error.code === 'missingtitle') {
        this.cache.set(title, null)
        return null
      }
      throw new Error(`wiki API error "${data.error.code}" fetching "${title}"`)
    }
    const text = data.parse?.wikitext?.['*']
    if (typeof text !== 'string') throw new Error(`unexpected wiki API response fetching "${title}"`)
    this.cache.set(title, text)
    return text
  }

  async fetchCategoryMembers(category: string): Promise<string[]> {
    const titles: string[] = []
    let cmcontinue: string | undefined
    do {
      const data = await this.apiGet({
        action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmlimit: '500',
        ...(cmcontinue ? { cmcontinue } : {}),
      })
      titles.push(...(data.query?.categorymembers ?? []).map((m: { title: string }) => m.title))
      cmcontinue = data.continue?.cmcontinue
    } while (cmcontinue)
    return titles
  }

  async fetchImageUrl(filename: string): Promise<string | null> {
    const data = await this.apiGet({ action: 'query', titles: `File:${filename}`, prop: 'imageinfo', iiprop: 'url' })
    const page = Object.values(data.query?.pages ?? {})[0] as { missing?: string; imageinfo?: { url: string }[] } | undefined
    if (!page || page.missing !== undefined) return null
    return page.imageinfo?.[0]?.url ?? null
  }

  async download(url: string): Promise<Uint8Array> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await this.fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } })
      if (res.status === 429) { await this.sleep(5000 * (attempt + 1)); continue }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      await this.sleep(this.delayMs)
      return new Uint8Array(await res.arrayBuffer())
    }
    throw new Error(`download rate limited: ${url}`)
  }
}
