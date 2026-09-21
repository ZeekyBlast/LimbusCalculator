import { calculateDynamicModifier, getEffectById, isEffectApplicable, sumCoinPowerBonus, sumCoinRollBonus, type AttackShape, type EffectStack } from './statusEffects'
import type { Condition, Operation, SidePair, StatusAfter, StatusState } from './types'

export type Owner = 'self' | 'target'
export type GrantOp = Extract<Operation, { kind: 'applyStatus' }>

/** Every two-value status caps at 99 potency and 99 count (https://limbuscompany.wiki.gg/wiki/Status_Effects). */
export const MAX_STATUS = 99
/** Registry slot whose stacks belong to the side being hit (Fragile/Protection and their typed variants). */
const TARGET_SIDE_SLOT = 'dynamic-additive-fragile-protection'

export function cloneState(s: StatusState): StatusState {
  const out: StatusState = {}
  for (const [id, v] of Object.entries(s)) out[id] = { potency: v.potency, count: v.count }
  return out
}

export function clonePair(p: SidePair): SidePair {
  return { self: cloneState(p.self), target: cloneState(p.target) }
}

export function other(o: Owner): Owner {
  return o === 'self' ? 'target' : 'self'
}

const clamp = (n: number): number => Math.min(MAX_STATUS, Math.max(0, n))

/**
 * Apply one status grant. `owner` is the side whose line this is; `op.target` is relative to it.
 * Granting potency to an absent status gives it count 1, granting count gives it potency 1
 * (namu.wiki/w/Limbus Company/키워드: "아무것도 없을 때 부여를 하면 횟수 1, 횟수 증가를 하면 위력 1로
 * 적용된다"). Values clamp to [0, 99]. A grant never removes a status: only consumption does.
 */
export function grant(pair: SidePair, op: GrantOp, owner: Owner): void {
  const state = pair[op.target === 'self' ? owner : other(owner)]
  const cur = state[op.status]
  if (!cur) {
    state[op.status] = { potency: clamp(op.potency ?? 1), count: clamp(op.count ?? 1) }
    return
  }
  if (op.potency !== undefined) cur.potency = clamp(cur.potency + op.potency)
  if (op.count !== undefined) cur.count = clamp(cur.count + op.count)
}

/** One use of a counted status: count −1, and the status disappears when its count reaches 0. */
export function consume(state: StatusState, id: string): void {
  const cur = state[id]
  if (!cur) return
  cur.count -= 1
  if (cur.count <= 0) delete state[id]
}

/** A condition on the owner's line, read against the working pair. An absent status reads as 0. */
export function conditionHolds(c: Condition, pair: SidePair, owner: Owner): boolean {
  const actual = pair[c.side === 'self' ? owner : other(owner)][c.stat]?.[c.field] ?? 0
  switch (c.op) {
    case '>=': return actual >= c.value
    case '>': return actual > c.value
    case '<=': return actual <= c.value
    case '<': return actual < c.value
    case '==': return actual === c.value
  }
}

export interface StackModifiers {
  /** Power Up family: added to every coin roll. */
  coinRollBonus: number
  /** Coin Boost / Coin Drop: added to Coin Power itself. */
  coinPowerBonus: number
  /** Damage Up/Down on the attacker (`pair.self`). */
  attackerDynamic: number
  /** Fragile/Protection on the target (`pair.target`). */
  targetDynamic: number
  /** Crit Damage Up on the attacker: added on top of `attackerDynamic` on a critical hit. */
  critOnly: number
}

/**
 * What the registry stacks of both sides contribute to the attacker's (`pair.self`) coins against
 * the target (`pair.target`). Bucketed by registry slot: every Fragile/Protection variant belongs
 * to the side being hit; ids missing from the registry fall to the attacker side and contribute 0.
 * Scoped variants (Fragile (Slash), Damage Up (Pride), ...) only count for a matching attack; with
 * no attack known every variant counts. The [-1, 1] clamps inside calculateDynamicModifier apply
 * per side, never to the pooled sum.
 */
export function stackModifiers(pair: SidePair, attack?: AttackShape): StackModifiers {
  const toStacks = (s: StatusState): EffectStack[] => Object.entries(s).map(([effectId, v]) => ({ effectId, stacks: v.potency }))
  const attackerStacks = toStacks(pair.self).filter(s => getEffectById(s.effectId)?.slot !== TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, attack))
  const targetStacks = toStacks(pair.target).filter(s => getEffectById(s.effectId)?.slot === TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, attack))
  const attackerDynamic = calculateDynamicModifier(attackerStacks, false)
  return {
    coinRollBonus: sumCoinRollBonus(attackerStacks),
    coinPowerBonus: sumCoinPowerBonus(attackerStacks),
    attackerDynamic,
    targetDynamic: calculateDynamicModifier(targetStacks, false),
    critOnly: calculateDynamicModifier(attackerStacks, true) - attackerDynamic,
  }
}

/** Poise: crit chance = potency × 5% while count > 0, capped at 100% (https://limbuscompany.wiki.gg/wiki/Poise). */
export function critChanceOf(state: StatusState): number {
  const p = state.poise
  return p && p.count > 0 ? Math.min(1, p.potency * 0.05) : 0
}

interface Acc { potency: number; count: number; seen: Set<string> }

function accumulate(acc: Map<string, Acc>, state: StatusState, ids: Set<string>, prob: number): void {
  for (const id of ids) {
    const v = state[id]
    const a = acc.get(id) ?? { potency: 0, count: 0, seen: new Set<string>() }
    a.potency += (v?.potency ?? 0) * prob
    a.count += (v?.count ?? 0) * prob
    a.seen.add(v ? `${v.potency},${v.count}` : 'absent')
    acc.set(id, a)
  }
}

function finish(acc: Map<string, Acc>, mass: number, side: Owner, varies: string[]): StatusState {
  const out: StatusState = {}
  for (const [id, a] of acc) {
    out[id] = { potency: a.potency / mass, count: a.count / mass }
    if (a.seen.size > 1) varies.push(`${side}:${id}`)
  }
  return out
}

/** Expected statuses over enumerated paths, weighted by `prob` and normalized by their total mass. */
export function averagePairs(paths: { pair: SidePair; prob: number }[]): StatusAfter {
  const live = paths.filter(p => p.prob > 0)
  const mass = live.reduce((s, p) => s + p.prob, 0)
  if (mass <= 0) return { self: {}, target: {}, varies: [] }
  const ids = { self: new Set<string>(), target: new Set<string>() }
  for (const { pair } of live) {
    for (const id of Object.keys(pair.self)) ids.self.add(id)
    for (const id of Object.keys(pair.target)) ids.target.add(id)
  }
  const acc = { self: new Map<string, Acc>(), target: new Map<string, Acc>() }
  for (const { pair, prob } of live) {
    accumulate(acc.self, pair.self, ids.self, prob)
    accumulate(acc.target, pair.target, ids.target, prob)
  }
  const varies: string[] = []
  return { self: finish(acc.self, mass, 'self', varies), target: finish(acc.target, mass, 'target', varies), varies }
}

/** Combine already-averaged leftovers by weight (for mixing over coins-left counts). */
export function mixStatusAfter(parts: { weight: number; after: StatusAfter }[]): StatusAfter {
  const live = parts.filter(p => p.weight > 0)
  const mass = live.reduce((s, p) => s + p.weight, 0)
  if (mass <= 0) return { self: {}, target: {}, varies: [] }
  const varies = new Set<string>()
  const mix = (side: Owner): StatusState => {
    const ids = new Set<string>()
    for (const { after } of live) for (const id of Object.keys(after[side])) ids.add(id)
    const out: StatusState = {}
    for (const id of ids) {
      let potency = 0
      let count = 0
      const seen = new Set<string>()
      for (const { weight, after } of live) {
        const v = after[side][id]
        potency += (v?.potency ?? 0) * weight
        count += (v?.count ?? 0) * weight
        seen.add(v ? `${v.potency},${v.count}` : 'absent')
      }
      out[id] = { potency: potency / mass, count: count / mass }
      if (seen.size > 1) varies.add(`${side}:${id}`)
    }
    return out
  }
  const self = mix('self')
  const target = mix('target')
  for (const { after } of live) for (const v of after.varies) varies.add(v)
  return { self, target, varies: [...varies] }
}
