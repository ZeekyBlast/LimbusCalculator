const BLOOD = [140, 28, 28] as const
const GOLD = [201, 162, 39] as const

/** Cell tint from blood (0% win) to gold (100% win); transparent when there is no clash to color. */
export function cellColor(win: number | null, alpha = 0.45): string {
  if (win === null) return 'transparent'
  const t = Math.min(1, Math.max(0, win))
  const mix = (i: 0 | 1 | 2) => Math.round(BLOOD[i] + (GOLD[i] - BLOOD[i]) * t)
  return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, ${alpha})`
}
