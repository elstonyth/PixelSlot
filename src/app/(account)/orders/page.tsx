import type { Metadata } from 'next';
import Link from 'next/link';
import { Package } from 'lucide-react';
import {
  AccountHeader,
  MockTable,
  Badge,
  Panel,
} from '@/components/account/ui';
import {
  getDeliveryOrders,
  type DeliveryOrderView,
} from '@/lib/actions/delivery';
import { features } from '@/lib/features';

export const metadata: Metadata = { title: 'Orders | Pokenic' };

// Per-customer data behind the auth gate — always rendered fresh.
export const dynamic = 'force-dynamic';

type Tone = 'green' | 'sky' | 'amber' | 'neutral';

// Map delivery-order status → badge tone.
const STATUS_TONE: Record<DeliveryOrderView['status'], Tone> = {
  requested: 'amber',
  packing: 'amber',
  shipped: 'sky',
  delivered: 'green',
  canceled: 'neutral',
};

const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const orderDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

function DeliveryItems({ items }: { items: DeliveryOrderView['items'] }) {
  const first = items[0];
  const extra = items.length - 1;
  return (
    <span className="flex items-center gap-2">
      {first?.card?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={first.card.image}
          alt=""
          width={24}
          height={32}
          className="h-8 w-6 shrink-0 rounded object-contain"
        />
      )}
      <span className="max-w-[220px] truncate">{first?.card?.name ?? '—'}</span>
      {extra > 0 && <span className="text-white/45">+{extra} more</span>}
    </span>
  );
}

function EmptyState() {
  return (
    <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Package className="h-6 w-6 text-white/50" aria-hidden />
      </span>
      <h2 className="font-heading text-lg font-bold text-white">
        No orders yet
      </h2>
      <p className="max-w-sm text-sm text-white/50">
        Request delivery of a vaulted card and your shipments will show up here.
      </p>
      <Link
        href={features.marketplace ? '/marketplace' : '/claw'}
        className="mt-1 inline-flex h-10 items-center rounded-xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white"
      >
        {features.marketplace ? 'Browse the marketplace' : 'Open a pack'}
      </Link>
    </Panel>
  );
}

export default async function OrdersPage() {
  const res = await getDeliveryOrders();
  const orders = res.ok ? res.orders : [];

  if (orders.length === 0) {
    return (
      <>
        <AccountHeader
          title="Orders"
          sub="Your delivery requests and shipments."
        />
        <EmptyState />
      </>
    );
  }

  const rows = orders.map((o) => [
    <span key="o" className="font-mono text-[12px] text-white/60">
      #{o.id.slice(-6)}
    </span>,
    <DeliveryItems key="i" items={o.items} />,
    orderDate(o.createdAt),
    o.trackingNumber ? (
      <span key="t" className="font-mono text-[12px] text-white/70">
        {o.trackingNumber}
      </span>
    ) : (
      <span key="t" className="text-white/35">
        —
      </span>
    ),
    <Badge key="s" tone={STATUS_TONE[o.status] ?? 'neutral'}>
      {humanize(o.status)}
    </Badge>,
  ]);

  return (
    <>
      <AccountHeader
        title="Orders"
        sub="Your delivery requests and shipments."
      />
      <MockTable
        head={['Order', 'Cards', 'Requested', 'Tracking', 'Status']}
        rows={rows}
      />
    </>
  );
}
