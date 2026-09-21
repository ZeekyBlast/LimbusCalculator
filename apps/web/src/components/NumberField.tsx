import { useState } from 'react'
import { parseNumberInput } from '../lib/inputs.ts'

interface Props {
  value: number
  onCommit: (n: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  'aria-label'?: string
}

function clamp(n: number, min?: number, max?: number): number {
  let out = n
  if (min !== undefined) out = Math.max(min, out)
  if (max !== undefined) out = Math.min(max, out)
  return out
}

/**
 * A number input that can be typed into character by character.
 *
 * The text lives here rather than in the store, so clearing the field or typing a lone "-" leaves
 * the value alone instead of committing 0 or NaN to the live report on every keystroke. The store
 * only hears about text that actually parses.
 */
export function NumberField({ value, onCommit, min, max, step, className, 'aria-label': ariaLabel }: Props) {
  const [text, setText] = useState(() => String(value))
  // Re-sync only when the value changes underneath us (a new unit, a swap, a shared URL, a clamp).
  // Syncing on every render would undo the half-typed states this component exists to preserve.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (parseNumberInput(text) !== value) setText(String(value))
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      className={className}
      onChange={e => {
        setText(e.target.value)
        const parsed = parseNumberInput(e.target.value)
        if (parsed !== undefined) onCommit(clamp(parsed, min, max))
      }}
      onBlur={() => { if (parseNumberInput(text) !== value) setText(String(value)) }}
    />
  )
}
