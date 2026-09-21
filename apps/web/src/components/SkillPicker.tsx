import type { Unit, UptieTier } from '@limbus/engine'
import type { ImageManifest } from '../lib/data.ts'
import { skillIconUrl } from '../lib/images.ts'
import { skillAtUptie } from '../lib/setup.ts'
import { slotLabel } from '../lib/unitSearch.ts'
import { DamageTypeBadge, SinBadge } from './Badges.tsx'

interface Props { unit: Unit; value: string | null; uptie: UptieTier; images: ImageManifest; onPick: (skillId: string) => void }

/** One tile per skill, showing the numbers at the chosen uptie. */
export function SkillPicker({ unit, value, uptie, images, onPick }: Props) {
  if (unit.skills.length === 0) return <p className="text-sm text-bone-dim">This part has no skills. It can be attacked but never clashes.</p>
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
      {unit.skills.map(raw => {
        const s = skillAtUptie(raw, uptie)
        const icon = skillIconUrl(images, s)
        return (
          <button key={s.id} type="button" aria-pressed={s.id === value} onClick={() => onPick(s.id)} className="tile">
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink">{icon && <img src={icon} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="num shrink-0 text-xs text-bone-faint">{slotLabel(s)}</span>
                <span className="min-w-0 truncate text-[15px]">{s.name}</span>
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <SinBadge sin={s.sin} />
                <DamageTypeBadge type={s.damageType} />
              </span>
            </span>
            <span className="num shrink-0 text-right text-[15px] leading-tight">
              <span className="text-bone">{s.basePower}</span>
              <span className="text-gold"> +{s.coinPower}</span>
              <span className="block text-xs text-bone-dim">{s.coinCount} coin{s.coinCount === 1 ? '' : 's'}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
