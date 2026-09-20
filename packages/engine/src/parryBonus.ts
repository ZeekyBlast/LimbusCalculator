/**
 * Static multiplier (D): Parry Round Bonus. Each parry round in a Clash gives +0.03, capped at
 * 99 stacks (beyond which the Clash draws instead).
 *
 * Source: https://blog.limbus.wiki/docs/damage_formula/
 */
const BONUS_PER_ROUND = 0.03;
const MAX_PARRY_ROUNDS = 99;

export function parryRoundBonus(rounds: number): number {
    const clamped = Math.min(Math.max(rounds, 0), MAX_PARRY_ROUNDS);
    return clamped * BONUS_PER_ROUND;
}
