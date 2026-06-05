import type { Metadata } from "next";
import MarketplaceClient from "./MarketplaceClient";

export const metadata: Metadata = {
  title: "Marketplace — Phygitals",
  description:
    "Buy and sell real graded cards with other collectors. Real cards, real ownership, instant transfers.",
};

export default function MarketplacePage() {
  return <MarketplaceClient />;
}
