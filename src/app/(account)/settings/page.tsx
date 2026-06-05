import type { Metadata } from "next";
import { AccountHeader, Panel, DemoNote } from "@/components/account/ui";

export const metadata: Metadata = { title: "Settings | Pokenic" };

const Field = ({ label, defaultValue, type = "text" }: { label: string; defaultValue?: string; type?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-[12px] font-medium text-white/55">{label}</span>
    <input
      type={type}
      defaultValue={defaultValue}
      className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/40 focus:border-white/25 focus:outline-none"
    />
  </label>
);

const TOGGLES = ["Email notifications", "Pull alerts", "Marketplace activity", "Two-factor authentication"];

export default function SettingsPage() {
  return (
    <>
      <AccountHeader title="Settings" sub="Manage your profile, security, and notifications." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 font-heading text-lg font-bold text-white">Profile</h2>
          <div className="flex flex-col gap-4">
            <Field label="Display name" defaultValue="FightingProdigy3098" />
            <Field label="Email" type="email" defaultValue="collector@pokenic.com" />
            <Field label="Bio" defaultValue="Chasing grails one pack at a time." />
            <button type="button" className="self-start rounded-xl bg-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white">
              Save changes
            </button>
          </div>
        </Panel>
        <Panel>
          <h2 className="mb-4 font-heading text-lg font-bold text-white">Notifications &amp; security</h2>
          <ul className="flex flex-col divide-y divide-white/5">
            {TOGGLES.map((t, i) => (
              <li key={t} className="flex items-center justify-between py-3">
                <span className="text-sm text-white/80">{t}</span>
                <span className={`flex h-6 w-11 items-center rounded-full p-0.5 ${i % 2 === 0 ? "justify-end bg-emerald-500/80" : "justify-start bg-white/15"}`}>
                  <span className="h-5 w-5 rounded-full bg-white" />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <DemoNote />
    </>
  );
}
