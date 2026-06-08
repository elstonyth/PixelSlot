// Stop hook — the enforced "builds green" gate (Audit fix 1).
//
// `medusa develop`/`medusa exec`/`next dev` are SWC transpile-only and DO NOT
// type-check, so a red build can survive an entire session unseen (it did once).
// On stop, type-check BOTH projects; if either has real type errors, block once
// (exit 2) and surface them so they get fixed before the session ends.
//
// Loop-safe: if the stop is already a continuation of a prior stop-hook block
// (`stop_hook_active`), let it through — one firm nudge, never an unfixable trap.
const { runTsc, errorLines } = require("./_tslib.js");

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
  const failed = results.filter((r) => r.status === "fail");
  if (failed.length === 0) process.exit(0); // green (skips/timeouts don't block)

  const blocks = failed
    .map((r) => {
      const errs = errorLines(r.output).map((e) => "    " + e);
      return `• ${r.label} typecheck FAILED:\n${errs.join("\n")}`;
    })
    .join("\n\n");
  console.error(
    `[stop-verify] Type errors are present — fix before finishing ` +
      `(dev servers don't type-check, so probes can't catch these):\n\n${blocks}\n\n` +
      `Run: npm run typecheck  ·  (backend) corepack yarn build`,
  );
  process.exit(2); // block this stop so the errors get addressed
});
