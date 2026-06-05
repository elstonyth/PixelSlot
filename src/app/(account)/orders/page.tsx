import type { Metadata } from "next";
import { AccountHeader, MockTable, Badge, DemoNote } from "@/components/account/ui";
import { MOCK_CARDS } from "@/lib/mock/cards";
import { usd } from "@/lib/format";

export const metadata: Metadata = { title: "Orders | Pokenic" };

const STATUS = [
  ["Delivered", "green"], ["In transit", "sky"], ["Processing", "amber"],
  ["Delivered", "green"], ["Vaulted", "neutral"],
] as const;

export default function OrdersPage() {
  const rows = MOCK_CARDS.slice(0, 8).map((c, i) => [
    <span key="o" className="font-mono text-[12px] text-white/60">#PKN{1042 + i}</span>,
    <span key="i" className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="h-8 w-6 shrink-0 rounded object-contain" />
      <span className="max-w-[220px] truncate">{c.name}</span>
    </span>,
    `2026-0${(i % 6) + 1}-1${i % 9}`,
    usd(c.price),
    <Badge key="s" tone={STATUS[i % STATUS.length][1]}>{STATUS[i % STATUS.length][0]}</Badge>,
  ]);
  return (
    <>
      <AccountHeader title="Orders" sub="Your purchases, shipments, and vaulted items." />
      <MockTable head={["Order", "Item", "Date", "Total", "Status"]} rows={rows} />
      <DemoNote />
    </>
  );
}
