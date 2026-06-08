// PostToolUse (Edit|Write) hook — fast type-error feedback at edit time (Audit
// fix 2). Advisory only: it injects a warning into context, NEVER blocks the
// edit. Path-aware (type-checks just the touched project) + incremental, with a
// node-enforced timeout so tsc can't pile up on Windows.
//
// Note: mid multi-file refactor, intermediate states can report transient errors
// that resolve once all files are edited — that's expected for an advisory check.
const { runTsc, errorLines } = require("./_tslib.js");

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input || "{}");
  } catch {
    process.exit(0);
  }
  const ti = data.tool_input || {};
  const file = ti.file_path || ti.path || "";
  // Only TS sources — skip declarations, generated, and dependency paths.
  if (!/\.(ts|tsx)$/.test(file)) process.exit(0);
  const norm = file.replace(/\\/g, "/");
  if (/\.d\.ts$|\/node_modules\/|\/\.medusa\/|\/\.mercur\//.test(norm)) {
    process.exit(0);
  }

  const key = norm.includes("/backend/") ? "backend" : "storefront";
  const res = runTsc(key, { incremental: true, timeoutMs: 60000 });
  if (res.status !== "fail") process.exit(0); // pass/timeout/skip -> stay quiet

  const errs = errorLines(res.output, 6);
  if (errs.length === 0) process.exit(0);
  const ctx =
    `tsc (${res.label}) reports type error(s) after this edit — ` +
    `fix before relying on the change (dev servers don't type-check):\n` +
    errs.join("\n");
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: ctx,
      },
    }),
  );
  process.exit(0); // advisory — never block edits
});
