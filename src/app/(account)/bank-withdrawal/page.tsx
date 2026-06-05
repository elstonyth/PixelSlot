import type { Metadata } from "next";
import { AccountHeader, Panel, MockTable, Badge, DemoNote } from "@/components/account/ui";
import { usd } from "@/lib/format";

export const metadata: Metadata = { title: "Withdraw | Pokenic" };

const Field = ({ label, ph, defaultValue }: { label: string; ph?: string; defaultValue?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-[12px] font-medium text-white/55">{label}</span>
    <input placeholder={ph} defaultValue={defaultValue} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/40 focus:border-white/25 focus:outline-none" />
  </label>
);

export default function BankWithdrawalPage() {
  const rows = [
    ["2026-06-01", usd(500), "Chase ••4821", <Badge key="a" tone="green">Completed</Badge>],
    ["2026-05-22", usd(1200), "Chase ••4821", <Badge key="b" tone="green">Completed</Badge>],
    ["2026-05-10", usd(300), "Chase ••4821", <Badge key="c" tone="amber">Pending</Badge>],
  ];
  return (
    <>
      <AccountHeader title="Withdraw to bank" sub="Cash out your available balance." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Panel>
          <p className="text-[12px] uppercase tracking-wide text-white/40">Available balance</p>
          <p className="mt-1 font-heading text-3xl font-bold text-white">{usd(1284.5)}</p>
          <div className="mt-5 flex flex-col gap-4">
            <Field label="Amount" ph="$0.00" />
            <Field label="Bank account" defaultValue="Chase ••4821" />
            <button type="button" className="rounded-xl bg-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white">Request withdrawal</button>
          </div>
        </Panel>
        <div>
          <h2 className="mb-3 font-heading text-lg font-bold text-white">Recent withdrawals</h2>
          <MockTable head={["Date", "Amount", "Destination", "Status"]} rows={rows} />
        </div>
      </div>
      <DemoNote />
    </>
  );
}
