/**
 * Bleed, Burn, and Rupture (limbuscompany.wiki.gg) all share the exact same
 * underlying mechanic: track a Potency (fixed damage per trigger) and a Count
 * (remaining triggers), both capped at 99; each trigger deals damage equal to
 * Potency and decrements Count by 1. This damage bypasses resistances, crit,
 * and level scaling entirely - it never flows through computeFinalDamage() or
 * calculateDynamicModifier() (formula/statusEffects.ts), which is why they're
 * modeled here instead of as another dynamic-modifier slot.
 *
 * What differs between them is only the TRIGGER CONDITION - the caller (clash
 * simulation / UI) decides when to invoke each one:
 *
 * - Bleed: "When tossing an attack Coin, take fixed damage... reduce Count by 1."
 *   Triggers on every coin toss of an Attack Skill, and once per clash round
 *   (including ties and losses) - never on Defense Skills.
 * - Burn: "At the end of a turn, the unit with Burn will take fixed damage...
 *   reduce Count by 1." Triggers once at Turn End.
 * - Rupture: "When hit, the unit with Rupture will take damage... Count reduced
 *   by 1." Triggers once per hit (each coin that connects).
 */

export interface AilmentState {
    /** Fixed damage dealt per trigger. */
    potency: number;
    /** Remaining triggers. Decrements by 1 each time the ailment triggers. */
    count: number;
}

export function clampAilmentValue(value: number): number {
    return Math.max(0, Math.min(99, value));
}

function resolveAilmentTrigger(state: AilmentState): { damage: number; nextState: AilmentState } {
    if (state.count <= 0) {
        return { damage: 0, nextState: state };
    }
    return {
        damage: state.potency,
        nextState: { potency: state.potency, count: state.count - 1 },
    };
}

/** Triggers on every coin toss of an Attack Skill, and once per clash round (including ties/losses) - never on Defense Skills. */
export function resolveBleedTrigger(state: AilmentState) {
    return resolveAilmentTrigger(state);
}

/** Triggers once at Turn End. */
export function resolveBurnTrigger(state: AilmentState) {
    return resolveAilmentTrigger(state);
}

/** Triggers once per hit (each coin that connects). */
export function resolveRuptureTrigger(state: AilmentState) {
    return resolveAilmentTrigger(state);
}

/**
 * Walks a full clash's round-by-round loop (formula/clash.ts's `ClashResult.rounds`) applying
 * Bleed once per coin the bleeding side tosses that round - both sides toss their whole active
 * pool every round regardless of who wins it (ties/losses included), so a round with N active
 * coins triggers Bleed N times, each decrementing Count by 1 until it hits 0.
 */
export function resolveBleedThroughRounds(
    rounds: { aCoinsRemaining: number; bCoinsRemaining: number }[],
    initialCoinCount: number,
    side: "a" | "b",
    state: AilmentState,
): { totalDamage: number; nextState: AilmentState } {
    let current = state;
    let totalDamage = 0;
    let activeThisRound = initialCoinCount;
    for (const round of rounds) {
        const triggers = Math.min(current.count, activeThisRound);
        totalDamage += current.potency * triggers;
        current = { potency: current.potency, count: current.count - triggers };
        activeThisRound = side === "a" ? round.aCoinsRemaining : round.bCoinsRemaining;
    }
    return { totalDamage, nextState: current };
}

/** Rupture triggers once per hit - each of the clash loser's post-win revealed coins is one hit, heads or tails. */
export function resolveRuptureOverHits(hitCount: number, state: AilmentState): { totalDamage: number; nextState: AilmentState } {
    const triggers = Math.min(state.count, hitCount);
    return {
        totalDamage: state.potency * triggers,
        nextState: { potency: state.potency, count: state.count - triggers },
    };
}
