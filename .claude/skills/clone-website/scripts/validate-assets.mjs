// Validate downloaded image bytes (not just HTTP 200). curl loops — especially on
// Windows/cygwin — can write truncated or 0-byte files that still decode to
// naturalWidth>0 yet render garbled. This checks real file headers and re-downloads
// bad ones with Node fetch.
//
// Run from the project root:  node validate-assets.mjs
// Scans src/components + src/app for referenced "/local/paths", maps them back to
// the live host, validates public/<path>, and repairs failures.
//
// Edit REMOTE_HOST for your target site. Windows-illegal ":" in filenames is
// expected to be sanitized to "_" on disk (and in component src strings).

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUB = path.join(ROOT, "public");
const SRC_DIRS = [path.join(ROOT, "src", "components"), path.join(ROOT, "src", "app")];
const REMOTE_HOST = "https://www.phygitals.com"; // <-- change per target

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const refs = new Set();
for (const f of SRC_DIRS.flatMap((d) => walk(d))) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/(\/[A-Za-z0-9_\/.-]+\.(?:webp|png|jpe?g|svg))/g)) refs.add(m[1]);
}

function status(file, buf) {
  if (file.endsWith(".webp")) {
    if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP")
      return "bad-webp-header";
    return buf.length < buf.readUInt32LE(4) + 8 ? "truncated" : "ok";
  }
  if (file.endsWith(".png")) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) return "bad-png-header";
    return buf.subarray(buf.length - 8).toString("ascii", 0, 4) !== "IEND" ? "truncated" : "ok";
  }
  if (/\.jpe?g$/.test(file)) {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return "bad-jpg-header";
    return buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9 ? "truncated" : "ok";
  }
  return "ok"; // svg/other: skip deep check
}

const bad = [];
let ok = 0;
for (const p of refs) {
  if (p.startsWith("/fonts/") || p.startsWith("/seo/")) continue;
  const dest = path.join(PUB, p);
  if (!fs.existsSync(dest)) { bad.push({ p, dest, reason: "MISSING" }); continue; }
  const st = status(path.basename(p), fs.readFileSync(dest));
  st === "ok" ? ok++ : bad.push({ p, dest, reason: st });
}
console.log(`Validated ${refs.size} referenced images: ${ok} ok, ${bad.length} bad`);
bad.forEach((b) => console.log(`  BAD [${b.reason}] ${b.p}`));

let repaired = 0;
for (const b of bad) {
  // restore the colon for the remote URL (local files sanitize ":" -> "_")
  const remote = REMOTE_HOST + b.p.replace(/(_media-\d+\.webp)$/, (m) => m.replace("_media", ":media"));
  try {
    const res = await fetch(remote, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) { console.log(`  FAIL ${res.status} ${b.p}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (status(path.basename(b.p), buf) !== "ok") { console.log(`  STILL-BAD ${b.p}`); continue; }
    fs.mkdirSync(path.dirname(b.dest), { recursive: true });
    fs.writeFileSync(b.dest, buf);
    repaired++;
    console.log(`  REPAIRED ${b.p} (${buf.length}b)`);
  } catch (e) {
    console.log(`  ERROR ${b.p}: ${e}`);
  }
}
console.log(`\nRepaired ${repaired}/${bad.length}.`);
