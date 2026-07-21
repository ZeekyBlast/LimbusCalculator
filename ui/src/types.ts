export interface Skill {
    sin?: string;
    skillLevel?: number;
    name?: string;
    damageType?: string;
    icon?: string;
    basePower?: number;
    coinPower?: number;
    coinCount?: number;
    atkWeightMod?: number;
    atkWeight?: number;
    hitCount?: number;
    skillEffect?: string;
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
    hp?: number;
    hpGrowth?: number;
    defenseLevelMod?: number;
    resistances?: { slash?: string; pierce?: string; blunt?: string };
    staggerThresholds?: { u4?: number; u3?: number; u2u1?: number };
    skills: Skill[];
    defenseSkill?: Skill;
    passives: Passive[];
}
