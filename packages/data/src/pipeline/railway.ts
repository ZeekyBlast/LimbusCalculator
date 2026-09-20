import type { Unit } from '@limbus/engine'
import { parseEnBoxData } from '../enemies/enbox.ts'
import { enemyRefFromEnBox, findEnemyBlock, findRedirectPage, parseEnemyBlock } from '../enemies/parse.ts'
import { parseLinePage, type RailwayLine } from '../railway/parse.ts'
import type { Failure } from '../types.ts'
import type { Log, WikiClient } from '../wiki/client.ts'

export interface RailwayScrape { line: RailwayLine; units: Unit[]; failures: Failure[]; warnings: string[] }

export async function scrapeRailway(client: WikiClient, linePage: string, log: Log): Promise<RailwayScrape> {
  log(`fetching line page: ${linePage}`)
  const lineText = await client.fetchWikitext(linePage)
  if (!lineText) throw new Error(`line page not found: ${linePage}`)
  const line = parseLinePage(lineText)
  log(`${line.sections.length} sections, ${line.enemyIds.length} distinct enemy ids`)

  const luaText = await client.fetchWikitext('Module:EnBox/data')
  if (!luaText) throw new Error('Module:EnBox/data not found')
  const index = parseEnBoxData(luaText)

  const units: Unit[] = []
  const failures: Failure[] = []
  const warnings: string[] = []
  for (const id of line.enemyIds) {
    const entry = index.get(id)
    if (!entry) { failures.push({ subject: id, reason: 'not in Module:EnBox/data' }); continue }
    const ref = enemyRefFromEnBox(id, entry)
    try {
      const wikitext = await client.fetchWikitext(ref.page)
      if (!wikitext) { failures.push({ subject: id, reason: `page missing: ${ref.page}` }); continue }
      let block = findEnemyBlock(wikitext, ref)
      if (!block && ref.anchor) {
        const redirect = findRedirectPage(wikitext, ref.anchor)
        const redirectText = redirect ? await client.fetchWikitext(redirect) : null
        if (redirectText) block = findEnemyBlock(redirectText, ref)
      }
      if (!block) { failures.push({ subject: id, reason: `no enemy block for "${ref.anchor ?? ''}" on ${ref.page}` }); continue }
      const parsed = parseEnemyBlock(block, ref)
      units.push(...parsed.value)
      warnings.push(...parsed.warnings)
      log(`  ${id} ${ref.name}: ${parsed.value.length} unit(s)`)
    } catch (e) {
      failures.push({ subject: id, reason: String(e) })
    }
  }
  return { line, units, failures, warnings }
}
