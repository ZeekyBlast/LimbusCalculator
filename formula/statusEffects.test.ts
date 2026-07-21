import { describe, it, expect } from "vitest";
import {
    statusEffects,
    getEffectById,
    calculateDynamicModifier,
    sumCoinRollBonus,
    sumCoinPowerBonus,
    type StatusEffect,
    type EffectStack,
} from "./statusEffects";

describe("getEffectById", () => {
    it("finds a registry entry by id", () => {
        expect(getEffectById("fragile")?.name).toBe("Fragile");
    });

    it("returns undefined for an unknown id", () => {
        expect(getEffectById("not-a-real-effect")).toBeUndefined();
    });
});

describe("calculateDynamicModifier", () => {
    it("is 0 with no effects", () => {
        expect(calculateDynamicModifier([], false)).toBe(0);
    });

    it("sums Fragile as a positive contribution", () => {
        const effects: EffectStack[] = [{ effectId: "fragile", stacks: 3 }];
        expect(calculateDynamicModifier(effects, false)).toBeCloseTo(0.3);
    });

    it("nets Fragile against Protection, clamped to [-1, 1]", () => {
        const effects: EffectStack[] = [
            { effectId: "fragile", stacks: 3 },
            { effectId: "protection", stacks: 1 },
        ];
        expect(calculateDynamicModifier(effects, false)).toBeCloseTo(0.2);
    });

    it("clamps an extreme Fragile/Protection net to 1", () => {
        const effects: EffectStack[] = [{ effectId: "fragile", stacks: 99 }];
        expect(calculateDynamicModifier(effects, false)).toBe(1);
    });

    it("nets Damage Up against Damage Down independently of the Fragile/Protection band", () => {
        const effects: EffectStack[] = [
            { effectId: "damage-up", stacks: 2 },
            { effectId: "damage-down", stacks: 1 },
        ];
        expect(calculateDynamicModifier(effects, false)).toBeCloseTo(0.1);
    });

    it("only applies crit-only effects when isCrit is true", () => {
        const effects: EffectStack[] = [{ effectId: "crit-damage-up", stacks: 2 }];
        expect(calculateDynamicModifier(effects, false)).toBe(0);
        expect(calculateDynamicModifier(effects, true)).toBeCloseTo(0.2);
    });

    it("never lets a 'tbd' effect contribute to the damage math", () => {
        // Use an isolated fixture rather than relying on a production entry staying
        // "tbd" forever - the registry is expected to gain more verified formulas over time.
        const fixture: StatusEffect[] = [{ id: "unverified-effect", name: "Unverified", slot: "dynamic-additive-flat", sign: "positive", perStackValue: 1, formulaStatus: "tbd" }];
        const effects: EffectStack[] = [{ effectId: "unverified-effect", stacks: 50 }];
        expect(calculateDynamicModifier(effects, false, fixture)).toBe(0);
    });

    it("keeps Bleed/Burn/Rupture out of the dynamic modifier even though they're verified - they're fixed damage, not a multiplier (see formula/fixedDamageAilment.ts)", () => {
        const effects: EffectStack[] = [
            { effectId: "bleed", stacks: 99 },
            { effectId: "burn", stacks: 99 },
            { effectId: "rupture", stacks: 99 },
        ];
        expect(calculateDynamicModifier(effects, false)).toBe(0);
    });

    it("ignores coin-roll-additive/coin-power-additive effects (they belong to the coin roll, not G/H)", () => {
        const effects: EffectStack[] = [
            { effectId: "power-up", stacks: 5 },
            { effectId: "coin-boost", stacks: 5 },
        ];
        expect(calculateDynamicModifier(effects, false)).toBe(0);
    });

    it("supports an isolated fixture registry without touching production data", () => {
        const fixture: StatusEffect[] = [{ id: "custom", name: "Custom", slot: "dynamic-additive-flat", sign: "positive", perStackValue: 0.05, formulaStatus: "verified" }];
        const effects: EffectStack[] = [{ effectId: "custom", stacks: 4 }];
        expect(calculateDynamicModifier(effects, false, fixture)).toBeCloseTo(0.2);
        // Confirm production registry is untouched by the fixture call.
        expect(statusEffects.some(e => e.id === "custom")).toBe(false);
    });
});

describe("sumCoinRollBonus / sumCoinPowerBonus", () => {
    it("sums unconditional coin-roll bonuses", () => {
        const effects: EffectStack[] = [{ effectId: "power-up", stacks: 3 }];
        expect(sumCoinRollBonus(effects)).toBe(3);
    });

    it("sums heads-gated coin-power bonuses, net of Coin Drop", () => {
        const effects: EffectStack[] = [
            { effectId: "coin-boost", stacks: 3 },
            { effectId: "coin-drop", stacks: 1 },
        ];
        expect(sumCoinPowerBonus(effects)).toBe(2);
    });
});
