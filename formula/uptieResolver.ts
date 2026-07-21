/**
 * Resolves a stat's value at a given Uptie tier. Base fields in identities.json represent the
 * Uptie 4 (max) value; the `*Uptie` override objects hold values for lower tiers where the
 * stat differs. An override at a given tier applies from that tier upward until the next
 * higher defined override (or the base/u4 value if none is defined above it).
 *
 * Example (real data, Blade Lineage Mentor Meursault's "Draw of the Sword"):
 * basePower: 3, basePowerUptie: { u2: 2 } -> tier1=2, tier2=2, tier3=3, tier4=3.
 */

export interface UptieOverride<T> {
    u1?: T;
    u2?: T;
    u3?: T;
}

export function resolveUptie<T>(base: T, overrides: UptieOverride<T> | undefined, tier: 1 | 2 | 3 | 4): T {
    if (tier === 4 || !overrides) return base;
    if (tier === 1 && overrides.u1 !== undefined) return overrides.u1;
    if (tier <= 2 && overrides.u2 !== undefined) return overrides.u2;
    if (tier <= 3 && overrides.u3 !== undefined) return overrides.u3;
    return base;
}
