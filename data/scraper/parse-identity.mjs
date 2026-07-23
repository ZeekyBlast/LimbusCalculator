import { parseTemplate, cleanText } from "./wikitext.mjs";

function toNumber(str) {
    if (str == null || str === "") return undefined;
    const n = Number(String(str).replace(/^\+\s*/, ""));
    return Number.isNaN(n) ? undefined : n;
}

function parseSkill(raw, variantLabel) {
    if (!raw) return undefined;
    const t = parseTemplate(raw);
    if (!t) return undefined;
    const p = t.params;
    return {
        variantLabel,
        sin: p.sin,
        skillLevel: toNumber(p.slevel),
        name: cleanText(p.name),
        damageType: p.type,
        icon: p.icon,
        basePower: toNumber(p.spower),
        basePowerUptie: { u3: toNumber(p["3spower"]), u2: toNumber(p["2spower"]), u1: toNumber(p["1spower"]) },
        coinPower: toNumber((p.cpower ?? "").replace(/^\+\s*/, "")),
        coinPowerUptie: { u3: toNumber(p["3cpower"]), u2: toNumber(p["2cpower"]), u1: toNumber(p["1cpower"]) },
        coinCount: toNumber(p.coin),
        atkWeightMod: toNumber(p.atkmod),
        atkWeight: toNumber(p.atkweight),
        hitCount: toNumber(p.amt),
        skillEffect: cleanText(p.se),
        skillEffectUptie: { u3: cleanText(p["3se"]), u1: cleanText(p["1se"]) },
        coinEffects: [1, 2, 3, 4, 5]
            .map(n => cleanText(p[`ce${n}`]))
            .filter(Boolean),
    };
}

function parsePassive(raw) {
    if (!raw) return undefined;
    const t = parseTemplate(raw);
    if (!t) return undefined;
    const p = t.params;
    return {
        name: p["1"],
        sin: p.sin,
        requirement: p.req,
        description: cleanText(p["2"]),
    };
}

/** Parses the full wikitext of an identity page into our clean schema. */
export function parseIdentityPage(title, wikitext) {
    const match = wikitext.match(/\{\{IDPage[\s\S]*/);
    if (!match) return null;
    // Find the matching closing }} for the outer IDPage template by brace-depth scan,
    // since the page has trailing sections (==Uptie Changes==, ==Trivia==, etc.) after it.
    const start = match.index;
    let depth = 0;
    let end = -1;
    for (let i = start; i < wikitext.length - 1; i++) {
        const two = wikitext.slice(i, i + 2);
        if (two === "{{") {
            depth++;
            i++;
            continue;
        }
        if (two === "}}") {
            depth--;
            i++;
            if (depth === 0) {
                end = i + 1;
                break;
            }
            continue;
        }
    }
    if (end === -1) return null;

    const t = parseTemplate(wikitext.slice(start, end));
    if (!t) return null;
    const p = t.params;

    return {
        title,
        prefix: p.prefix,
        sinner: p.sinner,
        quote: cleanText(p.quote),
        rarity: toNumber(p.rarity),
        season: toNumber(p.season),
        releaseDate: p.releasedate,
        hp: toNumber(p.hp),
        hpGrowth: toNumber(p.hpgrowth),
        speed: { u4: p.speed, u2: p["2speed"], u1: p["1speed"] },
        defenseLevelMod: toNumber(p.defmod),
        resistances: { slash: p.slash, pierce: p.pierce, blunt: p.blunt },
        staggerThresholds: { u4: toNumber(p.stagger1), u3: toNumber(p.stagger2), u2u1: toNumber(p.stagger3) },
        // Some Skills have condition-gated alternate versions the wiki lists as separate
        // sub-tabs, e.g. Skill 3's dashboard swaps to "Skill 3-2" under some effect -
        // these aren't optional flavor, they're real selectable moves missing from just skill1..skill4.
        skills: [
            "skill1", "skill1-2", "skill1-3",
            "skill2", "skill2-2", "skill2-3",
            "skill3", "skill3-2", "skill3-3", "skill3-4",
            "skill4",
        ].map(key => parseSkill(p[key], key.includes("-") ? key.split("-")[1] : undefined)).filter(Boolean),
        defenseSkill: parseSkill(p.defense),
        passives: [1, 2, 3].map(n => parsePassive(p[`passive${n}`])).filter(Boolean),
    };
}
