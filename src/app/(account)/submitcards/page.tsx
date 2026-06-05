import type { Metadata } from "next";
import { Send, ShieldCheck, Thermometer, Truck } from "lucide-react";
import { AccountHeader, Panel, DemoNote } from "@/components/account/ui";

export const metadata: Metadata = { title: "Submit Cards | Pokenic" };

const STEPS = [
  { icon: Send, title: "Register your cards", body: "Tell us what you're sending in." },
  { icon: ShieldCheck, title: "Ship to the vault", body: "We provide a prepaid, insured label." },
  { icon: Thermometer, title: "Stored & tokenized", body: "Climate-controlled, insured, tradeable." },
  { icon: Truck, title: "Trade or redeem", body: "Sell instantly or ship back anytime." },
];

const Field = ({ label, ph }: { label: string; ph: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-[12px] font-medium text-white/55">{label}</span>
    <input placeholder={ph} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/40 focus:border-white/25 focus:outline-none" />
  </label>
);

export default function SubmitCardsPage() {
  return (
    <>
      <AccountHeader title="Submit Cards" sub="Send in your graded cards to vault, trade, and sell." />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-white/40">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white">{i + 1}</span>
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">{s.body}</p>
            </div>
          );
        })}
      </div>
      <Panel className="max-w-xl">
        <h2 className="mb-4 font-heading text-lg font-bold text-white">Register a submission</h2>
        <div className="flex flex-col gap-4">
          <Field label="Card name" ph="2023 151 Charizard ex" />
          <Field label="Grader & grade" ph="PSA 10" />
          <Field label="Cert number" ph="12345678" />
          <button type="button" className="self-start rounded-xl bg-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white">Add to submission</button>
        </div>
      </Panel>
      <DemoNote />
    </>
  );
}
