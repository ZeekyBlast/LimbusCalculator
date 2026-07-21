// Fuzzy-matches free-text skill effect strings (e.g. "[On Hit] Inflict 3 Bleed") against
// the 962 fetched status-effect icon filenames. Manifest is longest-name-first so greedy
// substring matching prefers "Slash Fragility" over a shorter false-positive fragment.
import { useEffect, useState } from 'react'

let manifestPromise: Promise<string[]> | null = null

function loadManifest(): Promise<string[]> {
  if (!manifestPromise) {
    manifestPromise = fetch('/gamedata/status-effect-icons.json')
      .then(res => res.json())
      .catch(() => [])
  }
  return manifestPromise
}

export function useStatusEffectManifest(): string[] {
  const [manifest, setManifest] = useState<string[]>([])
  useEffect(() => {
    loadManifest().then(setManifest)
  }, [])
  return manifest
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Returns matched icon names (no extension), longest matches consuming their span first. */
export function matchStatusEffectIcons(text: string, manifest: string[], maxMatches = 6): string[] {
  if (!text || manifest.length === 0) return []
  let working = text
  const matched: string[] = []
  for (const name of manifest) {
    if (matched.length >= maxMatches) break
    if (name.length < 3) continue
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i')
    const m = working.match(re)
    if (m && m.index !== undefined) {
      matched.push(name)
      working = working.slice(0, m.index) + ' '.repeat(m[0].length) + working.slice(m.index + m[0].length)
    }
  }
  return matched
}
