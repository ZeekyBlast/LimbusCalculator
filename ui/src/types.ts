export interface UptieOverride<T> {
    u1?: T;
    u2?: T;
    u3?: T;
}

export interface Skill {
    /** Set only on a condition-gated alternate version of a skill slot, e.g. "2" for Skill 3-2. */
    variantLabel?: string;
    sin?: string;
    skillLevel?: number;
    name?: string;
    damageType?: string;
    icon?: string;
    basePower?: number;
    basePowerUptie?: UptieOverride<number>;
    coinPower?: number;
    coinPowerUptie?: UptieOverride<number>;
    coinCount?: number;
    atkWeightMod?: number;
    atkWeight?: number;
    hitCount?: number;
    skillEffect?: string;
    skillEffectUptie?: UptieOverride<string>;
    coinEffects?: string[];
}

export interface Passive {
    name?: string;
    sin?: string;
    requirement?: string;
    description?: string;
}

export interface Identity {
    title: string;
    prefix?: string;
    sinner?: string;
    quote?: string;
    rarity?: number;
    releaseDate?: string;
    hp?: number;
    hpGrowth?: number;
    speed?: { u4?: string; u2?: string; u1?: string };
    defenseLevelMod?: number;
    resistances?: { slash?: string; pierce?: string; blunt?: string };
    staggerThresholds?: { u4?: number; u3?: number; u2u1?: number };
    skills: Skill[];
    defenseSkill?: Skill;
    passives: Passive[];
}
