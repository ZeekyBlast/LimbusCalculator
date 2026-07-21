import { describe, it, expect } from "vitest";
import { criticalDamageModifier } from "./criticalModifier";

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
