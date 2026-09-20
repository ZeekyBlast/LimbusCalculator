import { describe, it, expect } from "vitest";
import { criticalDamageModifier, resolvePoiseCrit } from "./criticalModifier";

describe("criticalDamageModifier", () => {
    it("is 0.2 with no modifiers (base rate only)", () => {
        expect(criticalDamageModifier()).toBeCloseTo(0.2);
    });

    it("adds static adders (E2) directly", () => {
        expect(criticalDamageModifier(0.1)).toBeCloseTo(0.3);
    });

    it("applies result-multiplier adders (E3) as (E1+E2)*(E3+1)", () => {
        // (0.2 + 0.1) * (0.5 + 1) = 0.3 * 1.5 = 0.45
        expect(criticalDamageModifier(0.1, 0.5)).toBeCloseTo(0.45);
    });

    it("floors the multiplier at 0 (cannot go negative)", () => {
        expect(criticalDamageModifier(0, -2)).toBe(0);
    });
});

describe("resolvePoiseCrit", () => {
    it("crits when rng is under (Potency * 5)% and consumes 1 Count", () => {
        const { isCrit, nextState } = resolvePoiseCrit({ potency: 10, count: 3 }, () => 0.49);
        expect(isCrit).toBe(true);
        expect(nextState).toEqual({ potency: 10, count: 2 });
    });

    it("doesn't crit when rng lands at/above the chance, and Count is untouched", () => {
        const { isCrit, nextState } = resolvePoiseCrit({ potency: 10, count: 3 }, () => 0.5);
        expect(isCrit).toBe(false);
        expect(nextState).toEqual({ potency: 10, count: 3 });
    });

    it("clamps chance at 100% for Potency >= 20", () => {
        const { isCrit } = resolvePoiseCrit({ potency: 25, count: 1 }, () => 0.999);
        expect(isCrit).toBe(true);
    });

    it("never crits once Count is 0, regardless of Potency", () => {
        const { isCrit, nextState } = resolvePoiseCrit({ potency: 99, count: 0 }, () => 0);
        expect(isCrit).toBe(false);
        expect(nextState).toEqual({ potency: 99, count: 0 });
    });
});
