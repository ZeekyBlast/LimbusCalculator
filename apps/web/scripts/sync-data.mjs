// Copies the committed data set and the (git-ignored) downloaded images into public/ so Vite
// serves them as static assets. Runs before dev and build. `--force` re-copies the images.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const out = path.join(root, 'packages/data/out')
const images = path.join(root, 'packages/data/images')
const publicDir = path.resolve(here, '../public')
const force = process.argv.includes('--force')

rmSync(path.join(publicDir, 'data'), { recursive: true, force: true })
mkdirSync(path.join(publicDir, 'data'), { recursive: true })
cpSync(out, path.join(publicDir, 'data'), { recursive: true })
console.log(`sync-data: copied ${out} -> public/data`)

const imagesDest = path.join(publicDir, 'images')
if (!existsSync(images)) {
  console.warn('sync-data: packages/data/images is missing; portraits and icons will not load. Run: npm run scrape:images -w @limbus/data')
} else if (force || !existsSync(imagesDest)) {
  rmSync(imagesDest, { recursive: true, force: true })
  cpSync(images, imagesDest, { recursive: true })
  console.log(`sync-data: copied ${images} -> public/images`)
} else {
  console.log('sync-data: public/images already present (pass --force to refresh)')
}
