import { describe, it, expect } from "vitest";
import { resolveUptie } from "./uptieResolver";

describe("resolveUptie", () => {
    // Real example from identities.json: Blade Lineage Mentor Meursault's "Draw of the Sword"
    // basePower: 3, basePowerUptie: { u2: 2 }
    const base = 3;
    const overrides = { u2: 2 };

    it("tier 4 always uses the base value", () => {
        expect(resolveUptie(base, overrides, 4)).toBe(3);
    });

    it("tier 3 falls back to base when u3 is undefined", () => {
        expect(resolveUptie(base, overrides, 3)).toBe(3);
    });

    it("tier 2 uses its own override", () => {
        expect(resolveUptie(base, overrides, 2)).toBe(2);
    });

    it("tier 1 falls back to the next-higher defined override (u2) when u1 is undefined", () => {
        expect(resolveUptie(base, overrides, 1)).toBe(2);
    });

    it("returns base at every tier when there are no overrides at all", () => {
        expect(resolveUptie(10, undefined, 1)).toBe(10);
        expect(resolveUptie(10, undefined, 4)).toBe(10);
    });

    it("prefers the closest defined override at or below the requested tier", () => {
        const allDefined = { u1: 1, u2: 2, u3: 3 };
        expect(resolveUptie(4, allDefined, 1)).toBe(1);
        expect(resolveUptie(4, allDefined, 2)).toBe(2);
        expect(resolveUptie(4, allDefined, 3)).toBe(3);
        expect(resolveUptie(4, allDefined, 4)).toBe(4);
    });
});
