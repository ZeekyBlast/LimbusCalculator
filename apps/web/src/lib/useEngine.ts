import { useEffect, useRef, useState } from 'react'
import type { ClashReport, Combatant, MatchupGrid, ReportOptions, Unit } from '@limbus/engine'
import { engine } from './engineClient.ts'

export interface EngineResult<T> { result?: T; error?: string; pending: boolean }

function useEngineCall<T>(run: (() => Promise<T>) | undefined, deps: unknown[]): EngineResult<T> {
  const [state, setState] = useState<EngineResult<T>>({ pending: run !== undefined })
  const token = useRef(0)
  useEffect(() => {
    const mine = ++token.current
    if (!run) { setState({ pending: false }); return }
    setState(s => ({ ...s, pending: true }))
    run().then(
      result => { if (token.current === mine) setState({ result, pending: false }) },
      (e: unknown) => { if (token.current === mine) setState({ error: e instanceof Error ? e.message : String(e), pending: false }) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/** Clash report for two combatants; `undefined` on either side means "nothing to compute yet". */
export function useClashReport(a: Combatant | undefined, b: Combatant | undefined, options: ReportOptions): EngineResult<ClashReport> {
  const ready = a?.skill && b?.skill ? { a, b } : undefined
  return useEngineCall(ready ? () => engine().clash(ready.a, ready.b, options) : undefined, [a, b, options.staggerMidAttack])
}

export function useMatchupGrid(team: Combatant[], wave: Unit[], options: ReportOptions): EngineResult<MatchupGrid> {
  const ready = team.length > 0 && wave.length > 0
  return useEngineCall(ready ? () => engine().grid(team, wave, options) : undefined, [team, wave, options.staggerMidAttack])
}
