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

/**
 * Whether a hit crits, from limbuscompany.wiki.gg's Poise page: "Crit chance = (Potency * 5)%".
 * Count only decreases "on a Critical Hit (identical timing as On Hit)" - i.e. a non-crit hit
 * doesn't spend Count, and Count reaching 0 makes further crits impossible regardless of
 * remaining Potency. Turn End also decrements Count on the wiki, but that has no equivalent in
 * this simulator's single-clash scope (same reasoning as Burn in fixedDamageAilment.ts).
 */
export interface PoiseState {
    /** Drives crit chance: (potency * 5)%, clamped to 100%. */
    potency: number;
    /** Remaining crits available; a non-crit hit doesn't consume it. */
    count: number;
}

export function resolvePoiseCrit(state: PoiseState, rng: () => number = Math.random): { isCrit: boolean; nextState: PoiseState } {
    if (state.count <= 0) return { isCrit: false, nextState: state };
    const chance = Math.min(1, state.potency * 0.05);
    const isCrit = rng() < chance;
    return { isCrit, nextState: isCrit ? { potency: state.potency, count: state.count - 1 } : state };
}
