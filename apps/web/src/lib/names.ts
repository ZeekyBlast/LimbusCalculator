/**
 * Enemy names on the wiki are long paths ("Refracted Peccatulum Invidiae - Heishou Pack - Mao Branch Adept Faust Class 2").
 * For portraits and grid headers keep the last segment, which names the actual unit, and drop a trailing "Class N".
 */
export function shortEnemyName(name: string): string {
  const last = name.split(' - ').pop()?.trim() ?? name
  return last.replace(/\s+Class\s+\d+$/i, '')
}
