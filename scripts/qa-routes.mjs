// Single source of truth for the public routes the QA gates scan.
//
// This list used to be duplicated in qa-csp.mjs and qa-a11y.mjs. When /claw was
// retired (2026-07-12) only one copy was updated, so qa-csp 404'd on its second
// route and exited 1 on every run for weeks — the gate looked "red as usual"
// instead of "broken". One list, both gates.
export const QA_ROUTES = ['/', '/leaderboard', '/how-it-works', '/about'];
