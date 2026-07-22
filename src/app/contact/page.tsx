import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Reveal from '@/components/Reveal';
import { pillVariants } from '@/components/ui/pill';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How can we help? Our team typically responds within a day.',
};

// Prefilled subjects so a message lands as a sortable thread instead of a
// blank "hi" — pure mailto, no form backend to build or maintain.
const TOPICS = [
  { label: 'Order or payment issue', subject: 'Order issue' },
  { label: 'Shipping a card home', subject: 'Shipping request' },
  { label: 'Selling back / buyback', subject: 'Buyback question' },
  { label: 'Partnerships & brands', subject: 'Partnership' },
] as const;

const CHANNELS = [
  {
    label: 'Email',
    handle: 'hello@polycards.com',
    href: 'mailto:hello@polycards.com',
    external: false,
  },
  {
    label: 'Telegram',
    handle: '@polycardsgg',
    href: 'https://t.me/polycardsgg',
    external: true,
  },
  {
    label: 'Instagram',
    handle: '@polycards.gg',
    href: 'https://www.instagram.com/polycards.gg',
    external: true,
  },
  {
    label: 'Facebook',
    handle: 'polycards.gg',
    href: 'https://www.facebook.com/polycards.gg/',
    external: true,
  },
] as const;

export default function ContactPage() {
  return (
    <div className="px-fluid mx-auto w-full max-w-5xl py-4">
      {/* 01 — hero lockup */}
      <section
        aria-labelledby="contact-heading"
        className="flex flex-col items-center py-14 text-center sm:py-16"
      >
        <Reveal
          as="p"
          className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400"
        >
          Replies within a day
        </Reveal>
        <Reveal delay={60}>
          <h1
            id="contact-heading"
            className="font-heading mt-4 text-5xl leading-[0.95] text-white lg:text-6xl"
          >
            HOW CAN
            <br />
            WE HELP?
          </h1>
        </Reveal>
        <Reveal delay={140} className="mt-8">
          <a
            href="mailto:hello@polycards.com"
            className={cn(pillVariants({ variant: 'primary', size: 'lg' }))}
          >
            Start a conversation
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </Reveal>
      </section>

      {/* 02 — channels */}
      <section aria-labelledby="channels-heading" className="w-full">
        <h2 id="channels-heading" className="font-heading text-2xl text-white">
          REACH US
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHANNELS.map((c, i) => (
            <Reveal key={c.label} delay={i * 60} className="h-full">
              <a
                href={c.href}
                {...(c.external && {
                  target: '_blank',
                  rel: 'noopener noreferrer',
                })}
                className="group flex h-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 transition-colors hover:border-white/20"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {c.label}
                  </p>
                  <p className="font-heading mt-1 text-base text-white">
                    {c.handle}
                  </p>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-neutral-500 transition-colors group-hover:text-white"
                  aria-hidden
                />
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 03 — topic picker + FAQ */}
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <Reveal className="h-full">
          <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="font-heading text-lg leading-snug text-white">
              CUT TO THE CHASE
            </h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              Pick a topic and your message lands in the right thread
            </p>
            <ul className="mt-2 divide-y divide-white/10">
              {TOPICS.map((t) => (
                <li key={t.subject}>
                  <a
                    href={`mailto:hello@polycards.com?subject=${encodeURIComponent(t.subject)}`}
                    className="group flex min-h-11 items-center justify-between gap-3 py-3 text-[13px] font-semibold text-white transition-colors hover:text-neutral-300"
                  >
                    {t.label}
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 text-neutral-500 transition-colors group-hover:text-white"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={90} className="h-full">
          {/* justify-center like TheGame's teaser card — this card is shorter
              than the topic list beside it. */}
          <div className="flex h-full flex-col justify-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-5">
            <div>
              <h2 className="font-heading text-lg leading-snug text-white">
                FAQ
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                Shipping, storage, buyback, and how pulls are decided.
              </p>
            </div>
            {/* One link that actually resolves. The six question shortcuts that
                used to live here all pointed at /how-it-works and none of them
                was answered there. */}
            <Link
              href="/how-it-works#faq"
              className="flex min-h-11 w-fit items-center gap-1 text-[13px] font-semibold text-neutral-400 transition-colors hover:text-white"
            >
              Read the full FAQ
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
