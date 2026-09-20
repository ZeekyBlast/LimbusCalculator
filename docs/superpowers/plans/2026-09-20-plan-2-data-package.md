# Plan 2 of 3: Data Package (Wiki Scrapers and Normalized Game Data)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/data`, which scrapes limbuscompany.wiki.gg for every Identity and for every enemy on the live Refraction Railway line, normalizes them into the engine's `Unit` schema with structured effects, and commits the resulting JSON so the web app (Plan 3) builds from a clean clone.

**Architecture:** One TypeScript-native Node package (no bundler; Node's built-in type stripping runs `src/cli.ts` directly). A small wikitext template parser feeds three page parsers (Identity `IDPage`, enemy `ABPage`/`ENPage`/`ENPage/Invidiae`, Railway line page). A shared effect-text parser turns skill sentences into the engine's `Effect` shape, keeping unparsed lines as `{ kind: 'unparsed' }` so coverage is measurable. Pipelines glue a rate-limited wiki client to the parsers and write `out/*.json`. Committed wikitext fixtures make every parser testable offline.

**Tech Stack:** Node 22.18+ (type stripping unflagged), TypeScript 7 strict with `erasableSyntaxOnly`, Vitest. Zero runtime dependencies. Engine types via `import type` only.

**Spec:** `docs/superpowers/specs/2026-09-20-limbus-calculator-rebuild-design.md`, Section 5 (5.1 sources, 5.2 schema, 5.3 structured effects), Section 8 data testing, Section 9 step 2. Plan 1 (done) built `packages/engine`; Plan 3 builds `apps/web`.

## Global Constraints

- Node `>=22.18` (root `engines`); every TS file in `packages/data` must run under Node's type stripping: use `.ts` extensions in relative imports, `import type` for types, no enums, no parameter properties, no namespaces (`erasableSyntaxOnly: true`).
- `packages/data` has zero runtime dependencies. It imports from `@limbus/engine` with `import type` ONLY (the engine barrel re-exports `legacy/` modules that are not guaranteed erasable).
- Parsers are pure functions over strings. Only `src/wiki/client.ts` and `src/pipeline/*` touch the network or filesystem.
- Wiki fetches go through the MediaWiki API `action=parse&prop=wikitext` with a 1000 ms delay between requests, a User-Agent of `LimbusCalculator-DataScraper/0.2 (personal project; contact via GitHub)`, and retry on `ratelimited`.
- Output files under `packages/data/out/` are committed. Images under `packages/data/images/` are git-ignored.
- Every commit message ends with `Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV`.
- Test: `npm test -w @limbus/data` (Vitest). Typecheck: `npm run typecheck -w @limbus/data`.

## Facts about the wiki that the tasks rely on

- Identity pages use `{{IDPage ...}}`. Skill params are `skill1`, `skill1-2` (variant), ..., `skill4`, `defense`, `passive1..3`. Each skill is `{{UptieSkills ...}}` (or `{{Skill ...}}`) with `sin, slevel, name, type, spower, cpower, coin, amt, atkmod, atkweight, se, ce1..ce9` and lower-tier overrides prefixed `1`, `2`, `3` (`2spower`, `3se`, `1ce1`, ...). Wiki convention: the unprefixed value is Uptie 4; `Nxxx` is the value at tier N and every tier below it until a lower-prefixed override.
- Resistances on identities are words: `Ineff`, `Ineff.`, `Ineffective`, `Endure`, `Normal`, `Fatal`; a few pages use numbers.
- `stagger1..3` are percentages of max HP (70, 40, 20).
- Displayed HP for every template is `hp + hpgrowth × level` (rounded), where `level` defaults to the level cap. Identity level cap in Season 7 is 60.
- Enemy data lives in one of three templates on a page: `{{ABPage ...}}` (abnormalities and refracted humans: `id`, `name`, `hp`, `hpgrowth`, `level`, parts `abnoparts1..8` each `{{ABPage/Parts ...}}` with `partsname, level, hp, hpgrowth, speed, defmod, slash, pierce, blunt, wrath, lust, sloth, gluttony, gloom, pride, envy, stagger1..5` as NUMERIC multipliers, skills `skill1..13` each `{{Skill ...}}` with `skillparts<n>` naming the owning part, `passive1..5`), `{{ENPage ...}}` (single-body humans: `id, name, hp, hpgrowth, level, speed, defmod, slash..envy, stagger1..4, skill1..9, passive1..9`), and `{{ENPage/Invidiae ...}}` (Peccatula: identity-like, `prefix, sinner, level, hp, hpgrowth, speed, defmod, slash..envy` as WORDS, `stagger1..3, skill1..4, defense, defense2..4, passive0..9`, and no `id` param).
- One page can hold several enemy blocks (phases, sections). `Module:EnBox/data` maps every numeric enemy id to `{ name, faction, image, risk, page }` where `page` is `Title#Anchor`. ABPage/ENPage blocks carry `|id=<id>`; Invidiae blocks do not, so they are located by the heading that matches the anchor.
- The live Line page has `{{RRLine|title=...|start=...|stations=N}}`, a "Stage List" table with `Station #N: Name` cells, and an "Encounter Details" table with `Section #N : Name` rows, `Wave N` rows, and `{{EnBox|<id>}}` cells, with `Reinforcements` separating a second id list.

---

## File Structure

```
package.json                                 add @types/node devDep, engines >=22.18
packages/engine/src/types.ts                 add 'skill4' slot, Unit.portrait?, Skill.icon?
packages/data/package.json                   @limbus/data
packages/data/tsconfig.json
packages/data/vitest.config.ts
packages/data/README.md
packages/data/scripts/fetch-fixtures.sh      refresh test fixtures from the wiki
packages/data/test/fixtures/*.wikitext|.lua  committed wikitext samples
packages/data/src/wiki/wikitext.ts           parseTemplate, cleanText, findTemplateBlocks
packages/data/src/wiki/client.ts             WikiClient (network)
packages/data/src/normalize/values.ts        resistances, sins, damage types, speed, stagger, hp, statusId
packages/data/src/normalize/uptie.ts         wiki tier convention -> engine uptie overrides
packages/data/src/effects/parse.ts           effect text -> Effect[]
packages/data/src/identities/parse.ts        IDPage -> Unit
packages/data/src/enemies/enbox.ts           Module:EnBox/data -> Map
packages/data/src/enemies/parse.ts           enemy block -> Unit[]
packages/data/src/railway/parse.ts           Line page -> RailwayLine
packages/data/src/pipeline/identities.ts     scrapeIdentities
packages/data/src/pipeline/railway.ts        scrapeRailway
packages/data/src/pipeline/images.ts         scrapeImages
packages/data/src/pipeline/write.ts          writeOutputs
packages/data/src/cli.ts                     node src/cli.ts <identities|railway|images|all>
packages/data/out/{identities,enemies,railway,failures,meta,images}.json  committed outputs
packages/data/test/*.test.ts                 one per module + output validation
```

---

### Task 1: Package scaffold, engine type additions, fixtures

**Files:**
- Modify: `package.json` (root), `packages/engine/src/types.ts`, `.gitignore`
- Create: `packages/data/package.json`, `packages/data/tsconfig.json`, `packages/data/vitest.config.ts`, `packages/data/scripts/fetch-fixtures.sh`, `packages/data/test/fixtures/*`, `packages/data/src/types.ts`

**Interfaces:**
- Produces: the `@limbus/data` package; engine `Skill.slot` gains `'skill4'`, `Unit.portrait?: string`, `Skill.icon?: string`; shared data-side types in `src/types.ts` (`Failure`, `ParseResult`, `SINS`, `DAMAGE_TYPES`).

- [ ] **Step 1: Root package.json**

Add to `devDependencies`: `"@types/node": "^24.13.2"`. Change `engines` to `{ "node": ">=22.18" }`.

- [ ] **Step 2: Engine type additions**

In `packages/engine/src/types.ts`: change the `Skill.slot` union to `'skill1' | 'skill2' | 'skill3' | 'skill4' | 'defense' | 'enemy'`; add `/** Wiki image filename for the unit portrait, e.g. "Yinglong-9568_portrait.png". */ portrait?: string` to `Unit` after `group?`; add `/** Wiki image basename for the skill icon (without extension). */ icon?: string` to `Skill` after `variant?`.

Run: `npm run typecheck -w @limbus/engine && npm test -w @limbus/engine`
Expected: clean, 160 passed.

- [ ] **Step 3: Data package files**

`packages/data/package.json`:

```json
{
  "name": "@limbus/data",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json",
    "scrape": "node src/cli.ts all",
    "scrape:identities": "node src/cli.ts identities",
    "scrape:railway": "node src/cli.ts railway",
    "scrape:images": "node src/cli.ts images",
    "fixtures": "sh scripts/fetch-fixtures.sh"
  },
  "dependencies": {
    "@limbus/engine": "*"
  }
}
```

`packages/data/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src", "test"]
}
```

`packages/data/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
})
```

`packages/data/src/types.ts`:

```ts
import type { Sin, DamageType } from '@limbus/engine'

export const SINS: readonly Sin[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
export const DAMAGE_TYPES: readonly DamageType[] = ['slash', 'pierce', 'blunt']

export interface Failure {
  /** Page title or enemy id that failed. */
  subject: string
  reason: string
}

export interface ParseResult<T> {
  value: T
  warnings: string[]
}
```

Append to `.gitignore`:

```
# Scraped images (regenerate with npm run scrape:images -w @limbus/data)
packages/data/images/
```

- [ ] **Step 4: Fixture fetch script**

`packages/data/scripts/fetch-fixtures.sh`:

```sh
#!/usr/bin/env sh
# Refreshes the committed wikitext fixtures used by the parser tests.
set -e
cd "$(dirname "$0")/../test/fixtures"
UA="LimbusCalculator-DataScraper/0.2 (personal project; contact via GitHub)"
API="https://limbuscompany.wiki.gg/api.php"

get() {
  enc=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1")
  curl -s -A "$UA" "$API?format=json&action=parse&prop=wikitext&page=$enc" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.parse){console.error(JSON.stringify(j));process.exit(1)}process.stdout.write(j.parse.wikitext["*"])})' > "$2"
  echo "wrote $2 ($(wc -c < "$2") bytes)"
  sleep 1
}

get "Blade Lineage Salsu Don Quixote" identity-don-quixote.wikitext
get "Yinglong/Enemy" enemy-yinglong.wikitext
get "Shiomi Yoru/Enemy" enemy-shiomi-yoru.wikitext
get "Line 6: Maru no Uchi no Sanzu no Kawa/Station 2: Tarnishing" enemy-station2-invidiae.wikitext
get "Line 6: Maru no Uchi no Sanzu no Kawa" railway-line6.wikitext
get "Module:EnBox/data" enbox-data-full.lua
# Keep only the header, the Line 6 id range, and the closing brace so the fixture stays small.
node -e '
const fs=require("fs");const lines=fs.readFileSync("enbox-data-full.lua","utf8").split("\n");
const keep=lines.filter((l,i)=>i===0||/^\["95[3-7][0-9]"\]/.test(l)||l.trim()==="}");
fs.writeFileSync("enbox-data.lua",keep.join("\n"));fs.unlinkSync("enbox-data-full.lua");
console.log("wrote enbox-data.lua ("+keep.length+" lines)")'
```

Run: `mkdir -p packages/data/test/fixtures && sh packages/data/scripts/fetch-fixtures.sh`
Expected: six files written; `enemy-yinglong.wikitext` is about 22 KB and contains two `{{ABPage` blocks; `enbox-data.lua` has about 40 lines.

- [ ] **Step 5: Install and typecheck**

Run: `npm install && npm run typecheck`
Expected: clean for both workspaces (the data package has only `src/types.ts` so far).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold @limbus/data package with wiki fixtures; add portrait, icon, skill4 to engine types

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 2: Wikitext template parser

**Files:**
- Create: `packages/data/src/wiki/wikitext.ts`, `packages/data/test/wikitext.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Template { name: string; params: Record<string, string> }
export interface TemplateBlock extends Template { start: number; end: number }
export function parseTemplate(wikitext: string): Template | null
export function cleanText(text: string | undefined): string
export function findTemplateBlocks(wikitext: string, names: string[]): TemplateBlock[]
```

`findTemplateBlocks` returns every `{{Name ...}}` block whose name equals one of `names` or starts with `name + '/'` (so `'ENPage'` also matches `ENPage/Invidiae`), scanning left to right and skipping over each matched block so nested templates inside it are not returned.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/data -- wikitext`
Expected: FAIL, cannot find module `../src/wiki/wikitext.ts`.

- [ ] **Step 3: Implement**

```ts
// Minimal wikitext template parser for this wiki's flat `{{Name|key=value|...}}` style.
// Not a general MediaWiki parser: no conditionals or loops, just nested templates as param values.

export interface Template { name: string; params: Record<string, string> }
export interface TemplateBlock extends Template { start: number; end: number }

function splitTopLevel(str: string, sep: string): string[] {
  const parts: string[] = []
  let brace = 0
  let bracket = 0
  let cur = ''
  for (let i = 0; i < str.length; i++) {
    const two = str.slice(i, i + 2)
    if (two === '{{') { brace++; cur += two; i++; continue }
    if (two === '}}') { brace--; cur += two; i++; continue }
    if (two === '[[') { bracket++; cur += two; i++; continue }
    if (two === ']]') { bracket--; cur += two; i++; continue }
    if (str[i] === sep && brace === 0 && bracket === 0) { parts.push(cur); cur = ''; continue }
    cur += str[i]
  }
  parts.push(cur)
  return parts
}

function findTopLevelEquals(str: string): number {
  let brace = 0
  let bracket = 0
  for (let i = 0; i < str.length; i++) {
    const two = str.slice(i, i + 2)
    if (two === '{{') { brace++; i++; continue }
    if (two === '}}') { brace--; i++; continue }
    if (two === '[[') { bracket++; i++; continue }
    if (two === ']]') { bracket--; i++; continue }
    if (str[i] === '=' && brace === 0 && bracket === 0) return i
  }
  return -1
}

/** End index (exclusive) of the balanced `{{...}}` starting at `start`, or -1. */
function findTemplateEnd(str: string, start: number): number {
  let depth = 0
  for (let i = start; i < str.length - 1; i++) {
    const two = str.slice(i, i + 2)
    if (two === '{{') { depth++; i++; continue }
    if (two === '}}') { depth--; i++; if (depth === 0) return i + 1; continue }
  }
  return -1
}

function parseInner(inner: string): Template {
  const parts = splitTopLevel(inner, '|')
  const name = parts[0].trim()
  const params: Record<string, string> = {}
  let positional = 1
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const eq = findTopLevelEquals(part)
    if (eq === -1) params[String(positional++)] = part.trim()
    else params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return { name, params }
}

/** Parses one `{{Name|k=v|...}}` block. Trailing text after the closing braces is ignored. */
export function parseTemplate(wikitext: string): Template | null {
  const trimmed = wikitext.trim()
  if (!trimmed.startsWith('{{')) return null
  const end = findTemplateEnd(trimmed, 0)
  if (end === -1) return null
  return parseInner(trimmed.slice(2, end - 2))
}

/** Every block named one of `names` (exact, or `name/...`), in document order, skipping each block's interior. */
export function findTemplateBlocks(wikitext: string, names: string[]): TemplateBlock[] {
  const blocks: TemplateBlock[] = []
  let i = 0
  while (i < wikitext.length - 1) {
    if (wikitext.slice(i, i + 2) !== '{{') { i++; continue }
    const nameMatch = /^\{\{([^|{}\n]+)/.exec(wikitext.slice(i, i + 80))
    const name = nameMatch ? nameMatch[1].trim() : ''
    const wanted = names.some(n => name === n || name.startsWith(n + '/'))
    if (!wanted) { i += 2; continue }
    const end = findTemplateEnd(wikitext, i)
    if (end === -1) break
    const t = parseInner(wikitext.slice(i + 2, end - 2))
    blocks.push({ ...t, start: i, end })
    i = end
  }
  return blocks
}

/** Flattens inline templates, links, bold markup, and html down to readable text. */
export function cleanText(text: string | undefined): string {
  if (text == null) return ''
  let out = text
  out = out.replace(/\{\{SkillCon\|([^}|]+)\}\}/g, '[$1]')
  out = out.replace(/\{\{StatusEffect\|([^}|]+)(\|[^}]*)?\}\}/g, '$1')
  out = out.replace(/\{\{Keyword\|([^}|]+)(\|[^}]*)?\}\}/g, '$1')
  out = out.replace(/\{\{Icons\|[^}]*\}\}/g, '')
  out = out.replace(/\{\{SkillHint\|([^}]*)\}\}/g, '$1')
  out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  out = out.replace(/\[\[([^\]]+)\]\]/g, '$1')
  out = out.replace(/'''/g, '').replace(/''/g, '')
  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, '')
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ')
  return out.trim()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/data -- wikitext`
Expected: 9 passed. If a `cleanText` expectation differs only by whitespace, fix the implementation's whitespace collapsing, not the test.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "Add wikitext template parser with block finder

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 3: Value normalizers

**Files:**
- Create: `packages/data/src/normalize/values.ts`, `packages/data/test/values.test.ts`

**Interfaces:**
- Produces:

```ts
export const IDENTITY_LEVEL_CAP = 60
export function toNumber(raw: string | undefined): number | undefined
export function resistanceMultiplier(raw: string | undefined): number | undefined
export function normalizeSin(raw: string | undefined): Sin | undefined
export function normalizeDamageType(raw: string | undefined): SkillDamageType
export function parseSpeed(raw: string | undefined): { min: number; max: number } | undefined
export function parseStaggerThresholds(params: Record<string, string>, count: number): number[]
export function maxHpAtLevel(baseHp: number, growth: number, level: number): number
export function statusId(name: string): string
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  maxHpAtLevel, normalizeDamageType, normalizeSin, parseSpeed, parseStaggerThresholds,
  resistanceMultiplier, statusId, toNumber,
} from '../src/normalize/values.ts'

describe('toNumber', () => {
  it('parses plain and plus-prefixed numbers, undefined otherwise', () => {
    expect(toNumber('4')).toBe(4)
    expect(toNumber('+ 4')).toBe(4)
    expect(toNumber('+2')).toBe(2)
    expect(toNumber('-3')).toBe(-3)
    expect(toNumber('2.4')).toBe(2.4)
    expect(toNumber('')).toBeUndefined()
    expect(toNumber(undefined)).toBeUndefined()
    expect(toNumber('abc')).toBeUndefined()
  })
})

describe('resistanceMultiplier', () => {
  it('maps words and numbers', () => {
    expect(resistanceMultiplier('Ineff')).toBe(0.5)
    expect(resistanceMultiplier('Ineff.')).toBe(0.5)
    expect(resistanceMultiplier('Ineffective')).toBe(0.5)
    expect(resistanceMultiplier('Endure')).toBe(0.75)
    expect(resistanceMultiplier('Endured')).toBe(0.75)
    expect(resistanceMultiplier('Normal')).toBe(1)
    expect(resistanceMultiplier('Weak')).toBe(1.5)
    expect(resistanceMultiplier('Fatal')).toBe(2)
    expect(resistanceMultiplier('1.25')).toBe(1.25)
    expect(resistanceMultiplier('')).toBeUndefined()
    expect(resistanceMultiplier('???')).toBeUndefined()
  })
})

describe('normalizeSin / normalizeDamageType', () => {
  it('lowercases sins and rejects unknowns', () => {
    expect(normalizeSin('Pride')).toBe('pride')
    expect(normalizeSin('gloom')).toBe('gloom')
    expect(normalizeSin('Hope')).toBeUndefined()
  })
  it('maps damage and defense types', () => {
    expect(normalizeDamageType('Slash')).toBe('slash')
    expect(normalizeDamageType('blunt')).toBe('blunt')
    expect(normalizeDamageType('Guard')).toBe('guard')
    expect(normalizeDamageType('Defense')).toBe('guard')
    expect(normalizeDamageType('Evade')).toBe('evade')
    expect(normalizeDamageType(undefined)).toBe('none')
  })
})

describe('parseSpeed / parseStaggerThresholds / maxHpAtLevel', () => {
  it('parses a~b speed', () => {
    expect(parseSpeed('4~8')).toEqual({ min: 4, max: 8 })
    expect(parseSpeed('1~1')).toEqual({ min: 1, max: 1 })
    expect(parseSpeed('')).toBeUndefined()
  })
  it('reads stagger1..N percentages into descending fractions, skipping blanks', () => {
    expect(parseStaggerThresholds({ stagger1: '70', stagger2: '40', stagger3: '20' }, 3)).toEqual([0.7, 0.4, 0.2])
    expect(parseStaggerThresholds({ stagger1: '65', stagger2: '35', stagger3: '' }, 3)).toEqual([0.65, 0.35])
    expect(parseStaggerThresholds({}, 5)).toEqual([])
  })
  it('computes hp + growth * level rounded, as the wiki displays it', () => {
    expect(maxHpAtLevel(73, 2.4, 60)).toBe(217)
    expect(maxHpAtLevel(1338, 61.7, 60)).toBe(5040)
  })
})

describe('statusId', () => {
  it('kebab-cases names and applies the engine aliases', () => {
    expect(statusId('Poise')).toBe('poise')
    expect(statusId('Bleed')).toBe('bleed')
    expect(statusId('Slash Fragility')).toBe('fragile-slash')
    expect(statusId('Pierce DMG Up')).toBe('damage-up-pierce')
    expect(statusId('Blunt Power Up')).toBe('power-up-blunt')
    expect(statusId('Damage Up')).toBe('damage-up')
    expect(statusId('Flower-burying Pin -埋花針- (Yinglong)')).toBe('flower-burying-pin-yinglong')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/data -- values`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import type { Sin, SkillDamageType } from '@limbus/engine'
import { SINS } from '../types.ts'

/** Sinner level cap in Season 7; identities are stored at this level. */
export const IDENTITY_LEVEL_CAP = 60

export function toNumber(raw: string | undefined): number | undefined {
  if (raw == null) return undefined
  const cleaned = raw.trim().replace(/^\+\s*/, '')
  if (cleaned === '') return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

const RESISTANCE_WORDS: Record<string, number> = {
  ineff: 0.5, 'ineff.': 0.5, ineffective: 0.5,
  endure: 0.75, endured: 0.75,
  normal: 1,
  weak: 1.5,
  fatal: 2,
}

/** Word or numeric resistance to a damage multiplier (0.5 Ineffective .. 2 Fatal). */
export function resistanceMultiplier(raw: string | undefined): number | undefined {
  if (raw == null) return undefined
  const key = raw.trim().toLowerCase()
  if (key === '') return undefined
  if (key in RESISTANCE_WORDS) return RESISTANCE_WORDS[key]
  return toNumber(key)
}

export function normalizeSin(raw: string | undefined): Sin | undefined {
  const key = raw?.trim().toLowerCase()
  return SINS.find(s => s === key)
}

export function normalizeDamageType(raw: string | undefined): SkillDamageType {
  const key = raw?.trim().toLowerCase() ?? ''
  if (key === 'slash' || key === 'pierce' || key === 'blunt') return key
  if (key === 'guard' || key === 'defense') return 'guard'
  if (key === 'evade') return 'evade'
  return 'none'
}

export function parseSpeed(raw: string | undefined): { min: number; max: number } | undefined {
  const m = /^\s*(\d+)\s*[~-]\s*(\d+)\s*$/.exec(raw ?? '')
  if (!m) return undefined
  return { min: Number(m[1]), max: Number(m[2]) }
}

/** `stagger1..staggerN` percentages -> fractions of max HP in the order the wiki lists them (descending). */
export function parseStaggerThresholds(params: Record<string, string>, count: number): number[] {
  const out: number[] = []
  for (let i = 1; i <= count; i++) {
    const n = toNumber(params[`stagger${i}`])
    if (n !== undefined) out.push(n / 100)
  }
  return out
}

/** The wiki displays HP as hp + hpgrowth * level, rounded. */
export function maxHpAtLevel(baseHp: number, growth: number, level: number): number {
  return Math.round(baseHp + growth * level)
}

const STATUS_ALIASES: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(slash|pierce|blunt) fragility$/, m => `fragile-${m[1]}`],
  [/^(slash|pierce|blunt) dmg up$/, m => `damage-up-${m[1]}`],
  [/^(slash|pierce|blunt) dmg down$/, m => `damage-down-${m[1]}`],
  [/^(slash|pierce|blunt) power up$/, m => `power-up-${m[1]}`],
  [/^(slash|pierce|blunt) power down$/, m => `power-down-${m[1]}`],
]

/** Status name as written in skill text -> the engine registry's kebab-case id. */
export function statusId(name: string): string {
  const key = name.trim().toLowerCase()
  for (const [re, build] of STATUS_ALIASES) {
    const m = re.exec(key)
    if (m) return build(m)
  }
  return key
    .replace(/\([^)]*\)/g, m => ' ' + m.slice(1, -1) + ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/data -- values`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "Add value normalizers for resistances, sins, speed, stagger, hp, status ids

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 4: Uptie convention conversion

**Files:**
- Create: `packages/data/src/normalize/uptie.ts`, `packages/data/test/uptie.test.ts`

**Interfaces:**
- Produces:

```ts
export type WikiTierOverrides<T> = Partial<Record<1 | 2 | 3, T>>
export function resolveWikiTiers<T>(base: T, overrides: WikiTierOverrides<T>): [T, T, T, T]
export function changePoints<T>(tiers: [T, T, T, T], equal?: (a: T, b: T) => boolean): Partial<Record<UptieTier, T>>
```

Wiki convention: `base` is the Uptie 4 value; override `N` is the value at tier N and every lower tier until a lower-numbered override. Engine convention (`Skill.uptie`): an override at tier t applies from t upward until a higher tier overrides it, and the skill's base field is the value when no override applies. `resolveWikiTiers` computes the four per-tier values under the wiki rule; `changePoints` emits engine overrides at every tier whose value differs from the previous tier (tier 1 compared against tier 4, the engine base).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { changePoints, resolveWikiTiers } from '../src/normalize/uptie.ts'

describe('resolveWikiTiers', () => {
  it('applies an override to its tier and every lower tier', () => {
    expect(resolveWikiTiers(3, { 2: 2 })).toEqual([2, 2, 3, 3])
    expect(resolveWikiTiers(3, { 3: 2 })).toEqual([2, 2, 2, 3])
    expect(resolveWikiTiers(3, { 1: 1, 3: 2 })).toEqual([1, 2, 2, 3])
    expect(resolveWikiTiers(3, {})).toEqual([3, 3, 3, 3])
  })
})

describe('changePoints', () => {
  it('emits engine overrides where the value changes, relative to the tier-4 base', () => {
    expect(changePoints([2, 2, 3, 3])).toEqual({ 1: 2, 3: 3 })
    expect(changePoints([2, 2, 2, 3])).toEqual({ 1: 2, 4: 3 })
    expect(changePoints([1, 2, 2, 3])).toEqual({ 1: 1, 2: 2, 4: 3 })
    expect(changePoints([3, 2, 3, 3])).toEqual({ 2: 2, 3: 3 })
    expect(changePoints([3, 3, 3, 3])).toEqual({})
  })
  it('accepts a custom equality for arrays', () => {
    const eq = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)
    expect(changePoints([['a'], ['a'], ['b'], ['b']], eq)).toEqual({ 1: ['a'], 3: ['b'] })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/data -- uptie`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import type { UptieTier } from '@limbus/engine'

export type WikiTierOverrides<T> = Partial<Record<1 | 2 | 3, T>>

/** Wiki rule: `base` is Uptie 4; override N covers tier N and every lower tier down to the next lower override. */
export function resolveWikiTiers<T>(base: T, overrides: WikiTierOverrides<T>): [T, T, T, T] {
  const at = (tier: number): T => {
    for (const n of [1, 2, 3] as const) {
      if (n >= tier && overrides[n] !== undefined) return overrides[n] as T
    }
    return base
  }
  return [at(1), at(2), at(3), at(4)]
}

/** Engine rule: an override at tier t applies upward until a higher override. Emit one wherever the value changes. */
export function changePoints<T>(tiers: [T, T, T, T], equal: (a: T, b: T) => boolean = (a, b) => a === b): Partial<Record<UptieTier, T>> {
  const out: Partial<Record<UptieTier, T>> = {}
  if (!equal(tiers[0], tiers[3])) out[1] = tiers[0]
  for (const t of [2, 3, 4] as const) {
    if (!equal(tiers[t - 1], tiers[t - 2])) out[t] = tiers[t - 1]
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/data -- uptie`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "Add wiki-to-engine uptie tier conversion

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 5: Effect text parser

**Files:**
- Create: `packages/data/src/effects/parse.ts`, `packages/data/test/effects.test.ts`

**Interfaces:**
- Consumes: `statusId` (Task 3); engine types `Effect`, `EffectTrigger`, `Condition`, `Operation`.
- Produces:

```ts
export function parseEffectText(text: string, scope: Effect['scope'], defaultTrigger: EffectTrigger): Effect[]
export function effectCoverage(effects: Effect[]): { total: number; parsed: number }
```

Grammar (spec 5.3). Each non-empty line is independent. Leading `[Tag]` tokens set the trigger (`On Use`, `Combat Start`, `Clash Win`, `Clash Lose`, `On Hit`, `Heads Hit`, `Tails Hit`, `On Crit`, `Attack End`); any other tag makes the line unparsed. An optional condition prefix `At N+ Stat[ Count| Potency][ on self|target],` / `If target has N+ Stat[ Count],` / `If self has ...` / `If at N+ Stat Count,` yields a `Condition`. The remainder must be exactly one of: `Coin Power ±N`, `Base Power ±N`, `Final Power ±N` (recorded as basePower), `Clash Power ±N`, `[Deal ]±N% [more ]damage[ on Critical Hit]` (on Critical Hit switches the trigger to `on-crit`), or a status grant `Gain|Inflict [+]N Stat[ Count| Potency][ next turn]` optionally followed by ` and [+]N Stat[ Count]` clauses that reuse the verb. Lines containing `for every`, `instead`, `(max`, `Reuse`, `this Coin`, or `final Coin` are unparsed. Anything else is unparsed. Unparsed effects keep the mapped trigger (or the default) and the full line as `source`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { effectCoverage, parseEffectText } from '../src/effects/parse.ts'

const one = (text: string, scope: 'skill' | { coin: number } = 'skill', trigger: 'on-use' | 'on-hit' | 'passive' = 'on-use') =>
  parseEffectText(text, scope, trigger)

describe('parseEffectText', () => {
  it('parses a conditional coin power line', () => {
    const [e] = one('At 5+ Poise on self, Coin Power +1')
    expect(e.trigger).toBe('on-use')
    expect(e.scope).toBe('skill')
    expect(e.condition).toEqual({ stat: 'poise', side: 'self', field: 'potency', op: '>=', value: 5 })
    expect(e.op).toEqual({ kind: 'coinPower', delta: 1 })
    expect(e.source).toBe('At 5+ Poise on self, Coin Power +1')
  })
  it('parses tagged status grants with potency and count', () => {
    const [e] = one('[On Use] Gain +2 Poise Count')
    expect(e.trigger).toBe('on-use')
    expect(e.op).toEqual({ kind: 'applyStatus', target: 'self', status: 'poise', count: 2 })
    const [h] = one('[On Hit] Inflict 2 Rupture', { coin: 0 }, 'on-hit')
    expect(h.trigger).toBe('on-hit')
    expect(h.scope).toEqual({ coin: 0 })
    expect(h.op).toEqual({ kind: 'applyStatus', target: 'target', status: 'rupture', potency: 2 })
  })
  it('splits "and" clauses that reuse the verb', () => {
    const es = one('[On Hit] Inflict 3 Rupture and +2 Rupture Count', { coin: 0 }, 'on-hit')
    expect(es).toHaveLength(2)
    expect(es[0].op).toEqual({ kind: 'applyStatus', target: 'target', status: 'rupture', potency: 3 })
    expect(es[1].op).toEqual({ kind: 'applyStatus', target: 'target', status: 'rupture', count: 2 })
  })
  it('parses target and count conditions', () => {
    expect(one('If target has 3+ Rupture, Coin Power +1')[0].condition).toEqual({ stat: 'rupture', side: 'target', field: 'potency', op: '>=', value: 3 })
    expect(one('If at 3+ Poise Count, Coin Power +1')[0].condition).toEqual({ stat: 'poise', side: 'self', field: 'count', op: '>=', value: 3 })
    expect(one('[On Use] At 6+ Poise, Coin Power +1')[0].condition?.side).toBe('self')
  })
  it('parses power and damage operations', () => {
    expect(one('Base Power +2')[0].op).toEqual({ kind: 'basePower', delta: 2 })
    expect(one('Final Power +1')[0].op).toEqual({ kind: 'basePower', delta: 1 })
    expect(one('[Clash Win] Clash Power +2')[0].op).toEqual({ kind: 'clashPower', delta: 2 })
    expect(one('Coin Power -1')[0].op).toEqual({ kind: 'coinPower', delta: -1 })
    expect(one('Deal +20% damage')[0].op).toEqual({ kind: 'damagePercent', delta: 0.2 })
    const crit = one('+30% Damage on Critical Hit')[0]
    expect(crit.op).toEqual({ kind: 'damagePercent', delta: 0.3 })
    expect(crit.trigger).toBe('on-crit')
  })
  it('parses next-turn grants and passive text', () => {
    expect(one('[On Hit] Inflict 2 Bind next turn', { coin: 1 }, 'on-hit')[0].op).toEqual({ kind: 'applyStatus', target: 'target', status: 'bind', potency: 2 })
    expect(one('Gain 1 Protection', 'skill', 'passive')[0].trigger).toBe('passive')
  })
  it('leaves scaling, reuse, unknown tags, and ally targeting unparsed', () => {
    for (const line of [
      'Coin Power +1 for every 7 Poise on self (max 3)',
      '[Clash Lose] Deal -80% damage and damage dealt by this Skill cannot Stagger the target',
      '[Unclashable] [Target Fixed]',
      '[On Crit] To 1 ally that either has no Poise or has the least Poise Potency, apply 2 Poise',
      '[On Use] Consume all Flower-burying Pin on self and Reuse the final Coin',
      'Unbreakable Coin',
    ]) {
      const [e] = one(line)
      expect(e.op).toEqual({ kind: 'unparsed' })
      expect(e.source).toBe(line)
    }
    expect(one('[Clash Lose] Deal -80% damage and damage dealt by this Skill cannot Stagger the target')[0].trigger).toBe('clash-lose')
  })
  it('handles multi-line text and empty input', () => {
    const es = one('At 5+ Poise on self, Coin Power +1\n[On Use] Gain +2 Poise Count')
    expect(es).toHaveLength(2)
    expect(one('')).toEqual([])
    expect(one('  \n ')).toEqual([])
  })
})

describe('effectCoverage', () => {
  it('counts parsed versus total', () => {
    const es = one('At 5+ Poise on self, Coin Power +1\nCoin Power +1 for every 7 Poise on self (max 3)')
    expect(effectCoverage(es)).toEqual({ total: 2, parsed: 1 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/data -- effects`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import type { Condition, Effect, EffectTrigger, Operation } from '@limbus/engine'
import { statusId } from '../normalize/values.ts'

const TAG_TRIGGERS: Record<string, EffectTrigger> = {
  'On Use': 'on-use',
  'Combat Start': 'combat-start',
  'Clash Win': 'clash-win',
  'Clash Lose': 'clash-lose',
  'On Hit': 'on-hit',
  'Heads Hit': 'heads-hit',
  'Tails Hit': 'tails-hit',
  'On Crit': 'on-crit',
  'Attack End': 'attack-end',
}

const UNSUPPORTED = /\b(for every|instead|\(max|max \d|Reuse|this Coin|final Coin)\b/i
const TAG = /^\[([^\]]+)\]\s*/
const CONDITION = /^(At|If at|If target has|If self has|If this unit has)\s+(\d+)\+\s+(.+?)(?:\s+(Count|Potency))?(?:\s+on\s+(self|target))?,\s*(.*)$/i
const POWER = /^(Coin Power|Base Power|Final Power|Clash Power)\s*([+-]\s*\d+)$/i
const DAMAGE = /^(?:Deal\s+)?([+-]\s*\d+)%\s+(?:more\s+)?damage(\s+on Critical Hit)?$/i
const GRANT_FIRST = /^(Gain|Inflict)\s+\+?(\d+)\s+(.+?)(?:\s+(Count|Potency))?(?:\s+next turn)?$/i
const GRANT_REST = /^\+?(\d+)\s+(.+?)(?:\s+(Count|Potency))?(?:\s+next turn)?$/i

/** Splits skill/passive text into lines and parses each into one or more engine Effects. */
export function parseEffectText(text: string, scope: Effect['scope'], defaultTrigger: EffectTrigger): Effect[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .flatMap(line => parseLine(line, scope, defaultTrigger))
}

export function effectCoverage(effects: Effect[]): { total: number; parsed: number } {
  return { total: effects.length, parsed: effects.filter(e => e.op.kind !== 'unparsed').length }
}

function parseLine(line: string, scope: Effect['scope'], defaultTrigger: EffectTrigger): Effect[] {
  let rest = line
  let trigger = defaultTrigger
  let unknownTag = false
  for (let m = TAG.exec(rest); m; m = TAG.exec(rest)) {
    const mapped = TAG_TRIGGERS[m[1]]
    if (mapped) trigger = mapped
    else unknownTag = true
    rest = rest.slice(m[0].length)
  }
  const unparsed = (): Effect[] => [{ trigger, scope, op: { kind: 'unparsed' }, source: line }]
  if (unknownTag || UNSUPPORTED.test(rest)) return unparsed()

  let condition: Condition | undefined
  const c = CONDITION.exec(rest)
  if (c) {
    const prefix = c[1].toLowerCase()
    const side = prefix.includes('target') || c[5]?.toLowerCase() === 'target' ? 'target' : 'self'
    condition = { stat: statusId(c[3]), side, field: c[4]?.toLowerCase() === 'count' ? 'count' : 'potency', op: '>=', value: Number(c[2]) }
    rest = c[6]
  }

  const ops = parseOperations(rest)
  if (!ops) return unparsed()
  if (ops.critOnly) trigger = 'on-crit'
  return ops.ops.map(op => ({ trigger, scope, ...(condition ? { condition } : {}), op, source: line }))
}

function signed(raw: string): number {
  return Number(raw.replace(/\s+/g, ''))
}

function parseOperations(rest: string): { ops: Operation[]; critOnly: boolean } | null {
  const power = POWER.exec(rest)
  if (power) {
    const kind = power[1].toLowerCase()
    const delta = signed(power[2])
    if (kind === 'coin power') return { ops: [{ kind: 'coinPower', delta }], critOnly: false }
    if (kind === 'clash power') return { ops: [{ kind: 'clashPower', delta }], critOnly: false }
    return { ops: [{ kind: 'basePower', delta }], critOnly: false }
  }
  const damage = DAMAGE.exec(rest)
  if (damage) return { ops: [{ kind: 'damagePercent', delta: signed(damage[1]) / 100 }], critOnly: Boolean(damage[2]) }

  const clauses = rest.split(/\s+and\s+/i)
  const first = GRANT_FIRST.exec(clauses[0])
  if (!first) return null
  const target = first[1].toLowerCase() === 'gain' ? 'self' : 'target'
  const ops: Operation[] = [grant(target, first[2], first[3], first[4])]
  for (const clause of clauses.slice(1)) {
    const m = GRANT_REST.exec(clause)
    if (!m) return null
    ops.push(grant(target, m[1], m[2], m[3]))
  }
  return { ops, critOnly: false }
}

function grant(target: 'self' | 'target', amount: string, name: string, dimension: string | undefined): Operation {
  const n = Number(amount)
  const status = statusId(name)
  return dimension?.toLowerCase() === 'count'
    ? { kind: 'applyStatus', target, status, count: n }
    : { kind: 'applyStatus', target, status, potency: n }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/data -- effects`
Expected: 9 passed. If `Unbreakable Coin` parses as anything but unparsed, or `[Unclashable]` is not treated as an unknown tag, fix the implementation.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "Add structured effect parser with coverage counter

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 6: Identity page parser

**Files:**
- Create: `packages/data/src/identities/parse.ts`, `packages/data/test/identities.test.ts`

**Interfaces:**
- Consumes: `findTemplateBlocks`, `parseTemplate`, `cleanText` (Task 2); `values.ts` (Task 3); `resolveWikiTiers`, `changePoints` (Task 4); `parseEffectText` (Task 5); engine `Unit`, `Skill`, `Passive`, `Effect`, `SkillUptieOverride`, `UptieTier`.
- Produces:

```ts
export const IDENTITY_SKILL_KEYS: readonly string[]
export function parseIdentityPage(title: string, wikitext: string, levelCap?: number): ParseResult<Unit> | null
export function parseSkillTemplate(raw: string, id: string, slot: Skill['slot'], variant: string | undefined, warnings: string[]): Skill | null
export function parsePassiveTemplate(raw: string, warnings: string[], owner: string): Passive | null
export function portraitFilename(title: string): string
```

`parseSkillTemplate` is shared with the enemy parser (Task 7): it reads the common `Skill`/`UptieSkills` params, resolves tier overrides for `spower`, `cpower`, `se`, `ce1..ce9`, and builds `effects`, `uptie`, `unbreakableCoins`, and `rawText`. Skill `id` is `${unitId}::${paramKey}`.

- [ ] **Step 1: Write the failing tests**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseIdentityPage } from '../src/identities/parse.ts'

const wikitext = readFileSync(new URL('./fixtures/identity-don-quixote.wikitext', import.meta.url), 'utf8')
const TITLE = 'Blade Lineage Salsu Don Quixote'

describe('parseIdentityPage', () => {
  const result = parseIdentityPage(TITLE, wikitext)
  const unit = result!.value

  it('returns null when no IDPage template exists', () => {
    expect(parseIdentityPage('X', '== nothing ==')).toBeNull()
  })
  it('maps unit-level stats at the level cap', () => {
    expect(unit.id).toBe(TITLE)
    expect(unit.kind).toBe('identity')
    expect(unit.group).toBe('Don Quixote')
    expect(unit.level).toBe(60)
    expect(unit.hp).toBe(217)
    expect(unit.hpGrowth).toBe(2.4)
    expect(unit.speed).toEqual({ min: 4, max: 8 })
    expect(unit.defenseMod).toBe(-2)
    expect(unit.resistances.damageType).toEqual({ slash: 0.5, pierce: 1, blunt: 2 })
    expect(unit.resistances.sin).toEqual({ wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 })
    expect(unit.staggerThresholds).toEqual([0.7, 0.4, 0.2])
    expect(unit.portrait).toBe('Blade Lineage Salsu Don Quixote Full.png')
  })
  it('parses the three attack skills and the defense skill', () => {
    expect(unit.skills.map(s => s.slot)).toEqual(['skill1', 'skill2', 'skill3', 'defense'])
    const s1 = unit.skills[0]
    expect(s1.id).toBe(`${TITLE}::skill1`)
    expect(s1.name).toBe('Draw of the Sword')
    expect(s1.sin).toBe('pride')
    expect(s1.damageType).toBe('pierce')
    expect(s1.basePower).toBe(3)
    expect(s1.coinPower).toBe(4)
    expect(s1.coinCount).toBe(2)
    expect(s1.offenseLevelMod).toBe(1)
    expect(s1.attackWeight).toBe(1)
    expect(s1.icon).toBe('Draw of the Sword Don Quixote Icon')
    expect(s1.unbreakableCoins).toEqual([])
    expect(s1.rawText.skill).toBe('At 5+ Poise on self, Coin Power +1\n[On Use] Gain +2 Poise Count')
    expect(s1.rawText.coins).toEqual(['[On Hit] Gain 1 Poise', '[On Hit] Gain 1 Poise'])
  })
  it('converts wiki tier overrides to engine uptie overrides', () => {
    const s1 = unit.skills[0]
    expect(s1.uptie[1]?.basePower).toBe(2)
    expect(s1.uptie[2]?.basePower).toBeUndefined()
    expect(s1.uptie[3]?.basePower).toBe(3)
    expect(s1.uptie[4]?.basePower).toBeUndefined()
    const evade = unit.skills[3]
    expect(evade.damageType).toBe('evade')
    expect(evade.basePower).toBe(3)
    expect(evade.coinPower).toBe(10)
    expect(evade.uptie[1]?.basePower).toBe(2)
    expect(evade.uptie[4]?.basePower).toBe(3)
  })
  it('builds base effects from the uptie-4 text and tier-1 effects from the 3se/3ce overrides', () => {
    const s1 = unit.skills[0]
    expect(s1.effects).toHaveLength(4)
    expect(s1.effects[0]).toMatchObject({ trigger: 'on-use', scope: 'skill', condition: { stat: 'poise', value: 5 }, op: { kind: 'coinPower', delta: 1 } })
    expect(s1.effects[1].op).toEqual({ kind: 'applyStatus', target: 'self', status: 'poise', count: 2 })
    expect(s1.effects[2]).toMatchObject({ trigger: 'on-hit', scope: { coin: 0 }, op: { kind: 'applyStatus', target: 'self', status: 'poise', potency: 1 } })
    expect(s1.effects[3].scope).toEqual({ coin: 1 })
    const tier1 = s1.uptie[1]?.effects
    expect(tier1).toHaveLength(3)
    expect(tier1?.[0].op).toEqual({ kind: 'applyStatus', target: 'self', status: 'poise', count: 2 })
    expect(tier1?.[1].trigger).toBe('heads-hit')
    expect(s1.uptie[4]?.effects).toHaveLength(4)
  })
  it('parses passives with names, text, and effects', () => {
    expect(unit.passives.map(p => p.name)).toEqual(['Collective Breathing', 'Nightly Stroll'])
    expect(unit.passives[0].text.startsWith('When this unit gains Poise Potency')).toBe(true)
    expect(unit.passives[0].effects[0].trigger).toBe('passive')
  })
  it('reports no warnings for a well-formed page', () => {
    expect(result!.warnings).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/data -- identities`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import type { Effect, Passive, Skill, SkillUptieOverride, Unit, UptieTier } from '@limbus/engine'
import { parseEffectText } from '../effects/parse.ts'
import { changePoints, resolveWikiTiers, type WikiTierOverrides } from '../normalize/uptie.ts'
import {
  IDENTITY_LEVEL_CAP, maxHpAtLevel, normalizeDamageType, normalizeSin, parseSpeed, parseStaggerThresholds,
  resistanceMultiplier, toNumber,
} from '../normalize/values.ts'
import { DAMAGE_TYPES, SINS, type ParseResult } from '../types.ts'
import { cleanText, findTemplateBlocks, parseTemplate } from '../wiki/wikitext.ts'

/** Skill param keys in display order; `-N` suffixes are condition-gated variants the wiki lists as sub-tabs. */
export const IDENTITY_SKILL_KEYS: readonly string[] = [
  'skill1', 'skill1-2', 'skill1-3',
  'skill2', 'skill2-2', 'skill2-3',
  'skill3', 'skill3-2', 'skill3-3', 'skill3-4',
  'skill4',
]

const COIN_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const TIERS = [1, 2, 3] as const

function tierParam(params: Record<string, string>, key: string): WikiTierOverrides<string> {
  const out: WikiTierOverrides<string> = {}
  for (const t of TIERS) {
    const v = params[`${t}${key}`]
    if (v !== undefined && v.trim() !== '') out[t] = v
  }
  return out
}

function tierNumber(params: Record<string, string>, key: string, base: number): [number, number, number, number] {
  const raw = tierParam(params, key)
  const overrides: WikiTierOverrides<number> = {}
  for (const t of TIERS) {
    const n = toNumber(raw[t])
    if (n !== undefined) overrides[t] = n
  }
  return resolveWikiTiers(base, overrides)
}

function mapClean(over: WikiTierOverrides<string>): WikiTierOverrides<string> {
  const out: WikiTierOverrides<string> = {}
  for (const t of TIERS) if (over[t] !== undefined) out[t] = cleanText(over[t])
  return out
}

function effectsForTier(skillText: string, coinTexts: string[]): Effect[] {
  const effects = parseEffectText(skillText, 'skill', 'on-use')
  coinTexts.forEach((text, i) => effects.push(...parseEffectText(text, { coin: i }, 'on-hit')))
  return effects
}

const sameEffects = (a: Effect[], b: Effect[]) => JSON.stringify(a) === JSON.stringify(b)

/** Shared by identities and enemies: one `{{Skill}}`/`{{UptieSkills}}` template to an engine Skill. */
export function parseSkillTemplate(raw: string, id: string, slot: Skill['slot'], variant: string | undefined, warnings: string[]): Skill | null {
  const t = parseTemplate(raw)
  if (!t) { warnings.push(`${id}: skill param is not a template`); return null }
  const p = t.params

  const sin = normalizeSin(p.sin)
  if (!sin) warnings.push(`${id}: unknown sin "${p.sin ?? ''}", defaulting to wrath`)
  const coinCount = toNumber(p.coin) ?? 1
  const basePowerTiers = tierNumber(p, 'spower', toNumber(p.spower) ?? 0)
  const coinPowerTiers = tierNumber(p, 'cpower', toNumber(p.cpower) ?? 0)

  const skillTextTiers = resolveWikiTiers(cleanText(p.se), mapClean(tierParam(p, 'se')))
  const coinTextTiers = COIN_KEYS
    .filter(k => p[`ce${k}`] !== undefined || TIERS.some(tier => p[`${tier}ce${k}`] !== undefined))
    .map(k => resolveWikiTiers(cleanText(p[`ce${k}`]), mapClean(tierParam(p, `ce${k}`))))
  const effectTiers = [0, 1, 2, 3].map(i => effectsForTier(skillTextTiers[i], coinTextTiers.map(c => c[i]))) as [Effect[], Effect[], Effect[], Effect[]]

  const uptie: Partial<Record<UptieTier, SkillUptieOverride>> = {}
  const merge = <K extends keyof SkillUptieOverride>(field: K, points: Partial<Record<UptieTier, SkillUptieOverride[K]>>) => {
    for (const [tier, value] of Object.entries(points) as [string, SkillUptieOverride[K]][]) {
      const tierNum = Number(tier) as UptieTier
      uptie[tierNum] = { ...(uptie[tierNum] ?? {}), [field]: value }
    }
  }
  merge('basePower', changePoints(basePowerTiers))
  merge('coinPower', changePoints(coinPowerTiers))
  merge('effects', changePoints(effectTiers, sameEffects))

  const baseCoinTexts = coinTextTiers.map(c => c[3])
  return {
    id,
    name: cleanText(p.name),
    slot,
    ...(variant ? { variant } : {}),
    sin: sin ?? 'wrath',
    damageType: normalizeDamageType(p.type),
    offenseLevelMod: toNumber(p.atkmod) ?? 0,
    basePower: basePowerTiers[3],
    coinPower: coinPowerTiers[3],
    coinCount,
    unbreakableCoins: baseCoinTexts.map((text, i) => (/unbreakable coin/i.test(text) ? i : -1)).filter(i => i >= 0 && i < coinCount),
    attackWeight: toNumber(p.atkweight) ?? 1,
    ...(p.icon ? { icon: p.icon.trim() } : {}),
    uptie,
    effects: effectTiers[3],
    rawText: { skill: skillTextTiers[3], coins: baseCoinTexts },
  }
}

export function parsePassiveTemplate(raw: string, warnings: string[], owner: string): Passive | null {
  const t = parseTemplate(raw)
  if (!t) { warnings.push(`${owner}: passive param is not a template`); return null }
  const text = cleanText(t.params['2'])
  return { name: cleanText(t.params['1']), text, effects: parseEffectText(text, 'skill', 'passive') }
}

/** Wiki portrait filenames replace ":" and "【】" with spaces (e.g. "E.G.O::Spicebush" -> "E.G.O Spicebush"). */
export function portraitFilename(title: string): string {
  return `${title.replace(/[:【】]+/g, ' ').replace(/\s+/g, ' ').trim()} Full.png`
}

export function parseIdentityPage(title: string, wikitext: string, levelCap: number = IDENTITY_LEVEL_CAP): ParseResult<Unit> | null {
  const block = findTemplateBlocks(wikitext, ['IDPage'])[0]
  if (!block) return null
  const p = block.params
  const warnings: string[] = []

  const damageType = { slash: 1, pierce: 1, blunt: 1 }
  for (const dt of DAMAGE_TYPES) {
    const m = resistanceMultiplier(p[dt])
    if (m === undefined) warnings.push(`${title}: missing ${dt} resistance, defaulting to 1`)
    else damageType[dt] = m
  }
  const sin = Object.fromEntries(SINS.map(s => [s, 1])) as Unit['resistances']['sin']

  const skills: Skill[] = []
  for (const key of IDENTITY_SKILL_KEYS) {
    if (!p[key]) continue
    const slot = key.slice(0, 6) as Skill['slot']
    const variant = key.includes('-') ? key.split('-')[1] : undefined
    const s = parseSkillTemplate(p[key], `${title}::${key}`, slot, variant, warnings)
    if (s) skills.push(s)
  }
  if (p.defense) {
    const d = parseSkillTemplate(p.defense, `${title}::defense`, 'defense', undefined, warnings)
    if (d) skills.push(d)
  }

  const passives: Passive[] = []
  for (const n of [1, 2, 3]) {
    if (!p[`passive${n}`]) continue
    const pv = parsePassiveTemplate(p[`passive${n}`], warnings, title)
    if (pv) passives.push(pv)
  }

  const speed = parseSpeed(p.speed)
  if (!speed) warnings.push(`${title}: unparseable speed "${p.speed ?? ''}"`)
  const baseHp = toNumber(p.hp) ?? 0
  const hpGrowth = toNumber(p.hpgrowth) ?? 0

  return {
    value: {
      id: title,
      kind: 'identity',
      name: title,
      ...(p.sinner ? { group: p.sinner.trim() } : {}),
      portrait: portraitFilename(title),
      level: levelCap,
      hp: maxHpAtLevel(baseHp, hpGrowth, levelCap),
      hpGrowth,
      speed: speed ?? { min: 0, max: 0 },
      defenseMod: toNumber(p.defmod) ?? 0,
      resistances: { damageType, sin },
      staggerThresholds: parseStaggerThresholds(p, 3),
      skills,
      passives,
    },
    warnings,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/data -- identities`
Expected: 7 passed. If a literal string (passive text, a coin line) differs from the real fixture content, inspect the fixture and correct the test's literal (the fixture is the source of truth); never weaken a structural assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "Add identity page parser producing engine Units

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 7: Enemy index and enemy block parser

**Files:**
- Create: `packages/data/src/enemies/enbox.ts`, `packages/data/src/enemies/parse.ts`, `packages/data/test/enemies.test.ts`

**Interfaces:**
- Consumes: Task 2 wikitext helpers; Task 3 normalizers; `parseSkillTemplate`, `parsePassiveTemplate` (Task 6).
- Produces:

```ts
export interface EnBoxEntry { name: string; faction?: string; image?: string; risk?: string; page: string }
export function parseEnBoxData(lua: string): Map<string, EnBoxEntry>
export interface EnemyRef { id: string; name: string; page: string; anchor?: string; image?: string; faction?: string }
export function enemyRefFromEnBox(id: string, entry: EnBoxEntry): EnemyRef
export function findEnemyBlock(wikitext: string, ref: EnemyRef): TemplateBlock | undefined
export function parseEnemyBlock(block: TemplateBlock, ref: EnemyRef): ParseResult<Unit[]>
```

Unit ids are `${enemyId}:${partIndex}` (`:0` for single-body enemies). `group` is the enemy's EnBox name; `name` is the part name (ABPage) or the enemy name (ENPage). Every part carries the block's passives. `level` is the part's (or block's) stated level and `hp` is `maxHpAtLevel(hp, hpgrowth, level)`. Skills on ABPage blocks are assigned to the part whose `partsname` appears in the skill's `skillparts<n>` text; when the block has exactly one part, every skill goes to it.

- [ ] **Step 1: Write the failing tests**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEnBoxData } from '../src/enemies/enbox.ts'
import { enemyRefFromEnBox, findEnemyBlock, parseEnemyBlock } from '../src/enemies/parse.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const enbox = parseEnBoxData(fixture('enbox-data.lua'))
const ref = (id: string) => enemyRefFromEnBox(id, enbox.get(id)!)

describe('parseEnBoxData', () => {
  it('reads id rows into entries and splits page anchors', () => {
    expect(enbox.size).toBeGreaterThanOrEqual(30)
    expect(enbox.get('9568')).toEqual({ name: 'Refracted Yinglong', faction: 'Yinglong', image: 'Yinglong-9568_portrait.png', risk: 'WAW', page: 'Yinglong/Enemy#Refracted Yinglong' })
    expect(ref('9568')).toMatchObject({ id: '9568', page: 'Yinglong/Enemy', anchor: 'Refracted Yinglong' })
    expect(ref('9543').page).toBe('Line 6: Maru no Uchi no Sanzu no Kawa/Station 2: Tarnishing')
  })
})

describe('findEnemyBlock', () => {
  it('prefers the block whose id param matches', () => {
    const wikitext = fixture('enemy-yinglong.wikitext')
    expect(findEnemyBlock(wikitext, ref('9568'))?.params.id).toBe('9568')
    expect(findEnemyBlock(wikitext, ref('9569'))?.params.id).toBe('9569')
  })
  it('falls back to the heading anchor for blocks without an id', () => {
    const wikitext = fixture('enemy-station2-invidiae.wikitext')
    expect(findEnemyBlock(wikitext, ref('9543'))?.params.sinner).toBe('Hong Lu')
    expect(findEnemyBlock(wikitext, ref('9538'))?.params.sinner).toBe('Yi Sang')
  })
  it('returns undefined when nothing matches', () => {
    expect(findEnemyBlock('== nothing ==', ref('9568'))).toBeUndefined()
  })
})

describe('parseEnemyBlock: ABPage with parts', () => {
  const wikitext = fixture('enemy-yinglong.wikitext')
  const { value: units, warnings } = parseEnemyBlock(findEnemyBlock(wikitext, ref('9568'))!, ref('9568'))

  it('emits one unit per part with numeric resistances and hp at the stated level', () => {
    expect(units.map(u => u.id)).toEqual(['9568:0', '9568:1'])
    expect(units.map(u => u.name)).toEqual(['Inverted Scale', 'Head'])
    expect(units[0].group).toBe('Refracted Yinglong')
    expect(units[0].kind).toBe('enemy')
    expect(units[0].level).toBe(60)
    expect(units[0].hp).toBe(5040)
    expect(units[1].hp).toBe(7427)
    expect(units[0].speed).toEqual({ min: 1, max: 1 })
    expect(units[0].defenseMod).toBe(5)
    expect(units[0].resistances.damageType).toEqual({ slash: 1, pierce: 1, blunt: 1 })
    expect(units[0].resistances.sin).toEqual({ wrath: 1, lust: 0.75, sloth: 0.75, gluttony: 1.5, gloom: 1.5, pride: 1, envy: 1.5 })
    expect(units[0].staggerThresholds).toEqual([])
    expect(units[0].portrait).toBe('Yinglong-9568_portrait.png')
    expect(warnings).toEqual([])
  })
  it('assigns skills to parts by the skillparts label', () => {
    expect(units[0].skills).toHaveLength(1)
    const scale = units[0].skills[0]
    expect(scale.id).toBe('9568:0::skill1')
    expect(scale.slot).toBe('enemy')
    expect(scale.name).toBe('Wrath of the Inverted Scale [逆鱗之禍]')
    expect(scale.sin).toBe('wrath')
    expect(scale.damageType).toBe('pierce')
    expect(scale.basePower).toBe(2)
    expect(scale.coinPower).toBe(1)
    expect(scale.coinCount).toBe(2)
    expect(scale.attackWeight).toBe(7)
    expect(scale.unbreakableCoins).toEqual([0, 1])
    expect(scale.uptie).toEqual({})
    expect(units[1].skills).toHaveLength(6)
    expect(units[1].skills.map(s => s.basePower)).toEqual([3, 4, 4, 3, 4, 18])
  })
  it('attaches block passives to every part', () => {
    expect(units[0].passives.length).toBeGreaterThan(0)
    expect(units[0].passives).toEqual(units[1].passives)
  })
  it('parses the phase-3 block into three parts', () => {
    const p3 = parseEnemyBlock(findEnemyBlock(wikitext, ref('9569'))!, ref('9569')).value
    expect(p3).toHaveLength(3)
    expect(p3[0].staggerThresholds).toEqual([0.7, 0.3, 0])
  })
})

describe('parseEnemyBlock: ABPage single part (refracted human)', () => {
  it('parses Shiomi Yoru as one body with stagger and 1.2 slash', () => {
    const wikitext = fixture('enemy-shiomi-yoru.wikitext')
    const units = parseEnemyBlock(findEnemyBlock(wikitext, ref('9550'))!, ref('9550')).value
    expect(units).toHaveLength(1)
    expect(units[0].id).toBe('9550:0')
    expect(units[0].name).toBe('Body')
    expect(units[0].level).toBe(77)
    expect(units[0].hp).toBe(1918)
    expect(units[0].staggerThresholds).toEqual([0.2])
    expect(units[0].resistances.damageType.slash).toBe(1.2)
    expect(units[0].skills.length).toBeGreaterThanOrEqual(5)
    expect(units[0].skills[0]).toMatchObject({ name: 'Twinslash [二連]', basePower: 7, coinPower: 3, coinCount: 2, offenseLevelMod: -3 })
  })
})

describe('parseEnemyBlock: ENPage/Invidiae', () => {
  it('parses a Peccatulum as an identity-like single unit with word resistances', () => {
    const wikitext = fixture('enemy-station2-invidiae.wikitext')
    const { value: units } = parseEnemyBlock(findEnemyBlock(wikitext, ref('9543'))!, ref('9543'))
    expect(units).toHaveLength(1)
    const u = units[0]
    expect(u.id).toBe('9543:0')
    expect(u.name).toBe('Refracted Peccatulum Invidiae - The Lord of Hongyuan Hong Lu Class 2')
    expect(u.level).toBe(60)
    expect(u.hp).toBe(192)
    expect(u.speed).toEqual({ min: 4, max: 8 })
    expect(u.defenseMod).toBe(-2)
    expect(u.resistances.damageType).toEqual({ slash: 0.5, pierce: 1, blunt: 2 })
    expect(u.resistances.sin.wrath).toBe(2)
    expect(u.resistances.sin.gloom).toBe(0.75)
    expect(u.staggerThresholds).toEqual([0.65, 0.35])
    expect(u.skills.map(s => s.slot)).toEqual(['enemy', 'enemy', 'enemy', 'defense'])
    expect(u.skills[0].name).toBe('I Wish to Open the Path')
    expect(u.passives.length).toBeGreaterThanOrEqual(3)
  })
  it('locates the Yi Sang block by anchor and reads its first skill', () => {
    const wikitext = fixture('enemy-station2-invidiae.wikitext')
    const units = parseEnemyBlock(findEnemyBlock(wikitext, ref('9538'))!, ref('9538')).value
    expect(units[0].skills[0].name).toBe('Cut Down and Trample')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/data -- enemies`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement enbox.ts**

```ts
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
```

- [ ] **Step 4: Implement parse.ts**

```ts
import type { Passive, Skill, Unit } from '@limbus/engine'
import { parsePassiveTemplate, parseSkillTemplate } from '../identities/parse.ts'
import { maxHpAtLevel, parseSpeed, parseStaggerThresholds, resistanceMultiplier, toNumber } from '../normalize/values.ts'
import { DAMAGE_TYPES, SINS, type ParseResult } from '../types.ts'
import { cleanText, findTemplateBlocks, parseTemplate, type TemplateBlock } from '../wiki/wikitext.ts'
import type { EnBoxEntry } from './enbox.ts'

export interface EnemyRef { id: string; name: string; page: string; anchor?: string; image?: string; faction?: string }

const ENEMY_TEMPLATES = ['ABPage', 'ENPage']

export function enemyRefFromEnBox(id: string, entry: EnBoxEntry): EnemyRef {
  const hash = entry.page.indexOf('#')
  return {
    id,
    name: entry.name,
    page: hash === -1 ? entry.page : entry.page.slice(0, hash),
    ...(hash === -1 ? {} : { anchor: entry.page.slice(hash + 1) }),
    ...(entry.image ? { image: entry.image } : {}),
    ...(entry.faction ? { faction: entry.faction } : {}),
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The enemy block for `ref`: by `id` param when present, else the first block after the heading that carries the anchor. */
export function findEnemyBlock(wikitext: string, ref: EnemyRef): TemplateBlock | undefined {
  const blocks = findTemplateBlocks(wikitext, ENEMY_TEMPLATES)
  const byId = blocks.find(b => b.params.id?.trim() === ref.id)
  if (byId) return byId
  if (!ref.anchor) return blocks[0]
  const anchor = escapeRegExp(ref.anchor)
  const heading = new RegExp(`(id="${anchor}"|==\\s*(?:'''|<span[^>]*>)?\\s*${anchor}\\s*(?:'''|</span>)?\\s*==)`)
  const m = heading.exec(wikitext)
  if (!m) return undefined
  return blocks.find(b => b.start > m.index)
}

type Params = Record<string, string>

function resistances(p: Params, warnings: string[], owner: string): Unit['resistances'] {
  const damageType = { slash: 1, pierce: 1, blunt: 1 }
  for (const dt of DAMAGE_TYPES) {
    const m = resistanceMultiplier(p[dt])
    if (m === undefined) warnings.push(`${owner}: missing ${dt} resistance, defaulting to 1`)
    else damageType[dt] = m
  }
  const sin = { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 }
  for (const s of SINS) {
    const m = resistanceMultiplier(p[s])
    if (m === undefined) warnings.push(`${owner}: missing ${s} resistance, defaulting to 1`)
    else sin[s] = m
  }
  return { damageType, sin }
}

function passivesOf(p: Params, warnings: string[], owner: string, keys: string[]): Passive[] {
  const out: Passive[] = []
  for (const k of keys) {
    if (!p[k]) continue
    const pv = parsePassiveTemplate(p[k], warnings, owner)
    if (pv) out.push(pv)
  }
  return out
}

function skillsOf(p: Params, unitId: string, keys: string[], slot: Skill['slot'], warnings: string[]): Skill[] {
  const out: Skill[] = []
  for (const k of keys) {
    if (!p[k]) continue
    const s = parseSkillTemplate(p[k], `${unitId}::${k}`, slot, undefined, warnings)
    if (s) out.push(s)
  }
  return out
}

const range = (prefix: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`)

export function parseEnemyBlock(block: TemplateBlock, ref: EnemyRef): ParseResult<Unit[]> {
  const warnings: string[] = []
  return block.name === 'ABPage'
    ? { value: parseAbnormality(block.params, ref, warnings), warnings }
    : { value: [parseSingleBody(block.params, ref, warnings)], warnings }
}

function parseAbnormality(p: Params, ref: EnemyRef, warnings: string[]): Unit[] {
  const parts = range('abnoparts', 1, 8)
    .map(k => p[k])
    .filter((raw): raw is string => Boolean(raw))
    .map(raw => parseTemplate(raw)?.params)
    .filter((q): q is Params => Boolean(q))
  if (parts.length === 0) return [parseSingleBody(p, ref, warnings)]

  const passives = passivesOf(p, warnings, ref.name, range('passive', 1, 5))
  const blockLevel = toNumber(p.level)
  const skillKeys = range('skill', 1, 13).filter(k => p[k])

  return parts.map((q, index) => {
    const unitId = `${ref.id}:${index}`
    const partName = cleanText(q.partsname) || `Part ${index + 1}`
    const level = toNumber(q.level) ?? blockLevel ?? 1
    const baseHp = toNumber(q.hp) ?? toNumber(p.hp) ?? 0
    const hpGrowth = toNumber(q.hpgrowth) ?? toNumber(p.hpgrowth) ?? 0
    const ownKeys = skillKeys.filter(k => {
      if (parts.length === 1) return true
      const label = cleanText(p[`skillparts${k.slice('skill'.length)}`])
      return label.includes(partName)
    })
    const speed = parseSpeed(q.speed)
    if (!speed) warnings.push(`${unitId}: unparseable speed "${q.speed ?? ''}"`)
    return {
      id: unitId,
      kind: 'enemy',
      name: partName,
      group: ref.name,
      ...(ref.image ? { portrait: ref.image } : {}),
      level,
      hp: maxHpAtLevel(baseHp, hpGrowth, level),
      hpGrowth,
      speed: speed ?? { min: 0, max: 0 },
      defenseMod: toNumber(q.defmod) ?? 0,
      resistances: resistances(q, warnings, unitId),
      staggerThresholds: parseStaggerThresholds(q, 5),
      skills: skillsOf(p, unitId, ownKeys, 'enemy', warnings),
      passives,
    }
  })
}

function parseSingleBody(p: Params, ref: EnemyRef, warnings: string[]): Unit {
  const unitId = `${ref.id}:0`
  const level = toNumber(p.level) ?? 1
  const baseHp = toNumber(p.hp) ?? 0
  const hpGrowth = toNumber(p.hpgrowth) ?? 0
  const speed = parseSpeed(p.speed)
  if (!speed) warnings.push(`${unitId}: unparseable speed "${p.speed ?? ''}"`)
  return {
    id: unitId,
    kind: 'enemy',
    name: ref.name,
    group: ref.name,
    ...(ref.image ? { portrait: ref.image } : {}),
    level,
    hp: maxHpAtLevel(baseHp, hpGrowth, level),
    hpGrowth,
    speed: speed ?? { min: 0, max: 0 },
    defenseMod: toNumber(p.defmod) ?? 0,
    resistances: resistances(p, warnings, unitId),
    staggerThresholds: parseStaggerThresholds(p, 4),
    skills: [
      ...skillsOf(p, unitId, range('skill', 1, 9), 'enemy', warnings),
      ...skillsOf(p, unitId, ['defense', 'defense2', 'defense3', 'defense4'], 'defense', warnings),
    ],
    passives: passivesOf(p, warnings, ref.name, ['passive0', ...range('passive', 1, 9)]),
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -w @limbus/data -- enemies`
Expected: 10 passed. If a literal (a skill name, a passive count, the Yi Sang first-skill name) does not match the fixture, check the fixture text and correct the literal; keep every structural assertion.

- [ ] **Step 6: Commit**

```bash
git add packages/data
git commit -m "Add enemy index parser and ABPage/ENPage enemy block parser

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 8: Railway line page parser

**Files:**
- Create: `packages/data/src/railway/parse.ts`, `packages/data/test/railway.test.ts`

**Interfaces:**
- Produces:

```ts
export interface RailwayWave { number: number; enemyIds: string[]; reinforcementIds: string[] }
export interface RailwaySection { number: number; name: string; waves: RailwayWave[] }
export interface RailwayStation { number: number; name: string }
export interface RailwayLine { title: string; start: string; stations: RailwayStation[]; sections: RailwaySection[]; enemyIds: string[] }
export function parseLinePage(wikitext: string): RailwayLine
```

Deviation from spec 5.2 (`stations[...waves]`): the wiki lists waves per Section, not per Station, so `railway.json` carries `sections` with waves plus a flat `stations` name list. Plan 3 shows stations grouped under their section.

- [ ] **Step 1: Write the failing tests**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseLinePage } from '../src/railway/parse.ts'

const line = parseLinePage(readFileSync(new URL('./fixtures/railway-line6.wikitext', import.meta.url), 'utf8'))

describe('parseLinePage', () => {
  it('reads the line header', () => {
    expect(line.title).toBe('Line 6: Maru no Uchi no Sanzu no Kawa')
    expect(line.start).toBe('May 28th, 2026')
  })
  it('reads stations from the stage list', () => {
    expect(line.stations).toHaveLength(8)
    expect(line.stations[5]).toEqual({ number: 6, name: 'Drowning Desire' })
    expect(line.stations[7].name).toBe('Advent')
  })
  it('reads sections and waves with reinforcements', () => {
    expect(line.sections.map(s => s.number)).toEqual([1, 2, 3, 4, 5])
    expect(line.sections[1].name).toBe('Tarnishing')
    expect(line.sections[1].waves).toHaveLength(4)
    const wave2 = line.sections[1].waves[1]
    expect(wave2.number).toBe(2)
    expect(wave2.enemyIds.slice(0, 2)).toEqual(['9570', '9543'])
    expect(wave2.enemyIds).toHaveLength(7)
    expect(wave2.reinforcementIds).toHaveLength(6)
    expect(line.sections[0].waves).toEqual([{ number: 1, enemyIds: ['9563'], reinforcementIds: [] }])
    expect(line.sections[4].waves[0].enemyIds).toEqual(['9567', '9572', '9573', '9574'])
  })
  it('collects every distinct enemy id', () => {
    expect(line.enemyIds).toContain('9568')
    expect(line.enemyIds).toContain('9567')
    expect(new Set(line.enemyIds).size).toBe(line.enemyIds.length)
    expect(line.enemyIds.length).toBeGreaterThanOrEqual(30)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/data -- railway`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import { findTemplateBlocks } from '../wiki/wikitext.ts'

export interface RailwayWave { number: number; enemyIds: string[]; reinforcementIds: string[] }
export interface RailwaySection { number: number; name: string; waves: RailwayWave[] }
export interface RailwayStation { number: number; name: string }
export interface RailwayLine { title: string; start: string; stations: RailwayStation[]; sections: RailwaySection[]; enemyIds: string[] }

const SECTION_HEADING = /^==\s*Encounter Details\s*==/m
const NEXT_HEADING = /^==[^=]/m
const SECTION_CELL = /Section #(\d+)\s*:\s*([^\n|!<]+)/
const WAVE_CELL = /Wave (\d+)/
const STATION_CELL = /Station #(\d+)\s*:\s*([^\n|!<]+)/g
const ENBOX = /\{\{EnBox\|(\d+)/g

function ids(text: string): string[] {
  return [...text.matchAll(ENBOX)].map(m => m[1])
}

export function parseLinePage(wikitext: string): RailwayLine {
  const header = findTemplateBlocks(wikitext, ['RRLine'])[0]?.params ?? {}

  const stations = new Map<number, string>()
  for (const m of wikitext.matchAll(STATION_CELL)) {
    const n = Number(m[1])
    if (!stations.has(n)) stations.set(n, m[2].trim())
  }

  const sections: RailwaySection[] = []
  const start = SECTION_HEADING.exec(wikitext)
  if (start) {
    const after = wikitext.slice(start.index + start[0].length)
    const stop = NEXT_HEADING.exec(after)
    const table = stop ? after.slice(0, stop.index) : after
    let current: RailwaySection | undefined
    for (const row of table.split(/^\|-\s*$/m)) {
      const sec = SECTION_CELL.exec(row)
      if (sec) {
        current = { number: Number(sec[1]), name: sec[2].trim(), waves: [] }
        sections.push(current)
      }
      const wave = WAVE_CELL.exec(row)
      if (!wave || !current) continue
      const cell = row.slice(wave.index)
      const [main, reinforcements = ''] = cell.split(/Reinforcements/i)
      current.waves.push({ number: Number(wave[1]), enemyIds: ids(main), reinforcementIds: ids(reinforcements) })
    }
  }

  const enemyIds = [...new Set(sections.flatMap(s => s.waves.flatMap(w => [...w.enemyIds, ...w.reinforcementIds])))]
  return {
    title: header.title?.trim() ?? '',
    start: header.start?.trim() ?? '',
    stations: [...stations.entries()].sort((a, b) => a[0] - b[0]).map(([number, name]) => ({ number, name })),
    sections,
    enemyIds,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/data -- railway`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "Add Refraction Railway line page parser

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 9: Wiki client, pipelines, CLI, first real scrape, output validation

**Files:**
- Create: `packages/data/src/wiki/client.ts`, `packages/data/src/pipeline/identities.ts`, `packages/data/src/pipeline/railway.ts`, `packages/data/src/pipeline/write.ts`, `packages/data/src/pipeline/images.ts` (stub), `packages/data/src/cli.ts`, `packages/data/test/client.test.ts`, `packages/data/test/output.test.ts`, `packages/data/out/*.json`

**Interfaces:**
- Consumes: every parser above.
- Produces:

```ts
export type Log = (line: string) => void
export class WikiClient {
  constructor(options?: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; delayMs?: number; log?: Log })
  fetchWikitext(title: string): Promise<string | null>     // cached per title; null for a missing page
  fetchCategoryMembers(category: string): Promise<string[]>
  fetchImageUrl(filename: string): Promise<string | null>
  download(url: string): Promise<Uint8Array>
}
export async function scrapeIdentities(client: WikiClient, log: Log, limit?: number): Promise<{ units: Unit[]; failures: Failure[]; warnings: string[] }>
export async function scrapeRailway(client: WikiClient, linePage: string, log: Log): Promise<{ line: RailwayLine; units: Unit[]; failures: Failure[]; warnings: string[] }>
export function writeOutputs(dir: string, data: Outputs): Meta
```

Output files (all 2-space JSON):
- `identities.json`: `Unit[]`
- `enemies.json`: `Unit[]`
- `railway.json`: `RailwayLine`
- `failures.json`: `{ identities: Failure[]; enemies: Failure[]; warnings: string[] }`
- `meta.json`: `{ scrapedAt: string (ISO 8601), levelCap: number, railwayLine: string, identityCount: number, enemyUnitCount: number, effectParseCoverage: { total: number; parsed: number; ratio: number } }`

- [ ] **Step 1: Write the failing client test**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @limbus/data -- client`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement client.ts**

```ts
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
    const text: string | null = data.parse?.wikitext?.['*'] ?? null
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
```

- [ ] **Step 4: Run the client test**

Run: `npm test -w @limbus/data -- client`
Expected: 5 passed.

- [ ] **Step 5: Implement the pipelines**

`packages/data/src/pipeline/identities.ts`:

```ts
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
```

`packages/data/src/pipeline/railway.ts`:

```ts
import type { Unit } from '@limbus/engine'
import { parseEnBoxData } from '../enemies/enbox.ts'
import { enemyRefFromEnBox, findEnemyBlock, parseEnemyBlock } from '../enemies/parse.ts'
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
      const block = findEnemyBlock(wikitext, ref)
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
```

`packages/data/src/pipeline/write.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Effect, Unit } from '@limbus/engine'
import { effectCoverage } from '../effects/parse.ts'
import type { RailwayLine } from '../railway/parse.ts'
import type { Failure } from '../types.ts'

export interface Outputs {
  identities: Unit[]
  enemies: Unit[]
  railway: RailwayLine
  failures: { identities: Failure[]; enemies: Failure[]; warnings: string[] }
  levelCap: number
}

export interface Meta {
  scrapedAt: string
  levelCap: number
  railwayLine: string
  identityCount: number
  enemyUnitCount: number
  effectParseCoverage: { total: number; parsed: number; ratio: number }
}

function allEffects(units: Unit[]): Effect[] {
  return units.flatMap(u => [...u.skills.flatMap(s => s.effects), ...u.passives.flatMap(p => p.effects)])
}

export function buildMeta(data: Outputs, now: Date = new Date()): Meta {
  const cov = effectCoverage(allEffects([...data.identities, ...data.enemies]))
  return {
    scrapedAt: now.toISOString(),
    levelCap: data.levelCap,
    railwayLine: data.railway.title,
    identityCount: data.identities.length,
    enemyUnitCount: data.enemies.length,
    effectParseCoverage: { ...cov, ratio: cov.total === 0 ? 0 : Number((cov.parsed / cov.total).toFixed(4)) },
  }
}

export function writeOutputs(dir: string, data: Outputs): Meta {
  mkdirSync(dir, { recursive: true })
  const write = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + '\n')
  const meta = buildMeta(data)
  write('identities.json', data.identities)
  write('enemies.json', data.enemies)
  write('railway.json', data.railway)
  write('failures.json', data.failures)
  write('meta.json', meta)
  return meta
}
```

`packages/data/src/pipeline/images.ts` (stub for now; Task 10 replaces it):

```ts
import type { Unit } from '@limbus/engine'
import type { Log, WikiClient } from '../wiki/client.ts'

export type ImageManifest = Record<string, string | null>

export async function scrapeImages(_client: WikiClient, _units: Unit[], _imagesDir: string, _outDir: string, _log: Log): Promise<ImageManifest> {
  throw new Error('scrapeImages is implemented in Task 10')
}
```

`packages/data/src/cli.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Unit } from '@limbus/engine'
import { IDENTITY_LEVEL_CAP } from './normalize/values.ts'
import { scrapeIdentities } from './pipeline/identities.ts'
import { scrapeImages } from './pipeline/images.ts'
import { scrapeRailway } from './pipeline/railway.ts'
import { writeOutputs, type Outputs } from './pipeline/write.ts'
import type { RailwayLine } from './railway/parse.ts'
import { WikiClient } from './wiki/client.ts'

/** The live Refraction Railway line. Update when a new Line opens. */
export const RAILWAY_LINE_PAGE = 'Line 6: Maru no Uchi no Sanzu no Kawa'

const OUT_DIR = fileURLToPath(new URL('../out/', import.meta.url))
const IMAGES_DIR = fileURLToPath(new URL('../images/', import.meta.url))

const log = (line: string) => console.log(line)

function readJson<T>(name: string, fallback: T): T {
  const path = join(OUT_DIR, name)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback
}

async function main() {
  const command = process.argv[2] ?? 'all'
  const limitArg = process.argv.find(a => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined
  const client = new WikiClient({ log })

  const existing: Outputs = {
    identities: readJson<Unit[]>('identities.json', []),
    enemies: readJson<Unit[]>('enemies.json', []),
    railway: readJson<RailwayLine>('railway.json', { title: '', start: '', stations: [], sections: [], enemyIds: [] }),
    failures: readJson('failures.json', { identities: [], enemies: [], warnings: [] }),
    levelCap: IDENTITY_LEVEL_CAP,
  }

  if (command === 'images') {
    await scrapeImages(client, [...existing.identities, ...existing.enemies], IMAGES_DIR, OUT_DIR, log)
    return
  }

  const next: Outputs = { ...existing, failures: { ...existing.failures } }
  const warnings: string[] = []
  if (command === 'identities' || command === 'all') {
    const r = await scrapeIdentities(client, log, limit)
    next.identities = r.units
    next.failures.identities = r.failures
    warnings.push(...r.warnings)
    log(`identities: ${r.units.length} parsed, ${r.failures.length} failed`)
  }
  if (command === 'railway' || command === 'all') {
    const r = await scrapeRailway(client, RAILWAY_LINE_PAGE, log)
    next.railway = r.line
    next.enemies = r.units
    next.failures.enemies = r.failures
    warnings.push(...r.warnings)
    log(`enemies: ${r.units.length} units, ${r.failures.length} failed`)
  }
  next.failures.warnings = warnings
  const meta = writeOutputs(OUT_DIR, next)
  log(`wrote ${OUT_DIR} (coverage ${meta.effectParseCoverage.parsed}/${meta.effectParseCoverage.total} = ${meta.effectParseCoverage.ratio})`)
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 6: Typecheck, then smoke-run the CLI on five identities**

Run: `npm run typecheck -w @limbus/data && cd packages/data && node src/cli.ts identities --limit=5`
Expected: typecheck clean; log lines showing 5 identity pages, `identities: 5 parsed, 0 failed` (a page with an unusual template may fail; that is fine), files written to `packages/data/out/`. If Node refuses to run the `.ts` entry, check `node --version` is 22.18+ and that every relative import carries a `.ts` extension.

- [ ] **Step 7: Run the full scrape**

Run: `cd packages/data && node src/cli.ts all`
Expected: about five minutes. Around 180 to 200 identities parsed with the known handful of "no IDPage template found" failures (event identities), 30 or more enemy units for Line 6 with zero or very few enemy failures. Record the printed coverage ratio.

- [ ] **Step 8: Write the output validation test**

`packages/data/test/output.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Unit } from '@limbus/engine'
import type { RailwayLine } from '../src/railway/parse.ts'
import type { Meta } from '../src/pipeline/write.ts'
import { DAMAGE_TYPES, SINS } from '../src/types.ts'

/** Minimum effect parse coverage; raise it as the parser improves, never lower it silently. */
const COVERAGE_FLOOR = 0.4

const out = (name: string) => new URL(`../out/${name}`, import.meta.url)
const load = <T>(name: string): T => JSON.parse(readFileSync(out(name), 'utf8')) as T

describe('committed outputs', () => {
  it('exist', () => {
    for (const f of ['identities.json', 'enemies.json', 'railway.json', 'failures.json', 'meta.json']) expect(existsSync(out(f)), f).toBe(true)
  })

  const identities = load<Unit[]>('identities.json')
  const enemies = load<Unit[]>('enemies.json')
  const railway = load<RailwayLine>('railway.json')
  const meta = load<Meta>('meta.json')

  function checkUnit(u: Unit) {
    expect(u.id.length).toBeGreaterThan(0)
    expect(['identity', 'enemy']).toContain(u.kind)
    expect(u.level).toBeGreaterThan(0)
    expect(u.hp).toBeGreaterThan(0)
    for (const dt of DAMAGE_TYPES) expect(u.resistances.damageType[dt]).toBeGreaterThan(0)
    for (const s of SINS) expect(u.resistances.sin[s]).toBeGreaterThan(0)
    for (let i = 1; i < u.staggerThresholds.length; i++) expect(u.staggerThresholds[i]).toBeLessThanOrEqual(u.staggerThresholds[i - 1])
    for (const t of u.staggerThresholds) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(1) }
    for (const s of u.skills) {
      expect(s.coinCount).toBeGreaterThanOrEqual(1)
      expect(SINS).toContain(s.sin)
      for (const i of s.unbreakableCoins) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(s.coinCount) }
      expect(new Set(s.unbreakableCoins).size).toBe(s.unbreakableCoins.length)
      for (const e of s.effects) expect(e.source.length).toBeGreaterThan(0)
    }
  }

  it('has well-formed identities at the level cap', () => {
    expect(identities.length).toBeGreaterThan(150)
    for (const u of identities) { checkUnit(u); expect(u.kind).toBe('identity'); expect(u.level).toBe(meta.levelCap) }
    expect(new Set(identities.map(u => u.id)).size).toBe(identities.length)
  })
  it('has well-formed enemies covering every railway enemy id', () => {
    expect(enemies.length).toBeGreaterThan(20)
    for (const u of enemies) { checkUnit(u); expect(u.kind).toBe('enemy') }
    const enemyIds = new Set(enemies.map(u => u.id.split(':')[0]))
    const missing = railway.enemyIds.filter(id => !enemyIds.has(id))
    expect(missing, `railway enemy ids without units: ${missing.join(', ')}`).toEqual([])
  })
  it('has a railway line with sections and stations', () => {
    expect(railway.title.length).toBeGreaterThan(0)
    expect(railway.sections.length).toBeGreaterThan(0)
    expect(railway.stations.length).toBeGreaterThan(0)
  })
  it('meets the effect parse coverage floor and counts match', () => {
    expect(meta.identityCount).toBe(identities.length)
    expect(meta.enemyUnitCount).toBe(enemies.length)
    expect(meta.effectParseCoverage.total).toBeGreaterThan(1000)
    expect(meta.effectParseCoverage.ratio).toBeGreaterThanOrEqual(COVERAGE_FLOOR)
    expect(new Date(meta.scrapedAt).toString()).not.toBe('Invalid Date')
  })
})
```

Set `COVERAGE_FLOOR` to the scraped ratio rounded down to two decimals (a printed ratio of `0.6132` becomes `0.61`). If the real ratio is below `0.4`, keep the floor at the real value rounded down and note it in the report; do not weaken the parser tests.

- [ ] **Step 9: Run the whole data suite and typecheck**

Run: `npm run typecheck -w @limbus/data && npm test -w @limbus/data`
Expected: clean; all test files pass including `output.test.ts`. If `output.test.ts` reveals a data problem (a missing enemy id, an out-of-range unbreakable index), fix the parser, re-run `node src/cli.ts railway` or `all`, and re-test.

- [ ] **Step 10: Commit outputs and code**

```bash
git add packages/data
git commit -m "Add wiki client, scrape pipelines, CLI, and the first committed data set

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 10: Image pipeline, README, root docs

**Files:**
- Modify: `packages/data/src/pipeline/images.ts` (replace the stub), `README.md` (root)
- Create: `packages/data/README.md`, `packages/data/test/images.test.ts`, `packages/data/out/images.json`

**Interfaces:**
- Produces:

```ts
export type ImageManifest = Record<string, string | null>               // wiki filename -> relative path, or null if not found
export function imageRefs(units: Unit[]): string[]                       // distinct wiki filenames
export function localImagePath(filename: string): string                 // safe relative path under images/
export async function scrapeImages(client: WikiClient, units: Unit[], imagesDir: string, outDir: string, log: Log): Promise<ImageManifest>
```

Image refs are every `unit.portrait` and every `skill.icon + '.png'`. Files already on disk are skipped. `out/images.json` (committed) records the manifest so the web app can resolve paths without the images being in git.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @limbus/data -- images`
Expected: FAIL (`imageRefs` is not exported; the stub throws).

- [ ] **Step 3: Implement images.ts**

```ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Unit } from '@limbus/engine'
import type { Log, WikiClient } from '../wiki/client.ts'

export type ImageManifest = Record<string, string | null>

/** Every distinct wiki image filename the units reference: portraits and skill icons. */
export function imageRefs(units: Unit[]): string[] {
  const refs = new Set<string>()
  for (const u of units) {
    if (u.portrait) refs.add(u.portrait)
    for (const s of u.skills) if (s.icon) refs.add(`${s.icon}.png`)
  }
  return [...refs]
}

/** Flat filename safe for the filesystem and a URL path segment. */
export function localImagePath(filename: string): string {
  return filename.replace(/[/\\:]/g, '_')
}

export async function scrapeImages(client: WikiClient, units: Unit[], imagesDir: string, outDir: string, log: Log): Promise<ImageManifest> {
  mkdirSync(imagesDir, { recursive: true })
  mkdirSync(outDir, { recursive: true })
  const manifest: ImageManifest = {}
  const refs = imageRefs(units)
  log(`${refs.length} image references`)
  for (const [i, filename] of refs.entries()) {
    const local = localImagePath(filename)
    const dest = join(imagesDir, local)
    if (existsSync(dest)) { manifest[filename] = local; continue }
    try {
      const url = await client.fetchImageUrl(filename)
      if (!url) { manifest[filename] = null; log(`  not found: ${filename}`); continue }
      writeFileSync(dest, await client.download(url))
      manifest[filename] = local
    } catch (e) {
      manifest[filename] = null
      log(`  failed: ${filename}: ${String(e)}`)
    }
    if ((i + 1) % 50 === 0) log(`  ${i + 1}/${refs.length}`)
  }
  writeFileSync(join(outDir, 'images.json'), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}
```

- [ ] **Step 4: Run the tests, then the real image scrape**

Run: `npm test -w @limbus/data -- images && cd packages/data && node src/cli.ts images`
Expected: 3 passed; the scrape downloads roughly 800 to 1000 files into `packages/data/images/` over 15 to 25 minutes and writes `out/images.json`. Not-found entries are acceptable; note their count in the report.

- [ ] **Step 5: Write packages/data/README.md**

```markdown
# @limbus/data

Scrapes limbuscompany.wiki.gg into the engine's `Unit` schema and commits the result under `out/`.

## Commands

    npm run scrape -w @limbus/data              # identities + live Railway line + enemies
    npm run scrape:identities -w @limbus/data   # add --limit=N for a quick check
    npm run scrape:railway -w @limbus/data
    npm run scrape:images -w @limbus/data       # portraits and skill icons into images/ (git-ignored)
    npm run fixtures -w @limbus/data            # refresh test fixtures from the wiki

Runs take a few minutes: one request per second, User-Agent `LimbusCalculator-DataScraper/0.2`.

## Outputs (committed)

- `out/identities.json`: `Unit[]`, one per Identity, stored at the level cap (`meta.levelCap`).
- `out/enemies.json`: `Unit[]`, one per enemy PART. `id` is `<enemyId>:<partIndex>`, `group` is the enemy name.
- `out/railway.json`: the live line: `stations`, `sections[].waves[].enemyIds|reinforcementIds`.
- `out/failures.json`: pages or ids that did not parse, with reasons, plus warnings.
- `out/meta.json`: scrape time, counts, and `effectParseCoverage`.
- `out/images.json`: wiki filename -> local path under `images/` (or `null` if the wiki has no such file).

## Data contract notes

- HP: `hp` is the max HP at `level` (the wiki's `hp + hpgrowth * level`). For another level L use `hp + hpGrowth * (L - level)`.
- Stagger thresholds are descending fractions of max HP.
- Resistances are multipliers: 0.5 Ineffective, 0.75 Endured, 1 Normal, 1.5 Weak, 2 Fatal. Identities have all sin resistances at 1.
- `Skill.uptie` follows the engine convention (an override applies from its tier upward). The wiki's lower-tier params are converted in `src/normalize/uptie.ts`.
- Effects: `src/effects/parse.ts` handles flat power changes, percentage damage, `At N+ Stat` / `If target has N+ Stat` conditions, and `Gain|Inflict N Stat [Count]` grants. Everything else is `{ kind: 'unparsed' }` with the original sentence in `source`; the coverage ratio in `meta.json` is gated by `test/output.test.ts`.
- Enemy blocks are located by the `id` param when present, otherwise by the section heading named in `Module:EnBox/data`.

## Updating for a new Railway line

Change `RAILWAY_LINE_PAGE` in `src/cli.ts`, run `npm run scrape:railway -w @limbus/data`, then `scrape:images`, and commit `out/`.
```

- [ ] **Step 6: Update the root README**

Replace the `packages/data` bullet with: ``- `packages/data`: wiki scrapers and the committed normalized game data. See `packages/data/README.md`.``

- [ ] **Step 7: Full workspace check and commit**

Run: `npm run typecheck && npm test`
Expected: both packages clean and green.

```bash
git add -A
git commit -m "Add image pipeline and data package docs

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

## Self-review notes

- Spec 5.1 sources: identities (Task 6, 9), enemies via ABPage and the enemy index (Task 7, 9), railway from the line page (Task 8, 9). Covered.
- Spec 5.2 schema: `Unit` emitted by Tasks 6 and 7 matches the engine type; resistances numeric; images written to a git-ignored directory with a committed manifest (Task 10). Deviation recorded in Task 8: waves are per section, not per station.
- Spec 5.3 structured effects: Task 5, with coverage in `meta.json` and a floor test in Task 9.
- Spec 8 data tests: schema validation is done by `output.test.ts` structural checks rather than a generated JSON schema (no dependency budget for a schema library); parser fixtures for every supported phrasing are in Task 5; the Line 6 scrape is the committed output itself.
- Type consistency: `ParseResult<T>` (Task 1) used by Tasks 6 and 7; `TemplateBlock` (Task 2) used by Task 7; `parseSkillTemplate`/`parsePassiveTemplate` (Task 6) used by Task 7; `RailwayLine` (Task 8) used by Task 9; `Log` (Task 9 client) used by pipelines and Task 10; `Meta` and `ImageManifest` (Task 9) used by Task 9's test and Task 10. Checked.
- Known follow-ups for Plan 3: `Skill.slot` now includes `skill4`; enemy parts without skills exist in `enemies.json` and need the `Combatant.skill` optional change already logged from Plan 1.
