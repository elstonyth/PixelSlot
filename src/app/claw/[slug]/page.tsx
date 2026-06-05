import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_PACKS, findPack, findCategory } from "../packs-data";
import PackDetailClient from "./PackDetailClient";

// Prerender one page per pack slug.
export function generateStaticParams() {
  return ALL_PACKS.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = findPack(slug);
  return {
    title: pack ? `${pack.name} — ${pack.categoryName} | Pokenic` : "Pack | Pokenic",
  };
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pack = findPack(slug);
  const category = findCategory(slug);
  if (!pack || !category) notFound();
  return <PackDetailClient pack={pack} siblings={category.packs} />;
}
