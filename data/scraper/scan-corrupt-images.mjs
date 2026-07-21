import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "data/generated/images";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const GIF_MAGIC = Buffer.from("GIF8");

function isImageExt(name) {
    return /\.(png|jpg|jpeg)$/i.test(name);
}
function isGifExt(name) {
    return /\.gif$/i.test(name);
}

function walk(dir, out) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (isImageExt(entry.name) || isGifExt(entry.name)) {
            out.push(full);
        }
    }
}

const files = [];
walk(ROOT, files);

let suspects = [];
for (const f of files) {
    const size = statSync(f).size;
    if (size < 2000) {
        const head = Buffer.alloc(8);
        const fd = readFileSync(f);
        const isPng = fd.subarray(0, 4).equals(PNG_MAGIC);
        const isGif = fd.subarray(0, 4).equals(GIF_MAGIC);
        if (!isPng && !isGif) {
            suspects.push({ file: f, size, preview: fd.toString("utf8", 0, Math.min(200, fd.length)) });
        }
    }
}

console.log(`Scanned ${files.length} files. Found ${suspects.length} suspects (small + wrong magic bytes).`);
for (const s of suspects) {
    console.log(`  ${s.file} (${s.size}B): ${s.preview}`);
}
