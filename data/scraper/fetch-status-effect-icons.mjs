import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const API = "https://limbuscompany.wiki.gg/api.php";
const DEST = "data/generated/images/icons/status-effects";
const DELAY_MS = 800;

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

async function fetchAllCategoryFiles() {
    const titles = [];
    let cmcontinue;
    do {
        const data = await apiGet({
            action: "query",
            list: "categorymembers",
            cmtitle: "Category:Status Effects",
            cmnamespace: "6",
            cmlimit: "500",
            ...(cmcontinue ? { cmcontinue } : {}),
        });
        titles.push(...data.query.categorymembers.map(m => m.title.replace(/^File:/, "")));
        cmcontinue = data.continue?.cmcontinue;
        await sleep(DELAY_MS);
    } while (cmcontinue);
    return titles;
}

async function fetchImageUrl(filename) {
    const data = await apiGet({ action: "query", titles: `File:${filename}`, prop: "imageinfo", iiprop: "url" });
    const page = Object.values(data.query.pages)[0];
    if (!page || page.missing !== undefined) return null;
    return page.imageinfo?.[0]?.url ?? null;
}

async function downloadImage(filename, dest, retries = 6) {
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
        writeFileSync(dest, buf);
        return { filename, status: "downloaded" };
    }
    return { filename, status: "HTTP 429 (exhausted retries)" };
}

async function main() {
    mkdirSync(DEST, { recursive: true });

    console.log("Fetching status effect file list...");
    const filenames = await fetchAllCategoryFiles();
    console.log(`Found ${filenames.length} status effect icons.`);

    const limitArg = process.argv.find(a => a.startsWith("--limit="));
    const toFetch = limitArg ? filenames.slice(0, Number(limitArg.split("=")[1])) : filenames;

    const results = { downloaded: 0, skipped: 0, notFound: [], errors: [] };
    for (let i = 0; i < toFetch.length; i++) {
        const filename = toFetch[i];
        const safeName = filename.replace(/[/\\?%*:|"<>]/g, "_");
        const dest = path.join(DEST, safeName);
        try {
            const r = await downloadImage(filename, dest);
            if (r.status === "downloaded") results.downloaded++;
            else if (r.status.startsWith("skipped")) results.skipped++;
            else if (r.status === "not found") results.notFound.push(filename);
            else results.errors.push({ filename, status: r.status });
        } catch (e) {
            results.errors.push({ filename, status: String(e) });
        }
        if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${toFetch.length}...`);
        await sleep(DELAY_MS);
    }

    writeFileSync("data/generated/status-effect-icons-report.json", JSON.stringify(results, null, 2));
    console.log(`Downloaded ${results.downloaded}, skipped ${results.skipped}, not found ${results.notFound.length}, errors ${results.errors.length}.`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
