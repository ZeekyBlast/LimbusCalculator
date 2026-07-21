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
            console.log(`  rate limited, waiting ${wait}ms...`);
            await sleep(wait);
            continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return data;
    }
    throw new Error(`Still rate limited after ${retries} retries: ${url}`);
}

async function fetchImageUrl(filename) {
    const data = await apiGet({ action: "query", titles: `File:${filename}`, prop: "imageinfo", iiprop: "url" });
    const page = Object.values(data.query.pages)[0];
    if (!page || page.missing !== undefined) return null;
    return page.imageinfo?.[0]?.url ?? null;
}

async function downloadImage(filename, retries = 5) {
    const dest = resolveDestPath(filename);
    if (existsSync(dest)) return { filename, status: "skipped (exists)" };

    const url = await fetchImageUrl(filename);
    if (!url) return { filename, status: "not found" };

    for (let attempt = 0; attempt <= retries; attempt++) {
        const res = await fetch(url);
        if (res.status === 429) {
            const wait = 5000 * (attempt + 1);
            console.log(`  rate limited on download, waiting ${wait}ms...`);
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

function collectNeededFilenames(identities) {
    const names = new Set();
    for (const id of identities) {
        names.add(`${titleToFilenameBase(id.title)} Full.png`);
        for (const skill of id.skills) {
            if (skill.icon) names.add(`${skill.icon}.png`);
        }
        if (id.defenseSkill?.icon) names.add(`${id.defenseSkill.icon}.png`);
    }
    return [...names];
}

async function main() {
    const identities = JSON.parse(readFileSync("data/generated/identities.json", "utf8"));
    let filenames = collectNeededFilenames(identities);
    console.log(`Need ${filenames.length} unique image files for ${identities.length} identities.`);

    const limitArg = process.argv.find(a => a.startsWith("--limit="));
    if (limitArg) {
        filenames = filenames.slice(0, Number(limitArg.split("=")[1]));
        console.log(`Limiting to first ${filenames.length} for testing.`);
    }

    const results = { downloaded: 0, skipped: 0, notFound: [], errors: [] };
    for (let i = 0; i < filenames.length; i++) {
        const filename = filenames[i];
        try {
            const r = await downloadImage(filename);
            if (r.status === "downloaded") results.downloaded++;
            else if (r.status.startsWith("skipped")) results.skipped++;
            else if (r.status === "not found") results.notFound.push(filename);
            else results.errors.push({ filename, status: r.status });
        } catch (e) {
            results.errors.push({ filename, status: String(e) });
        }
        if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${filenames.length}...`);
        await sleep(DELAY_MS);
    }

    writeFileSync("data/generated/images-report.json", JSON.stringify(results, null, 2));
    console.log(`Downloaded ${results.downloaded}, skipped ${results.skipped}, not found ${results.notFound.length}, errors ${results.errors.length}.`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
