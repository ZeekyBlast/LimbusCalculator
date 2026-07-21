import path from "node:path";

export const IMAGES_DIR = "data/generated/images";
export const PORTRAITS_DIR = path.join(IMAGES_DIR, "portraits");
export const SPRITES_DIR = path.join(IMAGES_DIR, "sprites");
export const SKILLS_DIR = path.join(IMAGES_DIR, "skills");
export const ICONS_SIN_DIR = path.join(IMAGES_DIR, "icons/sin");
export const ICONS_TYPE_DIR = path.join(IMAGES_DIR, "icons/damage-type");

/** Wiki actual filenames replace ":", "【", "】" (and runs thereof) with a single space and collapse
 * doubled spaces (EGO-fusion titles like "E.G.O::Spicebush", subtitle-style titles like "House of
 * Spiders: The Index", and bracketed titles like "Proselyte:【Paper Slip】Faust"). */
export function titleToFilenameBase(title) {
    return title.replace(/[:【】]+/g, " ").replace(/\s+/g, " ").trim();
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

/** Maps a raw wiki filename (as fetched from File:<name>) to its organized destination path. */
export function resolveDestPath(filename) {
    if (filename in SIN_ICON_MAP) return path.join(ICONS_SIN_DIR, SIN_ICON_MAP[filename]);
    if (filename in TYPE_ICON_MAP) return path.join(ICONS_TYPE_DIR, TYPE_ICON_MAP[filename]);

    for (const [suffix, newName] of SPRITE_SUFFIXES) {
        if (filename.endsWith(suffix)) {
            const base = filename.slice(0, -suffix.length);
            return path.join(SPRITES_DIR, base, newName);
        }
    }

    if (filename.endsWith(" Full.png")) {
        const base = filename.slice(0, -" Full.png".length);
        return path.join(PORTRAITS_DIR, `${base}.png`);
    }

    return path.join(SKILLS_DIR, filename);
}
