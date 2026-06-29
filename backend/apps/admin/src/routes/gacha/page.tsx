import { Navigate } from "react-router-dom";
import { Sparkles } from "@medusajs/icons";
import type { RouteConfig } from "@mercurjs/dashboard-sdk";

// Nav-only parent for the Gacha section (Cards, Packs, Pull Ledger, Reward
// Pools). ponytail: redirect to the first child instead of a bespoke landing
// page — the section's value is the grouped sidebar, not this route.
export const config: RouteConfig = {
  label: "Gacha",
  icon: Sparkles,
  rank: 10,
};

const GachaSection = () => <Navigate to="/cards" replace />;

export default GachaSection;
