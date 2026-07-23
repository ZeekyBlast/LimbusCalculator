// Minimal wikitext template parser tailored to this wiki's flat `{{Name|key=value|...}}` style.
// Not a general MediaWiki parser — good enough because this wiki's identity templates
// don't use conditionals/loops, just nested templates as param values.

function splitTopLevel(str, sep) {
    const parts = [];
    let braceDepth = 0;
    let bracketDepth = 0;
    let cur = "";
    for (let i = 0; i < str.length; i++) {
        const two = str.slice(i, i + 2);
        if (two === "{{") {
            braceDepth++;
            cur += two;
            i++;
            continue;
        }
        if (two === "}}") {
            braceDepth--;
            cur += two;
            i++;
            continue;
        }
        if (two === "[[") {
            bracketDepth++;
            cur += two;
            i++;
            continue;
        }
        if (two === "]]") {
            bracketDepth--;
            cur += two;
            i++;
            continue;
        }
        if (str[i] === sep && braceDepth === 0 && bracketDepth === 0) {
            parts.push(cur);
            cur = "";
            continue;
        }
        cur += str[i];
    }
    parts.push(cur);
    return parts;
}

function findTopLevelEquals(str) {
    let braceDepth = 0;
    let bracketDepth = 0;
    for (let i = 0; i < str.length; i++) {
        const two = str.slice(i, i + 2);
        if (two === "{{") {
            braceDepth++;
            i++;
            continue;
        }
        if (two === "}}") {
            braceDepth--;
            i++;
            continue;
        }
        if (two === "[[") {
            bracketDepth++;
            i++;
            continue;
        }
        if (two === "]]") {
            bracketDepth--;
            i++;
            continue;
        }
        if (str[i] === "=" && braceDepth === 0 && bracketDepth === 0) {
            return i;
        }
    }
    return -1;
}

/** Finds the end (exclusive) of the balanced `{{...}}` block starting at `start`, ignoring any trailing text. */
function findTemplateEnd(str, start) {
    let depth = 0;
    for (let i = start; i < str.length - 1; i++) {
        const two = str.slice(i, i + 2);
        if (two === "{{") {
            depth++;
            i++;
            continue;
        }
        if (two === "}}") {
            depth--;
            i++;
            if (depth === 0) return i + 1;
            continue;
        }
    }
    return -1;
}

/** Parses a single `{{Name|k=v|...}}` block into { name, params }. Ignores trailing text (e.g. HTML comments) after the closing braces. Positional (no `=`) params are keyed "1","2",... */
export function parseTemplate(wikitext) {
    const trimmed = wikitext.trim();
    if (!trimmed.startsWith("{{")) return null;
    const end = findTemplateEnd(trimmed, 0);
    if (end === -1) return null;
    const inner = trimmed.slice(2, end - 2);
    const parts = splitTopLevel(inner, "|");
    const name = parts[0].trim();
    const params = {};
    let positional = 1;
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const eqIdx = findTopLevelEquals(part);
        if (eqIdx === -1) {
            params[String(positional++)] = part.trim();
        } else {
            const key = part.slice(0, eqIdx).trim();
            const value = part.slice(eqIdx + 1).trim();
            params[key] = value;
        }
    }
    return { name, params };
}

/** Strips common inline templates ({{Keyword|X}}, {{StatusEffect|X|b}}, {{SkillCon|X}}, {{Icons|X}}) down to readable text. */
export function cleanText(text) {
    if (text == null) return text;
    let out = text;
    // {{SkillCon|On Hit}} -> [On Hit]
    out = out.replace(/\{\{SkillCon\|([^}|]+)\}\}/g, "[$1]");
    // {{StatusEffect|Poise|b}} -> Poise
    out = out.replace(/\{\{StatusEffect\|([^}|]+)(\|[^}]*)?\}\}/g, "$1");
    // {{Keyword|X}} -> X
    out = out.replace(/\{\{Keyword\|([^}|]+)\}\}/g, "$1");
    // {{Icons|X}} -> (drop, purely visual)
    out = out.replace(/\{\{Icons\|[^}]*\}\}/g, "");
    // [[Link|Display]] -> Display, [[Link]] -> Link
    out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
    out = out.replace(/\[\[([^\]]+)\]\]/g, "$1");
    out = out.replace(/'''/g, "").replace(/''/g, "");
    out = out.replace(/<br\s*\/?>/gi, "\n");
    // Strip any remaining HTML tags (e.g. <b>空間斬</b> in dual English/native skill names) - keep the inner text.
    out = out.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    return out.trim();
}
