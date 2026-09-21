import type { Unit, UptieTier } from '@limbus/engine'
import type { ImageManifest } from '../lib/data.ts'
import { skillIconUrl } from '../lib/images.ts'
import { skillAtUptie } from '../lib/setup.ts'
import { slotLabel } from '../lib/unitSearch.ts'
import { DamageTypeBadge, SinBadge } from './Badges.tsx'

interface Props { unit: Unit; value: string | null; uptie: UptieTier; images: ImageManifest; onPick: (skillId: string) => void }

/** One button per skill, showing the numbers at the chosen uptie. */
export function SkillPicker({ unit, value, uptie, images, onPick }: Props) {
  if (unit.skills.length === 0) return <p className="mt-3 text-sm text-bone-dim">This part has no skills; it can only be attacked.</p>
  return (
    <div className="mt-3 grid gap-1">
      {unit.skills.map(raw => {
        const s = skillAtUptie(raw, uptie)
        const icon = skillIconUrl(images, s)
        const active = s.id === value
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(s.id)}
            className={`flex items-center gap-3 rounded border px-2 py-1.5 text-left text-sm ${active ? 'border-gold bg-paper-light' : 'border-paper-light hover:border-bone-dim'}`}
          >
            <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-ink">{icon && <img src={icon} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
            <span className="w-12 shrink-0 text-[10px] uppercase tracking-widest text-bone-dim">{slotLabel(s)}</span>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="ledger-number shrink-0 text-xs text-bone-dim">{s.basePower}<span className="text-gold">+{s.coinPower}</span>×{s.coinCount}</span>
            <SinBadge sin={s.sin} />
            <DamageTypeBadge type={s.damageType} />
          </button>
        )
      })}
    </div>
  )
}
