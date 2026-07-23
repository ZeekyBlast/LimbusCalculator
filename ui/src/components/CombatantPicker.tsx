import { useEffect, useState } from 'react'
import type { Identity } from '../types'
import { portraitUrl, skillIconUrl, sinIconUrl, damageTypeIconUrl, sinnerIconUrl, statusEffectIconUrl, uptie4BorderFrameUrls, hideOnError } from '../lib/images'
import { useStatusEffectManifest, matchStatusEffectIcons } from '../lib/statusEffectIcons'
import { Combobox, type ComboboxGroup } from './Combobox'
import { SINNER_ORDER } from '../lib/sinners'

interface CombatantPickerProps {
  role: string
  identities: Identity[]
  selectedTitle: string
  onTitleChange: (title: string) => void
  selectedSkillIndex: number
  onSkillIndexChange: (index: number) => void
  uptieTier: 1 | 2 | 3 | 4
  level: number
}

const UPTIE4_FRAMES = uptie4BorderFrameUrls()

function groupBySinner(identities: Identity[]): ComboboxGroup<string>[] {
  const groups = new Map<string, Identity[]>()
  for (const id of identities) {
    const key = id.sinner ?? 'Other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(id)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => SINNER_ORDER.indexOf(a) - SINNER_ORDER.indexOf(b))
    .map(([sinner, group]) => ({
      label: sinner,
      options: group.map(i => ({ value: i.title, label: i.prefix ?? i.title, keywords: `${i.title} ${i.sinner ?? ''}` })),
    }))
}

/**
 * Cycles the 3 fetched Uptie 4 border frames - no equivalent art exists for tiers 1-3.
 * The frame art's own aspect ratio (333x465, ~0.72) is portrait-shaped, so it only wraps
 * cleanly around a small ID-chip crop (see below), not the wide banner portrait: stretching
 * it full-bleed over a landscape box distorted the ornate corners into an unrecognizable smear.
 * The source PNGs bake in a dark bottom-shadow gradient (meant for a quote textbox on the
 * full-size card this art was designed for) instead of real alpha transparency there - screen
 * blending it turns those near-black pixels into a no-op over the portrait instead of an opaque
 * black patch, while the gold ring/shine pixels still add their highlight on top.
 */
function Uptie4Border() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % UPTIE4_FRAMES.length), 260)
    return () => clearInterval(id)
  }, [])
  return (
    <img
      src={UPTIE4_FRAMES[frame]}
      alt=""
      loading="lazy"
      className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-screen"
      onError={hideOnError}
    />
  )
}

// Skill effect text comes from the wiki as one block with embedded newlines (main clause,
// then "- " sub-clauses) - splitting it into per-line rows is what makes long E.G.O. skill
// text readable instead of one run-on paragraph.
function splitEffectLines(text?: string): string[] {
  if (!text) return []
  return text.split('\n').map(l => l.trim()).filter(Boolean)
}

function EffectIconLine({ text, manifest, indent }: { text: string; manifest: string[]; indent?: boolean }) {
  const icons = matchStatusEffectIcons(text, manifest)
  return (
    <p className={`text-bone-dim text-xs flex items-start gap-1 mb-1 last:mb-0 ${indent ? 'pl-3 border-l border-paper-light/60 ml-0.5' : ''}`}>
      <span className="flex-1">{text}</span>
      {icons.length > 0 && (
        <span className="flex gap-0.5 shrink-0 mt-0.5">
          {icons.map(name => (
            <img key={name} src={statusEffectIconUrl(name)} alt={name} title={name} loading="lazy" className="w-4 h-4" onError={hideOnError} />
          ))}
        </span>
      )}
    </p>
  )
}

/** Renders a skill's effect + coin-effect lines, collapsing anything past the first few behind a native <details> toggle so a wall-of-text E.G.O. skill doesn't blow out the card height. */
function SkillEffectText({ skill, manifest }: { skill: { skillEffect?: string; coinEffects?: string[] }; manifest: string[] }) {
  const lines = [
    ...splitEffectLines(skill.skillEffect).map(text => ({ text, indent: text.startsWith('-') })),
    ...(skill.coinEffects ?? []).map(text => ({ text, indent: false })),
  ]
  const VISIBLE = 3
  const visible = lines.slice(0, VISIBLE)
  const rest = lines.slice(VISIBLE)

  return (
    <div className="mt-1">
      {visible.map((l, i) => (
        <EffectIconLine key={i} text={l.text} manifest={manifest} indent={l.indent} />
      ))}
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="text-xs text-gold/70 hover:text-gold-bright cursor-pointer select-none">
            + {rest.length} more effect{rest.length > 1 ? 's' : ''}
          </summary>
          <div className="mt-1">
            {rest.map((l, i) => (
              <EffectIconLine key={i} text={l.text} manifest={manifest} indent={l.indent} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

export function CombatantPicker({ role, identities, selectedTitle, onTitleChange, selectedSkillIndex, onSkillIndexChange, uptieTier, level }: CombatantPickerProps) {
  const identity = identities.find(i => i.title === selectedTitle)
  const skill = identity?.skills[selectedSkillIndex]
  const effectManifest = useStatusEffectManifest()
  const personnelId = `personnel-${role}`
  const skillSelectId = `assigned-skill-${role}`

  return (
    <section className="border border-paper-light bg-paper rounded-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-paper-light bg-ink/40 px-4 py-2">
        <h2 className="font-display text-lg tracking-wide uppercase text-gold">{role}</h2>
        <span className="font-mono text-xs text-bone-dim">DOSSIER</span>
      </header>

      <div className="p-4">
        <label htmlFor={personnelId} className="block text-xs uppercase tracking-wide text-bone-dim mb-1">Personnel</label>
        <Combobox
          id={personnelId}
          ariaLabel={`Select ${role.toLowerCase()} personnel`}
          groups={groupBySinner(identities)}
          value={selectedTitle}
          onChange={title => {
            onTitleChange(title)
            onSkillIndexChange(0)
          }}
          triggerLabel={identity?.prefix ?? selectedTitle}
          searchable
          searchPlaceholder="Search by name, sinner, faction..."
        />

        {identity && (
          <div className="mt-4">
            <div className="relative w-full h-56 rounded-sm overflow-hidden border border-gold/50 bg-ink">
              {/* Source art is a 1920x1080 splash still, not a headshot - crop from the top like a surveillance photo rather than squeezing the whole scene into a portrait box. */}
              <img src={portraitUrl(identity.title)} alt={identity.title} loading="lazy" className="w-full h-full object-cover object-top" onError={hideOnError} />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />

              {uptieTier === 4 && (
                <div className="absolute bottom-1.5 right-1.5 w-10 h-14 rounded-sm overflow-hidden border border-gold-bright/80 shadow-lg">
                  <img src={portraitUrl(identity.title)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={hideOnError} />
                  <Uptie4Border />
                </div>
              )}
            </div>
            <div className="mt-2 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <img src={sinnerIconUrl(identity.sinner ?? '')} alt="" loading="lazy" className="w-4 h-4" onError={hideOnError} />
                <span className="font-display text-xl uppercase leading-none">{identity.sinner}</span>
              </div>
              <p className="text-xs text-bone-dim italic line-clamp-2">{identity.quote}</p>
            </div>
          </div>
        )}

        {identity && (
          <table className="w-full mt-3 text-xs ledger-number border-t border-paper-light">
            <tbody>
              <tr className="border-b border-paper-light/60">
                <td className="py-1 text-bone-dim font-body">HP (Lv {level})</td>
                <td className="py-1 text-right">{Math.round((identity.hp ?? 0) + (identity.hpGrowth ?? 0) * level)}</td>
              </tr>
              <tr className="border-b border-paper-light/60">
                <td className="py-1 text-bone-dim font-body">Defense</td>
                <td className="py-1 text-right">{level + (identity.defenseLevelMod ?? 0)}</td>
              </tr>
              <tr>
                <td className="py-1 text-bone-dim font-body">Slash / Pierce / Blunt</td>
                <td className="py-1 text-right">
                  {identity.resistances?.slash} / {identity.resistances?.pierce} / {identity.resistances?.blunt}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <label htmlFor={skillSelectId} className="block text-xs uppercase tracking-wide text-bone-dim mb-1 mt-4">Assigned Skill</label>
        <Combobox
          id={skillSelectId}
          ariaLabel={`Select ${role.toLowerCase()} skill`}
          groups={[{
            options: (identity?.skills ?? []).map((s, idx) => ({
              value: idx,
              label: `S${s.skillLevel}${s.variantLabel ? `-${s.variantLabel}` : ''} — ${s.name} (${s.sin}, ${s.damageType})`,
            })),
          }]}
          value={selectedSkillIndex}
          onChange={onSkillIndexChange}
          triggerLabel={
            skill ? `S${skill.skillLevel}${skill.variantLabel ? `-${skill.variantLabel}` : ''} — ${skill.name} (${skill.sin}, ${skill.damageType})` : ''
          }
        />

        {skill && (
          <div className="mt-3 text-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <img src={skillIconUrl(skill.icon ?? '')} alt="" loading="lazy" className="w-8 h-8 rounded-sm border border-paper-light" onError={hideOnError} />
              <img src={sinIconUrl(skill.sin ?? '')} alt="" loading="lazy" className="w-5 h-5" onError={hideOnError} />
              <img src={damageTypeIconUrl(skill.damageType ?? '')} alt="" loading="lazy" className="w-5 h-5" onError={hideOnError} />
              <span className="ledger-number text-gold-bright">
                {skill.basePower} + {skill.coinPower} &times; {skill.coinCount}
              </span>
            </div>
            <SkillEffectText skill={skill} manifest={effectManifest} />
          </div>
        )}
      </div>
    </section>
  )
}
