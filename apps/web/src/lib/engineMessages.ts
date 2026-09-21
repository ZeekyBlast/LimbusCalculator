import { clashReport, matchupGrid, unopposedReport, type ClashReport, type Combatant, type MatchupGrid, type ReportOptions, type Unit, type UnopposedReport } from '@limbus/engine'

export type EngineRequest =
  | { id: number; kind: 'clash'; a: Combatant; b: Combatant; options: ReportOptions }
  | { id: number; kind: 'unopposed'; attacker: Combatant; target: Combatant; options: ReportOptions }
  | { id: number; kind: 'grid'; team: Combatant[]; wave: Unit[]; options: ReportOptions }

export type EngineResponse =
  | { id: number; ok: true; kind: 'clash'; result: ClashReport }
  | { id: number; ok: true; kind: 'unopposed'; result: UnopposedReport }
  | { id: number; ok: true; kind: 'grid'; result: MatchupGrid }
  | { id: number; ok: false; error: string }

/** The worker body, kept pure so tests can call it without a Worker. */
export function handleRequest(req: EngineRequest): EngineResponse {
  try {
    switch (req.kind) {
      case 'clash': return { id: req.id, ok: true, kind: 'clash', result: clashReport(req.a, req.b, req.options) }
      case 'unopposed': return { id: req.id, ok: true, kind: 'unopposed', result: unopposedReport(req.attacker, req.target, req.options) }
      case 'grid': return { id: req.id, ok: true, kind: 'grid', result: matchupGrid(req.team, req.wave, req.options) }
    }
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
