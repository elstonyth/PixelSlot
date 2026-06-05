import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { AccountHeader, Badge, DemoNote } from "@/components/account/ui";

export const metadata: Metadata = { title: "Vouchers | Pokenic" };

const VOUCHERS = [
  { code: "WELCOME10", value: "$10 off", note: "First pack", state: "active" },
  { code: "FREESHIP", value: "Free shipping", note: "Any redemption", state: "active" },
  { code: "RIPDAY25", value: "$25 credit", note: "Expired", state: "used" },
  { code: "VAULT5", value: "5% buyback boost", note: "Legend packs", state: "active" },
];

export default function VouchersPage() {
  return (
    <>
      <AccountHeader title="Vouchers" sub="Credits and perks on your account." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VOUCHERS.map((v) => (
          <div key={v.code} className={`flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${v.state === "used" ? "opacity-55" : ""}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/15 to-white/5 text-white">
              <Ticket className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-heading text-base font-bold text-white">{v.value}</span>
                <Badge tone={v.state === "active" ? "green" : "neutral"}>{v.state === "active" ? "Active" : "Used"}</Badge>
              </div>
              <p className="text-[12px] text-white/50">{v.note}</p>
            </div>
            <code className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-medium text-white/80">{v.code}</code>
          </div>
        ))}
      </div>
      <DemoNote />
    </>
  );
}
