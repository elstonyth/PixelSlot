/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node hook script */
// Shared typecheck runner for the Claude Code hooks.
//
// Runs `tsc --noEmit` for a project with a node-enforced timeout (Windows lacks
// a reliable `timeout` in the hook shell, and an unbounded tsc would orphan /
// pile up â€” see .claude/rules/web/hooks.md). Incremental + a dedicated
// tsBuildInfo cache keep re-runs to ~1-3s. Never throws.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const REPO = path.resolve(__dirname, "..", "..");

const PROJECTS = {
  storefront: {
    label: "storefront",
    cwd: REPO,
    tsc: path.join(REPO, "node_modules", "typescript", "bin", "tsc"),
    tsconfig: path.join(REPO, "tsconfig.json"),
    cache: path.join(REPO, "node_modules", ".cache", "tsc-hook.tsbuildinfo"),
  },
  backend: {
    label: "backend/packages/api",
    cwd: path.join(REPO, "backend", "packages", "api"),
    tsc: path.join(REPO, "backend", "node_modules", "typescript", "bin", "tsc"),
    tsconfig: path.join(REPO, "backend", "packages", "api", "tsconfig.json"),
    cache: path.join(
      REPO,
      "backend",
      "packages",
      "api",
      "node_modules",
      ".cache",
      "tsc-hook.tsbuildinfo",
    ),
  },
};

// status: "pass" | "fail" | "timeout" | "skip"
function runTsc(key, { incremental = true, timeoutMs = 90000 } = {}) {
  const p = PROJECTS[key];
  if (!p || !fs.existsSync(p.tsc) || !fs.existsSync(p.tsconfig)) {
    return { status: "skip", label: p ? p.label : key, output: "" };
  }
  const args = [p.tsc, "--noEmit", "--pretty", "false", "-p", p.tsconfig];
  if (incremental) {
    try {
      fs.mkdirSync(path.dirname(p.cache), { recursive: true });
    } catch {}
    args.push("--incremental", "--tsBuildInfoFile", p.cache);
  }
  const res = spawnSync(process.execPath, args, {
    cwd: p.cwd,
    timeout: timeoutMs,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    // Without this, every spawned tsc flashes a visible console window on
    // Windows (the hook fires after each .ts edit — constant pop-ups).
    windowsHide: true,
  });
  if (res.status === 0) return { status: "pass", label: p.label, output: "" };
  // spawnSync sets `signal` when it kills the child on timeout; `error` on a
  // spawn failure. Either is inconclusive â€” never block on those.
  if (res.signal || res.error) {
    return { status: "timeout", label: p.label, output: "" };
  }
  const output = ((res.stdout || "") + (res.stderr || "")).trim();
  return { status: "fail", label: p.label, output };
}

function errorLines(output, max = 8) {
  return output
    .split(/\r?\n/)
    .filter((l) => /error TS\d+/.test(l))
    .slice(0, max);
}

module.exports = { runTsc, errorLines, PROJECTS };
