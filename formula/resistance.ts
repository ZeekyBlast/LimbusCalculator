/**
 * Static multiplier from Syx's Limbus Blog damage formula (A: Sin Resistance, B: Damage Type
 * Resistance both use this same piecewise curve). `x` is the current resistance multiplier
 * (e.g. 0.5 for 50% resistance, 2.0 for 200% weak).
 *
 * Source: https://blog.limbus.wiki/docs/damage_formula/ (BattleUnitModel::GiveAttackDamage)
 */
export function resistanceModifier(x: number): number {
    if (x < 0) return -0.5;
    if (x < 1) return (x - 1) / 2;
    return x - 1;
}

/**
 * Damage Type Resistance (B) override when the hit breaks Stagger: the normal resistance curve
 * is replaced entirely by +1, plus +0.5 per additional Stagger Threshold broken in the same hit
 * (Stagger+ = 2 thresholds, Stagger++ = 3 thresholds).
 */
export function staggerDamageTypeResistanceModifier(thresholdsBroken: number): number {
    if (thresholdsBroken < 1) return 0;
    return 1 + 0.5 * (thresholdsBroken - 1);
}
