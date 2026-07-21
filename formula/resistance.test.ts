import { describe, it, expect } from "vitest";
import { resistanceModifier, staggerDamageTypeResistanceModifier } from "./resistance";

describe("resistanceModifier", () => {
    it("matches the blog's worked examples", () => {
        // A(50%) = -0.25, A(200%) = +1
        expect(resistanceModifier(0.5)).toBeCloseTo(-0.25);
        expect(resistanceModifier(2.0)).toBeCloseTo(1);
    });

    it("returns -0.5 for negative (absorb) multipliers", () => {
        expect(resistanceModifier(-1)).toBe(-0.5);
        expect(resistanceModifier(-100)).toBe(-0.5);
    });

    it("returns 0 at exactly 100% (normal)", () => {
        expect(resistanceModifier(1)).toBe(0);
    });

    it("returns -0.5 at exactly 0% (nullify)", () => {
        expect(resistanceModifier(0)).toBe(-0.5);
    });
});

describe("staggerDamageTypeResistanceModifier", () => {
    it("is 0 when no threshold broken", () => {
        expect(staggerDamageTypeResistanceModifier(0)).toBe(0);
    });

    it("is +1 for a basic Stagger", () => {
        expect(staggerDamageTypeResistanceModifier(1)).toBe(1);
    });

    it("adds +0.5 per additional threshold (Stagger+, Stagger++)", () => {
        expect(staggerDamageTypeResistanceModifier(2)).toBe(1.5);
        expect(staggerDamageTypeResistanceModifier(3)).toBe(2);
    });
});
