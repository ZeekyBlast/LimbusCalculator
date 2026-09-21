import { resolveCombatant } from '@limbus/engine'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CombatantCard } from '../components/CombatantCard.tsx'
import { VerdictPanel } from '../components/VerdictPanel.tsx'
import type { GameData } from '../lib/data.ts'
import { href, navigate } from '../lib/router.ts'
import { toCombatant } from '../lib/setup.ts'
import { decodeSetup, encodeSetup } from '../lib/setupCodec.ts'
import { useClashReport } from '../lib/useEngine.ts'
import { useClashStore } from '../stores/clashStore.ts'

interface Props { data: GameData; search: URLSearchParams }

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <aside className="slab p-6">
      <div className="display text-3xl text-bone-dim">{title}</div>
      <p className="mt-2 text-sm text-bone-dim">{body}</p>
    </aside>
  )
}

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
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard is unavailable on insecure origins; the URL bar already holds the link.
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button type="button" onClick={swap} className="btn">Swap sides</button>
          <button type="button" onClick={copyLink} className="btn">{copied ? 'Link copied' : 'Copy share link'}</button>
          <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm text-bone-dim sm:ml-auto">
            <input type="checkbox" checked={setup.staggerMidAttack} onChange={e => setStaggerMidAttack(e.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
            <span className="min-w-0">Stagger hits the rest of the same attack</span>
          </label>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CombatantCard side="a" data={data} combatant={a} resolved={resolvedA} />
          <CombatantCard side="b" data={data} combatant={b} resolved={resolvedB} />
        </div>
      </div>
      <div className="min-w-0 self-start xl:sticky xl:top-5">
        {!a?.skill || !b?.skill ? (
          <Placeholder title="Pick both sides" body="Choose a unit and a skill on each side. The odds appear here and update as you change anything." />
        ) : report.error ? (
          <Placeholder title="Could not compute" body={report.error} />
        ) : !report.result ? (
          <Placeholder title="Computing" body="Running the exact clash chain and damage enumeration." />
        ) : (
          <VerdictPanel report={report.result} a={a} b={b} options={options} />
        )}
      </div>
    </div>
  )
}
