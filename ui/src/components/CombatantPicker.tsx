import { useEffect, useState } from 'react'
import type { Identity } from '../types'
import { portraitUrl, skillIconUrl, sinIconUrl, damageTypeIconUrl, sinnerIconUrl, statusEffectIconUrl, uptie4BorderFrameUrls, hideOnError } from '../lib/images'
import { useStatusEffectManifest, matchStatusEffectIcons } from '../lib/statusEffectIcons'

interface CombatantPickerProps {
  role: string
  identities: Identity[]
  selectedTitle: string
  onTitleChange: (title: string) => void
  selectedSkillIndex: number
  onSkillIndexChange: (index: number) => void
  uptieTier: 1 | 2 | 3 | 4
}

const UPTIE4_FRAMES = uptie4BorderFrameUrls()

/**
 * Cycles the 3 fetched Uptie 4 border frames - no equivalent art exists for tiers 1-3.
 * The frame art's own aspect ratio (333x465, ~0.72) is portrait-shaped, so it only wraps
 * cleanly around a small ID-chip crop (see below), not the wide banner portrait: stretching
 * it full-bleed over a landscape box distorted the ornate corners into an unrecognizable smear.
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
      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      onError={hideOnError}
    />
  )
}

function EffectIconLine({ text, manifest }: { text: string; manifest: string[] }) {
  const icons = matchStatusEffectIcons(text, manifest)
  return (
    <p className="text-bone-dim text-xs flex items-start gap-1 mb-1 last:mb-0">
      <span className="flex-1">{text}</span>
      {icons.length > 0 && (
        <span className="flex gap-0.5 shrink-0 mt-0.5">
          {icons.map(name => (
            <img key={name} src={statusEffectIconUrl(name)} alt={name} title={name} className="w-4 h-4" onError={hideOnError} />
          ))}
        </span>
      )}
    </p>
  )
}

export function CombatantPicker({ role, identities, selectedTitle, onTitleChange, selectedSkillIndex, onSkillIndexChange, uptieTier }: CombatantPickerProps) {
  const identity = identities.find(i => i.title === selectedTitle)
  const skill = identity?.skills[selectedSkillIndex]
  const effectManifest = useStatusEffectManifest()

  return (
    <section className="border border-paper-light bg-paper rounded-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-paper-light bg-ink/40 px-4 py-2">
        <span className="font-display text-lg tracking-wide uppercase text-gold">{role}</span>
        <span className="font-mono text-xs text-bone-dim">DOSSIER</span>
      </header>

      <div className="p-4">
        <label className="block text-xs uppercase tracking-wide text-bone-dim mb-1">Personnel</label>
        <select
          className="w-full bg-ink border border-paper-light rounded-sm px-3 py-2 text-bone focus:border-gold transition-colors"
          value={selectedTitle}
          onChange={e => {
            onTitleChange(e.target.value)
            onSkillIndexChange(0)
          }}
        >
          {identities.map(i => (
            <option key={i.title} value={i.title}>
              {i.title}
            </option>
          ))}
        </select>

        {identity && (
          <div className="mt-4">
            <div className="relative w-full h-36 rounded-sm overflow-hidden border border-gold/50 bg-ink">
              {/* Source art is a 1920x1080 splash still, not a headshot - crop from the top like a surveillance photo rather than squeezing the whole scene into a portrait box. */}
              <img src={portraitUrl(identity.title)} alt={identity.title} className="w-full h-full object-cover object-top" onError={hideOnError} />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />

              {uptieTier === 4 && (
                <div className="absolute bottom-1.5 right-1.5 w-10 h-14 rounded-sm overflow-hidden border border-gold-bright/80 shadow-lg">
                  <img src={portraitUrl(identity.title)} alt="" className="absolute inset-0 w-full h-full object-cover" onError={hideOnError} />
                  <Uptie4Border />
                </div>
              )}
            </div>
            <div className="mt-2 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <img src={sinnerIconUrl(identity.sinner ?? '')} alt="" className="w-4 h-4" onError={hideOnError} />
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
                <td className="py-1 text-bone-dim font-body">HP</td>
                <td className="py-1 text-right">{identity.hp}</td>
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

        <label className="block text-xs uppercase tracking-wide text-bone-dim mb-1 mt-4">Assigned Skill</label>
        <select
          className="w-full bg-ink border border-paper-light rounded-sm px-3 py-2 text-bone focus:border-gold transition-colors"
          value={selectedSkillIndex}
          onChange={e => onSkillIndexChange(Number(e.target.value))}
        >
          {identity?.skills.map((s, idx) => (
            <option key={idx} value={idx}>
              S{s.skillLevel} &mdash; {s.name} ({s.sin}, {s.damageType})
            </option>
          ))}
        </select>

        {skill && (
          <div className="mt-3 text-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <img src={skillIconUrl(skill.icon ?? '')} alt="" className="w-8 h-8 rounded-sm border border-paper-light" onError={hideOnError} />
              <img src={sinIconUrl(skill.sin ?? '')} alt="" className="w-5 h-5" onError={hideOnError} />
              <img src={damageTypeIconUrl(skill.damageType ?? '')} alt="" className="w-5 h-5" onError={hideOnError} />
              <span className="ledger-number text-gold-bright">
                {skill.basePower} + {skill.coinPower} &times; {skill.coinCount}
              </span>
            </div>
            {skill.skillEffect && <EffectIconLine text={skill.skillEffect} manifest={effectManifest} />}
            {skill.coinEffects?.map((e, i) => (
              <EffectIconLine key={i} text={e} manifest={effectManifest} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
