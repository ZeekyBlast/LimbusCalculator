/**
 * Auto-applies status effects a skill's own text declares (e.g. "[On Use] Gain +2 Poise Count",
 * "[On Hit] Inflict 2 Bleed") instead of requiring hand-retyping into the manual editor.
 *
 * Deliberately narrow, same posture as unbreakableCoin.ts: only the exact grammar
 * `Verb + optional "+" + Number + Name[ Count][ next turn]` is matched, anchored on the whole
 * shape, never on the name's mere presence - many lines reference a stat conditionally
 * ("Coin Power +1 for every 6 Charge on self") without granting it, and must produce zero grants.
 *
 * Verbs: "Gain" targets self, "Inflict" targets the opponent. "Apply"/"Lose"/"Remove" are not
 * handled - real "Apply" text is almost always ally/squad-targeted ("Apply 2 Protection to 2
 * other allies"), meaningless in this 1v1 sim; Lose/Remove weren't requested.
 *
 * Triggers: only [On Use], [On Hit], [On Crit] are recognized. [Combat Start] needs "has this
 * encounter's Combat Start already fired" state that doesn't exist yet, and most real Combat
 * Start text targets allies anyway. Every other bracket tag (Heads Hit, Clash Win, Attack End,
 * etc.) is left alone.
 *
 * Potency vs Count: bare "Gain N Poise" (no suffix) is Potency - confirmed via three convergent
 * sources (limbuscompany.wiki.gg's Poise and Bleed pages, plus a community guide noting Count
 * grants are the labeled exception, not the default: "many E.G.O inflict a small amount of Bleed
 * potency, a much smaller number inflict Bleed Count"). This applies only to the 6 dual-stat
 * effects (Bleed/Burn/Rupture/Sinking/Tremor/Poise); every other effect here is Count-only per
 * the wiki's own Status Effects catalog, so a bare number for those is unambiguous by
 * construction. Tremor is excluded entirely - it needs Stagger Threshold tracking, deliberately
 * not built (the scraped staggerThresholds unit was never confirmed against a raw game value).
 * Sinking is dual-stat in principle but this codebase only tracks it as a single flat counter
 * (see effectSetup.ts) - grants route there as a plain additive stack, not split potency/count.
 *
 * Allow-list is exhaustive, not fuzzy: only names in STAT_NAME_TO_EFFECT_ID ever produce a grant.
 * Everything else (the many identity-specific one-off named mechanics - Mauled Color, Red Plum
 * Blossom, Cumulus Wall, etc.) is left alone and stays text-only, by design.
 *
 * Known gap, not silently absorbed: a conditional override bullet that itself matches this
 * grammar (e.g. "- If 6+ allies, apply 2 instead") can double-count alongside its parent grant -
 * not solved here (would need a conditional-branch interpreter), flagged for manual QA instead.
 */

export type SkillGrantTrigger = "on-use" | "on-hit" | "on-crit";
export type SkillGrantTarget = "self" | "opponent";
export type SkillGrantDimension = "potency" | "count" | "stack";

export interface SkillGrant {
    trigger: SkillGrantTrigger;
    target: SkillGrantTarget;
    effectId: string;
    dimension: SkillGrantDimension;
    amount: number;
}

const TAGS: Record<string, SkillGrantTrigger> = {
    "On Use": "on-use",
    "On Hit": "on-hit",
    "On Crit": "on-crit",
};

/** Name (as it appears after the number) -> effect id + whether it's one of the 6 dual-stat (Potency+Count) effects. */
const STAT_NAME_TO_EFFECT_ID: Record<string, { id: string; dualStat: boolean }> = {
    Bleed: { id: "bleed", dualStat: true },
    Burn: { id: "burn", dualStat: true },
    Rupture: { id: "rupture", dualStat: true },
    Poise: { id: "poise", dualStat: true },
    Sinking: { id: "sinking", dualStat: false }, // tracked as a flat counter today, see effectSetup.ts

    Fragile: { id: "fragile", dualStat: false },
    Protection: { id: "protection", dualStat: false },
    "Damage Up": { id: "damage-up", dualStat: false },
    "Damage Down": { id: "damage-down", dualStat: false },
    "Crit Dmg Up": { id: "crit-damage-up", dualStat: false },
    "Power Up": { id: "power-up", dualStat: false },
    "Attack Power Up": { id: "attack-power-up", dualStat: false },
    "Attack Power Down": { id: "attack-power-down", dualStat: false },
    "Defense Power Up": { id: "defense-power-up", dualStat: false },
    "Defense Power Down": { id: "defense-power-down", dualStat: false },
    "Coin Boost": { id: "coin-boost", dualStat: false },
    "Coin Drop": { id: "coin-drop", dualStat: false },
    Haste: { id: "haste", dualStat: false },
    Bind: { id: "bind", dualStat: false },
    Paralyze: { id: "paralyze", dualStat: false },
    Charge: { id: "charge", dualStat: false },
    "Offense Level Up": { id: "offense-level-up-grant", dualStat: false },
    "Offense Level Down": { id: "offense-level-down", dualStat: false },
    "Defense Level Up": { id: "defense-level-up-grant", dualStat: false },
    "Defense Level Down": { id: "defense-level-down", dualStat: false },

    "Slash Fragility": { id: "fragile-slash", dualStat: false },
    "Pierce Fragility": { id: "fragile-pierce", dualStat: false },
    "Blunt Fragility": { id: "fragile-blunt", dualStat: false },
    "Envy Fragility": { id: "fragile-envy", dualStat: false },
    "Gloom Fragility": { id: "fragile-gloom", dualStat: false },
    "Pride Fragility": { id: "fragile-pride", dualStat: false },
    "Lust Fragility": { id: "fragile-lust", dualStat: false },

    "Slash DMG Up": { id: "damage-up-slash", dualStat: false },
    "Blunt DMG Up": { id: "damage-up-blunt", dualStat: false },
    "Gluttony DMG Up": { id: "damage-up-gluttony", dualStat: false },
    "Envy DMG Up": { id: "damage-up-envy", dualStat: false },
    "Pierce DMG Up": { id: "damage-up-pierce", dualStat: false },

    "Slash Power Up": { id: "power-up-slash", dualStat: false },
    "Blunt Power Up": { id: "power-up-blunt", dualStat: false },
    "Envy Power Up": { id: "power-up-envy", dualStat: false },
    "Pride Power Up": { id: "power-up-pride", dualStat: false },
    "Pierce Power Up": { id: "power-up-pierce", dualStat: false },
};

/** Effect ids that only contribute when the resolving skill's damage type or sin matches. */
const SCOPED_SUFFIXES: Record<string, { damageType?: string; sin?: string }> = {
    "fragile-slash": { damageType: "Slash" },
    "fragile-pierce": { damageType: "Pierce" },
    "fragile-blunt": { damageType: "Blunt" },
    "fragile-envy": { sin: "Envy" },
    "fragile-gloom": { sin: "Gloom" },
    "fragile-pride": { sin: "Pride" },
    "fragile-lust": { sin: "Lust" },
    "damage-up-slash": { damageType: "Slash" },
    "damage-up-blunt": { damageType: "Blunt" },
    "damage-up-gluttony": { sin: "Gluttony" },
    "damage-up-envy": { sin: "Envy" },
    "damage-up-pierce": { damageType: "Pierce" },
    "power-up-slash": { damageType: "Slash" },
    "power-up-blunt": { damageType: "Blunt" },
    "power-up-envy": { sin: "Envy" },
    "power-up-pride": { sin: "Pride" },
    "power-up-pierce": { damageType: "Pierce" },
};

/** True unless `effectId` is a type/sin-scoped variant whose suffix doesn't match this skill. */
export function isEffectApplicable(effectId: string, damageType?: string, sin?: string): boolean {
    const scope = SCOPED_SUFFIXES[effectId];
    if (!scope) return true;
    if (scope.damageType) return scope.damageType === damageType;
    return scope.sin === sin;
}

const GRANT_LINE = /^(Gain|Inflict)\s+\+?(\d+)\s+(.+?)\.?$/;

function parseLine(line: string, trigger: SkillGrantTrigger): SkillGrant | undefined {
    const m = line.trim().match(GRANT_LINE);
    if (!m) return undefined;
    const [, verb, amountStr, rawName] = m;
    let name = rawName.trim().replace(/\s+next turn$/i, "");
    let isCount = false;
    if (/\s+Count$/i.test(name)) {
        isCount = true;
        name = name.replace(/\s+Count$/i, "");
    }
    const stat = STAT_NAME_TO_EFFECT_ID[name];
    if (!stat) return undefined;
    const dimension: SkillGrantDimension = !stat.dualStat ? "stack" : isCount ? "count" : "potency";
    return {
        trigger,
        target: verb === "Gain" ? "self" : "opponent",
        effectId: stat.id,
        dimension,
        amount: Number(amountStr),
    };
}

/**
 * Walks skillEffect/coinEffects line-by-line, carrying forward the most recent bracket-tag
 * trigger across untagged continuation/sub-bullet lines (real text often nests a conditional
 * bullet under one tag rather than repeating it on every line).
 */
export function parseSkillGrants(skill: { skillEffect?: string; coinEffects?: string[] }): SkillGrant[] {
    const grants: SkillGrant[] = [];
    const texts = [skill.skillEffect, ...(skill.coinEffects ?? [])].filter((t): t is string => !!t);

    for (const text of texts) {
        let currentTrigger: SkillGrantTrigger | undefined;
        for (const rawLine of text.split("\n")) {
            const trimmed = rawLine.trim();
            const tagMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
            if (tagMatch) {
                currentTrigger = TAGS[tagMatch[1]];
                if (currentTrigger) {
                    const grant = parseLine(tagMatch[2], currentTrigger);
                    if (grant) grants.push(grant);
                }
                continue;
            }
            if (!currentTrigger) continue;
            const grant = parseLine(trimmed.replace(/^-\s*/, ""), currentTrigger);
            if (grant) grants.push(grant);
        }
    }

    // `coinEffects[i]` is one entry per coin SLOT, not per coin that actually lands - a 2-coin
    // skill whose coins both say "[On Hit] Gain 1 Poise" produces two identical grant objects
    // here, but the caller multiplies by how many coins actually hit. Left undeduped, that would
    // double-count (2 declarations x N hits instead of 1 declaration x N hits). Collapsing
    // identical declarations down to one is the correct read when every coin says the same
    // thing (confirmed the common case - e.g. Blade Lineage Salsu Don Quixote's Draw of the
    // Sword) - it's a real approximation for the rarer case of genuinely different per-coin
    // grants (those still can't be tied to which specific landed coin triggered them, since this
    // sim doesn't track coin-slot identity through a clash at all), but strictly better than the
    // multiplication bug it replaces.
    const seen = new Set<string>();
    return grants.filter(g => {
        const key = `${g.trigger}|${g.target}|${g.effectId}|${g.dimension}|${g.amount}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
