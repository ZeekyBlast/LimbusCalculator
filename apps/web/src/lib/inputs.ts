/**
 * The number a text field currently holds, or `undefined` while it holds no number yet.
 *
 * A cleared field, a lone sign, and a lone decimal point are all states a user passes through
 * while typing, so they must not be coerced: `Number('')` is 0 and `Number('-')` is NaN, and
 * committing either would overwrite the value the user is halfway through replacing.
 */
export function parseNumberInput(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}
