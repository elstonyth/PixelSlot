import type { Metadata } from "next";
import { AccountHeader, StatCards, MockTable, Badge, DemoNote } from "@/components/account/ui";
import { MOCK_CARDS } from "@/lib/mock/cards";
import { usd } from "@/lib/format";

export const metadata: Metadata = { title: "Borrow / Lend | Pokenic" };

export default function BorrowLendPage() {
  const rows = MOCK_CARDS.slice(0, 5).map((c, i) => [
    <span key="c" className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="h-8 w-6 shrink-0 rounded object-contain" />
      <span className="max-w-[200px] truncate">{c.name}</span>
    </span>,
    usd(c.fmv),
    usd(Math.round(c.fmv * 0.6)),
    `${8 + i}% APR`,
    <Badge key="s" tone={i % 2 === 0 ? "green" : "amber"}>{i % 2 === 0 ? "Active" : "Offered"}</Badge>,
  ]);
  return (
    <>
      <AccountHeader title="Borrow / Lend" sub="Borrow against your vaulted cards, or lend for yield." />
      <StatCards
        items={[
          { label: "Collateral value", value: usd(4820) },
          { label: "Borrowed", value: usd(1500) },
          { label: "Available to borrow", value: usd(1392) },
          { label: "Lending yield", value: usd(86.4), sub: "this month" },
        ]}
      />
      <div className="mt-5">
        <MockTable head={["Card", "FMV", "Max loan", "Rate", "Status"]} rows={rows} />
      </div>
      <DemoNote />
    </>
  );
}
