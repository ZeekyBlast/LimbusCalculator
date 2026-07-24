/**
 * Data-driven status effect registry, feeding the G/H dynamic modifiers in
 * formula/damage.ts (DynamicModifiers.skillEffects / .buffs), which were
 * previously always hardcoded to 0 in the UI.
 *
 * Salvaged and adapted from an earlier abandoned attempt at this project
 * (D:\Code\JavaScript\LimbusCalc) - its formula code was independently
 * audited against this project's verified sources (Syx's Limbus Blog,
 * limbuscompany.wiki.gg) and this registry pattern held up; ported deliberately,
 * not copy-pasted wholesale (several other parts of that project did NOT hold up
 * and were left behind - see the project wiki's decision log).
 *
 * `formulaStatus: "tbd"` entries have their per-stack formula unverified against
 * a reliable source - they must never contribute to damage math, only
 * stack-count tracking, until confirmed. Bleed/Burn/Rupture are all confirmed
 * (see formula/fixedDamageAilment.ts) and are deliberately still kept out of
 * this file's calculateDynamicModifier - they're fixed damage, not a
 * multiplier contribution.
 */

export type EffectSlot =
    /** Fragile vs Protection - opposing, clamped to [-1, 1] combined. */
    | "dynamic-additive-fragile-protection"
    /** Damage Up vs Down - opposing, clamped to [-1, 1] combined. */
    | "dynamic-additive-damage-up-down"
    /** Only contributes when the hit is a critical hit. */
    | "dynamic-additive-crit-only"
    /** Always contributes, regardless of crit. */
    | "dynamic-additive-flat"
    /** Unconditional per-coin power bonus (Power Up, Attack Power Up) - applies to the coin roll, not G/H. */
    | "coin-roll-additive"
    /** Heads-gated Coin Power modifier (Coin Boost, Coin Drop) - applies to the coin roll, not G/H. */
    | "coin-power-additive"
    /** Stack-tracking only; no direct formula effect (or formula not yet verified). */
    | "counter";

export type EffectSign = "positive" | "negative";

export interface StatusEffect {
    id: string;
    name: string;
    slot: EffectSlot;
    /** Ignored for "counter". */
    sign?: EffectSign;
    /** Meaning depends on slot; ignored for "counter". */
    perStackValue?: number;
    /** "tbd" = formula not verified against a reliable source yet - must not be wired into damage math. */
    formulaStatus: "verified" | "tbd";
    description?: string;
}

export interface EffectStack {
    effectId: string;
    stacks: number;
}

export const statusEffects: StatusEffect[] = [
    { id: "fragile", name: "Fragile", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "protection", name: "Protection", slot: "dynamic-additive-fragile-protection", sign: "negative", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "damage-up", name: "Damage Up", slot: "dynamic-additive-damage-up-down", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "damage-down", name: "Damage Down", slot: "dynamic-additive-damage-up-down", sign: "negative", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "crit-damage-up", name: "Crit Damage Up", slot: "dynamic-additive-crit-only", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "power-up", name: "Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified", description: "Adds to a single coin's roll." },
    { id: "attack-power-up", name: "Attack Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified", description: "Adds to all coins of the skill. Scope not yet distinguished from Power Up." },
    { id: "coin-boost", name: "Coin Boost", slot: "coin-power-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified", description: "Modifies Coin Power itself - only manifests on Heads." },
    { id: "coin-drop", name: "Coin Drop", slot: "coin-power-additive", sign: "negative", perStackValue: 1, formulaStatus: "verified", description: "Reduces Coin Power by 1 per stack - like Coin Boost, only manifests on Heads." },
    {
        id: "sinking",
        name: "Sinking",
        slot: "counter",
        formulaStatus: "verified",
        description: "Tracked as stacks; no direct formula effect. Other effects/passives may reference Sinking stacks.",
    },
    {
        id: "bleed",
        name: "Bleed",
        slot: "counter",
        formulaStatus: "verified",
        description:
            "Tracks Potency (fixed damage per trigger) and Count (remaining triggers), both capped at 99 - see formula/fixedDamageAilment.ts's resolveBleedTrigger. " +
            "Triggers on every coin toss of an Attack Skill, and once per clash round (including ties/losses) - never on Defense Skills. " +
            "Deliberately kept out of calculateDynamicModifier: bypasses resistances/crit/level scaling entirely rather than modifying the multiplicative formula.",
    },
    {
        id: "burn",
        name: "Burn",
        slot: "counter",
        formulaStatus: "verified",
        description:
            "Same Potency/Count mechanic as Bleed (see formula/fixedDamageAilment.ts's resolveBurnTrigger), but triggers once at Turn End instead of per-coin. " +
            "Deliberately kept out of calculateDynamicModifier for the same reason as Bleed.",
    },
    {
        id: "rupture",
        name: "Rupture",
        slot: "counter",
        formulaStatus: "verified",
        description:
            "Same Potency/Count mechanic as Bleed (see formula/fixedDamageAilment.ts's resolveRuptureTrigger), but triggers once per hit (each coin that connects). " +
            "Deliberately kept out of calculateDynamicModifier for the same reason as Bleed.",
    },

    // Added for skillEffectGrants.ts's auto-apply feature - type/sin-scoped Fragile/Damage Up/
    // Power Up variants (only the combinations confirmed present in data/generated/identities.json,
    // not every mathematically possible type x sin pairing), plus a handful of Count-only effects
    // the registry didn't cover yet. Type/sin gating itself lives in skillEffectGrants.ts's
    // isEffectApplicable, not here - calculateDynamicModifier/sumSlot stay damage-type-agnostic.
    { id: "fragile-slash", name: "Slash Fragility", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "fragile-pierce", name: "Pierce Fragility", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "fragile-blunt", name: "Blunt Fragility", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "fragile-envy", name: "Envy Fragility", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "fragile-gloom", name: "Gloom Fragility", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "fragile-pride", name: "Pride Fragility", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "fragile-lust", name: "Lust Fragility", slot: "dynamic-additive-fragile-protection", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },

    { id: "damage-up-slash", name: "Slash DMG Up", slot: "dynamic-additive-damage-up-down", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "damage-up-blunt", name: "Blunt DMG Up", slot: "dynamic-additive-damage-up-down", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "damage-up-gluttony", name: "Gluttony DMG Up", slot: "dynamic-additive-damage-up-down", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "damage-up-envy", name: "Envy DMG Up", slot: "dynamic-additive-damage-up-down", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },
    { id: "damage-up-pierce", name: "Pierce DMG Up", slot: "dynamic-additive-damage-up-down", sign: "positive", perStackValue: 0.1, formulaStatus: "verified" },

    { id: "power-up-slash", name: "Slash Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified" },
    { id: "power-up-blunt", name: "Blunt Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified" },
    { id: "power-up-envy", name: "Envy Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified" },
    { id: "power-up-pride", name: "Pride Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified" },
    { id: "power-up-pierce", name: "Pierce Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified" },

    { id: "attack-power-down", name: "Attack Power Down", slot: "coin-roll-additive", sign: "negative", perStackValue: 1, formulaStatus: "verified" },
    { id: "defense-power-up", name: "Defense Power Up", slot: "coin-roll-additive", sign: "positive", perStackValue: 1, formulaStatus: "verified", description: "Applies when this unit is the one being hit, not the attacker - not yet distinguished from Attack Power Up by the wiring layer." },
    { id: "defense-power-down", name: "Defense Power Down", slot: "coin-roll-additive", sign: "negative", perStackValue: 1, formulaStatus: "verified" },

    { id: "haste", name: "Haste", slot: "counter", formulaStatus: "verified", description: "Tracked as stacks; no direct formula effect (Speed isn't modeled by this single-clash simulator)." },
    { id: "bind", name: "Bind", slot: "counter", formulaStatus: "verified", description: "Tracked as stacks; no direct formula effect (this sim has no concept of a bound/unusable Skill slot)." },
    { id: "paralyze", name: "Paralyze", slot: "counter", formulaStatus: "verified", description: "Tracked as stacks; no direct formula effect (coin-fixing isn't modeled by this simulator's coin flips)." },
    { id: "charge", name: "Charge", slot: "counter", formulaStatus: "verified", description: "Tracked as stacks; no direct formula effect. Decays by 1 at Turn End per the wiki - not simulated." },
    { id: "offense-level-up-grant", name: "Offense Level Up (skill-granted)", slot: "counter", formulaStatus: "verified", description: "Distinct from CombatantSetup's manual per-side Level slider - tracked as stacks only, not yet folded into offenseLevel." },
    { id: "offense-level-down", name: "Offense Level Down", slot: "counter", formulaStatus: "verified" },
    { id: "defense-level-up-grant", name: "Defense Level Up (skill-granted)", slot: "counter", formulaStatus: "verified", description: "Distinct from CombatantSetup's manual per-side Level slider - tracked as stacks only, not yet folded into defenseLevel." },
    { id: "defense-level-down", name: "Defense Level Down", slot: "counter", formulaStatus: "verified" },
];

export function getEffectById(id: string, registry: StatusEffect[] = statusEffects): StatusEffect | undefined {
    return registry.find(effect => effect.id === id);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function sumSlot(effects: EffectStack[], registry: StatusEffect[], slot: EffectSlot): number {
    return effects.reduce((sum, effect) => {
        const def = getEffectById(effect.effectId, registry);
        if (!def || def.slot !== slot || def.formulaStatus !== "verified") return sum;
        const sign = def.sign === "negative" ? -1 : 1;
        return sum + sign * (def.perStackValue ?? 0) * effect.stacks;
    }, 0);
}

/**
 * G+H for formula/damage.ts's DynamicModifiers - covers the four dynamic-additive
 * slots only. coin-roll-additive/coin-power-additive effects apply to the coin
 * roll itself (see sumCoinRollBonus/sumCoinPowerBonus below), not here.
 */
export function calculateDynamicModifier(effects: EffectStack[], isCrit: boolean, registry: StatusEffect[] = statusEffects): number {
    const fragileProtection = clamp(sumSlot(effects, registry, "dynamic-additive-fragile-protection"), -1, 1);
    const damageUpDown = clamp(sumSlot(effects, registry, "dynamic-additive-damage-up-down"), -1, 1);
    const critOnly = isCrit ? sumSlot(effects, registry, "dynamic-additive-crit-only") : 0;
    const flat = sumSlot(effects, registry, "dynamic-additive-flat");
    return fragileProtection + damageUpDown + critOnly + flat;
}

/** Unconditional bonus to a coin's final power (Power Up, Attack Power Up) - applies regardless of heads/tails. */
export function sumCoinRollBonus(effects: EffectStack[], registry: StatusEffect[] = statusEffects): number {
    return sumSlot(effects, registry, "coin-roll-additive");
}

/** Heads-gated bonus to Coin Power (Coin Boost, Coin Drop) - only manifests when a coin lands Heads. */
export function sumCoinPowerBonus(effects: EffectStack[], registry: StatusEffect[] = statusEffects): number {
    return sumSlot(effects, registry, "coin-power-additive");
}
