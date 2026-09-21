import type { ManualOverrides, StatusValue, UptieTier } from '@limbus/engine'
import type { ClashSetup, SideSetup } from './setup.ts'

// Compact positional encoding so shared URLs stay short. Bump VERSION when the shape changes.
const VERSION = 1
type PackedSide = [string | null, string | null, number, number, number, Record<string, [number, number]>, [number, number, number, number], number | null]
type Packed = [typeof VERSION, PackedSide, PackedSide, 0 | 1]

function packSide(s: SideSetup): PackedSide {
  const status: Record<string, [number, number]> = {}
  for (const [id, v] of Object.entries(s.status)) status[id] = [v.potency, v.count]
  return [s.unitId, s.skillId, s.uptie, s.level, s.sanity, status, [s.manual.coinPower, s.manual.basePower, s.manual.clashPower, s.manual.damagePercent], s.currentHp]
}

const isFinite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isTier = (x: unknown): x is UptieTier => x === 1 || x === 2 || x === 3 || x === 4
const isIdOrNull = (x: unknown): x is string | null => x === null || typeof x === 'string'

function unpackSide(p: unknown): SideSetup | null {
  if (!Array.isArray(p) || p.length !== 8) return null
  const [unitId, skillId, uptie, level, sanity, status, manual, currentHp] = p as unknown[]
  if (!isIdOrNull(unitId) || !isIdOrNull(skillId) || !isTier(uptie) || !isFinite(level) || !isFinite(sanity)) return null
  if (typeof status !== 'object' || status === null || Array.isArray(status)) return null
  if (!Array.isArray(manual) || manual.length !== 4 || !manual.every(isFinite)) return null
  if (currentHp !== null && !isFinite(currentHp)) return null
  const statusOut: Record<string, StatusValue> = {}
  for (const [id, v] of Object.entries(status as Record<string, unknown>)) {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(isFinite)) return null
    statusOut[id] = { potency: v[0], count: v[1] }
  }
  const [coinPower, basePower, clashPower, damagePercent] = manual as [number, number, number, number]
  const manualOut: ManualOverrides = { coinPower, basePower, clashPower, damagePercent }
  return { unitId, skillId, uptie, level, sanity, status: statusOut, manual: manualOut, currentHp }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  try {
    const binary = atob(padded)
    return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)))
  } catch {
    return null
  }
}

export function encodeSetup(setup: ClashSetup): string {
  const packed: Packed = [VERSION, packSide(setup.a), packSide(setup.b), setup.staggerMidAttack ? 1 : 0]
  return toBase64Url(JSON.stringify(packed))
}

/** Null for anything that is not a well-formed encoded setup of the current version. */
export function decodeSetup(text: string): ClashSetup | null {
  const json = fromBase64Url(text)
  if (json === null) return null
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { return null }
  if (!Array.isArray(parsed) || parsed.length !== 4 || parsed[0] !== VERSION) return null
  const a = unpackSide(parsed[1])
  const b = unpackSide(parsed[2])
  if (!a || !b || (parsed[3] !== 0 && parsed[3] !== 1)) return null
  return { a, b, staggerMidAttack: parsed[3] === 1 }
}
