import { writeFileSync, mkdirSync } from "node:fs";
import { parseIdentityPage } from "./parse-identity.mjs";

const API = "https://limbuscompany.wiki.gg/api.php";
const DELAY_MS = 1000;

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

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchAllCategoryMembers(category) {
    const titles = [];
    let cmcontinue;
    do {
        const data = await apiGet({
            action: "query",
            list: "categorymembers",
            cmtitle: `Category:${category}`,
            cmlimit: "500",
            ...(cmcontinue ? { cmcontinue } : {}),
        });
        titles.push(...data.query.categorymembers.map(m => m.title));
        cmcontinue = data.continue?.cmcontinue;
        await sleep(DELAY_MS);
    } while (cmcontinue);
    return titles;
}

async function fetchWikitext(title) {
    const data = await apiGet({
        action: "query",
        titles: title,
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        redirects: "1",
    });
    const page = Object.values(data.query.pages)[0];
    if (!page || page.missing !== undefined) return null;
    return page.revisions?.[0]?.slots?.main?.["*"] ?? null;
}

async function main() {
    console.log("Fetching identity page list...");
    let titles = await fetchAllCategoryMembers("Identities");
    titles = titles.filter(t => !t.startsWith("Category:") && t !== "Identities");
    console.log(`Found ${titles.length} identity pages.`);

    const limitArg = process.argv.find(a => a.startsWith("--limit="));
    if (limitArg) {
        titles = titles.slice(0, Number(limitArg.split("=")[1]));
        console.log(`Limiting to first ${titles.length} for testing.`);
    }

    const identities = [];
    const failures = [];
    for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        try {
            const wikitext = await fetchWikitext(title);
            if (!wikitext) {
                failures.push({ title, reason: "missing page" });
                continue;
            }
            const parsed = parseIdentityPage(title, wikitext);
            if (!parsed) {
                failures.push({ title, reason: "no IDPage template found" });
                continue;
            }
            identities.push(parsed);
        } catch (e) {
            failures.push({ title, reason: String(e) });
        }
        if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${titles.length}...`);
        await sleep(DELAY_MS);
    }

    mkdirSync("data/generated", { recursive: true });
    writeFileSync("data/generated/identities.json", JSON.stringify(identities, null, 2));
    writeFileSync("data/generated/identities-failures.json", JSON.stringify(failures, null, 2));

    console.log(`Parsed ${identities.length} identities, ${failures.length} failures.`);
    console.log("Wrote data/generated/identities.json");
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
