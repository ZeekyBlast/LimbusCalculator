import type { Unit } from '@limbus/engine'
import { parseIdentityPage } from '../identities/parse.ts'
import type { Failure } from '../types.ts'
import type { Log, WikiClient } from '../wiki/client.ts'

export interface IdentityScrape { units: Unit[]; failures: Failure[]; warnings: string[] }

export async function scrapeIdentities(client: WikiClient, log: Log, limit?: number): Promise<IdentityScrape> {
  log('fetching identity page list')
  let titles = (await client.fetchCategoryMembers('Identities')).filter(t => !t.startsWith('Category:') && t !== 'Identities')
  if (limit !== undefined) titles = titles.slice(0, limit)
  log(`found ${titles.length} identity pages`)

  const units: Unit[] = []
  const failures: Failure[] = []
  const warnings: string[] = []
  for (const [i, title] of titles.entries()) {
    try {
      const wikitext = await client.fetchWikitext(title)
      if (!wikitext) { failures.push({ subject: title, reason: 'missing page' }); continue }
      const parsed = parseIdentityPage(title, wikitext)
      if (!parsed) { failures.push({ subject: title, reason: 'no IDPage template found' }); continue }
      units.push(parsed.value)
      warnings.push(...parsed.warnings)
    } catch (e) {
      failures.push({ subject: title, reason: String(e) })
    }
    if ((i + 1) % 20 === 0) log(`  ${i + 1}/${titles.length}`)
  }
  return { units, failures, warnings }
}
