const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** 0.7345 -> "73.5%" */
export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`
}

/** 12345.6 -> "12,346" */
export function num(x: number): string {
  return Number.isFinite(x) ? integer.format(x) : '∞'
}

/** 3 -> "+3", -2 -> "-2", 0 -> "0" */
export function signed(x: number): string {
  return x > 0 ? `+${x}` : String(x)
}

/** Multiplier badge text: 2 -> "x2", 0.5 -> "x0.5" */
export function mult(x: number): string {
  return `x${Number.isInteger(x) ? x : x.toFixed(2).replace(/0+$/, '')}`
}
