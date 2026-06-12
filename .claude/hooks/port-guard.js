/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node hook script */
// PreToolUse(Bash) hook — block ad-hoc servers on PM2-owned ports.
//
// The PM2 preview stack owns :4000 (pokenic-store), :4100 (pokenic-store-dev),
// :9000 (pokenic-backend), :7000 (pokenic-admin), :7001 (vendor) — see
// CLAUDE.md "PM2 services". Starting a second server on one of those ports has
// caused hours of port/cache confusion ("still broken" against the wrong
// process). Restart the PM2 app instead of binding the port directly.
//
// Blocks only when BOTH appear in one command: a server-launch keyword AND one
// of the owned ports (via -p/--port flag or PORT= env). Everything else passes.
const OWNED_PORTS = "(4000|4100|7000|7001|9000)";

const SERVERISH =
  /\b(next\s+(start|dev)|medusa\s+(develop|start)|vite(\s+(preview|dev))?|http-server|serve|(npm|yarn|pnpm)\s+(run\s+)?(start|dev|preview)\b)/;
const PORT_FLAG = new RegExp(`(?:-p|--port)[=\\s]+${OWNED_PORTS}\\b`);
const PORT_ENV = new RegExp(`\\bPORT\\s*=\\s*${OWNED_PORTS}\\b`);

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = JSON.parse(input || "{}").tool_input?.command ?? "";
  } catch {}
  if (SERVERISH.test(cmd) && (PORT_FLAG.test(cmd) || PORT_ENV.test(cmd))) {
    console.error(
      "[port-guard] BLOCKED: that port belongs to the PM2 preview stack " +
        "(:4000 store / :4100 store-dev / :9000 backend / :7000 admin / :7001 vendor). " +
        "Use `pm2 restart pokenic-store|pokenic-store-dev|pokenic-backend|pokenic-admin` " +
        "(after `npm run build` for the store) instead of starting an ad-hoc server.",
    );
    process.exit(2);
  }
  process.exit(0);
});
