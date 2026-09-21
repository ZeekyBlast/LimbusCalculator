import type { ClashReport, Combatant, MatchupGrid, ReportOptions, Unit, UnopposedReport } from '@limbus/engine'
import type { EngineRequest, EngineResponse } from './engineMessages.ts'

export interface WorkerLike {
  postMessage(message: EngineRequest): void
  onmessage: ((event: MessageEvent<EngineResponse>) => void) | null
  terminate(): void
}

type Pending = { resolve: (value: never) => void; reject: (reason: Error) => void }

/** `Omit` does not distribute over a union, so it would collapse `EngineRequest` down to only
 *  the fields shared by every variant (`kind`, `options`). This distributes it per-member instead. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never
type EngineRequestBody = DistributiveOmit<EngineRequest, 'id'>

/** Request/response bridge to the engine worker. One instance per page is enough. */
export class EngineClient {
  private readonly worker: WorkerLike
  private nextId = 1
  private readonly pending = new Map<number, Pending>()

  constructor(worker: WorkerLike = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })) {
    this.worker = worker
    this.worker.onmessage = event => {
      const res = event.data
      const entry = this.pending.get(res.id)
      if (!entry) return
      this.pending.delete(res.id)
      if (res.ok) entry.resolve(res.result as never)
      else entry.reject(new Error(res.error))
    }
  }

  clash(a: Combatant, b: Combatant, options: ReportOptions = {}): Promise<ClashReport> {
    return this.send({ kind: 'clash', a, b, options })
  }

  unopposed(attacker: Combatant, target: Combatant, options: ReportOptions = {}): Promise<UnopposedReport> {
    return this.send({ kind: 'unopposed', attacker, target, options })
  }

  grid(team: Combatant[], wave: Unit[], options: ReportOptions = {}): Promise<MatchupGrid> {
    return this.send({ kind: 'grid', team, wave, options })
  }

  terminate(): void {
    this.worker.terminate()
    for (const entry of this.pending.values()) entry.reject(new Error('engine worker terminated'))
    this.pending.clear()
  }

  private send<T>(body: EngineRequestBody): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: never) => void, reject })
      this.worker.postMessage({ ...body, id } as EngineRequest)
    })
  }
}

let shared: EngineClient | undefined

export function engine(): EngineClient {
  shared ??= new EngineClient()
  return shared
}
