import type { Metadata } from "next";
import { MOCK_CARDS, cardOrGeneric } from "@/lib/mock/cards";
import CardDetailClient from "./CardDetailClient";

// Prerender the mock pool; any other slug renders on demand (cardOrGeneric resolves it),
// so every /card/<id> link across the site works.
export function generateStaticParams() {
  return MOCK_CARDS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = cardOrGeneric(decodeURIComponent(id));
  return { title: `${card.name} | Pokenic`, description: `${card.set} · ${card.grader} ${card.grade}` };
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = cardOrGeneric(decodeURIComponent(id));
  return <CardDetailClient card={card} />;
}
