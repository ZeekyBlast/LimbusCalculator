import { DataStatus } from './components/DataStatus.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { useGameData, type GameData } from './lib/data.ts'
import { href, onLinkClick, useRoute, type Route } from './lib/router.ts'
import { ClashScreen } from './screens/ClashScreen.tsx'
import { RailwayScreen } from './screens/RailwayScreen.tsx'

function NavLink({ to, active, children }: { to: '/' | '/railway'; active: boolean; children: string }) {
  return (
    <a
      href={href(to)}
      onClick={onLinkClick}
      aria-current={active ? 'page' : undefined}
      className={`px-3 py-1 text-sm uppercase tracking-widest ${active ? 'text-gold-bright border-b-2 border-gold' : 'text-bone-dim hover:text-bone'}`}
    >
      {children}
    </a>
  )
}

function RouteBody({ route, data }: { route: Route; data: GameData }) {
  if (route.name === 'not-found') return <p className="text-bone-dim">No page at <code>{route.path}</code>.</p>
  if (route.name === 'clash') return <ClashScreen data={data} search={route.search} />
  return <RailwayScreen data={data} search={route.search} />
}

export function App() {
  const route = useRoute()
  const { data, error } = useGameData()
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-paper-light pb-3">
        <a href={href('/')} onClick={onLinkClick} className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wider text-bone">
          Limbus Calculator
        </a>
        <nav className="flex gap-2">
          <NavLink to="/" active={route.name === 'clash'}>Clash</NavLink>
          <NavLink to="/railway" active={route.name === 'railway'}>Railway</NavLink>
        </nav>
      </header>
      {error && <p role="alert" className="text-blood-bright">Could not load game data: {error}</p>}
      {!data && !error && <p className="text-bone-dim">Loading data…</p>}
      {data && <ErrorBoundary><RouteBody route={route} data={data} /></ErrorBoundary>}
      {data && <DataStatus data={data} />}
    </div>
  )
}
