import type { Unit } from '@limbus/engine'
import type { Log, WikiClient } from '../wiki/client.ts'

export type ImageManifest = Record<string, string | null>

export async function scrapeImages(_client: WikiClient, _units: Unit[], _imagesDir: string, _outDir: string, _log: Log): Promise<ImageManifest> {
  throw new Error('scrapeImages is implemented in Task 10')
}
