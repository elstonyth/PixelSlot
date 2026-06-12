/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node hook script */
// Stop hook â€” the enforced "builds green" gate (Audit fix 1).
//
// `medusa develop`/`medusa exec`/`next dev` are SWC transpile-only and DO NOT
// type-check, so a red build can survive an entire session unseen (it did once).
// On stop, type-check BOTH projects; if either has real type errors, block once
// (exit 2) and surface them so they get fixed before the session ends.
//
// Loop-safe: if the stop is already a continuation of a prior stop-hook block
// (`stop_hook_active`), let it through â€” one firm nudge, never an unfixable trap.
//
// Also runs the storefront vitest suite (src/**/*.test.ts — fast unit tests
// only, per vitest.config.ts). Backend jest suites are integration tests that
// boot Medusa + Postgres; far too slow for a stop gate, so they stay
// operator-invoked (`corepack yarn test:unit` / `test:integration:http`).
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { runTsc, errorLines } = require("./_tslib.js");

const REPO = path.resolve(__dirname, "..", "..");

// status mirrors runTsc: "pass" | "fail" | "timeout" | "skip"
function runVitest({ timeoutMs = 90000 } = {}) {
  const label = "storefront vitest";
  const bin = path.join(REPO, "node_modules", "vitest", "vitest.mjs");
  if (!fs.existsSync(bin)) return { status: "skip", label, output: "" };
  const res = spawnSync(process.execPath, [bin, "run", "--reporter=dot"], {
    cwd: REPO,
    timeout: timeoutMs,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (res.status === 0) return { status: "pass", label, output: "" };
  if (res.signal || res.error) return { status: "timeout", label, output: "" };
  const output = ((res.stdout || "") + (res.stderr || "")).trim();
  return { status: "fail", label, output };
}

function vitestFailLines(output, max = 12) {
  const interesting = output
    .split(/\r?\n/)
    .filter((l) =>
      /(FAIL|AssertionError|Test Files|Tests {2}|expected .* to)/.test(l),
    )
    .map((l) => l.trim())
    .filter(Boolean);
  if (interesting.length > 0) return interesting.slice(0, max);
  return output.split(/\r?\n/).slice(-6); // fallback: tail of the report
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input || "{}");
  } catch {}
  if (data.stop_hook_active) process.exit(0);

  const results = [
    runTsc("storefront", { timeoutMs: 120000 }),
    runTsc("backend", { timeoutMs: 150000 }),
  ];
  const vitest = runVitest({ timeoutMs: 90000 });
  const failed = results.filter((r) => r.status === "fail");
  if (failed.length === 0 && vitest.status !== "fail") {
    process.exit(0); // green (skips/timeouts don't block)
  }

  const blocks = failed
    .map((r) => {
      const errs = errorLines(r.output).map((e) => "    " + e);
      return `â€¢ ${r.label} typecheck FAILED:\n${errs.join("\n")}`;
    })
    .concat(
      vitest.status === "fail"
        ? [
            `â€¢ ${vitest.label} FAILED:\n` +
              vitestFailLines(vitest.output)
                .map((l) => "    " + l)
                .join("\n"),
          ]
        : [],
    )
    .join("\n\n");
  console.error(
    `[stop-verify] Verification failed â€” fix before finishing ` +
      `(dev servers don't type-check or run tests, so probes can't catch these):\n\n${blocks}\n\n` +
      `Run: npm run typecheck  Â·  npm test  Â·  (backend) corepack yarn build`,
  );
  process.exit(2); // block this stop so the errors get addressed
});
