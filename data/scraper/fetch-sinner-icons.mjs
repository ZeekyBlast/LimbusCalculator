import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const API = "https://limbuscompany.wiki.gg/api.php";
const DEST = "data/generated/images/icons/sinners";
const DELAY_MS = 1500;

const SINNERS = ["Yi Sang", "Faust", "Don Quixote", "Ryōshū", "Meursault", "Hong Lu", "Heathcliff", "Ishmael", "Rodion", "Sinclair", "Outis", "Gregor"];

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function apiGet(params, retries = 6) {
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

async function fetchImageUrl(filename) {
    const data = await apiGet({ action: "query", titles: `File:${filename}`, prop: "imageinfo", iiprop: "url" });
    const page = Object.values(data.query.pages)[0];
    if (!page || page.missing !== undefined) return null;
    return page.imageinfo?.[0]?.url ?? null;
}

async function downloadImage(filename, dest, retries = 6) {
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
        writeFileSync(dest, buf);
        return { filename, status: "downloaded" };
    }
    return { filename, status: "HTTP 429 (exhausted retries)" };
}

async function main() {
    mkdirSync(DEST, { recursive: true });
    for (const sinner of SINNERS) {
        const outFile = path.join(DEST, `${sinner.replace(/ /g, "_")}.png`);
        if (existsSync(outFile)) {
            console.log(`skipped (exists): ${sinner}`);
            await sleep(DELAY_MS);
            continue;
        }
        const filename = `${sinner}_Icon.png`;
        const r = await downloadImage(filename, outFile);
        console.log(`${r.status}: ${sinner}`);
        await sleep(DELAY_MS);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
