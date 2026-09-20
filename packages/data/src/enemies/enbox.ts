export interface EnBoxEntry { name: string; faction?: string; image?: string; risk?: string; page: string }

const ROW = /^\["(\d+)"\]\s*=\s*\{(.*)\},?\s*$/
const FIELD = /(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/g

/** Parses the wiki's Lua enemy index (`Module:EnBox/data`) into a map keyed by enemy id. */
export function parseEnBoxData(lua: string): Map<string, EnBoxEntry> {
  const out = new Map<string, EnBoxEntry>()
  for (const line of lua.split('\n')) {
    const row = ROW.exec(line.trim())
    if (!row) continue
    const fields: Record<string, string> = {}
    for (const m of row[2].matchAll(FIELD)) fields[m[1]] = m[2].replace(/\\"/g, '"')
    if (!fields.name || !fields.page) continue
    out.set(row[1], {
      name: fields.name,
      page: fields.page,
      ...(fields.faction ? { faction: fields.faction } : {}),
      ...(fields.image ? { image: fields.image } : {}),
      ...(fields.risk ? { risk: fields.risk } : {}),
    })
  }
  return out
}
