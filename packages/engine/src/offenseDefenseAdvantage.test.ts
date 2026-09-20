import { describe, it, expect } from "vitest";
import { offenseDefenseAdvantage } from "./offenseDefenseAdvantage";

describe("offenseDefenseAdvantage", () => {
    it("is 0 when levels are equal", () => {
        expect(offenseDefenseAdvantage(10, 10)).toBe(0);
    });

    it("is positive when attacker's offense exceeds defense", () => {
        // x = 25, C = 25 / (25 + 25) = 0.5
        expect(offenseDefenseAdvantage(35, 10)).toBeCloseTo(0.5);
    });

    it("is negative when attacker's offense is below defense", () => {
        expect(offenseDefenseAdvantage(10, 35)).toBeCloseTo(-0.5);
    });

    it("approaches but never reaches 1 as the gap grows", () => {
        const c = offenseDefenseAdvantage(1000, 0);
        expect(c).toBeLessThan(1);
        expect(c).toBeGreaterThan(0.9);
    });
});
