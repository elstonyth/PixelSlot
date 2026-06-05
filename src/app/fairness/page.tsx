import type { Metadata } from "next";
import { ShieldCheck, Check } from "lucide-react";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Fairness Proofs — Pokenic",
  description: "Verify the provably-fair selection proofs for your pulls.",
};

// Deterministic hex strings for display (not cryptographic — demo only).
function hex(seed: number, len: number): string {
  let s = "";
  let x = (seed * 2654435761) >>> 0;
  while (s.length < len) {
    x = (x * 1103515245 + 12345) >>> 0;
    s += x.toString(16).padStart(8, "0");
  }
  return s.slice(0, len);
}

const PROOFS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  serverSeedHash: hex(i * 7 + 3, 64),
  serverSeed: hex(i * 13 + 11, 64),
  clientSeed: hex(i * 5 + 9, 16),
  pick: 1 + ((i * 37) % 240),
  time: `${(i + 1) * 3}h ago`,
}));

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <span className="w-32 shrink-0 text-[11px] uppercase tracking-wide text-white/40">{label}</span>
      <code className="break-all font-mono text-[11px] text-white/70">{value}</code>
    </div>
  );
}

export default function FairnessPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-fluid py-6">
      <Reveal as="header" className="mb-6">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Fairness Proofs</h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
          This page shows your last 100 selection proofs. Each proof contains a{" "}
          <span className="text-white/80">serverSeedHash</span> (commitment), the revealed{" "}
          <span className="text-white/80">serverSeed</span>, your <span className="text-white/80">clientSeed</span>,
          and deterministic selection details. Anyone can verify reproducibility using the seeds and the sorting rule.
        </p>
      </Reveal>

      <ul className="flex flex-col gap-3">
        {PROOFS.map((p, i) => (
          <Reveal as="li" key={p.id} delay={Math.min(i, 8) * 40}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  Proof #{p.id}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <Check className="h-3 w-3" aria-hidden /> Verified
                  </span>
                </span>
                <span className="text-[11px] text-white/35">{p.time}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Row label="serverSeedHash" value={p.serverSeedHash} />
                <Row label="serverSeed" value={p.serverSeed} />
                <Row label="clientSeed" value={p.clientSeed} />
                <Row label="selection" value={`index #${p.pick} (sorted by HMAC-SHA256(serverSeed, clientSeed))`} />
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
      <p className="mt-4 text-center text-[11px] text-white/35">Demo proofs — live commit-reveal verification connects to the backend.</p>
    </div>
  );
}
