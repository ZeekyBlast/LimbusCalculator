import type { Identity } from '../types'
import { portraitUrl, sinnerIconUrl, statIconUrl, hideOnError } from '../lib/images'
import { Combobox } from './Combobox'
import { SINNER_ORDER } from '../lib/sinners'
import type { Roster } from '../lib/roster'

const NONE = ''

function maxHp(identity: Identity, level: number): number {
  return Math.round((identity.hp ?? 0) + (identity.hpGrowth ?? 0) * level)
}

interface RosterPanelProps {
  role: string
  identities: Identity[]
  roster: Roster
  onRosterChange: (roster: Roster) => void
  /** The identity currently selected in this side's Dossier - always occupies its own sinner's slot, not independently editable here. */
  deployedIdentity: Identity | undefined
  /** Deployed side's Level slider value - applied to every roster member's Max HP for comparison, since there's no per-bench-member Level control yet. */
  level: number
}

/**
 * A team is one identity per sinner (up to the 12 canonical sinners), not just the single
 * deployed identity the Dossier/clash uses. This exists so bench members' Support Passives
 * (active while on the roster but not deployed) become visible - the requirement text still
 * isn't computed as active/inactive, same limit as the deployed Combat Passive (see
 * project_sin_resonance memory: that needs a whole-party turn engine this 1v1 sim doesn't have).
 */
export function RosterPanel({ role, identities, roster, onRosterChange, deployedIdentity, level }: RosterPanelProps) {
  const benchEntries = SINNER_ORDER
    .filter(sinner => sinner !== deployedIdentity?.sinner && roster[sinner])
    .map(sinner => identities.find(i => i.title === roster[sinner]))
    .filter((i): i is Identity => !!i)

  const fielded = deployedIdentity ? [deployedIdentity, ...benchEntries] : benchEntries
  const hpRanked = [...fielded].sort((a, b) => maxHp(b, level) - maxHp(a, level))

  return (
    <section className="border border-paper-light bg-paper rounded-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-paper-light bg-ink/40 px-4 py-2">
        <h2 className="font-display text-lg tracking-wide uppercase text-gold">{role} Team Roster</h2>
        <span className="font-mono text-xs text-bone-dim">{(deployedIdentity ? 1 : 0) + benchEntries.length}/12</span>
      </header>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SINNER_ORDER.map(sinner => {
          if (sinner === deployedIdentity?.sinner) {
            return (
              <div
                key={sinner}
                title={`${sinner} - deployed (set via Dossier)`}
                className="flex items-center gap-1.5 bg-ink/40 border border-gold/50 rounded-sm px-2 py-2 text-xs"
              >
                <img src={sinnerIconUrl(sinner)} alt="" loading="lazy" className="w-4 h-4 shrink-0" onError={hideOnError} />
                <span className="text-gold-bright truncate">{deployedIdentity?.prefix ?? sinner}</span>
              </div>
            )
          }
          const options = identities.filter(i => i.sinner === sinner)
          const assigned = identities.find(i => i.title === roster[sinner])
          return (
            <Combobox
              key={sinner}
              id={`${role}-roster-${sinner}`}
              ariaLabel={`${role} roster: ${sinner}`}
              className="text-xs"
              groups={[{
                options: [
                  { value: NONE, label: `${sinner} — None` },
                  ...options.map(i => ({ value: i.title, label: i.prefix ?? i.title })),
                ],
              }]}
              value={roster[sinner] ?? NONE}
              onChange={title => onRosterChange({ ...roster, [sinner]: title })}
              triggerLabel={assigned?.prefix ?? sinner}
            />
          )
        })}
      </div>

      {hpRanked.length > 1 && (
        <div className="px-4 pb-4 pt-3 border-t border-paper-light">
          <p className="text-xs uppercase tracking-wide text-gold/70 mb-2 flex items-center gap-1.5">
            <img src={statIconUrl('hp')} alt="" loading="lazy" className="w-3.5 h-3.5 opacity-80" onError={hideOnError} />
            Team Max HP (Lv {level}) &mdash; for "highest/lowest Max HP" passives
          </p>
          <ol className="text-xs space-y-0.5">
            {hpRanked.map((identity, i) => (
              <li key={identity.title} className="flex items-center justify-between gap-2">
                <span className="text-bone-dim truncate">
                  {i === 0 && <span className="text-gold-bright mr-1">&#9650;</span>}
                  {i === hpRanked.length - 1 && <span className="text-blood-bright mr-1">&#9660;</span>}
                  {identity.prefix ?? identity.title}
                </span>
                <span className="ledger-number text-gold-bright shrink-0">{maxHp(identity, level)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {benchEntries.length > 0 && (
        <div className="px-4 pb-4 pt-3 border-t border-paper-light">
          <p className="text-xs uppercase tracking-wide text-gold/70 mb-2">Support Passives (bench)</p>
          <div className="space-y-2">
            {benchEntries.map(identity => {
              const support = identity.passives[1]
              if (!support) return null
              return (
                <div key={identity.title} className="flex gap-2 text-xs">
                  <img
                    src={portraitUrl(identity.title)}
                    alt=""
                    loading="lazy"
                    className="w-8 h-8 rounded-sm object-cover object-top border border-paper-light shrink-0"
                    onError={hideOnError}
                  />
                  <div className="min-w-0">
                    <span className="text-gold-bright">{support.name}</span>
                    {support.requirement && <span className="ml-1 font-mono text-[10px] text-bone-dim">({support.requirement})</span>}
                    <p className="text-bone-dim">{support.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
