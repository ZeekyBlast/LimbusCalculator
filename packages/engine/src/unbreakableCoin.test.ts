import { describe, it, expect } from "vitest";
import { countUnbreakableCoins } from "./unbreakableCoin";

describe("countUnbreakableCoins", () => {
    it("counts every coin whose own effect text tags it Unbreakable (Gregor's Crack of Dawn - all 4)", () => {
        const coinEffects = [
            "Unbreakable Coin \n [On Hit] Inflict +3 Burn Count \n [On Hit] Inflict +3 Tremor Count",
            "Unbreakable Coin \n [On Hit] Inflict 5 Tremor",
            "Unbreakable Coin \n [On Hit] Inflict 5 Burn",
            "Unbreakable Coin \n [On Hit] Trigger Amplitude Conversion into Tremor - Scorch \n [On Hit] Trigger Tremor Burst; then, reduce target's Tremor Count by 1 \n [On Hit] Activate Burn on target; then, reduce target's Burn Count by 1",
        ];
        expect(countUnbreakableCoins(coinEffects)).toBe(4);
    });

    it("counts only the tagged coin among a mixed pool (Faust's Eject - High Noon - coin 3 of 3)", () => {
        const coinEffects = [
            "[On Hit] Gain 1 Poise",
            "[On Crit] Deal +30% damage",
            "Unbreakable Coin \n Reuse this Coin (max 2 times)",
        ];
        expect(countUnbreakableCoins(coinEffects)).toBe(1);
    });

    it("returns 0 for no tag, undefined, or empty input", () => {
        expect(countUnbreakableCoins(["[On Hit] Gain 1 Poise"])).toBe(0);
        expect(countUnbreakableCoins([])).toBe(0);
        expect(countUnbreakableCoins(undefined)).toBe(0);
    });

    it("is a plain substring match with no grant-vs-tag distinction - safe only because the data shape keeps them apart", () => {
        // "[On Use] Convert this Skill's Coins into Unbreakable Coins equal to..." (a dynamic
        // GRANT effect, not a fixed per-coin tag) was verified against scraped data to live
        // exclusively in Skill.skillEffect, never in coinEffects[i] - so this function is never
        // called with it in practice. This test documents that the function itself doesn't (and
        // doesn't need to) tell the two apart; it trusts the caller only passes coinEffects.
        const grantText = "[On Use] Convert this Skill's Coins into Unbreakable Coins equal to The Middle Count, beginning with Coin 3";
        expect(countUnbreakableCoins([grantText])).toBe(1);
    });
});
