import type { Sin, DamageType } from '@limbus/engine'

export const SINS: readonly Sin[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
export const DAMAGE_TYPES: readonly DamageType[] = ['slash', 'pierce', 'blunt']

export interface Failure {
  /** Page title or enemy id that failed. */
  subject: string
  reason: string
}

export interface ParseResult<T> {
  value: T
  warnings: string[]
}
