/**
 * Static multiplier (C): Offense-Defense Advantage.
 * x = Attacker's Offense Level - Defender's Defense Level.
 *
 * Source: https://blog.limbus.wiki/docs/damage_formula/
 */
export function offenseDefenseAdvantage(offenseLevel: number, defenseLevel: number): number {
    const x = offenseLevel - defenseLevel;
    return x / (Math.abs(x) + 25);
}
