import { resolveCombatant } from '@limbus/engine'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CombatantCard } from '../components/CombatantCard.tsx'
import type { GameData } from '../lib/data.ts'
import { pct } from '../lib/format.ts'
import { href, navigate } from '../lib/router.ts'
import { toCombatant } from '../lib/setup.ts'
import { decodeSetup, encodeSetup } from '../lib/setupCodec.ts'
import { useClashReport } from '../lib/useEngine.ts'
import { useClashStore } from '../stores/clashStore.ts'

interface Props { data: GameData; search: URLSearchParams }

export function ClashScreen({ data, search }: Props) {
  const setup = useClashStore(s => s.setup)
  const { replace, swap, setStaggerMidAttack } = useClashStore.getState()
  const [copied, setCopied] = useState(false)

  // URL -> store when the page opens (or is navigated to) with ?s=; store -> URL on every change.
  const lastEncoded = useRef<string | null>(null)
  useEffect(() => {
    const s = search.get('s')
    if (!s || s === lastEncoded.current) return
    const decoded = decodeSetup(s)
    if (decoded) { lastEncoded.current = s; replace(decoded) }
  }, [search, replace])
  useEffect(() => {
    const encoded = encodeSetup(setup)
    if (encoded === lastEncoded.current) return
    lastEncoded.current = encoded
    navigate(href('/', new URLSearchParams({ s: encoded })), true)
  }, [setup])

  const a = useMemo(() => toCombatant(setup.a, data), [setup.a, data])
  const b = useMemo(() => toCombatant(setup.b, data), [setup.b, data])
  const resolvedA = useMemo(() => (a ? resolveCombatant(a, b) : undefined), [a, b])
  const resolvedB = useMemo(() => (b ? resolveCombatant(b, a) : undefined), [a, b])
  const options = useMemo(() => ({ staggerMidAttack: setup.staggerMidAttack }), [setup.staggerMidAttack])
  const report = useClashReport(a, b, options)

  const copyLink = async () => {
    await navigator.clipboard.writeText(location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={swap} className="rounded border border-paper-light px-3 py-1 hover:border-gold">Swap sides</button>
        <button type="button" onClick={copyLink} className="rounded border border-paper-light px-3 py-1 hover:border-gold">{copied ? 'Link copied' : 'Copy share link'}</button>
        <label className="ml-auto flex items-center gap-2 text-bone-dim">
          <input type="checkbox" checked={setup.staggerMidAttack} onChange={e => setStaggerMidAttack(e.target.checked)} />
          Stagger applies to the remaining coins of the same attack
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CombatantCard side="a" data={data} combatant={a} resolved={resolvedA} />
        <CombatantCard side="b" data={data} combatant={b} resolved={resolvedB} />
      </div>
      {/* Task 9 replaces this summary with <VerdictPanel> and <RollOnce>. */}
      <section className="mt-6 rounded border border-paper-light bg-paper p-4" aria-live="polite">
        {!a?.skill || !b?.skill ? <p className="text-bone-dim">Pick a unit and a skill on both sides to compute the clash.</p>
          : report.error ? <p className="text-blood-bright">{report.error}</p>
          : !report.result ? <p className="text-bone-dim">Computing…</p>
          : <p className="ledger-number text-lg">Win {pct(report.result.win)} · Draw {pct(report.result.draw)} · Lose {pct(report.result.lose)}</p>}
      </section>
    </div>
  )
}
