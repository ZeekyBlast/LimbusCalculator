// Reads the fetched status-effect icon filenames and writes a flat name manifest
// (no extension, longest-first) that the UI fuzzy-matches skill effect text against.
import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconDir = path.join(__dirname, '../generated/images/icons/status-effects')
const outPath = path.join(__dirname, '../generated/status-effect-icons.json')

const names = readdirSync(iconDir)
  .filter(f => f.toLowerCase().endsWith('.png'))
  .map(f => f.slice(0, -4))
  .sort((a, b) => b.length - a.length)

writeFileSync(outPath, JSON.stringify(names))
console.log(`Wrote ${names.length} status effect icon names to ${outPath}`)
