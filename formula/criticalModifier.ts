/**
 * Static multiplier (E): Critical hit damage modifier.
 * E1 (base rate) = 0.2, E2 = static critical adders (e.g. passives/E.G.O gifts that hook
 * GetCriticalDamageRatioAdder), E3 = static critical result-multiplier adders (hook
 * GetCriticalDamageRatioResultMultiplier). Combined: E = (E1 + E2) * max(E3 + 1, 0).
 *
 * Source: https://blog.limbus.wiki/docs/damage_formula/ (BuffDetail::GetCriticalDamageRatio)
 */
const BASE_CRITICAL_RATE = 0.2;

export function criticalDamageModifier(staticAdder = 0, resultMultiplierAdder = 0): number {
    return (BASE_CRITICAL_RATE + staticAdder) * Math.max(resultMultiplierAdder + 1, 0);
}
