import { describe, it, expect } from "vitest";
import { parseSkillGrants, isEffectApplicable } from "./skillEffectGrants";

describe("parseSkillGrants", () => {
    it("routes On Use (self) to Count when suffixed, On Hit (self) to Potency when bare - Blade Lineage Salsu Yi Sang's Skill 1", () => {
        const skill = { skillEffect: "[On Use] Gain +2 Poise Count", coinEffects: ["[On Hit] Gain 3 Poise next turn"] };
        expect(parseSkillGrants(skill)).toEqual([
            { trigger: "on-use", target: "self", effectId: "poise", dimension: "count", amount: 2 },
            { trigger: "on-hit", target: "self", effectId: "poise", dimension: "potency", amount: 3 },
        ]);
    });

    it("routes Inflict to opponent, bare dual-stat name to Potency - Blade Lineage Salsu Sinclair's To Claim Their Bones", () => {
        const skill = { skillEffect: "[On Hit] Inflict 5 Paralyze \n [On Hit] Inflict 3 Bleed" };
        expect(parseSkillGrants(skill)).toEqual([
            { trigger: "on-hit", target: "opponent", effectId: "paralyze", dimension: "stack", amount: 5 },
            { trigger: "on-hit", target: "opponent", effectId: "bleed", dimension: "potency", amount: 3 },
        ]);
    });

    it("picks the one recognized grant out of unmapped identity-specific lines - Blade of the House of Spiders Ryōshū's Inevitable Termination", () => {
        const skill = {
            skillEffect:
                "Deal +30% damage on Critical Hit \n [On Hit] Inflict 2 Bladetrail -Afterimage- \n [On Hit] Inflict Bladetrail -Afterimage- equal to Entanglement on self (max 4) \n [On Hit] Activate Burn on target. Target loses 1 Burn Count \n [On Crit] Inflict 1 Slash Fragility",
        };
        expect(parseSkillGrants(skill)).toEqual([{ trigger: "on-crit", target: "opponent", effectId: "fragile-slash", dimension: "stack", amount: 1 }]);
    });

    it("produces zero grants for pure conditional references, even ones that textually contain 'gain' mid-sentence - LCE E.G.O::AEDD Gregor's Electric Release", () => {
        const skill = {
            skillEffect:
                "[On Use] Deal +6% damage for every Charge on self (max 30%) \n [On Use] At 3+/5+ Charge, Coin Power +1/+2 \n [On Use] Clash Power +1 for every 5 Charge Count on self (max 2) \n [On Use] At less than 10 Charge Count, gain +2 Charge Count",
        };
        expect(parseSkillGrants(skill)).toEqual([]);
    });

    it("carries the trigger to an untagged continuation line but still rejects it if unmapped - LCCB Assistant Manager Ryōshū's O.O.F.", () => {
        const skill = { skillEffect: "[On Use] Gain 4 Poise \n Gain +1 Coin Power for every 7 Poise on self (max 2)" };
        expect(parseSkillGrants(skill)).toEqual([{ trigger: "on-use", target: "self", effectId: "poise", dimension: "potency", amount: 4 }]);
    });

    it("never grants Tremor - hard exclusion, Stagger Threshold tracking is deliberately unbuilt", () => {
        const skill = { skillEffect: "[On Use] Gain +3 Tremor Count" };
        expect(parseSkillGrants(skill)).toEqual([]);
    });

    it("routes Sinking to a flat stack regardless of a Count suffix, per its existing single-counter representation", () => {
        const skill = { coinEffects: ["[On Hit] Inflict +1 Sinking Count next turn"] };
        expect(parseSkillGrants(skill)).toEqual([{ trigger: "on-hit", target: "opponent", effectId: "sinking", dimension: "stack", amount: 1 }]);
    });

    it("dedupes an identical On Hit grant repeated across coin slots instead of double-counting - Blade Lineage Salsu Don Quixote's Draw of the Sword (2 coins, both say the same thing)", () => {
        const skill = {
            skillEffect: "At 5+ Poise on self, Coin Power +1 \n [On Use] Gain +2 Poise Count",
            coinEffects: ["[On Hit] Gain 1 Poise", "[On Hit] Gain 1 Poise"],
        };
        expect(parseSkillGrants(skill)).toEqual([
            { trigger: "on-use", target: "self", effectId: "poise", dimension: "count", amount: 2 },
            { trigger: "on-hit", target: "self", effectId: "poise", dimension: "potency", amount: 1 },
        ]);
    });

    it("returns [] for undefined/empty input", () => {
        expect(parseSkillGrants({})).toEqual([]);
        expect(parseSkillGrants({ skillEffect: "", coinEffects: [] })).toEqual([]);
    });
});

describe("isEffectApplicable", () => {
    it("is always true for an unscoped effect id", () => {
        expect(isEffectApplicable("bleed", "Slash", "Wrath")).toBe(true);
        expect(isEffectApplicable("bleed", undefined, undefined)).toBe(true);
    });

    it("gates a damage-type-scoped id to a matching skill only", () => {
        expect(isEffectApplicable("fragile-slash", "Slash", "Wrath")).toBe(true);
        expect(isEffectApplicable("fragile-slash", "Pierce", "Wrath")).toBe(false);
    });

    it("gates a sin-scoped id to a matching skill only", () => {
        expect(isEffectApplicable("power-up-envy", "Slash", "Envy")).toBe(true);
        expect(isEffectApplicable("power-up-envy", "Slash", "Wrath")).toBe(false);
    });
});
