import { useEffect, useMemo, useRef, useState } from 'react'

export interface ComboboxOption<T> {
  value: T
  label: string
  /** Extra terms matched during search but not displayed (e.g. full title, sinner name). */
  keywords?: string
}

export interface ComboboxGroup<T> {
  /** Omit to render this group's options with no header (a flat list). */
  label?: string
  options: ComboboxOption<T>[]
}

interface ComboboxProps<T> {
  id: string
  groups: ComboboxGroup<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  triggerLabel: string
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
}

interface FlatOption<T> {
  value: T
  label: string
  keywords?: string
  groupLabel?: string
}

/**
 * On-brand replacement for native <select>/<datalist>: the browser can't restyle a native
 * dropdown's open popup, so this renders its own ink/paper/gold panel. Built on the native
 * `popover` attribute rather than manual open-state/click-outside/z-index plumbing - it gets
 * top-layer stacking (escapes any ancestor overflow:hidden clipping), light-dismiss, and
 * Escape-to-close for free. We only add keyboard nav, filtering, and positioning on top.
 */
export function Combobox<T extends string | number>({
  id,
  groups,
  value,
  onChange,
  ariaLabel,
  triggerLabel,
  searchable = false,
  searchPlaceholder = 'Search...',
  className = '',
}: ComboboxProps<T>) {
  const panelId = `${id}-panel`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef(new Map<number, HTMLElement>())
  const typeaheadRef = useRef({ buffer: '', timeout: 0 })

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })

  const flat: FlatOption<T>[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: FlatOption<T>[] = []
    for (const group of groups) {
      const matched = group.options.filter(
        o => !q || o.label.toLowerCase().includes(q) || o.keywords?.toLowerCase().includes(q)
      )
      for (const o of matched) out.push({ ...o, groupLabel: group.label })
    }
    return out
  }, [groups, query])

  function reposition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const estHeight = 288 // matches max-h-72
    const spaceBelow = window.innerHeight - rect.bottom
    const flipAbove = spaceBelow < estHeight && rect.top > spaceBelow
    setPanelStyle({
      top: flipAbove ? Math.max(8, rect.top - estHeight - 4) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    function onToggle(e: Event) {
      const isOpen = (e as ToggleEvent).newState === 'open'
      setOpen(isOpen)
      if (isOpen) {
        reposition()
        setQuery('')
        const selectedIdx = flat.findIndex(o => o.value === value)
        setHighlight(Math.max(0, selectedIdx))
        requestAnimationFrame(() => searchInputRef.current?.focus())
      } else {
        triggerRef.current?.focus()
      }
    }
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    optionRefs.current.get(highlight)?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  function commit(index: number) {
    const opt = flat[index]
    if (!opt) return
    onChange(opt.value)
    panelRef.current?.hidePopover()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(flat.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(0, h - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setHighlight(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setHighlight(flat.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit(highlight)
    } else if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
      const buf = typeaheadRef.current
      window.clearTimeout(buf.timeout)
      buf.buffer += e.key.toLowerCase()
      const match = flat.findIndex(o => o.label.toLowerCase().startsWith(buf.buffer))
      if (match >= 0) setHighlight(match)
      buf.timeout = window.setTimeout(() => (buf.buffer = ''), 500)
    }
  }

  let renderedGroupLabel: string | undefined
  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        popoverTarget={panelId}
        popoverTargetAction="toggle"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 bg-ink border border-paper-light rounded-sm px-3 py-2 text-bone text-left focus:border-gold focus-visible:outline-2 focus-visible:outline-gold-bright focus-visible:outline-offset-2 transition-colors"
      >
        <span className="truncate">{triggerLabel}</span>
        <svg viewBox="0 0 20 20" fill="none" className={`w-4 h-4 shrink-0 text-bone-dim transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="listbox"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        style={{ position: 'fixed', top: panelStyle.top, left: panelStyle.left, width: panelStyle.width, margin: 0 }}
        className="bg-paper border border-gold/50 rounded-sm shadow-lg max-h-72 overflow-y-auto p-0"
      >
        {searchable && (
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setHighlight(0)
            }}
            placeholder={searchPlaceholder}
            className="w-full sticky top-0 bg-ink border-b border-paper-light px-3 py-2 text-bone placeholder:text-bone-dim focus:outline-none"
          />
        )}
        {flat.length === 0 && <p className="px-3 py-3 text-sm text-bone-dim">No matches.</p>}
        {flat.map((opt, i) => {
          const showHeader = opt.groupLabel && opt.groupLabel !== renderedGroupLabel
          renderedGroupLabel = opt.groupLabel
          return (
            <div key={i}>
              {showHeader && (
                <div className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-wide text-bone-dim">
                  {opt.groupLabel}
                </div>
              )}
              <div
                ref={el => {
                  if (el) optionRefs.current.set(i, el)
                  else optionRefs.current.delete(i)
                }}
                role="option"
                aria-selected={opt.value === value}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(i)}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 ${
                  i === highlight ? 'bg-paper-light text-gold-bright' : 'text-bone'
                } ${opt.value === value ? 'font-semibold' : ''}`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <span className="text-gold-bright shrink-0">&#10003;</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
