import { describe, expect, it } from 'vitest'
import { indexData, loadGameData } from '../src/lib/data.ts'
import { makeRaw } from './fixtures.ts'

describe('indexData', () => {
  const data = indexData(makeRaw())
  it('indexes units and skills by id', () => {
    expect(data.unitsById.get('u')?.name).toBe('Test Unit')
    expect(data.unitsById.get('9568:1')?.name).toBe('Head')
    expect(data.skillsById.get('9568:0::skill1')?.slot).toBe('enemy')
  })
  it('groups enemy parts by their numeric enemy id in part order', () => {
    expect(data.unitsByEnemyId.get('9568')?.map(u => u.id)).toEqual(['9568:0', '9568:1'])
    expect(data.unitsByEnemyId.get('9553')).toBeUndefined()
  })
  it('keeps the raw collections', () => {
    expect(data.identities).toHaveLength(1)
    expect(data.railway.sections[0].stationNumbers).toEqual([1])
  })
})

describe('loadGameData', () => {
  it('fetches the five files under base/data and indexes them', async () => {
    const raw = makeRaw()
    const requested: string[] = []
    const fetchImpl = (async (url: string) => {
      requested.push(url)
      const name = url.split('/').pop()!.replace('.json', '') as keyof typeof raw
      return new Response(JSON.stringify(raw[name]), { status: 200 })
    }) as unknown as typeof fetch
    const data = await loadGameData('/LimbusCalculator/', fetchImpl)
    expect(requested.sort()).toEqual([
      '/LimbusCalculator/data/enemies.json', '/LimbusCalculator/data/identities.json', '/LimbusCalculator/data/images.json',
      '/LimbusCalculator/data/meta.json', '/LimbusCalculator/data/railway.json',
    ])
    expect(data.meta.levelCap).toBe(60)
  })
  it('names the file that failed', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    await expect(loadGameData('/', fetchImpl)).rejects.toThrow(/\.json \(HTTP 404\)/)
  })
})
