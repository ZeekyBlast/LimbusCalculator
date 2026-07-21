import { describe, it, expect } from "vitest";
import { headsChance, flipCoins, clashPowerLevelBonus, simulateClash, type ClashCombatant } from "./clash";
import { computeFinalDamage } from "./damage";

describe("headsChance", () => {
    it("is 50% at 0 sanity", () => {
        expect(headsChance(0)).toBeCloseTo(0.5);
    });

    it("matches the wiki's worked examples", () => {
        expect(headsChance(27)).toBeCloseTo(0.77);
        expect(headsChance(-33)).toBeCloseTo(0.17);
    });

    it("is 95% at max sanity and 5% at min sanity", () => {
        expect(headsChance(45)).toBeCloseTo(0.95);
        expect(headsChance(-45)).toBeCloseTo(0.05);
    });

    it("clamps beyond the [-45, 45] range", () => {
        expect(headsChance(100)).toBeCloseTo(0.95);
        expect(headsChance(-100)).toBeCloseTo(0.05);
    });
});

describe("flipCoins", () => {
    it("counts heads using an injected rng", () => {
        // rng < chance counts as heads; feed a fixed sequence
        const seq = [0.1, 0.9, 0.2, 0.8];
        let i = 0;
        const rng = () => seq[i++];
        expect(flipCoins(4, 0.5, rng)).toBe(2); // 0.1 and 0.2 are < 0.5
    });

    it("returns 0 for 0 coins", () => {
        expect(flipCoins(0, 0.9)).toBe(0);
    });
});

describe("clashPowerLevelBonus", () => {
    it("matches the wiki's literal example: 4 level difference -> +1", () => {
        expect(clashPowerLevelBonus(14, 10)).toBe(1);
    });

    it("is 0 with no level difference", () => {
        expect(clashPowerLevelBonus(10, 10)).toBe(0);
    });

    it("gives the lower side 0, never a negative penalty", () => {
        expect(clashPowerLevelBonus(10, 14)).toBe(0);
    });

    it("floors partial 3-level increments", () => {
        expect(clashPowerLevelBonus(12, 10)).toBe(0); // 2 level diff, not enough for +1
        expect(clashPowerLevelBonus(13, 10)).toBe(1); // 3 level diff
    });
});

describe("simulateClash", () => {
    const combatant = (overrides: Partial<ClashCombatant> = {}): ClashCombatant => ({
        basePower: 5,
        coinPower: 3,
        coinCount: 2,
        level: 10,
        sanityPoints: 0,
        ...overrides,
    });

    it("hand-traced: A wins round 1 outright, clash ends in 1 round", () => {
        // A: basePower 5, coinPower 3, 1 coin. B: basePower 5, coinPower 3, 2 coins.
        // Force A's coin heads (rng < 0.5) and B's coins both tails (rng >= 0.5).
        // Round 1: A flips 1 coin (heads) -> aPower = 5 + 0 + 1*3 = 8
        //          B flips 2 coins (both tails) -> bPower = 5 + 0 + 0*3 = 5
        // A wins the round, B loses a coin (2 -> 1). B still has 1 coin, so round 2 happens.
        // Round 2: A flips 1 coin (heads again) -> aPower = 8. B flips 1 coin (tails) -> bPower = 5.
        // A wins again, B loses its last coin (1 -> 0). Clash ends, A wins.
        const seq = [0.1, 0.9, 0.9, 0.1, 0.9];
        let i = 0;
        const rng = () => seq[i++];

        const a = combatant({ coinCount: 1 });
        const b = combatant({ coinCount: 2 });
        const result = simulateClash(a, b, rng);

        expect(result.winner).toBe("a");
        expect(result.winnerCoinsRemaining).toBe(1);
        expect(result.parryRounds).toBe(0);
        expect(result.rounds).toHaveLength(2);
        expect(result.rounds[0]).toMatchObject({ aPower: 8, bPower: 5, aCoinsRemaining: 1, bCoinsRemaining: 1, tie: false });
        expect(result.rounds[1]).toMatchObject({ aPower: 8, bPower: 5, aCoinsRemaining: 1, bCoinsRemaining: 0, tie: false });
    });

    it("applies the asymmetric level bonus to clash power", () => {
        // A is 3 levels above B -> A gets +1 power; B gets +0. Both coins tails so only
        // base power + level bonus matters: aPower = 5+1=6, bPower = 5+0=5. A wins.
        const seq = [0.9, 0.9];
        let i = 0;
        const rng = () => seq[i++];

        const a = combatant({ coinCount: 1, level: 13 });
        const b = combatant({ coinCount: 1, level: 10 });
        const result = simulateClash(a, b, rng);

        expect(result.rounds[0].aPower).toBe(6);
        expect(result.rounds[0].bPower).toBe(5);
        expect(result.winner).toBe("a");
    });

    it("counts a tied round as a parry: no coin lost, parryRounds increments", () => {
        // Both flip identically (same chance, same rng draws) -> equal power every round.
        const rng = () => 0.9; // always tails for both sides
        const a = combatant({ coinCount: 1 });
        const b = combatant({ coinCount: 1 });

        // This would tie forever; rely on the 99-round draw cap.
        const result = simulateClash(a, b, rng);

        expect(result.winner).toBe("draw");
        expect(result.parryRounds).toBe(99);
        expect(result.rounds.every(r => r.tie)).toBe(true);
        expect(result.rounds).toHaveLength(99);
    });

    it("caps at 99 parry rounds and forces a draw (never infinite-loops)", () => {
        const rng = () => 0.9;
        const a = combatant({ coinCount: 5 });
        const b = combatant({ coinCount: 5 });
        const result = simulateClash(a, b, rng);
        expect(result.winner).toBe("draw");
        expect(result.parryRounds).toBe(99);
    });
});

describe("one-sided attack phase (per-coin minimum damage)", () => {
    // The wiki: "an Attack Skill will always deal a minimum of 1 damage per Coin, even if the
    // Attack Skill displays having rolled a 0." computeFinalDamage's existing minimum-damage
    // floor (max(total, 1, 0.05*coinRoll)) already satisfies this when called once per coin -
    // no new minimum logic needed in the clash module itself, just per-coin call discipline
    // in the caller (UI), which this test documents/guards.
    it("still yields at least 1 damage for a coin that rolled 0", () => {
        const damage = computeFinalDamage({
            coinRoll: 0,
            staticModifiers: { sinResistance: 0, damageTypeResistance: 0, offenseDefenseAdvantage: 0, parryBonus: 0, critical: 0 },
            dynamicModifiers: { skillEffects: 0, buffs: 0 },
        });
        expect(damage).toBeGreaterThanOrEqual(1);
    });
});
