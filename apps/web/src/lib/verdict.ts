import type { ClashReport, DamageSummary } from '@limbus/engine'

export interface Verdict { text: 'FAVORED' | 'EVEN' | 'UNFAVORED' | 'STALEMATE'; tone: 'gold' | 'bone' | 'blood' }

export function verdictFor(report: ClashReport): Verdict {
  if (report.draw >= 1) return { text: 'STALEMATE', tone: 'bone' }
  if (report.win >= 0.55) return { text: 'FAVORED', tone: 'gold' }
  if (report.win <= 0.45) return { text: 'UNFAVORED', tone: 'blood' }
  return { text: 'EVEN', tone: 'bone' }
}

/** Where the p10–p90 band and the median sit on a 0..max axis, as fractions. */
export function bandGeometry(s: DamageSummary): { left: number; width: number; median: number } {
  if (s.max <= 0) return { left: 0, width: 0, median: 0 }
  return { left: s.p10 / s.max, width: (s.p90 - s.p10) / s.max, median: s.p50 / s.max }
}
