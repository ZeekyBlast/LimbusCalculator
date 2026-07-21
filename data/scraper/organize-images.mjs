import { readFileSync, readdirSync, mkdirSync, renameSync, existsSync } from "node:fs";
import path from "node:path";

const SRC = "data/generated/images";
const PORTRAITS_DIR = path.join(SRC, "portraits");
const SPRITES_DIR = path.join(SRC, "sprites");
const SKILLS_DIR = path.join(SRC, "skills");
const ICONS_SIN_DIR = path.join(SRC, "icons/sin");
const ICONS_TYPE_DIR = path.join(SRC, "icons/damage-type");

/** Wiki actual filenames replace "::" with a plain space and collapse doubled spaces (EGO-fusion identity titles). */
function titleToFilenameBase(title) {
    return title.replace(/::/g, " ").replace(/\s+/g, " ").trim();
}

const SPRITE_SUFFIXES = [
    [" Idle Sprite.png", "idle.png"],
    [" Moving Sprite.png", "moving.png"],
    [" Guard Sprite.png", "guard.png"],
    [" Evade Sprite.png", "evade.png"],
    [" Hurt Sprite.png", "hurt.png"],
    [" Idle Animation.gif", "idle-animation.gif"],
];

const SIN_ICON_MAP = {
    "Pride1.png": "pride.png",
    "Wrath1.png": "wrath.png",
    "Lust1.png": "lust.png",
    "Sloth1.png": "sloth.png",
    "Gluttony1.png": "gluttony.png",
    "Gloom1.png": "gloom.png",
    "Envy1.png": "envy.png",
};
const TYPE_ICON_MAP = {
    "Slash.png": "slash.png",
    "Pierce.png": "pierce.png",
    "Blunt.png": "blunt.png",
};

for (const dir of [PORTRAITS_DIR, SPRITES_DIR, SKILLS_DIR, ICONS_SIN_DIR, ICONS_TYPE_DIR]) {
    mkdirSync(dir, { recursive: true });
}

function moveFile(from, to) {
    if (!existsSync(from)) return false;
    if (!existsSync(from) || from === to) return false;
    mkdirSync(path.dirname(to), { recursive: true });
    renameSync(from, to);
    return true;
}

const identities = JSON.parse(readFileSync("data/generated/identities.json", "utf8"));
let movedCount = 0;

for (const [from, to] of Object.entries(SIN_ICON_MAP)) {
    if (moveFile(path.join(SRC, from), path.join(ICONS_SIN_DIR, to))) movedCount++;
}
for (const [from, to] of Object.entries(TYPE_ICON_MAP)) {
    if (moveFile(path.join(SRC, from), path.join(ICONS_TYPE_DIR, to))) movedCount++;
}

for (const id of identities) {
    const base = titleToFilenameBase(id.title);
    if (moveFile(path.join(SRC, `${base} Full.png`), path.join(PORTRAITS_DIR, `${base}.png`))) movedCount++;
    for (const [suffix, newName] of SPRITE_SUFFIXES) {
        if (moveFile(path.join(SRC, `${base}${suffix}`), path.join(SPRITES_DIR, base, newName))) movedCount++;
    }
}

// Anything left flat in SRC is a skill/defense icon (already globally unique names).
const remaining = readdirSync(SRC, { withFileTypes: true }).filter(e => e.isFile());
for (const entry of remaining) {
    if (moveFile(path.join(SRC, entry.name), path.join(SKILLS_DIR, entry.name))) movedCount++;
}

const stillFlat = readdirSync(SRC, { withFileTypes: true }).filter(e => e.isFile());
console.log(`Moved ${movedCount} files into organized structure. ${stillFlat.length} files remain unorganized at the top level.`);
if (stillFlat.length > 0) console.log(stillFlat.map(e => e.name));
