/**
 * Final Damage composition, from Syx's Limbus Blog:
 * https://blog.limbus.wiki/docs/damage_formula/ (BattleUnitModel::GiveAttackDamage)
 *
 * Final Damage = Coin Roll · max(1 + Ms, 0) · (1 + Md)
 *              + floor(Attack Adder · (1 + max(A + B + C, 0)))
 *              + floor(Attack HP Adder)
 * where Ms = A + B + C + D + E + F (static) and Md = G + H (dynamic).
 *
 * Minimum: result is clamped to at least 1, and at least 0.05 * Coin Roll, then rounded down.
 */

export interface StaticModifiers {
    /** A: Sin Resistance */
    sinResistance: number;
    /** B: Damage Type Resistance */
    damageTypeResistance: number;
    /** C: Offense-Defense Advantage */
    offenseDefenseAdvantage: number;
    /** D: Parry Round Bonus */
    parryBonus: number;
    /** E: Critical modifier (0 when the hit isn't a critical) */
    critical: number;
    /** F: Observation Level bonus. The game always returns 0 for this outside removed content. */
    observationLevel?: number;
}

export interface DynamicModifiers {
    /** G: bonuses from Passives/Skill effects */
    skillEffects: number;
    /** H: Buffs (e.g. Fragile, Protection) */
    buffs: number;
}

export interface DamageInput {
    coinRoll: number;
    staticModifiers: StaticModifiers;
    dynamicModifiers: DynamicModifiers;
    /** Flat additive damage multiplied by (1 + max(A+B+C, 0)) — no D/E/F/dynamic modifiers apply. */
    attackAdder?: number;
    /** Flat additive damage applied with no multiplier at all. */
    attackHpAdder?: number;
}

export function sumStaticModifiers(s: StaticModifiers): number {
    return s.sinResistance + s.damageTypeResistance + s.offenseDefenseAdvantage + s.parryBonus + s.critical + (s.observationLevel ?? 0);
}

export function sumDynamicModifiers(d: DynamicModifiers): number {
    return d.skillEffects + d.buffs;
}

export function computeFinalDamage(input: DamageInput): number {
    const { coinRoll, staticModifiers: s, dynamicModifiers: d, attackAdder = 0, attackHpAdder = 0 } = input;

    const Ms = sumStaticModifiers(s);
    const Md = sumDynamicModifiers(d);

    const coinDamage = coinRoll * Math.max(1 + Ms, 0) * (1 + Md);

    const adderAdvantage = 1 + Math.max(s.sinResistance + s.damageTypeResistance + s.offenseDefenseAdvantage, 0);
    const attackAdderDamage = Math.floor(attackAdder * adderAdvantage);
    const attackHpDamage = Math.floor(attackHpAdder);

    const total = coinDamage + attackAdderDamage + attackHpDamage;
    const withMinimum = Math.max(total, 1, 0.05 * coinRoll);

    return Math.floor(withMinimum);
}
