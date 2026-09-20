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
