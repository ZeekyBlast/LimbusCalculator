import type { Skill, Unit } from '@limbus/engine'
import type { ImageManifest } from './data.ts'

export function imageUrl(images: ImageManifest, filename: string | undefined, base: string = import.meta.env.BASE_URL): string | undefined {
  if (!filename) return undefined
  const local = images[filename]
  if (!local) return undefined
  return `${base}images/${encodeURIComponent(local)}`
}

export function portraitUrl(images: ImageManifest, unit: Unit, base: string = import.meta.env.BASE_URL): string | undefined {
  return imageUrl(images, unit.portrait, base)
}

export function skillIconUrl(images: ImageManifest, skill: Skill, base: string = import.meta.env.BASE_URL): string | undefined {
  return imageUrl(images, skill.icon ? `${skill.icon}.png` : undefined, base)
}
