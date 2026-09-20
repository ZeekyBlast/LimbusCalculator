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
