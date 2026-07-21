import { readFileSync } from "node:fs";
import { parseIdentityPage } from "./parse-identity.mjs";

const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const pages = raw.query.pages;
const page = Object.values(pages)[0];
const wikitext = page.revisions[0].slots.main["*"];

const parsed = parseIdentityPage(page.title, wikitext);
console.log(JSON.stringify(parsed, null, 2));
