#!/usr/bin/env sh
# Refreshes the committed wikitext fixtures used by the parser tests.
set -e
cd "$(dirname "$0")/../test/fixtures"
UA="LimbusCalculator-DataScraper/0.2 (personal project; contact via GitHub)"
API="https://limbuscompany.wiki.gg/api.php"

get() {
  enc=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1")
  curl -s -A "$UA" "$API?format=json&action=parse&prop=wikitext&page=$enc" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.parse){console.error(JSON.stringify(j));process.exit(1)}process.stdout.write(j.parse.wikitext["*"])})' > "$2"
  echo "wrote $2 ($(wc -c < "$2") bytes)"
  sleep 1
}

get "Blade Lineage Salsu Don Quixote" identity-don-quixote.wikitext
get "Yinglong/Enemy" enemy-yinglong.wikitext
get "Shiomi Yoru/Enemy" enemy-shiomi-yoru.wikitext
get "Line 6: Maru no Uchi no Sanzu no Kawa/Station 2: Tarnishing" enemy-station2-invidiae.wikitext
get "Line 6: Maru no Uchi no Sanzu no Kawa" railway-line6.wikitext
get "Module:EnBox/data" enbox-data-full.lua
# Keep only the header, the Line 6 id range, and the closing brace so the fixture stays small.
node -e '
const fs=require("fs");const lines=fs.readFileSync("enbox-data-full.lua","utf8").split("\n");
const keep=lines.filter((l,i)=>i===0||/^\["95[3-7][0-9]"\]/.test(l)||l.trim()==="}");
fs.writeFileSync("enbox-data.lua",keep.join("\n"));fs.unlinkSync("enbox-data-full.lua");
console.log("wrote enbox-data.lua ("+keep.length+" lines)")'
