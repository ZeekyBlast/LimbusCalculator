import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { titleToFilenameBase, resolveDestPath } from "./image-paths.mjs";

const API = "https://limbuscompany.wiki.gg/api.php";
const DELAY_MS = 800;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function apiGet(params, retries = 5) {
    const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const res = await fetch(url, { headers: { "User-Agent": "LimbusCalculator-DataScraper/0.1 (personal project; contact via GitHub)" } });
        const data = await res.json();
        if (data.error?.code === "ratelimited") {
            const wait = 5000 * (attempt + 1);
            console.log(`  rate limited (api), waiting ${wait}ms...`);
            await sleep(wait);
            continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return data;
    }
    throw new Error(`Still rate limited after ${retries} retries: ${url}`);
}

async function fetchWikitext(title) {
    const data = await apiGet({ action: "query", titles: title, prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1" });
    const page = Object.values(data.query.pages)[0];
    if (!page || page.missing !== undefined) return null;
    return page.revisions?.[0]?.slots?.main?.["*"] ?? null;
}

async function fetchImageUrl(filename) {
    const data = await apiGet({ action: "query", titles: `File:${filename}`, prop: "imageinfo", iiprop: "url" });
    const page = Object.values(data.query.pages)[0];
    if (!page || page.missing !== undefined) return null;
    return page.imageinfo?.[0]?.url ?? null;
}

async function downloadImage(filename, retries = 6) {
    const dest = resolveDestPath(filename);
    if (existsSync(dest)) return { filename, status: "skipped (exists)" };

    const url = await fetchImageUrl(filename);
    if (!url) return { filename, status: "not found" };

    for (let attempt = 0; attempt <= retries; attempt++) {
        const res = await fetch(url);
        if (res.status === 429) {
            const wait = 5000 * (attempt + 1);
            console.log(`  rate limited (download), waiting ${wait}ms...`);
            await sleep(wait);
            continue;
        }
        if (!res.ok) return { filename, status: `HTTP ${res.status}` };
        const buf = Buffer.from(await res.arrayBuffer());
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, buf);
        return { filename, status: "downloaded" };
    }
    return { filename, status: "HTTP 429 (exhausted retries)" };
}

/** Extracts image filenames from the first <gallery>...</gallery> block (the main sprite gallery). */
function extractMainGalleryFiles(wikitext) {
    const match = wikitext.match(/<gallery[^>]*>([\s\S]*?)<\/gallery>/);
    if (!match) return [];
    return match[1]
        .split("\n")
        .map(line => line.split("|")[0].trim().replace(/_/g, " "))
        .filter(name => /\.(png|gif|jpg|jpeg)$/i.test(name));
}

const SIN_ICONS = ["Pride1.png", "Wrath1.png", "Lust1.png", "Sloth1.png", "Gluttony1.png", "Gloom1.png", "Envy1.png"];
const DAMAGE_TYPE_ICONS = ["Slash.png", "Pierce.png", "Blunt.png"];

async function main() {
    let identities = JSON.parse(readFileSync("data/generated/identities.json", "utf8"));
    const limitArg = process.argv.find(a => a.startsWith("--limit="));
    if (limitArg) identities = identities.slice(0, Number(limitArg.split("=")[1]));
    const titlesArg = process.argv.find(a => a.startsWith("--titles="));
    if (titlesArg) {
        const wanted = new Set(titlesArg.slice("--titles=".length).split("|"));
        identities = identities.filter(id => wanted.has(id.title));
    }

    const results = { downloaded: 0, skipped: 0, notFound: [], errors: [] };
    const record = r => {
        if (r.status === "downloaded") results.downloaded++;
        else if (r.status.startsWith("skipped")) results.skipped++;
        else if (r.status === "not found") results.notFound.push(r.filename);
        else results.errors.push(r);
    };

    console.log("Fetching generic sin/damage-type icons...");
    for (const filename of [...SIN_ICONS, ...DAMAGE_TYPE_ICONS]) {
        record(await downloadImage(filename));
        await sleep(DELAY_MS);
    }

    console.log(`Fetching sprites + fixed portraits for ${identities.length} identities...`);
    for (let i = 0; i < identities.length; i++) {
        const title = identities[i].title;
        const wikitext = await fetchWikitext(title);
        await sleep(DELAY_MS);
        if (!wikitext) {
            results.errors.push({ filename: title, status: "wikitext fetch failed" });
            continue;
        }

        const galleryFiles = extractMainGalleryFiles(wikitext);
        const portraitFile = `${titleToFilenameBase(title)} Full.png`;
        const filesToFetch = [...new Set([portraitFile, ...galleryFiles])];

        for (const filename of filesToFetch) {
            record(await downloadImage(filename));
            await sleep(DELAY_MS);
        }

        if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${identities.length} identities...`);
    }

    writeFileSync("data/generated/more-images-report.json", JSON.stringify(results, null, 2));
    console.log(`Downloaded ${results.downloaded}, skipped ${results.skipped}, not found ${results.notFound.length}, errors ${results.errors.length}.`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
