import { EMPTY_MANUAL, type Combatant } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { EngineClient, type WorkerLike } from '../src/lib/engineClient.ts'
import { handleRequest, type EngineRequest, type EngineResponse } from '../src/lib/engineMessages.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

/** Runs the worker body inline, asynchronously, like a real worker would. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<EngineResponse>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  sent: EngineRequest[] = []
  postMessage(req: EngineRequest): void {
    this.sent.push(req)
    queueMicrotask(() => this.onmessage?.({ data: handleRequest(req) } as MessageEvent<EngineResponse>))
  }
  terminate(): void {}
}

function combatant(id: string): Combatant {
  const unit = makeUnit({ id, skills: [makeSkill({ id: `${id}::skill1` })] })
  return { unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } }
}

describe('EngineClient', () => {
  it('resolves each request with its own result even when several are in flight', async () => {
    const worker = new FakeWorker()
    const client = new EngineClient(worker)
    const [clash, hit] = await Promise.all([client.clash(combatant('a'), combatant('b')), client.unopposed(combatant('a'), combatant('b'))])
    expect(clash.win + clash.lose + clash.draw).toBeCloseTo(1)
    expect(hit.damage.mean).toBeGreaterThan(0)
    expect(worker.sent.map(r => r.id)).toEqual([1, 2])
  })
  it('rejects every in-flight request when the worker itself fails', async () => {
    const worker = new FakeWorker()
    const client = new EngineClient(worker)
    // Reject before the queued microtask answers, so the request is genuinely still in flight.
    const inFlight = client.clash(combatant('a'), combatant('b'))
    worker.onerror?.({ message: 'boom' } as ErrorEvent)
    await expect(inFlight).rejects.toThrow(/boom/)
  })
  it('rejects with the engine error message', async () => {
    const client = new EngineClient(new FakeWorker())
    await expect(client.clash(combatant('a'), { ...combatant('b'), skill: undefined })).rejects.toThrow(/both combatants need a skill/)
  })
})
